/** Recoverable write-ahead journal for the existing normalized storage schema.
 * Once the journal write succeeds, reads use its intended values even if a
 * later record write fails. No old records are touched before that boundary.
 */
import {v4 as uuid} from '@lukeed/uuid';
import {clearEditorDraft, exportEditorDrafts} from './editor-drafts';

const legacyJournalKey = 'twine-studio-pending-transaction';
const journalSessionKey = 'twine-studio-journal-owner';
const journalHistorySessionKey = 'twine-studio-journal-history';
const journalOwner = uuid();
let previousOwners: string[] = [];
let journalHistoryAvailable = true;
try {
	const saved = window.sessionStorage.getItem(journalHistorySessionKey);
	const history = saved ? JSON.parse(saved) : [];
	const prior = window.sessionStorage.getItem(journalSessionKey);
	previousOwners = [...new Set([
		...(Array.isArray(history) ? history : []),
		prior
	].filter((owner): owner is string =>
		typeof owner === 'string' && /^[a-zA-Z0-9-]{1,64}$/.test(owner)
	))];
} catch {
	journalHistoryAvailable = false;
}
try {
	window.sessionStorage.setItem(journalSessionKey, journalOwner);
	window.sessionStorage.setItem(journalHistorySessionKey, JSON.stringify(previousOwners));
} catch {
	journalHistoryAvailable = false;
}
const previousJournalKeys = previousOwners.map(owner => `${legacyJournalKey}-${owner}`);
export const journalKey = `${legacyJournalKey}-${journalOwner}`;
const commitLockName = 'twine-studio-storage-commit';
const commitLockWaitMs = 15000;

function requestCommitLock(callback: () => void) {
	const controller = new AbortController();
	const timeout = window.setTimeout(() => controller.abort(), commitLockWaitMs);
	try {
		return navigator.locks.request(commitLockName, {signal: controller.signal}, callback)
			.catch(cause => {
				if (controller.signal.aborted)
					throw new Error('Timed out waiting for another tab to finish saving. Retry when it is responsive.');
				throw cause;
			})
			.finally(() => window.clearTimeout(timeout));
	} catch (cause) {
		window.clearTimeout(timeout);
		throw cause;
	}
}

function inheritedJournalKeys() {
	if (journalHistoryAvailable) return previousJournalKeys;
	// Session storage can be blocked or full while local storage still holds a
	// durable journal. Discover those bytes rather than orphaning them on reload.
	const keys: string[] = [];
	for (let i = 0; i < window.localStorage.length; i++) {
		const key = window.localStorage.key(i)!;
		if (key.startsWith(`${legacyJournalKey}-`) && key !== journalKey)
			keys.push(key);
	}
	return keys;
}

function unownedJournalKeys() {
	if (!journalHistoryAvailable) return [];
	const known = new Set([journalKey, ...previousJournalKeys]);
	const keys: string[] = [];
	for (let i = 0; i < window.localStorage.length; i++) {
		const key = window.localStorage.key(i)!;
		if (key.startsWith(`${legacyJournalKey}-`) && !known.has(key))
			keys.push(key);
	}
	return keys.sort();
}

