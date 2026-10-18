/** Recoverable write-ahead journal for the existing normalized storage schema.
 * Once the journal write succeeds, reads use its intended values even if a
 * later record write fails. No old records are touched before that boundary.
 */
export const journalKey = 'twine-studio-pending-transaction';
const eventName = 'twine-studio-storage-status';
type Changes = Map<string, string | null>;
let pending: Changes = new Map();
let staging: Changes | undefined;
let error = '';
let durable = false;
let notificationPending = false;

function validKey(key: string) {
	return /^twine-studio-(prefs|stories|passages|storyformats)(-|$)/.test(key);
}

function savedJournal(): Changes {
	const raw = window.localStorage.getItem(journalKey);
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
	return {dirty: pending.size > 0 || Boolean(error), error, durable};
}

export function subscribeStorageStatus(listener: () => void) {
	window.addEventListener(eventName, listener);
	return () => window.removeEventListener(eventName, listener);
}

function outstanding(): Changes {
	return new Map([...savedJournal(), ...pending]);
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
	pending = new Map([...outstanding(), ...changes]);
	if (!pending.size) return;
	durable = false;
	try {
		// setItem is atomic: quota failure here leaves every existing record intact.
		window.localStorage.setItem(
			journalKey,
			JSON.stringify({version: 1, changes: [...pending]})
		);
		durable = true;
		// Free obsolete records before new writes, retaining the journal throughout.
		for (const [key, value] of pending)
			if (value === null) window.localStorage.removeItem(key);
		for (const [key, value] of pending)
			if (value !== null) window.localStorage.setItem(key, value);
		window.localStorage.removeItem(journalKey);
		pending.clear();
		error = '';
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
		{version: 1, records, unsavedChanges: [...pending]},
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
