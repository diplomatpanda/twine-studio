import {BrowserWindow, dialog, ipcMain} from 'electron';
import debounce from 'lodash/debounce';
import type {DebouncedFunc} from 'lodash';
import {i18n} from './locales';
import {saveJsonFile} from './json-file';
import {flushAppPrefs, getAppPrefsSaveVersion} from './app-prefs';
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
import {PersistenceQueue} from '../../util/persistence-queue';
import {
	aiAvailability,
	cancelAiPassageEdit,
	requestAiPassageEdit
} from './opencode-go';
import {openAiCredentialWindow, registerAiCredentialWindowIpc} from './ai-credentials-window';

const allowedJsonFilenames = new Set(['prefs.json', 'story-formats.json']);

function validateJsonFilename(filename: unknown): asserts filename is string {
	if (typeof filename !== 'string' || !allowedJsonFilenames.has(filename)) {
		throw new Error('Invalid JSON filename.');
	}
}

export function initIpc() {
	registerAiCredentialWindowIpc();
	ipcMain.handle('open-ai-credentials', async event => {
		const parent = BrowserWindow.fromWebContents(event.sender) ?? undefined;
		await openAiCredentialWindow(parent);
	});
	ipcMain.handle('ai-availability', aiAvailability);
	ipcMain.handle('request-ai-passage-edit', (_event, payload) =>
		requestAiPassageEdit(payload, async (request, model) => {
			const {response} = await dialog.showMessageBox({
				type: 'question',
				title: 'Send passage to OpenCode Go?',
				message: request.instruction === 'repair-format-syntax'
					? 'Send the selected passage for AI code repair?'
					: request.instruction === 'propose-conditional-choice'
						? 'Send the selected passage for an AI conditional choice proposal?'
						: 'Send the selected passage for an AI branch proposal?',
				detail: `Model: ${model}. This sends the selected passage source (${request.passageText.length} characters), its name and ID, story format and version, coding task, and session ID to OpenCode Go using your key.${request.instruction === 'propose-conditional-choice' ? ` It also sends your request and ${request.destinations?.length ?? 0} destination names and IDs.` : request.instruction === 'propose-new-branch' ? ' It also sends your branch request.' : ''} A proposed edit will still require your approval in Twine Studio.`,
				buttons: ['Cancel', 'Send passage'],
				defaultId: 0,
				cancelId: 0,
				noLink: true
			});
			return response === 1;
		})
	);
	ipcMain.on('cancel-ai-passage-edit', (_event, sessionId) =>
		cancelAiPassageEdit(sessionId)
	);

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
	const jsonWrites = new PersistenceQueue();
	const activeOperations = new Set<Promise<void>>();
	let mutationVersion = 0;

	function trackOperation(operation: Promise<void>) {
		mutationVersion++;
		activeOperations.add(operation);
		const cleanup = () => activeOperations.delete(operation);
		void operation.then(cleanup, cleanup);
		return operation;
	}

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
		mutationVersion++;
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

	ipcMain.handle('delete-story', (event, story) =>
		trackOperation(
			(async () => {
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
			})()
		)
	);

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

	// A per-request reply prevents unrelated renames consuming each other's
	// completion callbacks. The renderer tracks this promise outside its reducer.
	ipcMain.handle('rename-story', (event, oldStory, newStory) =>
		trackOperation(
			(async () => {
				try {
					await flushOneStory(oldStory.id);
					const previous = storySaveChains.get(oldStory.id);
					const operation = (previous ?? Promise.resolve())
						.catch(() => undefined)
						.then(() => renameStory(oldStory, newStory));
					storySaveChains.set(oldStory.id, operation);
					await operation;
				} catch (error) {
					dialog.showErrorBox(
						i18n.t('electron.errors.storyRename'),
						(error as Error).message
					);
					throw error;
				}
			})()
		)
	);

	ipcMain.on('save-json', (_event, filename: string, data: any) => {
		let attempt: Promise<void>;
		try {
			validateJsonFilename(filename);
			mutationVersion++;
			attempt = jsonWrites.enqueue(filename, async () => {
				try {
					await saveJsonFile(filename, data);
				} catch (error) {
					dialog.showErrorBox(
						i18n.t('electron.errors.jsonSave'),
						(error as Error).message
					);
					throw error;
				}
			});
		} catch (error) {
			dialog.showErrorBox(
				i18n.t('electron.errors.jsonSave'),
				(error as Error).message
			);
			attempt = Promise.reject(error);
		}
		// send() has no awaiting caller. The queue retains failed work for retry.
		void attempt.catch(() => undefined);
		return attempt;
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
				if (
					deletingStoryIds.has(story.id) &&
					pendingStoryRestores.has(story.id)
				) {
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

	async function flushOneStory(
		storyId: string,
		failedBeforeFlush = failedStorySaves.has(storyId)
	) {
		let flushError: unknown;
		try {
			await storySavers[storyId]?.flush();
		} catch (error) {
			// Lodash retains rejected lastResult even after a successful retry.
			if (failedStorySaves.has(storyId)) flushError = error;
		}
		if (failedBeforeFlush) {
			const failedArgs = failedStorySaves.get(storyId);
			if (failedArgs) {
				await enqueueStorySave(failedArgs);
				flushError = undefined;
			}
		}
		if (flushError) throw flushError;
	}

	const flushStorySaves = async () => {
		const retryable = new Set(failedStorySaves.keys());
		let version: number;
		let appPrefsVersion: number;
		do {
			version = mutationVersion;
			appPrefsVersion = getAppPrefsSaveVersion();
			// A completed deletion may schedule a deferred restore. Drain those
			// operations before taking the current list of story debouncers.
			await Promise.all([...activeOperations]);
			await Promise.all(
				Object.keys(storySavers).map(id => flushOneStory(id, retryable.has(id)))
			);
			await Promise.all([...activeStorySaves]);
			await jsonWrites.flush();
			await flushAppPrefs();
		} while (
			activeOperations.size ||
			activeStorySaves.size ||
			version !== mutationVersion ||
			appPrefsVersion !== getAppPrefsSaveVersion()
		);
	};

	// The renderer invokes this after dispatching its beforeunload flush hook.
	// IPC message ordering makes this a barrier: all save-story-html messages
	// emitted by that hook have been delivered before this handler runs.
	ipcMain.handle('flush-story-saves', flushStorySaves);
	return flushStorySaves;
}