/** Adopt abandoned page journals only after earlier tab commits release the lock. */
export async function recoverUnownedJournals() {
	if (!journalHistoryAvailable) return;
	if (!navigator.locks?.request) {
		if (unownedJournalKeys().length)
			throw new Error(
				'A recovery journal from another or closed tab needs attention. Export recovery data before changing browser storage.'
			);
		return;
	}
	await requestCommitLock(() => {
		const keys = unownedJournalKeys();
		if (!keys.length) return;
		if ([legacyJournalKey, journalKey, ...previousJournalKeys]
			.some(key => window.localStorage.getItem(key) !== null))
			throw new Error(
				'Multiple recovery journals need review. Export recovery data before changing browser storage.'
			);
		const changes: Changes = new Map();
		const journalSnapshots = new Map<string, string | null>();
		for (const key of keys)
			for (const [changedKey, value] of readJournal(key, journalSnapshots)) {
				if (changes.has(changedKey) && changes.get(changedKey) !== value)
					throw new Error(
						'Conflicting recovery journals need review. Export recovery data before changing browser storage.'
					);
				changes.set(changedKey, value);
			}
		if (!changes.size) {
			for (const [key, snapshot] of journalSnapshots)
				if (window.localStorage.getItem(key) === snapshot)
					window.localStorage.removeItem(key);
			if (unownedJournalKeys().length)
				throw new Error(
					'A recovery journal changed during replay. Export recovery data before changing browser storage.'
				);
			return;
		}
		pending = changes;
		flushStorageChangesUnderLock(keys, journalSnapshots);
		if (unownedJournalKeys().length)
			throw new Error(
				'A recovery journal changed during replay. Export recovery data before changing browser storage.'
			);
	});
}
const eventName = 'twine-studio-storage-status';
type Changes = Map<string, string | null>;
let pending: Changes = new Map();
let staging: Changes | undefined;
let error = '';
let durable = false;
let notificationPending = false;
let storyGuardActive = false;
let storyConflict = false;
let recoveredDraftConflict = false;
const conflictingDraftIds = new Set<string>();
const orphanDraftIds = new Set<string>();
const unreadableStoryRecords = new Set<string>();
let observedJournal: string | null = null;
const observedInheritedJournals = new Map<string, string | null>();
const observedStories = new Map<string, string | null>();
let lockRequestPending = false;
const conflictMessage =
	'Another tab changed saved stories. This tab cannot safely save over that version.';
const unreadableMessage =
	'Some saved stories or passages could not be opened. Export recovery data before repairing storage.';

function isStoryKey(key: string) {
	return /^twine-studio-(stories|passages)(-|$)/.test(key);
}

function markStoryConflict() {
	storyConflict = true;
	durable = false;
	error = conflictMessage;
	notify();
}

/** Track the version loaded by this editor, without treating its own writes as external. */
export function startStoryStorageGuard() {
	storyGuardActive = true;
	observedStories.clear();
	observedInheritedJournals.clear();
	for (const key of inheritedJournalKeys())
		observedInheritedJournals.set(key, window.localStorage.getItem(key));
	for (let i = 0; i < window.localStorage.length; i++) {
		const key = window.localStorage.key(i)!;
		if (isStoryKey(key))
			observedStories.set(key, window.localStorage.getItem(key));
	}
	observedJournal = window.localStorage.getItem(journalKey);
	return () => {
		storyGuardActive = false;
	};
}

function checkStoryStorageGuard(changes: Changes) {
	if (!storyGuardActive) return;
	if (unreadableStoryRecords.size && [...changes.keys()].some(isStoryKey)) {
		pending = new Map([...pending, ...changes]);
		durable = false;
		error = unreadableMessage;
		notify();
		throw new Error(unreadableMessage);
	}
	const currentJournal = window.localStorage.getItem(journalKey);
	if (currentJournal !== observedJournal)
		markStoryConflict();
	for (const [key, observed] of observedInheritedJournals)
		if (window.localStorage.getItem(key) !== observed)
			markStoryConflict();
	for (const key of changes.keys()) {
		if (
			isStoryKey(key) &&
			window.localStorage.getItem(key) !== (observedStories.get(key) ?? null)
		) markStoryConflict();
	}
	if (storyConflict) {
		pending = new Map([...pending, ...changes]);
		throw new Error(conflictMessage);
	}
}

function validKey(key: string) {
	return /^twine-studio-(prefs|stories|passages|storyformats)(-|$)/.test(key);
}

