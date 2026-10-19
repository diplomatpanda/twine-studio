import {Story} from '../../store/stories/stories.types';
import {StoryKnowledgeKind} from '../../store/stories/story-knowledge';

export const MAX_AI_KNOWLEDGE_ENTRIES = 4;

export interface AiKnowledgeContextEntry {
	scope: 'story' | 'passage';
	kind: StoryKnowledgeKind;
	status: 'established';
	title: string;
	note: string;
}

export interface AiPassageEditPayload {
	sessionId: string;
	storyFormat: string;
	storyFormatVersion: string;
	passageId: string;
	passageName: string;
	passageText: string;
	instruction: 'repair-format-syntax' | 'propose-conditional-choice' | 'propose-new-branch' | 'propose-two-way-branch';
	request?: string;
	destinations?: Array<{id: string; name: string}>;
	knowledge?: AiKnowledgeContextEntry[];
}

export interface AiAvailability {
	configured: boolean;
	model?: string;
	reason?: string;
}

export interface TwineElectronWindow extends Window {
	twineElectron?: {
		openAiCredentials(): Promise<void>;
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
