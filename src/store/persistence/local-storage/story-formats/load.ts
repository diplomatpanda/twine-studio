import {StoryFormatsState} from '../../../story-formats/story-formats.types';
import {storageKey} from '../keys';

export async function load(): Promise<StoryFormatsState> {
	const result: StoryFormatsState = [];
	const serialized = window.localStorage.getItem(storageKey('storyformats'));

	if (!serialized) {
		return [];
	}

	serialized.split(',').forEach(id => {
		try {
			const serializedFormat = window.localStorage.getItem(
				storageKey('storyformats', id)
			);

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
				window.localStorage.getItem(storageKey('storyformats', id))
			);
		}
	});

	return result;
}
