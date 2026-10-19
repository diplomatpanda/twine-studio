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
const observedStories = new Map<string, string | null>();
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
		parsed.version !== 1 ||
		!Array.isArray(parsed.changes) ||
		parsed.changes.some(
			(entry: unknown) =>
				!Array.isArray(entry) ||
				entry.length !== 2 ||
				typeof entry[0] !== 'string' ||
				!validKey(entry[0]) ||
				(entry[1] !== null && typeof entry[1] !== 'string')
		)
	) {
		throw new Error(
			'The saved recovery journal has an unsupported structure. Export recovery data before changing browser storage.'
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
	return {dirty: storyConflict || unreadableStoryRecords.size > 0 || orphanDraftIds.size > 0 || pending.size > 0 || Boolean(error), error, durable, conflict: storyConflict, recoveredDraftConflict, orphanDrafts: orphanDraftIds.size > 0, unreadableStoryRecords: unreadableStoryRecords.size > 0};
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

export function commitStorageChanges(changes: Changes) {
	// Reject programmer errors before adding them to the recoverable queue.
	for (const key of changes.keys())
		if (!validKey(key)) throw new Error('Invalid storage transaction key.');
	checkStoryStorageGuard(new Map([...pending, ...changes]));
	const recoveredJournals = new Map<string, string | null>();
	const inheritedKeys = inheritedJournalKeys();
	pending = new Map([...outstanding(recoveredJournals, inheritedKeys), ...changes]);
	if (!pending.size) return;
	durable = false;
	try {
		// setItem is atomic: quota failure here leaves every existing record intact.
		const serializedJournal = JSON.stringify({version: 1, changes: [...pending]});
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
			if (recovered && window.localStorage.getItem(key) === recovered)
				window.localStorage.removeItem(key);
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
