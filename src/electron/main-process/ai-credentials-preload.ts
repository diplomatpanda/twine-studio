import {contextBridge, ipcRenderer} from 'electron';

if (process.isMainFrame) {
	contextBridge.exposeInMainWorld('credentialBridge', {
		status: () => ipcRenderer.invoke('ai-credential-status'),
		save: (key: string) => ipcRenderer.invoke('ai-credential-save', key),
		clear: () => ipcRenderer.invoke('ai-credential-clear'),
		close: () => ipcRenderer.invoke('ai-credential-close')
	});
}