function readJournal(key: string, snapshots?: Map<string, string | null>): Changes {
	const raw = window.localStorage.getItem(key);
	snapshots?.set(key, raw);
	if (!raw) return new Map();
	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new Error(
			'The saved recovery journal is unreadable. Export recovery data before changing browser storage.'
		);
	}
	if (
		!parsed ||
		(parsed.version !== 1 && parsed.version !== 2) ||
		!Array.isArray(parsed.changes) ||
		parsed.changes.some(
			(entry: unknown) =>
				!Array.isArray(entry) ||
				entry.length !== 2 ||
				typeof entry[0] !== 'string' ||
				!validKey(entry[0]) ||
				(entry[1] !== null && typeof entry[1] !== 'string')
		) ||
		(parsed.version === 2 &&
			(!Array.isArray(parsed.bases) ||
				parsed.bases.length !== parsed.changes.length ||
				parsed.bases.some(
					(entry: unknown) =>
						!Array.isArray(entry) ||
						entry.length !== 2 ||
						typeof entry[0] !== 'string' ||
						!validKey(entry[0]) ||
						(entry[1] !== null && typeof entry[1] !== 'string')
				)))
	) {
		throw new Error(
			'The saved recovery journal has an unsupported structure. Export recovery data before changing browser storage.'
		);
	}
	if (parsed.version === 2) {
		const bases = new Map<string, string | null>(parsed.bases);
		if (
			bases.size !== parsed.changes.length ||
			parsed.changes.some(([changedKey]: [string, string | null]) =>
				!bases.has(changedKey)
			)
		)
			throw new Error(
				'The saved recovery journal has an unsupported structure. Export recovery data before changing browser storage.'
			);
		for (const [changedKey, intended] of parsed.changes as [string, string | null][]) {
			const current = window.localStorage.getItem(changedKey);
			// An interrupted commit may leave each record at its old or new value.
			if (current !== bases.get(changedKey) && current !== intended)
				throw new Error(
					'A saved recovery journal conflicts with newer browser data. Export recovery data before changing browser storage.'
				);
		}
	} else {
		// Version-one journals do not record the value before the save. If a
		// record differs from the intended value, replay could erase a newer
		// tab's work. Preserve the journal for raw export instead.
		for (const [changedKey, intended] of parsed.changes as [string, string | null][])
			if (window.localStorage.getItem(changedKey) !== intended)
				throw new Error(
					'A legacy recovery journal cannot be verified against current browser data. Export recovery data before changing browser storage.'
				);
	}
	return new Map(parsed.changes);
}

function savedJournal(
	snapshots?: Map<string, string | null>,
	inheritedKeys = inheritedJournalKeys()
): Changes {
	return new Map([
		...readJournal(legacyJournalKey, snapshots),
		...inheritedKeys.flatMap(key => [...readJournal(key, snapshots)]),
		...readJournal(journalKey, snapshots)
	]);
}

function notify() {
	// Persistence middleware runs during reducer evaluation. Defer subscribers
	// until that render completes, coalescing changes from the same operation.
	if (notificationPending) return;
	notificationPending = true;
	void Promise.resolve().then(() => {
		notificationPending = false;
		window.dispatchEvent(new Event(eventName));
	});
}

export function getStorageStatus() {
	return {dirty: storyConflict || unreadableStoryRecords.size > 0 || orphanDraftIds.size > 0 || pending.size > 0 || Boolean(error), error, durable, saving: lockRequestPending && !storyConflict, conflict: storyConflict, recoveredDraftConflict, orphanDrafts: orphanDraftIds.size > 0, unreadableStoryRecords: unreadableStoryRecords.size > 0};
}

/** Stop story saves when indexed records could not be loaded without data loss. */
export function reportUnreadableStoryRecord(key: string) {
	if (!isStoryKey(key)) throw new Error('Invalid story recovery key.');
	unreadableStoryRecords.add(key);
	notify();
}

