import {Story} from '../../store/stories/stories.types';

export interface AiPassageEditPayload {
	sessionId: string;
	storyFormat: string;
	storyFormatVersion: string;
	passageId: string;
	passageName: string;
	passageText: string;
	instruction: 'repair-format-syntax' | 'propose-conditional-choice' | 'propose-new-branch';
	request?: string;
	destinations?: Array<{id: string; name: string}>;
}

export interface AiAvailability {
	configured: boolean;
	model?: string;
	reason?: string;
}

export interface TwineElectronWindow extends Window {
	twineElectron?: {
		aiAvailability(): Promise<AiAvailability>;
		requestAiPassageEdit(payload: AiPassageEditPayload): Promise<string>;
		cancelAiPassageEdit(sessionId: string): void;
		deleteStory(story: Story): Promise<void>;
		loadPrefs(): Promise<any>;
		loadStories(): Promise<any>;
		loadStoryFormats(): Promise<any>;
		flushStorySaves(): Promise<void>;
		restoreStory?(story: Story): void;
		openHtmlWithScratchFile(data: string, filename: string): void;
		renameStory(oldStory: Story, newStory: Story): Promise<void>;
		saveStoryHtml(story: Story, data: string): void;
		saveJson(filename: string, data: any): void;
	};
}
