import {Passage} from '../../stories';
import {storageKey} from './keys';
import {clearSavedDurableEditorDrafts, currentDurableEditorDraft, saveDurableEditorDraft} from './durable-editor-drafts';

const draftPrefix = 'twine-studio-editor-draft-';

export interface EditorDraft {
	version: 1;
	storyId: string;
	passageId: string;
	baseText: string;
	text: string;
}

function draftKey(passageId: string) {
	return `${draftPrefix}${passageId}`;
}

/** Keep the latest keystrokes in this tab before the debounced story save runs. */
export function saveEditorDraft(passage: Passage, text: string) {
	clearSavedEditorDraft(passage);
	const previous = readEditorDraft(passage) ?? currentDurableEditorDraft(passage.id);
	const draft: EditorDraft = {
		version: 1,
		storyId: passage.story,
		passageId: passage.id,
		baseText: previous?.baseText ?? passage.text,
		text
	};
	saveDurableEditorDraft(draft);
	window.sessionStorage.setItem(draftKey(passage.id), JSON.stringify(draft));
}

export function readEditorDraft(passage: Passage): EditorDraft | undefined {
	let raw: string | null;
	try {
		raw = window.sessionStorage.getItem(draftKey(passage.id));
	} catch {
		return;
	}
	if (!raw) return;
	try {
		const draft = JSON.parse(raw) as EditorDraft;
		if (
			draft.version === 1 &&
			draft.storyId === passage.story &&
			draft.passageId === passage.id &&
			typeof draft.baseText === 'string' &&
			typeof draft.text === 'string'
		) return draft;
	} catch {
		// Leave an unreadable draft untouched for raw recovery export.
	}
}

export function clearSavedEditorDraft(passage: Passage) {
	const draft = readEditorDraft(passage);
	const saved = window.localStorage.getItem(storageKey('passages', passage.id));
	if (!saved) return;
	try {
		const savedText = JSON.parse(saved).text;
		if (typeof savedText !== 'string') return;
		if (draft && savedText === draft.text)
			window.sessionStorage.removeItem(draftKey(passage.id));
		clearSavedDurableEditorDrafts(passage.id, savedText);
	} catch {
		// Keep the draft if the saved record cannot be read.
	}
}

export function clearEditorDraft(passageId: string) {
	let sessionCleared = true;
	try {
		window.sessionStorage.removeItem(draftKey(passageId));
	} catch {
		// A profile may stop allowing session storage after recovery was shown.
		sessionCleared = false;
	}
	return sessionCleared;
}

export function exportEditorDrafts() {
	const result: Record<string, string | null> = {};
	try {
		for (let i = 0; i < window.sessionStorage.length; i++) {
			const key = window.sessionStorage.key(i)!;
			if (key.startsWith(draftPrefix))
				result[key] = window.sessionStorage.getItem(key);
		}
	} catch {
		// Raw export can still include local storage when session storage is blocked.
	}
	return result;
}