/** Keep a recovered editor draft in memory without replacing a changed saved passage. */
export function preserveConflictingEditorDraft(key: string, value: string) {
	if (!key.startsWith('twine-studio-passages-') || !validKey(key))
		throw new Error('Invalid editor draft recovery key.');
	pending.set(key, value);
	conflictingDraftIds.add(key.slice('twine-studio-passages-'.length));
	recoveredDraftConflict = true;
	markStoryConflict();
}

export function discardConflictingEditorDrafts() {
	for (const passageId of conflictingDraftIds) clearEditorDraft(passageId);
}

/** Surface draft bytes whose passage could not be loaded into an editable story. */
export function reportOrphanEditorDraft(passageId: string) {
	orphanDraftIds.add(passageId);
	notify();
}

export function discardOrphanEditorDrafts() {
	for (const passageId of orphanDraftIds)
		if (clearEditorDraft(passageId)) orphanDraftIds.delete(passageId);
	notify();
}

export function subscribeStorageStatus(listener: () => void) {
	window.addEventListener(eventName, listener);
	return () => window.removeEventListener(eventName, listener);
}

function outstanding(
	snapshots?: Map<string, string | null>,
	inheritedKeys = inheritedJournalKeys()
): Changes {
	return new Map([...savedJournal(snapshots, inheritedKeys), ...pending]);
}

export function readStorageItem(key: string): string | null {
	if (staging?.has(key)) return staging.get(key)!;
	const changes = outstanding();
	if (changes.size && !pending.size) {
		pending = changes;
		durable = true;
		error =
			'A previous save was interrupted. Your recovered changes are loaded; retry saving or export a backup.';
		notify();
	}
	return changes.has(key)
		? changes.get(key)!
		: window.localStorage.getItem(key);
}

function flushStorageChangesUnderLock(
	extraInheritedKeys: string[] = [],
	expectedJournalSnapshots?: Map<string, string | null>
) {
	checkStoryStorageGuard(pending);
	const recoveredJournals = new Map<string, string | null>();
	const inheritedKeys = [...inheritedJournalKeys(), ...extraInheritedKeys];
	pending = new Map([...outstanding(recoveredJournals, inheritedKeys), ...pending]);
	if (expectedJournalSnapshots)
		for (const [key, expected] of expectedJournalSnapshots)
			if (recoveredJournals.get(key) !== expected)
				throw new Error(
					'A recovery journal changed during replay. Export recovery data before changing browser storage.'
				);
	if (!pending.size) return;
	checkStoryStorageGuard(pending);
	durable = false;
	try {
		// Another edit may have joined the queue after the pre-lock journal was
		// written, or its attempted journal update may have failed. Make the
		// complete current queue durable before touching any record.
		const serializedJournal = JSON.stringify({
			version: 2,
			changes: [...pending],
			bases: [...pending.keys()].map(key => [key, window.localStorage.getItem(key)])
		});
		window.localStorage.setItem(journalKey, serializedJournal);
		if (storyGuardActive) observedJournal = serializedJournal;
		durable = true;
		// Free obsolete records before new writes, retaining the journal throughout.
		for (const [key, value] of pending)
			if (value === null) {
				window.localStorage.removeItem(key);
				if (storyGuardActive && isStoryKey(key)) observedStories.set(key, null);
			}
		for (const [key, value] of pending)
			if (value !== null) {
				window.localStorage.setItem(key, value);
				if (storyGuardActive && isStoryKey(key)) observedStories.set(key, value);
			}
		window.localStorage.removeItem(journalKey);
		if (storyGuardActive) observedJournal = null;
		// A duplicated tab may still own an inherited key. Clear only the exact
		// journal version included in this commit, never a newer write to that key.
		for (const key of [legacyJournalKey, ...inheritedKeys]) {
			const recovered = recoveredJournals.get(key);
			if (recovered && window.localStorage.getItem(key) === recovered) {
				window.localStorage.removeItem(key);
				if (storyGuardActive && observedInheritedJournals.has(key))
					observedInheritedJournals.set(key, null);
			}
		}
		if (journalHistoryAvailable) {
			try {
				window.sessionStorage.setItem(
					journalHistorySessionKey,
					JSON.stringify(previousOwners.filter((_, i) =>
						window.localStorage.getItem(previousJournalKeys[i]) !== null
					))
				);
			} catch {
				// The committed records do not depend on session storage cleanup.
			}
		}
		pending.clear();
		if (!storyConflict) error = '';
		durable = false;
		notify();
	} catch (cause) {
		error =
			(cause as Error).message || 'Browser storage could not save changes.';
		notify();
		throw cause;
	}
}

