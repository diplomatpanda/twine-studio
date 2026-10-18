import {app, BrowserWindow, dialog, shell} from 'electron';
import {initApp} from '../init-app';
import {initIpc} from '../ipc';
import {initLocales} from '../locales';
import {initMenuBar} from '../menu-bar';
import {
	backupStoryDirectory,
	createStoryDirectory,
	initStoryDirectory
} from '../story-directory';
import {cleanScratchDirectory} from '../scratch-file';

jest.mock('electron');
jest.mock('../app-prefs');
jest.mock('../ipc');
jest.mock('../locales');
jest.mock('../menu-bar');
jest.mock('../story-directory');
jest.mock('../scratch-file');

describe('initApp', () => {
	const initIpcMock = initIpc as jest.Mock;
	const initLocalesMock = initLocales as jest.Mock;
	const initMenuBarMock = initMenuBar as jest.Mock;
	const initStoryDirectoryMock = initStoryDirectory as jest.Mock;
	const backupStoryDirectoryMock = backupStoryDirectory as jest.Mock;
	const cleanScratchDirectoryMock = cleanScratchDirectory as jest.Mock;
	const createStoryDirectoryMock = createStoryDirectory as jest.Mock;
	const onMock = app.on as jest.Mock;
	const quitMock = app.quit as jest.Mock;
	const showErrorBoxMock = dialog.showErrorBox as jest.Mock;
	const openExternalMock = shell.openExternal as jest.Mock;
	const browserWindowMock = BrowserWindow as unknown as {
		instances: BrowserWindow[];
	};

	beforeEach(() => {
		browserWindowMock.instances.length = 0;
		jest.spyOn(global, 'setInterval');
	});

	it('initializes locales', async () => {
		await initApp();
		expect(initLocalesMock).toHaveBeenCalledTimes(1);
	});

	it('initializes the story directory', async () => {
		await initApp();
		expect(initStoryDirectoryMock).toHaveBeenCalledTimes(1);
	});

	it('creates the story directory', async () => {
		await initApp();
		expect(createStoryDirectoryMock).toHaveBeenCalledTimes(1);
	});

	it('backs up the story directory', async () => {
		await initApp();
		expect(backupStoryDirectoryMock).toHaveBeenCalledTimes(1);
	});

	it('initializes backing up the story directory every 20 minutes', async () => {
		await initApp();
		expect((global.setInterval as unknown as jest.Mock).mock.calls).toEqual([
			[backupStoryDirectory, 1000 * 60 * 20]
		]);
	});

	it('flushes saves and cleans the scratch directory before quitting', async () => {
		await initApp();

		const onQuit = onMock.mock.calls.find(([event]) => event === 'before-quit');

		expect(onQuit).not.toBeUndefined();
		expect(cleanScratchDirectoryMock).not.toHaveBeenCalled();
		const event = {preventDefault: jest.fn()};
		onQuit[1](event);
		expect(event.preventDefault).toHaveBeenCalledTimes(1);
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(cleanScratchDirectoryMock).toHaveBeenCalledTimes(1);
		expect(quitMock).toHaveBeenCalledTimes(1);
	});

	it('guards the native window close until saves finish', async () => {
		await initApp();

		const window = browserWindowMock.instances.at(-1)!;
		const windowMock = window as unknown as {on: jest.Mock};
		const onClose = windowMock.on.mock.calls.find(
			(call: unknown[]) => call[0] === 'close'
		);
		expect(onClose).not.toBeUndefined();
		const event = {preventDefault: jest.fn()};
		onClose[1](event);

		expect(event.preventDefault).toHaveBeenCalledTimes(1);
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(quitMock).toHaveBeenCalledTimes(1);
	});

	it('keeps the window open when story saves fail during shutdown', async () => {
		const saveError = new Error('save failed');
		initIpcMock.mockReturnValue(async () => {
			throw saveError;
		});
		await initApp();

		const onQuit = onMock.mock.calls.find(([event]) => event === 'before-quit');
		const event = {preventDefault: jest.fn()};
		onQuit[1](event);
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(event.preventDefault).toHaveBeenCalledTimes(1);
		expect(cleanScratchDirectoryMock).not.toHaveBeenCalled();
		expect(quitMock).not.toHaveBeenCalled();
		expect(showErrorBoxMock).toHaveBeenCalledWith(
			'Twine Studio could not finish saving.',
			expect.stringContaining('Your window has been kept open')
		);
		const window = browserWindowMock.instances.at(-1)! as unknown as {
			setEnabled: jest.Mock;
		};
		expect(window.setEnabled.mock.calls).toEqual([[false], [true]]);
	});

	it('waits for writes queued during cleanup before completing shutdown', async () => {
		let release!: () => void;
		const flush = jest
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockImplementationOnce(
				() => new Promise<void>(resolve => (release = resolve))
			);
		initIpcMock.mockReturnValue(flush);
		await initApp();
		const onQuit = onMock.mock.calls.find(([event]) => event === 'before-quit');
		onQuit[1]({preventDefault: jest.fn()});
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(cleanScratchDirectoryMock).toHaveBeenCalledTimes(1);
		expect(quitMock).not.toHaveBeenCalled();
		release();
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(quitMock).toHaveBeenCalledTimes(1);
	});

	it('initializes IPC', async () => {
		await initApp();
		expect(initIpcMock).toHaveBeenCalledTimes(1);
	});

	it('initializes the menu bar', async () => {
		await initApp();
		expect(initMenuBarMock).toHaveBeenCalledTimes(1);
	});

	it('configures the main window with isolated sandboxed web contents', async () => {
		await initApp();

		const window = browserWindowMock.instances.at(-1)! as unknown as {
			options: {webPreferences: Record<string, unknown>};
		};
		expect(window.options.webPreferences).toMatchObject({
			sandbox: true,
			nodeIntegration: false,
			contextIsolation: true,
			nodeIntegrationInSubFrames: false
		});
	});

	it.each(['http://example.com', 'https://example.com', 'mailto:test@example.com'])(
		'opens allowed external navigation URL %s',
		async url => {
			await initApp();

			const window = browserWindowMock.instances.at(-1)!;
			const webContents = window.webContents as unknown as {
				on: jest.Mock;
			};
			const navigateHandler = webContents.on.mock.calls.find(
				([event]) => event === 'will-navigate'
			)[1];
			const event = {preventDefault: jest.fn()};

			navigateHandler(event, url);

			expect(openExternalMock).toHaveBeenCalledWith(url);
			expect(event.preventDefault).toHaveBeenCalledTimes(1);
		}
	);

	it.each([
		'file:///tmp/story.html',
		'javascript:alert(1)',
		'custom-protocol://story',
		'not a URL'
	])('blocks unsafe or invalid navigation URL %s', async url => {
		await initApp();

		const window = browserWindowMock.instances.at(-1)!;
		const webContents = window.webContents as unknown as {
			on: jest.Mock;
		};
		const navigateHandler = webContents.on.mock.calls.find(
			([event]) => event === 'will-navigate'
		)[1];
		const event = {preventDefault: jest.fn()};

		navigateHandler(event, url);

		expect(openExternalMock).not.toHaveBeenCalled();
		expect(event.preventDefault).toHaveBeenCalledTimes(1);
	});

	it('opens allowed window URLs externally and denies the new window', async () => {
		await initApp();

		const window = browserWindowMock.instances.at(-1)!;
		const setWindowOpenHandler = window.webContents
			.setWindowOpenHandler as jest.Mock;
		const handler = setWindowOpenHandler.mock.calls[0][0];

		expect(handler({url: 'https://example.com'})).toEqual({action: 'deny'});
		expect(openExternalMock).toHaveBeenCalledWith('https://example.com');
	});

	it('denies unsafe window URLs without opening them externally', async () => {
		await initApp();

		const window = browserWindowMock.instances.at(-1)!;
		const setWindowOpenHandler = window.webContents
			.setWindowOpenHandler as jest.Mock;
		const handler = setWindowOpenHandler.mock.calls[0][0];

		expect(handler({url: 'javascript:alert(1)'})).toEqual({action: 'deny'});
		expect(openExternalMock).not.toHaveBeenCalled();
	});

	it.todo('creates the main window');
	it.todo('injects user CSS into the main window if available');

	it('does not show an error dialog when everything loads', async () => {
		await initApp();
		expect(showErrorBoxMock).not.toHaveBeenCalled();
	});

	it('displays an error dialog and quits if an error occurs', async () => {
		initLocalesMock.mockRejectedValue(new Error());
		await initApp();
		expect(showErrorBoxMock).toHaveBeenCalledTimes(1);
		expect(quitMock).toHaveBeenCalledTimes(1);
	});
});
