export {};

describe('recoverable local storage transactions', () => {
	let tx: typeof import('../transaction');
	const oldKey = 'twine-studio-stories-old';
	const newKey = 'twine-studio-passages-new';
	beforeEach(() => {
		jest.resetModules();
		window.localStorage.clear();
		tx = require('../transaction');
		window.localStorage.setItem(oldKey, 'old source');
	});
	afterEach(() => jest.restoreAllMocks());

	it('does not mutate existing records when the journal cannot be written', () => {
		const original = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
			this: Storage,
			key,
			value
		) {
			if (key === tx.journalKey)
				throw new DOMException('Full', 'QuotaExceededError');
			original.call(this, key, value);
		});
		expect(() =>
			tx.withStorageTransaction(() => {
				tx.writeStorageItem(oldKey, null);
				tx.writeStorageItem(newKey, 'latest draft');
			})
		).toThrow('Full');
		expect(window.localStorage.getItem(oldKey)).toBe('old source');
		expect(window.localStorage.getItem(newKey)).toBeNull();
		expect(tx.readStorageItem(newKey)).toBe('latest draft');
		expect(tx.getStorageStatus()).toMatchObject({dirty: true, durable: false});
		expect(
			JSON.parse(tx.exportStorageRecovery()).unsavedChanges
		).toContainEqual([newKey, 'latest draft']);
		jest.restoreAllMocks();
		tx.retryStorageChanges();
		expect(window.localStorage.getItem(newKey)).toBe('latest draft');
		expect(tx.getStorageStatus().dirty).toBe(false);
	});

	it('recovers the latest values across a fresh module after a partial write', () => {
		const original = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
			this: Storage,
			key,
			value
		) {
			if (key === newKey) throw new Error('Interrupted write');
			original.call(this, key, value);
		});
		expect(() =>
			tx.withStorageTransaction(() => {
				tx.writeStorageItem(oldKey, null);
				tx.writeStorageItem(newKey, 'latest draft');
			})
		).toThrow('Interrupted write');
		expect(window.localStorage.getItem(oldKey)).toBeNull();
		expect(window.localStorage.getItem(tx.journalKey)).not.toBeNull();
		jest.restoreAllMocks();
		jest.resetModules();
		tx = require('../transaction');
		expect(tx.readStorageItem(newKey)).toBe('latest draft');
		expect(tx.getStorageStatus()).toMatchObject({dirty: true, durable: true});
		tx.retryStorageChanges();
		expect(window.localStorage.getItem(newKey)).toBe('latest draft');
		expect(window.localStorage.getItem(tx.journalKey)).toBeNull();
	});

	it('merges continued edits after failure, including deletion and index changes', () => {
		const original = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
			this: Storage,
			key,
			value
		) {
			if (key === tx.journalKey) throw new Error('Full');
			original.call(this, key, value);
		});
		expect(() => tx.writeStorageItem(newKey, 'first draft')).toThrow();
		expect(() =>
			tx.withStorageTransaction(() => {
				tx.writeStorageItem(newKey, 'second draft');
				tx.writeStorageItem(oldKey, null);
				tx.writeStorageItem('twine-studio-passages', 'new');
			})
		).toThrow();
		jest.restoreAllMocks();
		tx.retryStorageChanges();
		expect(window.localStorage.getItem(newKey)).toBe('second draft');
		expect(window.localStorage.getItem(oldKey)).toBeNull();
		expect(window.localStorage.getItem('twine-studio-passages')).toBe('new');
	});

	it('rejects corrupt and foreign-key journals without changing their bytes', () => {
		const raw = JSON.stringify({
			version: 1,
			changes: [['twine-stories', null]]
		});
		window.localStorage.setItem(tx.journalKey, raw);
		window.localStorage.setItem('twine-stories', 'upstream data');
		expect(() => tx.readStorageItem(oldKey)).toThrow('unsupported structure');
		expect(window.localStorage.getItem('twine-stories')).toBe('upstream data');
		expect(window.localStorage.getItem(tx.journalKey)).toBe(raw);
		expect(JSON.parse(tx.exportStorageRecovery()).records[tx.journalKey]).toBe(
			raw
		);
	});

	it('stages nested changes and aborts cleanly if the updater throws', () => {
		expect(() =>
			tx.withStorageTransaction(() => {
				tx.writeStorageItem(oldKey, 'not committed');
				tx.withStorageTransaction(() =>
					tx.writeStorageItem(newKey, 'not committed')
				);
				throw new Error('invalid operation');
			})
		).toThrow('invalid operation');
		expect(window.localStorage.getItem(oldKey)).toBe('old source');
		expect(window.localStorage.getItem(tx.journalKey)).toBeNull();
	});

	it('rejects invalid keys without poisoning future saves', () => {
		expect(() => tx.writeStorageItem('twine-stories', 'foreign')).toThrow(
			'Invalid storage'
		);
		tx.writeStorageItem(newKey, 'valid draft');
		expect(window.localStorage.getItem('twine-stories')).toBeNull();
		expect(window.localStorage.getItem(newKey)).toBe('valid draft');
		expect(tx.getStorageStatus().dirty).toBe(false);
	});
});
