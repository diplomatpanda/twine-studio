export {};

describe('browser story storage guard', () => {
	const storyKey = 'twine-studio-stories-story';
	const passageKey = 'twine-studio-passages-passage';
	let tx: typeof import('../transaction');
	let stop: () => void;

	beforeEach(() => {
		jest.resetModules();
		window.localStorage.clear();
		window.sessionStorage.clear();
		window.localStorage.setItem(storyKey, 'original story');
		window.localStorage.setItem(passageKey, 'original passage');
		tx = require('../transaction');
		stop = tx.startStoryStorageGuard();
	});
	afterEach(() => stop());

	it('keeps a local draft out of storage after another tab changes its passage', () => {
		window.localStorage.setItem(passageKey, 'other tab passage');
		expect(() => tx.writeStorageItem(passageKey, 'local draft')).toThrow(
		'Another tab changed saved stories'
		);
		expect(window.localStorage.getItem(passageKey)).toBe('other tab passage');
		expect(window.localStorage.getItem(tx.journalKey)).toBeNull();
		expect(tx.getStorageStatus()).toMatchObject({dirty: true, conflict: true});
		expect(JSON.parse(tx.exportStorageRecovery()).unsavedChanges)
			.toContainEqual([passageKey, 'local draft']);
		expect(() => tx.retryStorageChanges()).toThrow('Another tab changed saved stories');
	});

	it('blocks a transaction that would replace another tab’s story record', () => {
		window.localStorage.setItem(storyKey, 'other tab story');
		expect(() => tx.withStorageTransaction(() => {
			tx.writeStorageItem(storyKey, 'local story');
			tx.writeStorageItem(passageKey, 'local draft');
		})).toThrow('Another tab changed saved stories');
		expect(tx.getStorageStatus()).toMatchObject({dirty: true, conflict: true});
		expect(window.localStorage.getItem(passageKey)).toBe('original passage');
	});

	it('allows this tab to keep saving when another story changes', () => {
		window.localStorage.setItem('twine-studio-stories-unrelated', 'external');
		tx.writeStorageItem(passageKey, 'first local edit');
		tx.writeStorageItem(passageKey, 'second local edit');
		expect(window.localStorage.getItem(passageKey)).toBe('second local edit');
		expect(tx.getStorageStatus().dirty).toBe(false);
	});

	it('keeps a failed tab journal when another tab saves preferences', () => {
		const original = Storage.prototype.setItem;
		const failingWrite = jest.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(function (this: Storage, key, value) {
				if (key === passageKey) throw new Error('Interrupted record write');
				original.call(this, key, value);
			});
		expect(() => tx.writeStorageItem(passageKey, 'recover me')).toThrow();
		failingWrite.mockRestore();
		const firstJournal = tx.journalKey;
		const saved = window.localStorage.getItem(firstJournal);
		window.sessionStorage.clear();
		jest.resetModules();
		// Simulate a second tab loading a separate transaction module instance.
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const otherTab: typeof import('../transaction') = require('../transaction');
		otherTab.writeStorageItem('twine-studio-prefs-theme', 'dark');
		expect(otherTab.journalKey).not.toBe(firstJournal);
		expect(window.localStorage.getItem(firstJournal)).toBe(saved);
		tx.retryStorageChanges();
		expect(window.localStorage.getItem(passageKey)).toBe('recover me');
	});
});
