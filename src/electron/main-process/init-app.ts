import {app, BrowserWindow, dialog, screen, shell} from 'electron';
import path from 'path';
import {initIpc} from './ipc';
import {initLocales} from './locales';
import {initMenuBar} from './menu-bar';
import {cleanScratchDirectory} from './scratch-file';
import {
	backupStoryDirectory,
	createStoryDirectory,
	initStoryDirectory
} from './story-directory';
import {getUserCss} from './user-css';

let mainWindow: BrowserWindow | null = null;

const externalProtocols = new Set(['http:', 'https:', 'mailto:']);

function parseURL(url: string): URL | undefined {
	try {
		return new URL(url);
	} catch {
		return undefined;
	}
}

function openExternalURL(url: string) {
	const parsedURL = parseURL(url);

	if (!parsedURL || !externalProtocols.has(parsedURL.protocol)) return false;

	shell.openExternal(url);
	return true;
}

async function flushRendererChanges() {
	if (!mainWindow) return;

	// The renderer batches passage edits for one second. Electron invokes
	// before-quit before it starts unloading renderer windows, so trigger the
	// existing renderer flush hook while the window is still alive. Then wait
	// for renderer publication promises and for the renderer to ask the main
	// process to flush, which acknowledges that all save IPC messages emitted by
	// the hook have reached ipcMain.
	await mainWindow.webContents.executeJavaScript(
		"(async () => { window.dispatchEvent(new Event('beforeunload')); if (window.__twineWaitForPendingStorySaves) await window.__twineWaitForPendingStorySaves(); await window.twineElectron.flushStorySaves(); })();"
	);
}

async function createWindow(
	onClose: (event: {preventDefault(): void}) => void
) {
	const screenSize = screen.getPrimaryDisplay().workAreaSize;

	mainWindow = new BrowserWindow({
		height: Math.round(screenSize.height * 0.9),
		width: Math.round(screenSize.width * 0.9),
		show: false,
		webPreferences: {
			preload: path.resolve(__dirname, './preload.js'),
			sandbox: true,
			nodeIntegration: false,
			contextIsolation: true,
			nodeIntegrationInSubFrames: false
		}
	});
	mainWindow.loadURL(
		// Path is relative to this file in the electron-build/ directory that's
		// created during `npm run build:electron-main`.
		// app.isPackaged
		`file://${path.resolve(__dirname, '../../../../renderer/index.html')}`
	);

	mainWindow.once('ready-to-show', async () => {
		const userCss = await getUserCss();

		if (userCss) {
			console.log('Adding user CSS');
			mainWindow!.webContents.insertCSS(userCss);
		}

		mainWindow!.show();

		if (!app.isPackaged) {
			mainWindow!.webContents.openDevTools();
		}
	});
	mainWindow.on('closed', () => (mainWindow = null));
	mainWindow.on('close', onClose);

	// Load external links in the system browser.

	mainWindow.webContents.on('will-navigate', (event, url) => {
		openExternalURL(url);
		event.preventDefault();
	});
	mainWindow.webContents.setWindowOpenHandler(({url}) => {
		openExternalURL(url);
		return {action: 'deny'};
	});
}

export async function initApp() {
	try {
		await initLocales();
		await initStoryDirectory();
		await createStoryDirectory();
		await backupStoryDirectory();
		setInterval(backupStoryDirectory, 1000 * 60 * 20);
		const flushStorySaves = initIpc() ?? (async () => {});
		initMenuBar();

		// Electron does not await async event listeners. Prevent the first close or
		// quit event, finish all renderer and disk work, then start one controlled
		// quit. A failed flush clears the guard and leaves the window open so the
		// user can retry without losing the latest edit.
		let quitStarted = false;
		let quitFinished = false;
		const requestQuit = (event?: {preventDefault(): void}) => {
			if (quitFinished) return;

			event?.preventDefault();
			if (quitStarted) return;
			quitStarted = true;
			// Do not accept another edit while the final renderer/disk snapshot is
			// being drained. Restore input if saving fails and the window stays open.
			mainWindow?.setEnabled(false);

			void (async () => {
				try {
					await flushRendererChanges();
					await flushStorySaves();
					try {
						await cleanScratchDirectory();
					} catch (error) {
						console.error('Error while cleaning scratch files:', error);
					}
					// Native menu actions can enqueue preferences during cleanup.
					// Finish those writes immediately before the controlled quit.
					await flushStorySaves();
				} catch (error) {
					console.error('Error while flushing renderer or story saves:', error);
					quitStarted = false;
					mainWindow?.setEnabled(true);
					dialog.showErrorBox(
						'Twine Studio could not finish saving.',
						'Your window has been kept open. Check the storage location and try closing again. ' +
							(error as Error).message
					);
					return;
				}

				quitFinished = true;
				app.quit();
			})();
		};

		app.on('before-quit', requestQuit);
		// window-all-closed calls app.quit(), but the window close event itself
		// happens first. Prevent it so the renderer is still available to flush.
		createWindow(requestQuit);
	} catch (error) {
		// Not localized because that may be the cause of the error.

		dialog.showErrorBox(
			'An error occurred during startup.',
			(error as Error).message
		);
		app.quit();
	}
}
