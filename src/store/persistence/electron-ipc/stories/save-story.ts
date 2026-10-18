import {TwineElectronWindow} from '../../../../electron/shared';
import {Story} from '../../../stories';
import {publishStory, publishStoryWithFormat} from '../../../../util/publish';
import {
	formatWithNameAndVersion,
	StoryFormatsState
} from '../../../story-formats';
import {getAppInfo} from '../../../../util/app-info';
import {fetchStoryFormatProperties} from '../../../../util/story-format/fetch-properties';
import {PersistenceQueue} from '../../../../util/persistence-queue';

const storyTasks = new PersistenceQueue();

export async function waitForPendingStorySaves() {
	await storyTasks.flush();
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
	return queueTask(story.id, () => saveStoryNow(story, formats));
}

function queueTask(id: string, task: () => Promise<void>) {
	const attempt = storyTasks.enqueue(id, task);
	// Reducer middleware cannot await. Retain failures for shutdown/retry; main
	// process operations show their own error dialog.
	void attempt.catch(error =>
		console.error('Story persistence failed:', error)
	);
	return attempt;
}

export function deleteStory(story: Story) {
	return queueTask(story.id, async () => {
		await (window as TwineElectronWindow).twineElectron!.deleteStory(story);
	});
}

export function restoreStory(story: Story, formats: StoryFormatsState) {
	return queueTask(story.id, async () => {
		(window as TwineElectronWindow).twineElectron!.restoreStory?.(story);
		await saveStoryNow(story, formats);
	});
}

export function renameStory(
	oldStory: Story,
	story: Story,
	formats: StoryFormatsState
) {
	let renamed = false;
	return queueTask(story.id, async () => {
		if (!renamed) {
			await (window as TwineElectronWindow).twineElectron!.renameStory(
				oldStory,
				story
			);
			renamed = true;
		}
		await saveStoryNow(story, formats);
	});
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
