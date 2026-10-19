import {fakeStory} from '../../../../test-util';

describe('browser editor draft recovery', () => {
	let load: typeof import('../stories/load').load;
	let drafts: typeof import('../editor-drafts');
	let tx: typeof import('../transaction');
	let story: ReturnType<typeof fakeStory>;
	let passageKey: string;

	beforeEach(() => {
		jest.resetModules();
		window.localStorage.clear();
		window.sessionStorage.clear();
		// Each test needs a fresh transaction module with empty pending state.
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		load = require('../stories/load').load;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		drafts = require('../editor-drafts');
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		tx = require('../transaction');
		story = fakeStory();
		story.passages[0].text = 'saved base';
		passageKey = `twine-studio-passages-${story.passages[0].id}`;
		window.localStorage.setItem('twine-studio-stories', story.id);
		window.localStorage.setItem('twine-studio-passages', story.passages[0].id);
		window.localStorage.setItem(`twine-studio-stories-${story.id}`,
			JSON.stringify({...story, passages: undefined}));
		window.localStorage.setItem(passageKey, JSON.stringify(story.passages[0]));
	});

	it('restores a draft when the saved passage still matches its starting text', async () => {
		drafts.saveEditorDraft(story.passages[0], 'last keystrokes');
		const loaded = await load();
		expect(loaded[0].passages[0].text).toBe('last keystrokes');
		expect(JSON.parse(window.localStorage.getItem(passageKey)!).text)
			.toBe('last keystrokes');
		expect(Object.keys(drafts.exportEditorDrafts())).toHaveLength(0);
	});

	it('keeps normal recovery available when IndexedDB access is denied', async () => {
		const prior = Object.getOwnPropertyDescriptor(window, 'indexedDB');
		Object.defineProperty(window, 'indexedDB', {
			configurable: true,
			get: () => {throw new DOMException('Blocked', 'SecurityError');}
		});
		try {
			drafts.saveEditorDraft(story.passages[0], 'session draft');
			const loaded = await load();
			expect(loaded[0].passages[0].text).toBe('session draft');
			expect(JSON.parse(window.localStorage.getItem(passageKey)!).text)
				.toBe('session draft');
		} finally {
			if (prior) Object.defineProperty(window, 'indexedDB', prior);
			else delete (window as any).indexedDB;
		}
	});

	it('preserves a divergent draft for backup without overwriting saved work', async () => {
		drafts.saveEditorDraft(story.passages[0], 'local last keystrokes');
		window.localStorage.setItem(passageKey, JSON.stringify({
			...story.passages[0], text: 'another tab saved this'
		}));
		const loaded = await load();
		expect(loaded[0].passages[0].text).toBe('local last keystrokes');
		expect(JSON.parse(window.localStorage.getItem(passageKey)!).text)
			.toBe('another tab saved this');
		expect(tx.getStorageStatus())
			.toMatchObject({dirty: true, conflict: true, recoveredDraftConflict: true});
		expect(JSON.parse(tx.exportStorageRecovery()).unsavedChanges)
			.toContainEqual([passageKey, expect.stringContaining('local last keystrokes')]);
	});

	it('keeps the original comparison baseline through a passage rerender', async () => {
		drafts.saveEditorDraft(story.passages[0], 'first local edit');
		drafts.saveEditorDraft(
			{...story.passages[0], text: 'another tab saved this'},
			'second local edit'
		);
		expect(drafts.readEditorDraft(story.passages[0])?.baseText)
			.toBe('saved base');
		window.localStorage.setItem(passageKey, JSON.stringify({
			...story.passages[0], text: 'another tab saved this'
		}));
		await load();
		expect(JSON.parse(window.localStorage.getItem(passageKey)!).text)
			.toBe('another tab saved this');
		expect(tx.getStorageStatus().recoveredDraftConflict).toBe(true);
	});

	it('shows raw recovery when a draft passage was deleted', async () => {
		drafts.saveEditorDraft(story.passages[0], 'writing before deletion');
		window.localStorage.removeItem(passageKey);
		const loaded = await load();
		expect(loaded[0].passages).toHaveLength(0);
		expect(tx.getStorageStatus()).toMatchObject({dirty: true, orphanDrafts: true});
		expect(JSON.parse(tx.exportStorageRecovery()).sessionDrafts)
			.toEqual(expect.objectContaining({
				[`twine-studio-editor-draft-${story.passages[0].id}`]:
					expect.stringContaining('writing before deletion')
			}));
	});
});
