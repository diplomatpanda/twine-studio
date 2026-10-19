import {v4 as uuid} from '@lukeed/uuid';
import type {EditorDraft} from './editor-drafts';

const databaseName = 'twine-studio-editor-drafts';
const storeName = 'drafts';
const owner = uuid();

export interface DurableEditorDraft extends EditorDraft {
	id: string;
	owner: string;
}

const drafts = new Map<string, unknown>();
const writes = new Map<string, Promise<void>>();
let databasePromise: Promise<IDBDatabase | undefined> | undefined;

function validDraft(value: unknown): value is DurableEditorDraft {
	if (!value || typeof value !== 'object') return false;
	const draft = value as Partial<DurableEditorDraft>;
	return draft.version === 1 &&
		typeof draft.id === 'string' &&
		typeof draft.owner === 'string' &&
		typeof draft.storyId === 'string' &&
		typeof draft.passageId === 'string' &&
		typeof draft.baseText === 'string' &&
		typeof draft.text === 'string' &&
		draft.id === `${draft.owner}:${draft.passageId}`;
}

function sameDraft(left: DurableEditorDraft, right: DurableEditorDraft) {
	return left.id === right.id && left.owner === right.owner &&
		left.storyId === right.storyId && left.passageId === right.passageId &&
		left.baseText === right.baseText && left.text === right.text;
}

function database() {
	let indexedDB: IDBFactory;
	try {
		indexedDB = window.indexedDB;
	} catch {
		return Promise.resolve(undefined);
	}
	if (!indexedDB) return Promise.resolve(undefined);
	if (!databasePromise) databasePromise = new Promise(resolve => {
		try {
			const request = indexedDB.open(databaseName, 1);
			request.onupgradeneeded = () => {
				if (!request.result.objectStoreNames.contains(storeName))
					request.result.createObjectStore(storeName, {keyPath: 'id'});
			};
			request.onsuccess = () => {
				request.result.onversionchange = () => request.result.close();
				resolve(request.result);
			};
			request.onerror = () => resolve(undefined);
			request.onblocked = () => resolve(undefined);
		} catch {
			resolve(undefined);
		}
	});
	return databasePromise;
}

function enqueue(id: string, action: () => Promise<void>) {
	const previous = writes.get(id) ?? Promise.resolve();
	const next = previous.then(action, action).catch(() => {});
	writes.set(id, next);
	void next.then(() => {
		if (writes.get(id) === next) writes.delete(id);
	});
	return next;
}

function putDraft(draft: DurableEditorDraft) {
	return enqueue(draft.id, async () => {
		const db = await database();
		if (!db) return;
		await new Promise<void>(resolve => {
			try {
				const transaction = db.transaction(storeName, 'readwrite');
				transaction.objectStore(storeName).put(draft);
				transaction.oncomplete = () => resolve();
				transaction.onerror = () => resolve();
				transaction.onabort = () => resolve();
			} catch {
				resolve();
			}
		});
	});
}

/** Queue a durable checkpoint immediately, without delaying the editor. */
export function saveDurableEditorDraft(draft: EditorDraft) {
	const record: DurableEditorDraft = {...draft, owner, id: `${owner}:${draft.passageId}`};
	drafts.set(record.id, record);
	void putDraft(record);
}

/** Read checkpoints before the Library decides which passage text to show. */
export async function loadDurableEditorDrafts() {
	const db = await database();
	if (db) await new Promise<void>(resolve => {
		try {
			const transaction = db.transaction(storeName, 'readonly');
			const request = transaction.objectStore(storeName).getAll();
			request.onsuccess = () => {
				for (const [index, value] of (request.result as unknown[]).entries()) {
					const id = value && typeof value === 'object' &&
						typeof (value as {id?: unknown}).id === 'string'
						? (value as {id: string}).id
						: `unreadable-${index}`;
					if (!drafts.has(id)) drafts.set(id, value);
				}
			};
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => resolve();
			transaction.onabort = () => resolve();
		} catch {
			resolve();
		}
	});
	return [...drafts.values()].filter(validDraft);
}

export function exportDurableEditorDrafts() {
	return Object.fromEntries(drafts);
}

export function listDurableEditorDrafts() {
	return [...drafts.values()].filter(validDraft);
}

export function currentDurableEditorDraft(passageId: string) {
	const value = drafts.get(`${owner}:${passageId}`);
	return validDraft(value) ? value : undefined;
}

export function hasUnreadableDurableEditorDrafts() {
	return [...drafts.values()].some(value => !validDraft(value));
}

function deleteDraft(expected: DurableEditorDraft) {
	let removed = false;
	return enqueue(expected.id, async () => {
		const db = await database();
		if (!db) return;
		await new Promise<void>(resolve => {
			try {
				const transaction = db.transaction(storeName, 'readwrite');
				const store = transaction.objectStore(storeName);
				const request = store.get(expected.id);
				let matched = false;
				let replacement: unknown;
				request.onsuccess = () => {
					const current = request.result as unknown;
					if (!current || (validDraft(current) && sameDraft(current, expected))) {
						matched = true;
						if (current) store.delete(expected.id);
					} else replacement = current;
				};
				transaction.oncomplete = () => {
					removed = matched;
					if (replacement && drafts.get(expected.id) === expected)
						drafts.set(expected.id, replacement);
					resolve();
				};
				transaction.onerror = () => resolve();
				transaction.onabort = () => resolve();
			} catch {
				resolve();
			}
		});
	}).then(() => removed);
}

export function clearSavedDurableEditorDrafts(passageId: string, savedText: string) {
	for (const [id, value] of drafts)
		if (validDraft(value) && value.passageId === passageId && value.text === savedText) {
			const expected = value;
			void deleteDraft(expected).then(removed => {
				if (removed && drafts.get(id) === expected) drafts.delete(id);
			});
		}
}

/** Discard exactly the version the writer reviewed, never a newer tab's draft. */
export async function discardDurableEditorDraft(expected: DurableEditorDraft) {
	if (!validDraft(expected) || drafts.get(expected.id) !== expected) return false;
	const removed = await deleteDraft(expected);
	if (!removed || drafts.get(expected.id) !== expected) return false;
	drafts.delete(expected.id);
	return true;
}
