export {};

describe('recoverable local storage transactions', () => {
	let tx: typeof import('../transaction');
	const oldKey = 'twine-studio-stories-old';
	const newKey = 'twine-studio-passages-new';
	beforeEach(() => {
		jest.resetModules();
		window.localStorage.clear();
		window.sessionStorage.clear();
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

	it('does not replay an interrupted journal over a newer saved record', () => {
		const original = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
			this: Storage,
			key,
			value
		) {
			if (key === newKey) throw new Error('Interrupted write');
			original.call(this, key, value);
		});
		expect(() => tx.writeStorageItem(newKey, 'interrupted draft'))
			.toThrow('Interrupted write');
		const interruptedJournal = tx.journalKey;
		const journal = JSON.parse(window.localStorage.getItem(interruptedJournal)!);
		expect(journal).toMatchObject({
			version: 2,
			bases: [[newKey, null]]
		});
		jest.restoreAllMocks();
		window.localStorage.setItem(newKey, 'another tab saved this');
		jest.resetModules();
		tx = require('../transaction');
		expect(() => tx.readStorageItem(newKey))
			.toThrow('conflicts with newer browser data');
		expect(window.localStorage.getItem(newKey)).toBe('another tab saved this');
		expect(window.localStorage.getItem(interruptedJournal)).not.toBeNull();
		expect(JSON.parse(tx.exportStorageRecovery()).records[interruptedJournal])
			.toContain('interrupted draft');
	});

	it('retains a durable journal across repeated reloads before retry', () => {
		const firstJournal = tx.journalKey;
		window.localStorage.setItem(firstJournal, JSON.stringify({
			version: 2,
			changes: [[newKey, 'draft across reloads']],
			bases: [[newKey, null]]
		}));
		jest.resetModules();
		tx = require('../transaction');
		expect(tx.readStorageItem(newKey)).toBe('draft across reloads');
		jest.resetModules();
		tx = require('../transaction');
		expect(tx.readStorageItem(newKey)).toBe('draft across reloads');
		tx.retryStorageChanges();
		expect(window.localStorage.getItem(newKey)).toBe('draft across reloads');
		expect(window.localStorage.getItem(firstJournal)).toBeNull();
	});

	it('keeps an inherited journal if its owner writes a conflicting version during commit', () => {
		const inheritedJournal = tx.journalKey;
		window.localStorage.setItem(inheritedJournal, JSON.stringify({
			version: 2,
			changes: [[newKey, 'first draft']],
			bases: [[newKey, null]]
		}));
		jest.resetModules();
		tx = require('../transaction');
		const newer = JSON.stringify({
			version: 2,
			changes: [[newKey, 'newer draft']],
			bases: [[newKey, null]]
		});
		const original = Storage.prototype.setItem;
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
			this: Storage, key, value
		) {
			if (this === window.localStorage && key === 'twine-studio-prefs-theme')
				original.call(this, inheritedJournal, newer);
			original.call(this, key, value);
		});
		tx.writeStorageItem('twine-studio-prefs-theme', 'dark');
		expect(window.localStorage.getItem(inheritedJournal)).toBe(newer);
		expect(window.localStorage.getItem(newKey)).toBe('first draft');
		expect(() => tx.readStorageItem(newKey))
			.toThrow('conflicts with newer browser data');
	});

	it('initializes when session storage is blocked', () => {
		const originalGet = Storage.prototype.getItem;
		const originalSet = Storage.prototype.setItem;
		let failRecord = false;
		jest.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
			this: Storage, key
		) {
			if (this === window.sessionStorage) throw new DOMException('Blocked', 'SecurityError');
			return originalGet.call(this, key);
		});
		jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
			this: Storage, key, value
		) {
			if (this === window.sessionStorage) throw new DOMException('Blocked', 'SecurityError');
			if (this === window.localStorage && key === newKey && failRecord)
				throw new Error('Interrupted record write');
			originalSet.call(this, key, value);
		});
		jest.resetModules();
		tx = require('../transaction');
		failRecord = true;
		expect(() => tx.writeStorageItem(newKey, 'durable draft'))
			.toThrow('Interrupted record write');
		const oldJournal = tx.journalKey;
		expect(window.localStorage.getItem(oldJournal)).not.toBeNull();
		failRecord = false;
		jest.resetModules();
		tx = require('../transaction');
		expect(tx.readStorageItem(newKey)).toBe('durable draft');
		tx.retryStorageChanges();
		expect(window.localStorage.getItem(newKey)).toBe('durable draft');
		expect(window.localStorage.getItem(oldJournal)).toBeNull();
	});

	it('clears a legacy journal when its record already matches', () => {
		const oldJournal = 'twine-studio-pending-transaction';
		window.localStorage.setItem(newKey, 'legacy recovered draft');
		window.localStorage.setItem(oldJournal, JSON.stringify({
			version: 1,
			changes: [[newKey, 'legacy recovered draft']]
		}));
		expect(tx.readStorageItem(newKey)).toBe('legacy recovered draft');
		tx.retryStorageChanges();
		expect(window.localStorage.getItem(newKey)).toBe('legacy recovered draft');
		expect(window.localStorage.getItem(oldJournal)).toBeNull();
	});

	it('preserves a legacy journal when its record differs from the draft', () => {
		const oldJournal = 'twine-studio-pending-transaction';
		const raw = JSON.stringify({
			version: 1,
			changes: [[newKey, 'unverified legacy draft']]
		});
		window.localStorage.setItem(oldJournal, raw);
		window.localStorage.setItem(newKey, 'another tab saved this');
		expect(() => tx.readStorageItem(newKey))
			.toThrow('legacy recovery journal cannot be verified');
		expect(() => tx.retryStorageChanges())
			.toThrow('legacy recovery journal cannot be verified');
		expect(window.localStorage.getItem(newKey)).toBe('another tab saved this');
		expect(window.localStorage.getItem(oldJournal)).toBe(raw);
		expect(JSON.parse(tx.exportStorageRecovery()).records[oldJournal]).toBe(raw);
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

	it('rejects a version-two journal with no base for a changed key', () => {
		const raw = JSON.stringify({
			version: 2,
			changes: [[newKey, 'unverified draft']],
			bases: []
		});
		window.localStorage.setItem(tx.journalKey, raw);
		expect(() => tx.readStorageItem(newKey)).toThrow('unsupported structure');
		expect(window.localStorage.getItem(tx.journalKey)).toBe(raw);
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
