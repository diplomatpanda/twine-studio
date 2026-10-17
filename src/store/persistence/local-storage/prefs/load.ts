import {PrefsState} from '../../../prefs';
import {storageKey} from '../keys';

export async function load(): Promise<Partial<PrefsState>> {
	const serialized = window.localStorage.getItem(storageKey('prefs'));
	const result: Partial<PrefsState> = {};

	if (!serialized) {
		return {};
	}

	serialized.split(',').forEach(id => {
		try {
			const serializedPref = window.localStorage.getItem(storageKey('prefs', id));

			if (!serializedPref) {
				console.warn(`No preference stored at ${storageKey('prefs', id)}`);
				return;
			}

			const item = JSON.parse(serializedPref);

			(result as any)[item.name] = item.value;
		} catch (e) {
			console.warn(
				`Preference ${id} had corrupt serialized value, skipping`,
				window.localStorage.getItem(storageKey('prefs', id)),
				e
			);
		}
	});

	return result;
}
