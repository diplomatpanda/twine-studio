describe('cross-tab browser commit lock', () => {
	const sharedKey = 'twine-studio-passages-shared';
	const otherKey = 'twine-studio-passages-other';
	let callbacks: Array<() => void>;
	let first: typeof import('../transaction');
	let second: typeof import('../transaction');
	let stopFirst: () => void;
	let stopSecond: () => void;

	beforeEach(() => {
		jest.resetModules();
		window.localStorage.clear();
		window.sessionStorage.clear();
		window.localStorage.setItem(sharedKey, 'original');
		callbacks = [];
		Object.defineProperty(navigator, 'locks', {
			configurable: true,
			value: {
				request: (_name: string, _options: unknown, callback: () => void) =>
					new Promise<void>((resolve, reject) => callbacks.push(() => {
						try {
							callback();
							resolve();
						} catch (error) {
							reject(error);
						}
					}))
			}
		});
		first = require('../transaction');
		stopFirst = first.startStoryStorageGuard();
		window.sessionStorage.clear();
		jest.resetModules();
		second = require('../transaction');
		stopSecond = second.startStoryStorageGuard();
	});
	afterEach(() => {
		stopFirst();
		stopSecond();
		jest.useRealTimers();
	});

	it('keeps a same-record second tab draft when the first tab commits', async () => {
		first.writeStorageItem(sharedKey, 'first tab');
		second.writeStorageItem(sharedKey, 'second tab');
		expect(window.localStorage.getItem(sharedKey)).toBe('original');
		expect(callbacks).toHaveLength(2);
		expect(window.localStorage.getItem(first.journalKey)).toContain('first tab');
		expect(window.localStorage.getItem(second.journalKey)).toContain('second tab');
		callbacks[0]();
		callbacks[1]();
		await Promise.resolve();
		expect(window.localStorage.getItem(sharedKey)).toBe('first tab');
		expect(window.localStorage.getItem(first.journalKey)).toBeNull();
		expect(window.localStorage.getItem(second.journalKey)).toContain('second tab');
		expect(second.getStorageStatus()).toMatchObject({dirty: true, conflict: true});
	});

	it('allows independent stories to commit in either tab', async () => {
		first.writeStorageItem(sharedKey, 'first tab');
		second.writeStorageItem(otherKey, 'second tab');
		callbacks[0]();
		callbacks[1]();
		await Promise.resolve();
		expect(window.localStorage.getItem(sharedKey)).toBe('first tab');
		expect(window.localStorage.getItem(otherKey)).toBe('second tab');
		expect(first.getStorageStatus().dirty).toBe(false);
		expect(second.getStorageStatus().dirty).toBe(false);
	});

	it('leaves an exit-time journal recoverable while the lock is held', () => {
		first.writeStorageItem(sharedKey, 'last edit before pagehide');
		expect(window.localStorage.getItem(sharedKey)).toBe('original');
		const journal = window.localStorage.getItem(first.journalKey);
		expect(journal).toContain('last edit before pagehide');
		// Reloading the same tab keeps its session history and overlays the journal.
		window.sessionStorage.setItem(
			'twine-studio-journal-owner',
			first.journalKey.slice('twine-studio-pending-transaction-'.length)
		);
		jest.resetModules();
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const reloaded: typeof import('../transaction') = require('../transaction');
		expect(reloaded.readStorageItem(sharedKey)).toBe('last edit before pagehide');
		expect(window.localStorage.getItem(first.journalKey)).toBe(journal);
	});

	it('retains the journal and allows retry after lock acquisition fails', async () => {
		const workingLocks = navigator.locks;
		Object.defineProperty(navigator, 'locks', {
			configurable: true,
			value: {request: () => Promise.reject(new Error('Lock denied'))}
		});
		first.writeStorageItem(sharedKey, 'retry this draft');
		for (let i = 0; i < 6; i++) await Promise.resolve();
		expect(first.getStorageStatus().error).toBe('Lock denied');
		expect(window.localStorage.getItem(sharedKey)).toBe('original');
		expect(window.localStorage.getItem(first.journalKey)).toContain('retry this draft');
		Object.defineProperty(navigator, 'locks', {
			configurable: true,
			value: workingLocks
		});
		first.retryStorageChanges();
		expect(callbacks).toHaveLength(1);
		callbacks[0]();
		expect(window.localStorage.getItem(sharedKey)).toBe('retry this draft');
		expect(first.getStorageStatus().dirty).toBe(false);
	});

	it('times out a stalled lock request without losing the draft', async () => {
		jest.useFakeTimers();
		const workingLocks = navigator.locks;
		Object.defineProperty(navigator, 'locks', {
			configurable: true,
			value: {
				request: (_name: string, options: {signal: AbortSignal}) =>
					new Promise<void>((_resolve, reject) => options.signal.addEventListener(
						'abort', () => reject(new DOMException('Aborted', 'AbortError'))
					))
			}
		});
		first.writeStorageItem(sharedKey, 'draft waiting for lock');
		expect(first.getStorageStatus().saving).toBe(true);
		jest.advanceTimersByTime(15000);
		for (let i = 0; i < 6; i++) await Promise.resolve();
		expect(first.getStorageStatus()).toMatchObject({
			dirty: true,
			durable: true,
			saving: false,
			error: 'Timed out waiting for another tab to finish saving. Retry when it is responsive.'
		});
		expect(window.localStorage.getItem(sharedKey)).toBe('original');
		expect(window.localStorage.getItem(first.journalKey)).toContain('draft waiting for lock');
		Object.defineProperty(navigator, 'locks', {
			configurable: true,
			value: workingLocks
		});
		first.retryStorageChanges();
		callbacks[0]();
		expect(window.localStorage.getItem(sharedKey)).toBe('draft waiting for lock');
	});

	it('never applies a newer queued edit without journaling that edit', async () => {
		first.writeStorageItem(sharedKey, 'first queued edit');
		const originalSet = Storage.prototype.setItem;
		const failingJournal = jest.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(function (this: Storage, key, value) {
				if (this === window.localStorage && key === first.journalKey &&
					value.includes('second queued edit')) throw new Error('Journal full');
				originalSet.call(this, key, value);
			});
		expect(() => first.writeStorageItem(sharedKey, 'second queued edit'))
			.toThrow('Journal full');
		expect(window.localStorage.getItem(first.journalKey))
			.toContain('first queued edit');
		callbacks[0]();
		await Promise.resolve();
		expect(window.localStorage.getItem(sharedKey)).toBe('original');
		expect(first.getStorageStatus()).toMatchObject({dirty: true, durable: false});
		failingJournal.mockRestore();
		first.retryStorageChanges();
		callbacks[1]();
		expect(window.localStorage.getItem(sharedKey)).toBe('second queued edit');
		expect(window.localStorage.getItem(first.journalKey)).toBeNull();
	});

	it('fails closed when the browser has no lock manager', () => {
		delete (navigator as any).locks;
		expect(() => first.writeStorageItem(sharedKey, 'protected draft'))
			.toThrow('cannot coordinate safe saves');
		expect(window.localStorage.getItem(sharedKey)).toBe('original');
		expect(window.localStorage.getItem(first.journalKey)).toContain('protected draft');
		expect(first.getStorageStatus()).toMatchObject({dirty: true, durable: true});
	});

	it('replays a closed tab journal in a fresh tab', async () => {
		first.writeStorageItem(sharedKey, 'closed tab draft');
		const journal = window.localStorage.getItem(first.journalKey);
		window.sessionStorage.clear();
		jest.resetModules();
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const fresh: typeof import('../transaction') = require('../transaction');
		const check = fresh.recoverUnownedJournals();
		// The writer's pending lock was abandoned when its page closed.
		callbacks[1]();
		await expect(check).resolves.toBeUndefined();
		expect(journal).toContain('closed tab draft');
		expect(window.localStorage.getItem(sharedKey)).toBe('closed tab draft');
		expect(window.localStorage.getItem(first.journalKey)).toBeNull();
	});

	it('waits for an active tab before inspecting its temporary journal', async () => {
		first.writeStorageItem(sharedKey, 'active tab draft');
		window.sessionStorage.clear();
		jest.resetModules();
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const fresh: typeof import('../transaction') = require('../transaction');
		const check = fresh.recoverUnownedJournals();
		expect(callbacks).toHaveLength(2);
		callbacks[0]();
		callbacks[1]();
		await expect(check).resolves.toBeUndefined();
		expect(fresh.readStorageItem(sharedKey)).toBe('active tab draft');
	});

	it('preserves a stale closed-tab journal and newer record for raw export', async () => {
		first.writeStorageItem(sharedKey, 'closed tab draft');
		const journal = window.localStorage.getItem(first.journalKey);
		window.localStorage.setItem(sharedKey, 'newer saved record');
		window.sessionStorage.clear();
		jest.resetModules();
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const fresh: typeof import('../transaction') = require('../transaction');
		const recovery = fresh.recoverUnownedJournals();
		callbacks[1]();
		await expect(recovery).rejects.toThrow('conflicts with newer browser data');
		expect(window.localStorage.getItem(sharedKey)).toBe('newer saved record');
		expect(window.localStorage.getItem(first.journalKey)).toBe(journal);
	});
});

export {};
