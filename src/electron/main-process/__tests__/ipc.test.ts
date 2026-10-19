import {dialog, ipcMain} from 'electron';
import {initIpc} from '../ipc';
import {loadPrefs} from '../prefs';
import {saveJsonFile} from '../json-file';
import {flushAppPrefs, getAppPrefsSaveVersion} from '../app-prefs';
import {openHtmlWithScratchFile} from '../scratch-file';
import {
	deleteStory,
	loadStories,
	renameStory,
	saveStoryHtml
} from '../story-file';
import {Story} from '../../../store/stories';
import {fakePendingStoryFormat, fakePrefs, fakeStory} from '../../../test-util';
import {loadStoryFormats} from '../story-formats';
import {requestAiPassageEdit} from '../opencode-go';

jest.mock('../json-file');
jest.mock('../app-prefs');
jest.mock('../prefs');
jest.mock('../scratch-file');
jest.mock('../story-file');
jest.mock('../story-formats');
jest.mock('../opencode-go');

describe('initIpc()', () => {
	const deleteStoryMock = deleteStory as jest.Mock;
	const loadPrefsMock = loadPrefs as jest.Mock;
	const handleMock = ipcMain.handle as jest.Mock;
	const loadStoriesMock = loadStories as jest.Mock;
	const loadStoryFormatsMock = loadStoryFormats as jest.Mock;
	const onMock = ipcMain.on as jest.Mock;
	const openWithScratchFileMock = openHtmlWithScratchFile as jest.Mock;
	const renameStoryMock = renameStory as jest.Mock;
	const saveJsonFileMock = saveJsonFile as jest.Mock;
	const saveStoryHtmlMock = saveStoryHtml as jest.Mock;
	let flushStorySaves: (() => Promise<void>) | undefined;

	beforeEach(() => {
		saveStoryHtmlMock.mockResolvedValue(undefined);
		flushStorySaves = initIpc();
	});

	it('requires a default-cancel native confirmation before AI inference', async () => {
		const request = {
			storyFormat: 'SugarCube',
			storyFormatVersion: '2.36.1',
			passageName: 'Start',
			passageText: '<<if $map>>Yes<</if>>'
		};
		(requestAiPassageEdit as jest.Mock).mockImplementation(
			async (_payload, approve) => approve(request, 'glm-5.3-flash')
		);
		const handler = handleMock.mock.calls.find(
			call => call[0] === 'request-ai-passage-edit'
		)![1];
		(dialog.showMessageBox as jest.Mock).mockResolvedValueOnce({response: 0});
		expect(await handler({}, request)).toBe(false);
		expect(dialog.showMessageBox).toHaveBeenCalledWith(
			expect.objectContaining({
				defaultId: 0,
				cancelId: 0,
				detail: expect.stringContaining('Model: glm-5.3-flash.')
			})
		);
		(dialog.showMessageBox as jest.Mock).mockResolvedValueOnce({response: 1});
		expect(await handler({}, request)).toBe(true);
	});

	it('names the two-way branch task and request in native confirmation', async () => {
		const request = {
			instruction: 'propose-two-way-branch',
			storyFormat: 'SugarCube', storyFormatVersion: '2.36.1',
			passageName: 'Start', passageText: 'Choose a route.',
			request: 'Offer a cabin or road route.'
		};
		(requestAiPassageEdit as jest.Mock).mockImplementation(
			async (_payload, approve) => approve(request, 'glm-5.3-flash')
		);
		const handler = handleMock.mock.calls.find(
			call => call[0] === 'request-ai-passage-edit'
		)![1];
		(dialog.showMessageBox as jest.Mock).mockResolvedValueOnce({response: 0});
		expect(await handler({}, request)).toBe(false);
		expect(dialog.showMessageBox).toHaveBeenCalledWith(
			expect.objectContaining({
				message: expect.stringContaining('two-way branch proposal'),
				detail: expect.stringContaining('It also sends your branch request.'),
				defaultId: 0
			})
		);
	});

	it('discloses the selected Story Knowledge size in native confirmation', async () => {
		const request = {
			storyFormat: 'SugarCube', storyFormatVersion: '2.36.1',
			passageName: 'Start', passageText: 'A closed door.',
			knowledge: [{
				scope: 'story', kind: 'world-rule', status: 'established',
				title: 'Key rule', note: 'Doors need keys.'
			}]
		};
		(requestAiPassageEdit as jest.Mock).mockImplementation(
			async (_payload, approve) => approve(request, 'deepseek-v4.1-flash')
		);
		const handler = handleMock.mock.calls.find(
			call => call[0] === 'request-ai-passage-edit'
		)![1];
		(dialog.showMessageBox as jest.Mock).mockResolvedValueOnce({response: 0});
		expect(await handler({}, request)).toBe(false);
		expect(dialog.showMessageBox).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: expect.stringContaining('1 selected established Story Knowledge notes (24 characters)')
			})
		);
	});

	it('waits for main-only preference writes before shutdown', async () => {
		let release!: () => void;
		(flushAppPrefs as jest.Mock).mockImplementation(
			() => new Promise<void>(resolve => (release = resolve))
		);
		let closed = false;
		const closing = flushStorySaves!().then(() => {
			closed = true;
		});
		while (!release) await Promise.resolve();
		expect(closed).toBe(false);
		release();
		await closing;
		expect(closed).toBe(true);
	});

	it('checks again when a main-only preference changes during the barrier', async () => {
		let version = 0;
		(getAppPrefsSaveVersion as jest.Mock).mockImplementation(() => version);
		(flushAppPrefs as jest.Mock).mockImplementationOnce(async () => {
			version++;
		});
		await flushStorySaves!();
		expect(flushAppPrefs).toHaveBeenCalledTimes(2);
	});

	it.each(['rename-story', 'delete-story'])(
		'waits for an active %s operation before shutdown',
		async operation => {
			let release!: () => void;
			const mock =
				operation === 'rename-story' ? renameStoryMock : deleteStoryMock;
			mock.mockImplementation(
				() => new Promise<void>(resolve => (release = resolve))
			);
			const handler = handleMock.mock.calls.find(
				call => call[0] === operation
			)![1];
			const story = fakeStory();
			const mutation = handler({sender: {send: jest.fn()}}, story, {
				...story,
				name: 'Renamed'
			});
			let closed = false;
			const closing = flushStorySaves!().then(() => {
				closed = true;
			});
			// Wait until the filesystem operation has begun, without releasing it.
			while (!release) await Promise.resolve();
			expect(closed).toBe(false);
			release();
			await Promise.all([mutation, closing]);
			expect(closed).toBe(true);
		}
	);

	it('serializes settings writes and waits for the latest version during shutdown', async () => {
		let release!: () => void;
		saveJsonFileMock
			.mockImplementationOnce(
				() => new Promise<void>(resolve => (release = resolve))
			)
			.mockResolvedValue(undefined);
		const handler = onMock.mock.calls.find(call => call[0] === 'save-json')![1];
		const first = handler({}, 'prefs.json', {theme: 'light'});
		const second = handler({}, 'prefs.json', {theme: 'dark'});
		let closed = false;
		const closing = flushStorySaves!().then(() => {
			closed = true;
		});
		await Promise.resolve();
		expect(saveJsonFileMock).toHaveBeenCalledTimes(1);
		expect(closed).toBe(false);
		release();
		await Promise.all([first, second, closing]);
		expect(saveJsonFileMock.mock.calls).toEqual([
			['prefs.json', {theme: 'light'}],
			['prefs.json', {theme: 'dark'}]
		]);
	});

	it('retains a failed settings write and later edits for shutdown retry', async () => {
		saveJsonFileMock
			.mockRejectedValueOnce(new Error('settings unavailable'))
			.mockResolvedValue(undefined);
		const handler = onMock.mock.calls.find(call => call[0] === 'save-json')![1];
		const first = handler({}, 'prefs.json', {theme: 'light'});
		const second = handler({}, 'prefs.json', {theme: 'dark'});
		await expect(first).rejects.toThrow('settings unavailable');
		await expect(second).rejects.toThrow('settings unavailable');
		await flushStorySaves!();
		expect(saveJsonFileMock).toHaveBeenLastCalledWith('prefs.json', {
			theme: 'dark'
		});
	});

	describe('the listener it adds for delete-story events', () => {
		let listener: any[];
		let story: Story;

		beforeEach(() => {
			listener = handleMock.mock.calls.find(call => call[0] === 'delete-story');
			story = fakeStory();
		});

		it('calls deleteStory()', async () => {
			expect(listener).not.toBeUndefined();
			await listener[1]({sender: {send: jest.fn()}}, story);
			expect(deleteStoryMock).toHaveBeenCalledWith(story);
		});

		it('sends back a story-deleted event', async () => {
			const send = jest.fn();

			expect(listener).not.toBeUndefined();
			await listener[1]({sender: {send}}, story, 'test-story-html');
			expect(send.mock.calls).toEqual([['story-deleted', story]]);
		});

		it('cancels a trailing save before deleting the story', async () => {
			jest.useFakeTimers();
			const saveListener = onMock.mock.calls.find(
				call => call[0] === 'save-story-html'
			);
			try {
				saveListener![1]({sender: {send: jest.fn()}}, story, 'first');
				saveListener![1]({sender: {send: jest.fn()}}, story, 'latest');
				saveStoryHtmlMock.mockClear();

				await listener[1]({sender: {send: jest.fn()}}, story);
				jest.advanceTimersByTime(1000);

				expect(deleteStoryMock).toHaveBeenCalledWith(story);
				expect(saveStoryHtmlMock).not.toHaveBeenCalled();
			} finally {
				jest.useRealTimers();
			}
		});

		it('keeps late saves blocked until the story is explicitly restored', async () => {
			const saveListener = onMock.mock.calls.find(
				call => call[0] === 'save-story-html'
			);
			const restoreListener = onMock.mock.calls.find(
				call => call[0] === 'restore-story'
			);
			await listener[1]({sender: {send: jest.fn()}}, story);

			saveStoryHtmlMock.mockClear();
			saveListener![1]({sender: {send: jest.fn()}}, story, 'late-save');
			await flushStorySaves!();
			expect(saveStoryHtmlMock).not.toHaveBeenCalled();

			restoreListener![1]({sender: {send: jest.fn()}}, story);
			saveListener![1]({sender: {send: jest.fn()}}, story, 'restored');
			await flushStorySaves!();
			expect(saveStoryHtmlMock).toHaveBeenLastCalledWith(story, 'restored');
		});

		it('defers an immediate undo save until deletion completes', async () => {
			let resolveDelete!: () => void;
			deleteStoryMock.mockImplementationOnce(
				() => new Promise<void>(resolve => (resolveDelete = resolve))
			);
			const saveListener = onMock.mock.calls.find(
				call => call[0] === 'save-story-html'
			);
			const restoreListener = onMock.mock.calls.find(
				call => call[0] === 'restore-story'
			);
			saveStoryHtmlMock.mockClear();

			const deletion = listener[1]({sender: {send: jest.fn()}}, story);
			await Promise.resolve();
			restoreListener![1]({sender: {send: jest.fn()}}, story);
			saveListener![1]({sender: {send: jest.fn()}}, story, 'restored');
			expect(saveStoryHtmlMock).not.toHaveBeenCalled();

			resolveDelete();
			await deletion;
			await flushStorySaves!();
			expect(saveStoryHtmlMock).toHaveBeenCalledWith(story, 'restored');
		});

		it('does not retry a failed save while deletion is in progress', async () => {
			saveStoryHtmlMock.mockRejectedValueOnce(new Error('save failed'));
			const saveListener = onMock.mock.calls.find(
				call => call[0] === 'save-story-html'
			);
			saveListener![1]({sender: {send: jest.fn()}}, story, 'failed');
			await expect(flushStorySaves!()).rejects.toThrow('save failed');
			saveStoryHtmlMock.mockClear();

			let resolveDelete!: () => void;
			deleteStoryMock.mockImplementationOnce(
				() => new Promise<void>(resolve => (resolveDelete = resolve))
			);
			const deletion = listener[1]({sender: {send: jest.fn()}}, story);
			await Promise.resolve();
			await Promise.resolve();
			const flushDuringDelete = flushStorySaves!();
			resolveDelete();
			await deletion;
			await flushDuringDelete;
			expect(saveStoryHtmlMock).not.toHaveBeenCalled();
		});
	});

	describe('the handler it adds for load-prefs events', () => {
		it('returns the value of loadPrefs() if it does not throw', async () => {
			const prefs = fakePrefs();
			loadPrefsMock.mockReturnValue(prefs);

			const listener = handleMock.mock.calls.find(
				call => call[0] === 'load-prefs'
			);

			expect(listener).not.toBeUndefined();
			expect(await listener[1]()).toEqual(prefs);
			expect(loadPrefsMock).toHaveBeenCalledTimes(1);
		});

		it('returns an empty object if loadPrefs() throws an error', async () => {
			jest.spyOn(console, 'warn').mockReturnValue();
			loadPrefsMock.mockImplementation(() => {
				throw new Error();
			});

			const listener = handleMock.mock.calls.find(
				call => call[0] === 'load-prefs'
			);

			expect(listener).not.toBeUndefined();
			expect(await listener[1]()).toEqual({});
		});
	});

	it('adds a handler for load-stories that calls loadStories()', async () => {
		const stories = [fakeStory(), fakeStory()];

		loadStoriesMock.mockReturnValue(stories);

		const listener = handleMock.mock.calls.find(
			call => call[0] === 'load-stories'
		);

		expect(await listener[1]()).toEqual(stories);
		expect(loadStoriesMock).toHaveBeenCalledTimes(1);
	});

	describe('the handler it adds for load-story-formats events', () => {
		it('returns the value of loadStoryFormats() if it does not throw', async () => {
			const formats = [fakePendingStoryFormat(), fakePendingStoryFormat()];

			loadStoryFormatsMock.mockReturnValue(formats);

			const listener = handleMock.mock.calls.find(
				call => call[0] === 'load-story-formats'
			);

			expect(listener).not.toBeUndefined();
			expect(await listener[1]()).toEqual(formats);
			expect(loadStoryFormatsMock).toHaveBeenCalledTimes(1);
		});

		it('returns an empty array if loadStoryFormats() throws an error', async () => {
			jest.spyOn(console, 'warn').mockReturnValue();
			loadStoryFormatsMock.mockImplementation(() => {
				throw new Error();
			});

			const listener = handleMock.mock.calls.find(
				call => call[0] === 'load-story-formats'
			);

			expect(listener).not.toBeUndefined();
			expect(await listener[1]()).toEqual([]);
		});
	});

	it('adds a listener for open-html-with-scratch-file events that calls openWithScratchFile()', async () => {
		const listener = onMock.mock.calls.find(
			call => call[0] === 'open-html-with-scratch-file'
		);

		expect(listener).not.toBeUndefined();
		listener[1]({}, 'test-file-contents', 'test-filename');
		expect(openWithScratchFileMock).toHaveBeenCalledWith(
			'test-file-contents',
			'test-filename'
		);
	});

	describe('the listener it adds for rename-story events', () => {
		let listener: any[];
		let newStory: Story;
		let oldStory: Story;

		beforeEach(() => {
			listener = handleMock.mock.calls.find(call => call[0] === 'rename-story');
			oldStory = fakeStory();
			newStory = {...oldStory, name: 'new-name'};
		});

		it('calls renameStory()', async () => {
			expect(listener).not.toBeUndefined();
			await listener[1]({sender: {send: jest.fn()}}, oldStory, newStory);
			expect(renameStoryMock.mock.calls).toEqual([[oldStory, newStory]]);
		});

		it('resolves its own request without a global completion event', async () => {
			const send = jest.fn();

			expect(listener).not.toBeUndefined();
			await listener[1]({sender: {send}}, oldStory, newStory);
			expect(send).not.toHaveBeenCalled();
		});
	});

	describe('the listener it adds for save-json events', () => {
		const getListener = () =>
			onMock.mock.calls.find(call => call[0] === 'save-json');

		it.each(['prefs.json', 'story-formats.json'])(
			'accepts the renderer filename %s',
			async filename => {
				const testData = {};

				const listener = getListener();
				expect(listener).not.toBeUndefined();
				await listener![1]({}, filename, testData);
				expect(saveJsonFileMock).toHaveBeenCalledWith(filename, testData);
			}
		);

		it.each([
			'test-filename.json',
			'../prefs.json',
			'..\\prefs.json',
			'C:\\temp\\prefs.json'
		])('rejects an unsafe filename %s before writing', async filename => {
			const listener = getListener();
			expect(listener).not.toBeUndefined();
			await expect(listener![1]({}, filename, {})).rejects.toThrow(
				'Invalid JSON filename.'
			);
			expect(saveJsonFileMock).not.toHaveBeenCalledWith(filename, {});
		});
	});

	describe('the listener it adds for save-story-html events', () => {
		let listener: any[];
		let story: Story;

		beforeEach(() => {
			jest.useFakeTimers();
			jest.spyOn(console, 'log').mockReturnValue();
			listener = onMock.mock.calls.find(call => call[0] === 'save-story-html');
			story = fakeStory();
		});

		afterEach(() => {
			jest.clearAllTimers();
			jest.useRealTimers();
		});

		it('calls saveStoryHtml()', async () => {
			expect(listener).not.toBeUndefined();
			await listener[1]({sender: {send: jest.fn()}}, story, 'test-story-html');
			jest.advanceTimersByTime(1000);
			expect(saveStoryHtmlMock).toHaveBeenCalledWith(story, 'test-story-html');
		});

		it('debounces calls to saveStoryHtml() for the same story ID with both leading and trailing calls', async () => {
			listener[1]({sender: {send: jest.fn()}}, story, 'test-story-html-1');
			listener[1]({sender: {send: jest.fn()}}, story, 'test-story-html-2');
			listener[1]({sender: {send: jest.fn()}}, story, 'test-story-html-3');
			jest.advanceTimersByTime(1000);
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			expect(saveStoryHtmlMock.mock.calls).toEqual([
				[story, 'test-story-html-1'],
				[story, 'test-story-html-3']
			]);
		});

		it("doesn't debounce calls to saveStoryHtml() for different story IDs", async () => {
			const story1 = fakeStory();
			const story2 = fakeStory();

			story1.id = 'mock-id-1';
			story2.id = 'mock-id-2';

			listener[1]({sender: {send: jest.fn()}}, story1, 'test-story-html-1');
			listener[1]({sender: {send: jest.fn()}}, story2, 'test-story-html-2');
			jest.advanceTimersByTime(1000);
			expect(saveStoryHtmlMock.mock.calls).toEqual([
				[story1, 'test-story-html-1'],
				[story2, 'test-story-html-2']
			]);
		});

		it('correctly debounces calls to saveStoryHtml() when multiple stories are saved at once', async () => {
			const story1 = fakeStory();
			const story2 = fakeStory();

			story1.id = 'mock-id-1';
			story2.id = 'mock-id-2';

			listener[1]({sender: {send: jest.fn()}}, story1, 'test-story-html-1');
			listener[1]({sender: {send: jest.fn()}}, story1, 'test-story-html-2');
			listener[1]({sender: {send: jest.fn()}}, story2, 'test-story-html-3');
			listener[1]({sender: {send: jest.fn()}}, story1, 'test-story-html-4');
			listener[1]({sender: {send: jest.fn()}}, story2, 'test-story-html-5');
			jest.advanceTimersByTime(1000);
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			expect(saveStoryHtmlMock.mock.calls).toEqual([
				[story1, 'test-story-html-1'],
				[story2, 'test-story-html-3'],
				[story1, 'test-story-html-4'],
				[story2, 'test-story-html-5']
			]);
		});

		it('sends back a story-html-saved event', async () => {
			const send = jest.fn();

			saveStoryHtmlMock.mockReturnValue(undefined);
			expect(listener).not.toBeUndefined();
			listener[1]({sender: {send}}, story, 'test-story-html');
			jest.advanceTimersByTime(1000);
			await Promise.resolve();
			expect(send.mock.calls).toEqual([['story-html-saved', story]]);
		});

		it('rejects if asked to save an empty string', async () => {
			expect(listener).not.toBeUndefined();
			await expect(
				listener[1]({sender: {send: jest.fn()}}, story, '')
			).rejects.toBeInstanceOf(Error);
			expect(saveStoryHtmlMock).not.toHaveBeenCalled();
		});

		it('rejects if asked to save a non-string', async () => {
			expect(listener).not.toBeUndefined();
			await expect(
				listener[1]({sender: {send: jest.fn()}}, story, null)
			).rejects.toBeInstanceOf(Error);
			expect(saveStoryHtmlMock).not.toHaveBeenCalled();
			await expect(
				listener[1]({sender: {send: jest.fn()}}, story, undefined)
			).rejects.toBeInstanceOf(Error);
			expect(saveStoryHtmlMock).not.toHaveBeenCalled();
			await expect(
				listener[1]({sender: {send: jest.fn()}}, story, false)
			).rejects.toBeInstanceOf(Error);
			expect(saveStoryHtmlMock).not.toHaveBeenCalled();
			await expect(
				listener[1](
					{sender: {send: jest.fn()}},
					story,
					Promise.resolve('some html')
				)
			).rejects.toBeInstanceOf(Error);
			expect(saveStoryHtmlMock).not.toHaveBeenCalled();
		});
	});

	describe('the flush function it returns for app shutdown', () => {
		let saveListeners: any[];
		let story: Story;
		let story2: Story;

		beforeEach(() => {
			jest.useFakeTimers();
			jest.spyOn(console, 'log').mockReturnValue();
			saveListeners = onMock.mock.calls.find(
				call => call[0] === 'save-story-html'
			);
			story = fakeStory();
			story2 = fakeStory();
		});

		afterEach(() => {
			jest.clearAllTimers();
			jest.useRealTimers();
		});

		it('flushes all pending debounced story saves', async () => {
			saveListeners[1]({sender: {send: jest.fn()}}, story, 'test-story-html-1');
			saveListeners[1]({sender: {send: jest.fn()}}, story, 'test-story-html-2');
			saveListeners[1](
				{sender: {send: jest.fn()}},
				story2,
				'test-story-html-3'
			);

			// Leading calls.

			expect(saveStoryHtmlMock.mock.calls).toEqual([
				[story, 'test-story-html-1'],
				[story2, 'test-story-html-3']
			]);
			saveStoryHtmlMock.mockClear();
			await flushStorySaves!();

			// Trailing calls.

			expect(saveStoryHtmlMock.mock.calls).toEqual([
				[story, 'test-story-html-2']
			]);
		});

		it('does nothing if there are no debounced story saves pending', async () => {
			saveListeners[1]({sender: {send: jest.fn()}}, story, 'test-story-html-1');
			saveListeners[1]({sender: {send: jest.fn()}}, story, 'test-story-html-2');
			saveListeners[1](
				{sender: {send: jest.fn()}},
				story2,
				'test-story-html-3'
			);
			jest.advanceTimersByTime(1000);
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			expect(saveStoryHtmlMock.mock.calls).toEqual([
				[story, 'test-story-html-1'],
				[story2, 'test-story-html-3'],
				[story, 'test-story-html-2']
			]);
			saveStoryHtmlMock.mockClear();
			await flushStorySaves!();
			expect(saveStoryHtmlMock).not.toHaveBeenCalled();
		});

		it('waits for an active leading save before resolving', async () => {
			let resolveSave!: () => void;
			saveStoryHtmlMock.mockImplementation(
				() => new Promise<void>(resolve => (resolveSave = resolve))
			);
			saveListeners[1]({sender: {send: jest.fn()}}, story, 'test-story-html');

			let flushed = false;
			const flush = flushStorySaves!().then(() => {
				flushed = true;
			});
			await Promise.resolve();
			expect(flushed).toBe(false);
			resolveSave();
			await flush;
			expect(flushed).toBe(true);
		});

		it('serializes leading and trailing saves for one story', async () => {
			const resolves: Array<() => void> = [];
			saveStoryHtmlMock.mockImplementation(
				() => new Promise<void>(resolve => resolves.push(resolve))
			);

			saveListeners[1]({sender: {send: jest.fn()}}, story, 'first');
			saveListeners[1]({sender: {send: jest.fn()}}, story, 'latest');
			jest.advanceTimersByTime(1000);

			expect(saveStoryHtmlMock.mock.calls).toEqual([[story, 'first']]);
			const flush = flushStorySaves!();
			resolves[0]();
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();
			expect(saveStoryHtmlMock.mock.calls).toEqual([
				[story, 'first'],
				[story, 'latest']
			]);
			resolves[1]();
			await flush;
		});

		it('rejects the shutdown flush when a disk save fails', async () => {
			saveStoryHtmlMock.mockRejectedValueOnce(new Error('save failed'));
			saveListeners[1]({sender: {send: jest.fn()}}, story, 'latest');

			await expect(flushStorySaves!()).rejects.toThrow('save failed');
		});

		it('retries the failed latest save on a later shutdown flush', async () => {
			saveStoryHtmlMock
				.mockRejectedValueOnce(new Error('temporary save failure'))
				.mockResolvedValueOnce(undefined);
			saveListeners[1]({sender: {send: jest.fn()}}, story, 'latest');

			await expect(flushStorySaves!()).rejects.toThrow(
				'temporary save failure'
			);
			expect(saveStoryHtmlMock).toHaveBeenCalledTimes(1);

			await expect(flushStorySaves!()).resolves.toBeUndefined();
			expect(saveStoryHtmlMock).toHaveBeenCalledTimes(2);
			expect(saveStoryHtmlMock).toHaveBeenLastCalledWith(story, 'latest');

			await expect(flushStorySaves!()).resolves.toBeUndefined();
			expect(saveStoryHtmlMock).toHaveBeenCalledTimes(2);
		});

		it('does not retry an older failure after a newer save succeeds', async () => {
			saveStoryHtmlMock
				.mockRejectedValueOnce(new Error('old save failed'))
				.mockResolvedValue(undefined);
			saveListeners[1]({sender: {send: jest.fn()}}, story, 'old');
			saveListeners[1]({sender: {send: jest.fn()}}, story, 'newer');

			await expect(flushStorySaves!()).resolves.toBeUndefined();
			expect(saveStoryHtmlMock.mock.calls).toEqual([
				[story, 'old'],
				[story, 'newer']
			]);

			await expect(flushStorySaves!()).resolves.toBeUndefined();
			expect(saveStoryHtmlMock).toHaveBeenCalledTimes(2);
		});
	});
});
