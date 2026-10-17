import {v4 as uuid} from '@lukeed/uuid';
import {PrefsState} from '../../../prefs';
import {storageKey} from '../keys';

export function save(state: PrefsState) {
	// Delete existing prefs in local storage, since we aren't bothering to
	// preserve IDs.

	const previouslySerialized = window.localStorage.getItem(storageKey('prefs'));

	if (previouslySerialized) {
		previouslySerialized.split(',').forEach(id => {
			window.localStorage.removeItem(storageKey('prefs', id));
		});
	}

	/* Save new ones. */

	const ids: string[] = [];

	for (const name in state) {
		const id = uuid();

		ids.push(id);
		window.localStorage.setItem(
			storageKey('prefs', id),
			JSON.stringify({
				id,
				name,
				value: state[name as keyof PrefsState]
			})
		);
	}

	window.localStorage.setItem(storageKey('prefs'), ids.join(','));
}
