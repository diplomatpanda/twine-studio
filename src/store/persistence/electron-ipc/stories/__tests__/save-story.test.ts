import {StoryFormatsState} from '../../../../story-formats';
import {Story} from '../../../../stories';
import {
	fakeLoadedStoryFormat,
	fakeStoryFormatProperties,
	fakeStory
} from '../../../../../test-util';
import {TwineElectronWindow} from '../../../../../electron/shared';
import {getAppInfo} from '../../../../../util/app-info';
import {
	publishStory,
	publishStoryWithFormat
} from '../../../../../util/publish';
import * as fetchStoryFormatProperties from '../../../../../util/story-format/fetch-properties';
import {saveStory, waitForPendingStorySaves} from '../save-story';

describe('saveStory()', () => {
	let formatsState: StoryFormatsState;
	let saveStoryHtml: jest.SpyInstance;
	let story: Story;

	beforeEach(() => {
		formatsState = [fakeLoadedStoryFormat()];
		saveStoryHtml = jest.fn();
		story = fakeStory();
		story.storyFormat = formatsState[0].name;
		story.storyFormatVersion = formatsState[0].version;
		(window as any).twineElectron = {saveStoryHtml};
		jest.spyOn(console, 'warn').mockReturnValue();
	});

	afterEach(() => delete (window as TwineElectronWindow).twineElectron);

	it('calls saveStoryHtml on the twineElectron global', async () => {
		await saveStory(story, formatsState);
		expect(saveStoryHtml.mock.calls).toEqual([
			[
				story,
				publishStoryWithFormat(
					story,
					(formatsState[0] as any).properties.source,
					getAppInfo(),
					{startOptional: true}
				)
			]
		]);
	});

	it("loads the story's format if needed", async () => {
		const properties = fakeStoryFormatProperties();
		jest
			.spyOn(fetchStoryFormatProperties, 'fetchStoryFormatProperties')
			.mockResolvedValue(properties);

		await saveStory(story, [
			{...formatsState[0], loadState: 'unloaded', properties: undefined} as any
		]);
		expect(saveStoryHtml.mock.calls).toEqual([
			[
				story,
				publishStoryWithFormat(story, properties.source, getAppInfo(), {
					startOptional: true
				})
			]
		]);
	});

	it('sends story data only if the format cannot be loaded', async () => {
		jest
			.spyOn(fetchStoryFormatProperties, 'fetchStoryFormatProperties')
			.mockRejectedValue(new Error());

		await saveStory(story, [
			{...formatsState[0], loadState: 'unloaded', properties: undefined} as any
		]);
		expect(saveStoryHtml.mock.calls).toEqual([
			[
				story,
				publishStory(story, getAppInfo(), {
					startOptional: true
				})
			]
		]);
	});

	it('waits for async story publication and preserves per-story order', async () => {
		const properties = fakeStoryFormatProperties();
		const firstStory = {...story};
		const secondStory = {...story, name: 'second story'};
		let resolveFirst!: (value: typeof properties) => void;
		let resolveSecond!: (value: typeof properties) => void;
		const fetchProperties = jest
			.spyOn(fetchStoryFormatProperties, 'fetchStoryFormatProperties')
			.mockImplementationOnce(
				() => new Promise(resolve => (resolveFirst = resolve))
			)
			.mockImplementationOnce(
				() => new Promise(resolve => (resolveSecond = resolve))
			);
		const unloadedFormats = [
			{...formatsState[0], loadState: 'unloaded', properties: undefined} as any
		];

		const firstSave = saveStory(firstStory, unloadedFormats);
		const secondSave = saveStory(secondStory, unloadedFormats);
		const pendingPublication = waitForPendingStorySaves();

		await Promise.resolve();
		expect(fetchProperties).toHaveBeenCalledTimes(1);
		expect(saveStoryHtml).not.toHaveBeenCalled();

		resolveFirst(properties);
		await firstSave;
		await Promise.resolve();
		expect(fetchProperties).toHaveBeenCalledTimes(2);
		expect(saveStoryHtml).toHaveBeenCalledTimes(1);

		resolveSecond(properties);
		await Promise.all([secondSave, pendingPublication]);
		expect(saveStoryHtml).toHaveBeenCalledTimes(2);
		expect(saveStoryHtml.mock.calls[0][0]).toBe(firstStory);
		expect(saveStoryHtml.mock.calls[1][0]).toBe(secondStory);
	});
});
