import {passageDefaults, storyDefaults} from '../../../stories/defaults';
import {Passage, Story} from '../../../stories/stories.types';
import {storageKey} from '../keys';
import {clearSavedEditorDraft, exportEditorDrafts, readEditorDraft} from '../editor-drafts';
import {preserveConflictingEditorDraft, readStorageItem, reportOrphanEditorDraft, reportUnreadableStoryRecord, writeStorageItem} from '../transaction';

function reportUnmatchedEditorDrafts(handled: Set<string>) {
	for (const key of Object.keys(exportEditorDrafts())) {
		const passageId = key.slice('twine-studio-editor-draft-'.length);
		if (!handled.has(passageId)) reportOrphanEditorDraft(passageId);
	}
}

/**
 * Parses initial state from local storage.
 */
export async function load(): Promise<Story[]> {
	const stories: Record<string, Story> = Object.create(null);
	const handledDrafts = new Set<string>();
	const serializedStories = readStorageItem(storageKey('stories'));

	if (!serializedStories) {
		if (readStorageItem(storageKey('passages')))
			reportUnreadableStoryRecord(storageKey('stories'));
		reportUnmatchedEditorDrafts(handledDrafts);
		return [];
	}

	// First, deserialize stories. We index them by ID so that we can quickly add
	// passages to them as they are deserialized.

	serializedStories.split(',').forEach(id => {
		if (!id) {
			reportUnreadableStoryRecord(storageKey('stories'));
			return;
		}
		const serializedStory = readStorageItem(storageKey('stories', id));

		if (!serializedStory) {
			reportUnreadableStoryRecord(storageKey('stories', id));
			console.warn(
				`Story list contained ID ${id}, but ${storageKey('stories', id)} does not exist, skipping`
			);
			return;
		}

		try {
			const story: Story = JSON.parse(serializedStory);

			if (!story || story.id !== id) {
				reportUnreadableStoryRecord(storageKey('stories', id));
				console.warn(`Story ${id} did not match its index ID, skipping`);
				return;
			}

			stories[story.id] = {
				...storyDefaults(),
				...story,

				// Coerce lastUpdate to a date.
				lastUpdate: story.lastUpdate
					? new Date(Date.parse(story.lastUpdate as unknown as string))
					: new Date(),

				// Force the passages property to be an empty array -- we'll populate it
				// when we load passages below.
				passages: []
			};
		} catch (e) {
			reportUnreadableStoryRecord(storageKey('stories', id));
			console.warn(`Could not parse story ${id} as JSON, skipping`);
		}
	});

	// Then create passages, adding them to their parent story.

	const serializedPassages = readStorageItem(storageKey('passages'));

	if (serializedPassages) {
		serializedPassages.split(',').forEach(id => {
			if (!id) {
				reportUnreadableStoryRecord(storageKey('passages'));
				return;
			}
			const serializedPassage = readStorageItem(storageKey('passages', id));

			if (!serializedPassage) {
				reportUnreadableStoryRecord(storageKey('passages', id));
				console.warn(
					`Passage list contained ID ${id}, but ${storageKey('passages', id)} does not exist, skipping`
				);
				return;
			}

			try {
				const passage: Passage = JSON.parse(serializedPassage);

				if (!passage || passage.id !== id || !passage.story) {
					reportUnreadableStoryRecord(storageKey('passages', id));
					console.warn(`Passage ${id} did not match its index or have a parent story ID, skipping`);
					return;
				}

				if (!stories[passage.story]) {
					reportUnreadableStoryRecord(storageKey('passages', id));
					console.warn(
						`Passage ${id} is orphaned (looking for story ID ${passage.story}), skipping`
					);
					return;
				}

				let loadedPassage: Passage = {
					...passageDefaults,
					...passage,

					// Remove empty tags.
					tags: passage.tags ? passage.tags.filter(t => t.trim() !== '') : []
				};
				const draft = readEditorDraft(loadedPassage);
				if (draft) {
					handledDrafts.add(draft.passageId);
					if (loadedPassage.text === draft.text) {
						clearSavedEditorDraft(loadedPassage);
					} else {
						const savedText = loadedPassage.text;
						loadedPassage = {...loadedPassage, text: draft.text};
						const key = storageKey('passages', passage.id);
						const serialized = JSON.stringify(loadedPassage);
						if (savedText === draft.baseText) {
							try {
								writeStorageItem(key, serialized);
								clearSavedEditorDraft(loadedPassage);
							} catch {
								// The pending transaction and tab draft remain available.
							}
						} else {
							preserveConflictingEditorDraft(key, serialized);
						}
					}
				}
				stories[passage.story].passages.push(loadedPassage);
			} catch (e) {
				reportUnreadableStoryRecord(storageKey('passages', id));
				console.warn(`Could not parse passage ${id} as JSON, skipping`);
			}
		});
	}

	// Flatten the stories object.
	reportUnmatchedEditorDrafts(handledDrafts);
	return Object.values(stories);
}
