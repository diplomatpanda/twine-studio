import {app, BrowserWindow, dialog} from 'electron';
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
	});

	it('initializes IPC', async () => {
		await initApp();
		expect(initIpcMock).toHaveBeenCalledTimes(1);
	});

	it('initializes the menu bar', async () => {
		await initApp();
		expect(initMenuBarMock).toHaveBeenCalledTimes(1);
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
