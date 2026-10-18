import {Story} from '../../store/stories/stories.types';

export interface TwineElectronWindow extends Window {
	twineElectron?: {
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
