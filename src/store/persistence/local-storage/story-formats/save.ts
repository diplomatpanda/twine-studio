import {v4 as uuid} from '@lukeed/uuid';
import {StoryFormatsState} from '../../../story-formats/story-formats.types';
import {storageKey} from '../keys';
import {
	readStorageItem,
	writeStorageItem,
	withStorageTransaction
} from '../transaction';

export function save(state: StoryFormatsState) {
	withStorageTransaction(() => {
		// Delete existing formats in local storage, since we aren't bothering to
		// preserve ids.

		const previouslySerialized = readStorageItem(storageKey('storyformats'));

		if (previouslySerialized) {
			previouslySerialized.split(',').forEach(id => {
				writeStorageItem(storageKey('storyformats', id), null);
			});
		}

		// Save new ones.

		const ids: string[] = [];

		for (const format of state) {
			const id = uuid();

			// We have to remove the `properties` property if it exists, as that is
			// dynamically added when loading.

			ids.push(id);
			writeStorageItem(
				storageKey('storyformats', id),
				JSON.stringify({
					...format,
					loadError: undefined,
					loadState: undefined,
					properties: undefined,
					selected: undefined
				})
			);
		}

		writeStorageItem(storageKey('storyformats'), ids.join(','));
	});
}
