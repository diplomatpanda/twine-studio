import {
	fakeLoadedStoryFormat,
	fakePrefs,
	fakeStory
} from '../../../../test-util';
import {load as loadPrefs} from '../prefs/load';
import {save as savePrefs} from '../prefs/save';
import {load as loadStories} from '../stories/load';
import {
	deletePassageById,
	doUpdateTransaction,
	savePassage,
	saveStory
} from '../stories/save';
import {load as loadStoryFormats} from '../story-formats/load';
import {save as saveStoryFormats} from '../story-formats/save';
import {storageKey} from '../keys';

describe('local storage namespace isolation', () => {
	beforeEach(() => window.localStorage.clear());
	afterAll(() => window.localStorage.clear());

	it('preserves legacy keys while writing and deleting only namespaced data', async () => {
		const story = fakeStory(1);
		const prefs = fakePrefs();
		const formats = [fakeLoadedStoryFormat()];
		window.localStorage.setItem('twine-stories', 'legacy-story');
		window.localStorage.setItem('twine-passages', 'legacy-passage');
		window.localStorage.setItem('twine-prefs', 'legacy-pref');
		window.localStorage.setItem('twine-storyformats', 'legacy-format');
		window.localStorage.setItem('twine-stories-legacy-story', 'legacy');

		savePrefs(prefs);
		saveStoryFormats(formats);
		doUpdateTransaction(transaction => saveStory(transaction, story));
		doUpdateTransaction(transaction =>
			savePassage(transaction, story.passages[0])
		);
		doUpdateTransaction(transaction =>
			deletePassageById(transaction, story.passages[0].id)
		);

		expect(window.localStorage.getItem('twine-stories')).toBe('legacy-story');
		expect(window.localStorage.getItem('twine-passages')).toBe(
			'legacy-passage'
		);
		expect(window.localStorage.getItem('twine-prefs')).toBe('legacy-pref');
		expect(window.localStorage.getItem('twine-storyformats')).toBe(
			'legacy-format'
		);
		expect(window.localStorage.getItem('twine-stories-legacy-story')).toBe(
			'legacy'
		);
		expect(
			window.localStorage.getItem(storageKey('passages', story.passages[0].id))
		).toBeNull();
	});

	it('does not import legacy state implicitly', async () => {
		window.localStorage.setItem('twine-prefs', 'legacy-pref');
		window.localStorage.setItem('twine-stories', 'legacy-story');
		window.localStorage.setItem('twine-passages', 'legacy-passage');
		window.localStorage.setItem('twine-storyformats', 'legacy-format');

		expect(await loadPrefs()).toEqual({});
		expect(await loadStories()).toEqual([]);
		expect(await loadStoryFormats()).toEqual([]);
	});
});
