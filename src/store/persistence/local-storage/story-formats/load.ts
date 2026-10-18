import {StoryFormatsState} from '../../../story-formats/story-formats.types';
import {storageKey} from '../keys';
import {readStorageItem} from '../transaction';

export async function load(): Promise<StoryFormatsState> {
	const result: StoryFormatsState = [];
	const serialized = readStorageItem(storageKey('storyformats'));

	if (!serialized) {
		return [];
	}

	serialized.split(',').forEach(id => {
		try {
			const serializedFormat = readStorageItem(storageKey('storyformats', id));

			if (!serializedFormat) {
				console.warn(
					`No story format stored at ${storageKey('storyformats', id)}, skipping`
				);
				return;
			}

			result.push({...JSON.parse(serializedFormat), loadState: 'unloaded'});
		} catch (e) {
			console.warn(
				`Story format ${id} had corrupt serialized value, skipping`,
				readStorageItem(storageKey('storyformats', id))
			);
		}
	});

	return result;
}
