import {TwineElectronWindow} from '../../../../electron/shared';
import {Story} from '../../../stories';
import {publishStory, publishStoryWithFormat} from '../../../../util/publish';
import {
	formatWithNameAndVersion,
	StoryFormatsState
} from '../../../story-formats';
import {getAppInfo} from '../../../../util/app-info';
import {fetchStoryFormatProperties} from '../../../../util/story-format/fetch-properties';

const pendingStorySaves = new Set<Promise<void>>();
const storySaveChains = new Map<string, Promise<void>>();

export async function waitForPendingStorySaves() {
	while (pendingStorySaves.size > 0) {
		await Promise.all([...pendingStorySaves]);
	}
}

declare global {
	interface Window {
		__twineWaitForPendingStorySaves?: () => Promise<void>;
	}
}

if (typeof window !== 'undefined') {
	window.__twineWaitForPendingStorySaves = waitForPendingStorySaves;
}

/**
 * Sends an IPC message to save a story to disk, ideally in published form.
 */
export function saveStory(story: Story, formats: StoryFormatsState) {
	const previousSave = storySaveChains.get(story.id);
	const save = previousSave
		? previousSave.catch(() => undefined).then(() => saveStoryNow(story, formats))
		: saveStoryNow(story, formats);
	storySaveChains.set(story.id, save);
	pendingStorySaves.add(save);
	void save.then(
		() => {
			pendingStorySaves.delete(save);
			if (storySaveChains.get(story.id) === save) {
				storySaveChains.delete(story.id);
			}
		},
		() => {
			pendingStorySaves.delete(save);
			if (storySaveChains.get(story.id) === save) {
				storySaveChains.delete(story.id);
			}
		}
	);
	return save;
}

async function saveStoryNow(story: Story, formats: StoryFormatsState) {
	const {twineElectron} = window as TwineElectronWindow;

	if (!twineElectron) {
		throw new Error('Electron bridge is not present on window.');
	}

	try {
		const format = formatWithNameAndVersion(
			formats,
			story.storyFormat,
			story.storyFormatVersion
		);

		if (format.loadState === 'loaded') {
			twineElectron.saveStoryHtml(
				story,
				publishStoryWithFormat(story, format.properties.source, getAppInfo(), {
					startOptional: true
				})
			);
		} else {
			const {source} = await fetchStoryFormatProperties(format.url);

			twineElectron.saveStoryHtml(
				story,
				publishStoryWithFormat(story, source, getAppInfo(), {
					startOptional: true
				})
			);
		}
	} catch (error) {
		console.warn(
			`Could not save full story (${
				(error as Error).message
			}). Trying to save story data only.`
		);
		twineElectron.saveStoryHtml(
			story,
			publishStory(story, getAppInfo(), {startOptional: true})
		);
	}
}
