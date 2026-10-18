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
import {
	deleteStory,
	renameStory,
	restoreStory,
	saveStory,
	waitForPendingStorySaves
} from '../save-story';
import {waitFor} from '@testing-library/react';

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
		await waitFor(() => expect(fetchProperties).toHaveBeenCalledTimes(2));
		expect(fetchProperties).toHaveBeenCalledTimes(2);
		expect(saveStoryHtml).toHaveBeenCalledTimes(1);

		resolveSecond(properties);
		await Promise.all([firstSave, secondSave, pendingPublication]);
		expect(saveStoryHtml).toHaveBeenCalledTimes(2);
		expect(saveStoryHtml.mock.calls[0][0]).toBe(firstStory);
		expect(saveStoryHtml.mock.calls[1][0]).toBe(secondStory);
	});

	it('retries a failed rename before a later rename and its latest publication', async () => {
		const renamed = {...story, name: 'Second name'};
		const final = {...story, name: 'Final name'};
		const rename = jest
			.fn()
			.mockRejectedValueOnce(new Error('rename unavailable'))
			.mockResolvedValue(undefined);
		(window as any).twineElectron.renameStory = rename;
		jest.spyOn(console, 'error').mockReturnValue();
		const first = renameStory(story, renamed, formatsState);
		const second = renameStory(renamed, final, formatsState);
		await expect(first).rejects.toThrow('rename unavailable');
		await expect(second).rejects.toThrow('rename unavailable');
		expect(saveStoryHtml).not.toHaveBeenCalled();
		await waitForPendingStorySaves();
		expect(rename.mock.calls).toEqual([
			[story, renamed],
			[story, renamed],
			[renamed, final]
		]);
		expect(saveStoryHtml.mock.calls.map(call => call[0].name)).toEqual([
			'Second name',
			'Final name'
		]);
	});

	it('waits for deletion before restoring and saving the same story', async () => {
		let finishDelete!: () => void;
		const deletion = jest.fn(
			() => new Promise<void>(resolve => (finishDelete = resolve))
		);
		const restore = jest.fn();
		(window as any).twineElectron.deleteStory = deletion;
		(window as any).twineElectron.restoreStory = restore;
		const deleted = deleteStory(story);
		const restored = restoreStory(story, formatsState);
		await Promise.resolve();
		expect(restore).not.toHaveBeenCalled();
		finishDelete();
		await Promise.all([deleted, restored]);
		expect(restore).toHaveBeenCalledWith(story);
		expect(saveStoryHtml).toHaveBeenCalledTimes(1);
	});
});