function queueStorageFlush() {
	if (lockRequestPending || !pending.size || storyConflict) return;
	if (!navigator.locks?.request) {
		error = 'This browser cannot coordinate safe saves between tabs. Export a backup before leaving.';
		notify();
		throw new Error(error);
	}
	lockRequestPending = true;
	try {
		void requestCommitLock(() => {
			try {
				flushStorageChangesUnderLock();
			} finally {
				lockRequestPending = false;
			}
		}).catch(cause => {
			lockRequestPending = false;
			error = (cause as Error).message || 'Browser storage could not save changes.';
			notify();
		});
	} catch (cause) {
		lockRequestPending = false;
		error = (cause as Error).message || 'Browser storage could not save changes.';
		notify();
		throw cause;
	}
}

export function commitStorageChanges(changes: Changes) {
	// Reject programmer errors before adding them to the recoverable queue.
	for (const key of changes.keys())
		if (!validKey(key)) throw new Error('Invalid storage transaction key.');
	checkStoryStorageGuard(new Map([...pending, ...changes]));
	const inheritedKeys = inheritedJournalKeys();
	pending = new Map([...outstanding(undefined, inheritedKeys), ...changes]);
	if (!pending.size) return;
	durable = false;
	try {
		// The per-tab journal makes this update durable even if the page exits
		// while the asynchronous Web Lock request is still waiting.
		const serializedJournal = JSON.stringify({
			version: 2,
			changes: [...pending],
			bases: [...pending.keys()].map(key => [key, window.localStorage.getItem(key)])
		});
		window.localStorage.setItem(journalKey, serializedJournal);
		if (storyGuardActive) observedJournal = serializedJournal;
		durable = true;
		if (!unreadableStoryRecords.size) error = '';
		notify();
	} catch (cause) {
		error = (cause as Error).message || 'Browser storage could not save changes.';
		notify();
		throw cause;
	}
	queueStorageFlush();
}

export function retryStorageChanges() {
	commitStorageChanges(new Map());
}

export function withStorageTransaction(update: () => void) {
	if (staging) {
		update();
		return;
	}
	const changes: Changes = new Map();
	staging = changes;
	try {
		update();
	} finally {
		staging = undefined;
	}
	commitStorageChanges(changes);
}

export function writeStorageItem(key: string, value: string | null) {
	if (staging) staging.set(key, value);
	else commitStorageChanges(new Map([[key, value]]));
}

/** Raw rescue export remains available even when the journal cannot be parsed. */
export function exportStorageRecovery() {
	const records: Record<string, string | null> = {};
	for (let i = 0; i < window.localStorage.length; i++) {
		const key = window.localStorage.key(i)!;
		if (key.startsWith('twine-studio-'))
			records[key] = window.localStorage.getItem(key);
	}
	return JSON.stringify(
		{version: 1, records, sessionDrafts: exportEditorDrafts(), unsavedChanges: [...pending]},
		null,
		2
	);
}

// An in-memory edit that could not enter the journal cannot survive navigation.
export function protectUnsavedChanges(event: BeforeUnloadEvent) {
	if (pending.size && !durable) {
		event.preventDefault();
		event.returnValue = '';
	}
}

window.addEventListener('beforeunload', protectUnsavedChanges);
