import {v4 as uuid} from '@lukeed/uuid';
import {PrefsState} from '../../../prefs';
import {storageKey} from '../keys';
import {
	readStorageItem,
	writeStorageItem,
	withStorageTransaction
} from '../transaction';

export function save(state: PrefsState) {
	withStorageTransaction(() => {
		// Delete existing prefs in local storage, since we aren't bothering to
		// preserve IDs.

		const previouslySerialized = readStorageItem(storageKey('prefs'));

		if (previouslySerialized) {
			previouslySerialized.split(',').forEach(id => {
				writeStorageItem(storageKey('prefs', id), null);
			});
		}

		/* Save new ones. */

		const ids: string[] = [];

		for (const name in state) {
			const id = uuid();

			ids.push(id);
			writeStorageItem(
				storageKey('prefs', id),
				JSON.stringify({
					id,
					name,
					value: state[name as keyof PrefsState]
				})
			);
		}

		writeStorageItem(storageKey('prefs'), ids.join(','));
	});
}
