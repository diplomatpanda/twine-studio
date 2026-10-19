import {BrowserWindow, ipcMain} from 'electron';
import {aiCredentialStatus, clearAiKey, saveAiKey} from '../ai-credentials';
import {openAiCredentialWindow, registerAiCredentialWindowIpc} from '../ai-credentials-window';

jest.mock('electron');
jest.mock('../ai-credentials');

describe('isolated AI credential window', () => {
	const windows = BrowserWindow as unknown as {instances: Array<any>};
	beforeEach(() => {
		jest.clearAllMocks();
		windows.instances.length = 0;
		registerAiCredentialWindowIpc();
	});

	it('uses a separate sandboxed preload and blocks navigation', async () => {
		const closed = openAiCredentialWindow();
		const win = windows.instances[0];
		expect(win.options.webPreferences).toMatchObject({
			partition: 'ai-credentials',
			sandbox: true,
			nodeIntegration: false,
			contextIsolation: true,
			nodeIntegrationInSubFrames: false
		});
		expect(win.options.webPreferences.preload).toContain('ai-credentials-preload.js');
		expect(win.loadURL).toHaveBeenCalledWith(expect.stringMatching(/^data:text\/html/));
		expect(win.webContents.setWindowOpenHandler).toHaveBeenCalled();
		const navigation = win.webContents.on.mock.calls.find(([name]: string[]) => name === 'will-navigate')[1];
		const event = {preventDefault: jest.fn()};
		navigation(event);
		expect(event.preventDefault).toHaveBeenCalled();
		win.on.mock.calls.find(([name]: string[]) => name === 'closed')[1]();
		await closed;
	});

	it('rejects credential IPC from the story renderer', async () => {
		const closed = openAiCredentialWindow();
		const win = windows.instances[0];
		const handlers = new Map<string, (...args: any[]) => any>((ipcMain.handle as jest.Mock).mock.calls);
		const outsider = {sender: {}};
		expect(() => handlers.get('ai-credential-status')!(outsider)).toThrow('isolated key window');
		await expect(handlers.get('ai-credential-save')!(outsider, 'secret')).rejects.toThrow('isolated key window');
		await expect(handlers.get('ai-credential-clear')!(outsider)).rejects.toThrow('isolated key window');
		expect(() => handlers.get('ai-credential-close')!(outsider)).toThrow('isolated key window');
		expect(saveAiKey).not.toHaveBeenCalled();
		expect(clearAiKey).not.toHaveBeenCalled();
		expect(aiCredentialStatus).not.toHaveBeenCalled();
		await handlers.get('ai-credential-save')!({sender: win.webContents}, 'secret');
		expect(saveAiKey).toHaveBeenCalledWith('secret');
		handlers.get('ai-credential-close')!({sender: win.webContents});
		expect(win.close).toHaveBeenCalled();
		win.on.mock.calls.find(([name]: string[]) => name === 'closed')[1]();
		await closed;
	});
});
