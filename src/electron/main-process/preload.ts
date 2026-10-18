// Exposes a limited bridge through Electron's isolated preload context. Story
// formats still run in the page context, so all bridge inputs remain untrusted.

import {contextBridge, ipcRenderer} from 'electron';
import {Story} from '../../store/stories/stories.types';
import {AiPassageEditPayload} from '../shared';

if (process.isMainFrame) {
	contextBridge.exposeInMainWorld('twineElectron', {
		aiAvailability() {
			return ipcRenderer.invoke('ai-availability');
		},
		requestAiPassageEdit(payload: AiPassageEditPayload) {
			return ipcRenderer.invoke('request-ai-passage-edit', payload);
		},
		cancelAiPassageEdit(sessionId: string) {
			ipcRenderer.send('cancel-ai-passage-edit', sessionId);
		},
		deleteStory(story: Story) {
			return ipcRenderer.invoke('delete-story', story);
		},
		loadPrefs() {
			return ipcRenderer.invoke('load-prefs');
		},
		loadStories() {
			return ipcRenderer.invoke('load-stories');
		},
		loadStoryFormats() {
			return ipcRenderer.invoke('load-story-formats');
		},
		flushStorySaves() {
			return ipcRenderer.invoke('flush-story-saves');
		},
		restoreStory(story: Story) {
			ipcRenderer.send('restore-story', story);
		},
		openHtmlWithScratchFile(data: string, filename: string) {
			ipcRenderer.send('open-html-with-scratch-file', data, filename);
		},
		renameStory(oldStory: Story, newStory: Story) {
			return ipcRenderer.invoke('rename-story', oldStory, newStory);
		},
		saveJson(filename: string, data: any) {
			ipcRenderer.send('save-json', filename, data);
		},
		saveStoryHtml(story: Story, data: string) {
			ipcRenderer.send('save-story-html', story, data);
		}
	}
);
}
