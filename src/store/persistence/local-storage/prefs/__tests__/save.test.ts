import {save} from '../save';
import {fakePrefs} from '../../../../../test-util';
import {storageKey} from '../../keys';

describe('prefs local storage save', () => {
	beforeEach(() => window.localStorage.clear());
	afterAll(() => window.localStorage.clear());

	it('saves preferences to local storage', () => {
		const prefs = fakePrefs();

		save(prefs);

		const ids = window.localStorage.getItem(storageKey('prefs'))!.split(',');

		expect(ids.length).toBe(Object.keys(prefs).length);

		const saved: any = {};

		ids.forEach(id => {
			const savedPref = window.localStorage.getItem(storageKey('prefs', id));

			expect(typeof savedPref).toBe('string');
			const restored = JSON.parse(savedPref as string);

			saved[restored.name] = restored.value;
		});

		for (const key in prefs) {
			expect(saved[key]).toEqual((prefs as any)[key]);
		}
	});
});
