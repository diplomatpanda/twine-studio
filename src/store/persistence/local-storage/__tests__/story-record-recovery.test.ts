import {fakeStory} from '../../../../test-util';

describe('unreadable browser story records', () => {
	let load: typeof import('../stories/load').load;
	let tx: typeof import('../transaction');

	beforeEach(() => {
		window.localStorage.clear();
		window.sessionStorage.clear();
		jest.resetModules();
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		load = require('../stories/load').load;
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		tx = require('../transaction');
		tx.startStoryStorageGuard();
	});

	it('warns and preserves raw bytes when a listed story is malformed', async () => {
		const key = 'twine-studio-stories-broken-story';
		localStorage.setItem('twine-studio-stories', 'broken-story');
		localStorage.setItem(key, '{broken');
		expect(await load()).toEqual([]);
		expect(tx.getStorageStatus()).toMatchObject({
			dirty: true, conflict: false, unreadableStoryRecords: true
		});
		expect(JSON.parse(tx.exportStorageRecovery()).records[key]).toBe('{broken');
		expect(() => tx.writeStorageItem('twine-studio-stories', 'replacement'))
			.toThrow();
		expect(localStorage.getItem(key)).toBe('{broken');
	});

	it('continues saving unrelated preferences while a story record is unreadable', async () => {
		localStorage.setItem('twine-studio-stories', 'broken-story');
		localStorage.setItem('twine-studio-stories-broken-story', '{broken');
		await load();
		tx.writeStorageItem('twine-studio-prefs-theme', 'dark');
		expect(localStorage.getItem('twine-studio-prefs-theme')).toBe('dark');
		expect(tx.getStorageStatus().unreadableStoryRecords).toBe(true);
	});

	it('warns when a listed passage is missing while retaining readable stories', async () => {
		const story = fakeStory();
		localStorage.setItem('twine-studio-stories', story.id);
		localStorage.setItem(`twine-studio-stories-${story.id}`,
			JSON.stringify({...story, passages: undefined}));
		localStorage.setItem('twine-studio-passages', story.passages[0].id);
		const loaded = await load();
		expect(loaded).toHaveLength(1);
		expect(loaded[0].passages).toHaveLength(0);
		expect(tx.getStorageStatus().unreadableStoryRecords).toBe(true);
		expect(JSON.parse(tx.exportStorageRecovery()).records['twine-studio-passages'])
			.toBe(story.passages[0].id);
	});

	it('exports malformed passage bytes without dropping the indexed ID', async () => {
		const story = fakeStory();
		const passageKey = `twine-studio-passages-${story.passages[0].id}`;
		localStorage.setItem('twine-studio-stories', story.id);
		localStorage.setItem(`twine-studio-stories-${story.id}`,
			JSON.stringify({...story, passages: undefined}));
		localStorage.setItem('twine-studio-passages', story.passages[0].id);
		localStorage.setItem(passageKey, '{broken passage');
		const loaded = await load();
		expect(loaded[0].passages).toHaveLength(0);
		expect(tx.getStorageStatus().unreadableStoryRecords).toBe(true);
		expect(JSON.parse(tx.exportStorageRecovery()).records[passageKey])
			.toBe('{broken passage');
	});

	it('warns when the passage index remains but the story index is missing', async () => {
		localStorage.setItem('twine-studio-passages', 'orphan-id');
		expect(await load()).toEqual([]);
		expect(tx.getStorageStatus().unreadableStoryRecords).toBe(true);
	});

	it('does not hide a saved story whose ID matches an object prototype property', async () => {
		const story = fakeStory();
		const saved = {...story, id: '__proto__', passages: undefined};
		localStorage.setItem('twine-studio-stories', saved.id);
		localStorage.setItem('twine-studio-stories-__proto__', JSON.stringify(saved));
		const loaded = await load();
		expect(loaded).toHaveLength(1);
		expect(loaded[0].id).toBe('__proto__');
	});
});
