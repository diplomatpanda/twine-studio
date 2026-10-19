import {BrowserWindow, ipcMain} from 'electron';
import path from 'path';
import {aiCredentialStatus, clearAiKey, saveAiKey} from './ai-credentials';

let credentialWindow: BrowserWindow | null = null;
let windowClosed: Promise<void> | undefined;

// This page contains no story data or third-party content. Its separate preload
// is the only renderer surface allowed to submit a credential.
const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OpenCode Go key</title>
<style>
body { font: 14px system-ui, sans-serif; color: #20232b; background: #fff; margin: 24px; }
h1 { font-size: 21px; margin: 0 0 12px; }
p { line-height: 1.5; }
label { display: block; font-weight: 600; margin: 16px 0 6px; }
input { box-sizing: border-box; width: 100%; padding: 9px; font: inherit; }
button { margin: 14px 8px 0 0; padding: 8px 12px; font: inherit; }
#message { min-height: 21px; } .hint { color: #4b5563; }
</style></head><body>
<h1>OpenCode Go key</h1>
<p class="hint">Enter your own key for optional, approved AI code edits. The key is kept out of stories and encrypted with this device's credential service.</p>
<p id="status" role="status">Checking credential storage…</p>
<form id="key-form"><label for="key">API key</label>
<input id="key" type="password" autocomplete="off" spellcheck="false" maxlength="4096" required>
<button id="save" type="submit">Save key</button>
<button id="remove" type="button">Remove saved key</button>
<button id="done" type="button">Done</button></form>
<p id="message" role="alert"></p>
<script>
const bridge = window.credentialBridge;
const status = document.getElementById('status');
const message = document.getElementById('message');
const key = document.getElementById('key');
const save = document.getElementById('save');
const remove = document.getElementById('remove');
async function refresh() {
  try {
    const result = await bridge.status();
    status.textContent = result.source === 'environment'
      ? 'An environment-provided key is active. A saved key is used only when that variable is removed.'
      : result.source === 'saved' ? 'A saved key is available.' : 'No key is configured.';
    save.disabled = !result.storageAvailable;
    if (!result.storageAvailable) message.textContent = 'Secure credential storage is unavailable on this device.';
  } catch (error) { message.textContent = String(error.message || error); }
}
document.getElementById('key-form').addEventListener('submit', async event => {
  event.preventDefault();
  const value = key.value;
  key.value = '';
  save.disabled = true;
  message.textContent = '';
  try { await bridge.save(value); message.textContent = 'Key saved securely.'; }
  catch (error) { message.textContent = String(error.message || error); }
  await refresh();
});
remove.addEventListener('click', async () => {
  key.value = '';
  message.textContent = '';
  try { await bridge.clear(); message.textContent = 'Saved key removed.'; }
  catch (error) { message.textContent = String(error.message || error); }
  await refresh();
});
document.getElementById('done').addEventListener('click', () => bridge.close());
void refresh();
</script></body></html>`;

function requireCredentialWindow(event: Electron.IpcMainInvokeEvent) {
	if (!credentialWindow || event.sender !== credentialWindow.webContents) {
		throw new Error('Credential access is limited to the isolated key window.');
	}
}

export function registerAiCredentialWindowIpc() {
	ipcMain.handle('ai-credential-status', event => {
		requireCredentialWindow(event);
		return aiCredentialStatus();
	});
	ipcMain.handle('ai-credential-save', async (event, key) => {
		requireCredentialWindow(event);
		await saveAiKey(key);
	});
	ipcMain.handle('ai-credential-clear', async event => {
		requireCredentialWindow(event);
		await clearAiKey();
	});
	ipcMain.handle('ai-credential-close', event => {
		requireCredentialWindow(event);
		credentialWindow!.close();
	});
}

export function openAiCredentialWindow(parent?: BrowserWindow) {
	if (credentialWindow) {
		credentialWindow.focus();
		return windowClosed!;
	}
	const win = new BrowserWindow({
		parent,
		modal: !!parent,
		width: 510,
		height: 385,
		minWidth: 420,
		minHeight: 350,
		show: false,
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.resolve(__dirname, './ai-credentials-preload.js'),
			partition: 'ai-credentials',
			sandbox: true,
			nodeIntegration: false,
			contextIsolation: true,
			nodeIntegrationInSubFrames: false
		}
	});
	credentialWindow = win;
	let rejectWindow!: (error: Error) => void;
	windowClosed = new Promise((resolve, reject) => {
		rejectWindow = reject;
		win.on('closed', () => {
			credentialWindow = null;
			windowClosed = undefined;
			resolve();
		});
	});
	win.webContents.on('will-navigate', event => event.preventDefault());
	win.webContents.on('will-redirect', event => event.preventDefault());
	win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
	win.once('ready-to-show', () => win.show());
	void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(PAGE)}`)
		.catch(() => {
			rejectWindow(new Error('Could not open the credential window.'));
			win.close();
		});
	return windowClosed;
}
