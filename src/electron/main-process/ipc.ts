import {dialog, ipcMain} from 'electron';
import debounce from 'lodash/debounce';
import type {DebouncedFunc} from 'lodash';
import {i18n} from './locales';
import {saveJsonFile} from './json-file';
import {
	deleteStory,
	loadStories,
	renameStory,
	saveStoryHtml
} from './story-file';
import {loadStoryFormats} from './story-formats';
import {loadPrefs} from './prefs';
import {openHtmlWithScratchFile} from './scratch-file';
import {Story} from '../../store/stories/stories.types';

const allowedJsonFilenames = new Set(['prefs.json', 'story-formats.json']);

function validateJsonFilename(filename: unknown): asserts filename is string {
	if (typeof filename !== 'string' || !allowedJsonFilenames.has(filename)) {
		throw new Error('Invalid JSON filename.');
	}
}

export function initIpc() {
	// We want to debounce story saves so we aren't constantly writing to disk.
	// However, we need to have individual debounced functions per story so that
	// saves on multiple stories in one interval aren't lost. So we maintain a set
	// of debounced functions keyed by story ID.
	//
	// These still take an argument because the individual invocations will see a
	// different story object each time.

	type StorySaveArgs = {
		event: any;
		story: Story;
		storyHtml: string;
		generation: number;
	};
	const storySavers: Record<
		string,
		DebouncedFunc<(args: StorySaveArgs) => Promise<void>>
	> = {};
	const activeStorySaves = new Set<Promise<void>>();
	const storySaveChains = new Map<string, Promise<void>>();
	const latestStorySaveArgs = new Map<string, StorySaveArgs>();
	const failedStorySaves = new Map<string, StorySaveArgs>();
	const nextStorySaveGeneration = new Map<string, number>();
	const deletedStoryIds = new Set<string>();
	const deletingStoryIds = new Set<string>();
	const pendingStoryRestores = new Set<string>();
	const deferredRestoredStorySaves = new Map<string, StorySaveArgs>();

	const enqueueStorySave = (args: StorySaveArgs) => {
		const {event, story, storyHtml} = args;
		if (deletedStoryIds.has(story.id)) return Promise.resolve();
		const saveStoryNow = async () => {
			try {
				await saveStoryHtml(story, storyHtml);
				event.sender.send('story-html-saved', story);
				const failedArgs = failedStorySaves.get(story.id);
				if (failedArgs && failedArgs.generation <= args.generation) {
					failedStorySaves.delete(story.id);
				}
			} catch (error) {
				// Preserve the latest arguments so a later shutdown attempt can retry
				// the same edit even though lodash's flush() retains a rejected result.
				failedStorySaves.set(
					story.id,
					latestStorySaveArgs.get(story.id) ?? args
				);
				dialog.showErrorBox(
					i18n.t('electron.errors.storySave'),
					(error as Error).message
				);
				throw error;
			}
		};
		const previousSave = storySaveChains.get(story.id);
		const save = previousSave
			? previousSave.catch(() => undefined).then(saveStoryNow)
			: saveStoryNow();
		storySaveChains.set(story.id, save);

		// Lodash's flush() does not wait for a leading invocation that is
		// already in progress, so track every actual disk write too.
		const trackedSave = save.then(
			() => {
				activeStorySaves.delete(trackedSave);
			},
			error => {
				activeStorySaves.delete(trackedSave);
				throw error;
			}
		);
		activeStorySaves.add(trackedSave);
		// The IPC listener cannot await a debounced callback. The dialog
		// above remains the user-facing error path, while this prevents a
		// failed save from becoming an unhandled rejection.
		void trackedSave.catch(() => undefined);
		return trackedSave;
	};

	const scheduleStorySave = (args: StorySaveArgs) => {
		const {story} = args;
		if (!storySavers[story.id]) {
			storySavers[story.id] = debounce(
				(saveArgs: StorySaveArgs) => enqueueStorySave(saveArgs),
				1000,
				{leading: true, trailing: true}
			);
		}
		storySavers[story.id](args);
	};

	ipcMain.on('delete-story', async (event, story) => {
		const storyId = story.id;
		deletingStoryIds.add(storyId);
		deletedStoryIds.add(storyId);
		storySavers[storyId]?.cancel();

		try {
			// Finish a write that was already active before deleting the file. Any
			// trailing debounce is canceled above, and new saves are ignored while
			// this deletion is in progress.
			await storySaveChains.get(storyId)?.catch(() => undefined);
			await deleteStory(story);
			const restoreRequested = pendingStoryRestores.delete(storyId);
			const deferredRestore = deferredRestoredStorySaves.get(storyId);
			deferredRestoredStorySaves.delete(storyId);
			delete storySavers[storyId];
			storySaveChains.delete(storyId);
			latestStorySaveArgs.delete(storyId);
			failedStorySaves.delete(storyId);
			deletingStoryIds.delete(storyId);
			if (restoreRequested) {
				deletedStoryIds.delete(storyId);
				if (deferredRestore) {
					latestStorySaveArgs.set(storyId, deferredRestore);
					scheduleStorySave(deferredRestore);
				}
			}
			// Keep this ID blocked unless the renderer explicitly restored it while
			// deletion was in progress.
			event.sender.send('story-deleted', story);
		} catch (error) {
			deletingStoryIds.delete(storyId);
			const restoreRequested = pendingStoryRestores.delete(storyId);
			const deferredRestore = deferredRestoredStorySaves.get(storyId);
			deferredRestoredStorySaves.delete(storyId);
			deletedStoryIds.delete(storyId);
			if (restoreRequested && deferredRestore) {
				latestStorySaveArgs.set(storyId, deferredRestore);
				scheduleStorySave(deferredRestore);
			}
			dialog.showErrorBox(
				i18n.t('electron.errors.storyDelete'),
				(error as Error).message
			);
			throw error;
		}
	});

	ipcMain.on('restore-story', (_event, story) => {
		// Do not clear the tombstone until trashing finishes. Any save emitted by
		// an immediate undo is retained and replayed after deletion completes.
		if (deletingStoryIds.has(story.id)) {
			pendingStoryRestores.add(story.id);
		} else {
			deletedStoryIds.delete(story.id);
		}
	});

	// These use handle() so that they can return data to the renderer process.

	ipcMain.handle('load-prefs', async () => {
		try {
			return await loadPrefs();
		} catch (error) {
			console.warn(`Could not load prefs, returning empty object: ${error}`);
			return {};
		}
	});

	ipcMain.handle('load-stories', loadStories);

	ipcMain.handle('load-story-formats', async () => {
		try {
			return await loadStoryFormats();
		} catch (error) {
			console.warn(
				`Could not load story formats, returning empty array: ${error}`
			);
			return [];
		}
	});

	ipcMain.on(
		'open-html-with-scratch-file',
		(event, data: string, filename: string) => {
			openHtmlWithScratchFile(data, filename);
		}
	);

	// This doesn't use handle() because state reducers in the renderer process
	// can't be be asynchronous--we have to send a signal back.

	ipcMain.on('rename-story', async (event, oldStory, newStory) => {
		try {
			await renameStory(oldStory, newStory);
			event.sender.send('story-renamed', oldStory, newStory);
		} catch (error) {
			dialog.showErrorBox(
				i18n.t('electron.errors.storyRename'),
				(error as Error).message
			);
			throw error;
		}
	});

	ipcMain.on('save-json', async (event, filename: string, data: any) => {
		try {
			validateJsonFilename(filename);
			await saveJsonFile(filename, data);
		} catch (error) {
			dialog.showErrorBox(
				i18n.t('electron.errors.jsonSave'),
				(error as Error).message
			);
			throw error;
		}
	});

	ipcMain.on('save-story-html', async (event, story, storyHtml) => {
		try {
			if (typeof storyHtml !== 'string') {
				throw new Error('Asked to save non-string as story HTML');
			}

			if (storyHtml.trim() === '') {
				throw new Error('Asked to save empty string as story HTML');
			}
			const generation = (nextStorySaveGeneration.get(story.id) ?? 0) + 1;
			nextStorySaveGeneration.set(story.id, generation);
			const args: StorySaveArgs = {event, story, storyHtml, generation};
			if (deletedStoryIds.has(story.id)) {
				if (deletingStoryIds.has(story.id) && pendingStoryRestores.has(story.id)) {
					deferredRestoredStorySaves.set(story.id, args);
				}
				return;
			}
			latestStorySaveArgs.set(story.id, args);
			scheduleStorySave(args);
		} catch (error) {
			dialog.showErrorBox(
				i18n.t('electron.errors.storySave'),
				(error as Error).message
			);
			throw error;
		}
	});

	const flushStorySaves = async function flushStorySaves() {
		const errors: unknown[] = [];

		if (Object.keys(storySavers).length > 0) {
			// Flush all pending story saves.

			for (const storyId of Object.keys(storySavers)) {
				console.log(`Flushing pending story saves for story ID ${storyId}`);
				const failedBeforeFlush = failedStorySaves.has(storyId);
				let flushError: unknown;
				try {
					await storySavers[storyId].flush();
				} catch (error) {
					// lodash retains a rejected lastResult forever. If no failed save
					// is currently cached, this rejection is stale after a successful
					// retry and must not make a later flush fail again.
					if (failedStorySaves.has(storyId)) flushError = error;
				}

				// A rejected lodash flush remains rejected on subsequent flushes and
				// does not invoke the callback again. Retry only on a later shutdown
				// attempt, leaving the window open after the first failed attempt.
				if (failedBeforeFlush) {
					const failedArgs = failedStorySaves.get(storyId);
					if (failedArgs) {
						try {
							await enqueueStorySave(failedArgs);
							flushError = undefined;
						} catch (error) {
							flushError = error;
						}
					}
				}

				if (flushError) {
					errors.push(flushError);
				}
			}

			// Wait for both leading and trailing writes before allowing quit.
			while (activeStorySaves.size > 0) {
				const saves = [...activeStorySaves];
				const results = await Promise.allSettled(saves);
				for (const result of results) {
					if (result.status === 'rejected') errors.push(result.reason);
				}
			}

			console.log('All pending story saves flushed successfully');
		} else {
			console.log('No pending story saves to flush');
		}

		if (errors.length > 0) throw errors[0];
	};

	// The renderer invokes this after dispatching its beforeunload flush hook.
	// IPC message ordering makes this a barrier: all save-story-html messages
	// emitted by that hook have been delivered before this handler runs.
	ipcMain.handle('flush-story-saves', flushStorySaves);
	return flushStorySaves;
}
