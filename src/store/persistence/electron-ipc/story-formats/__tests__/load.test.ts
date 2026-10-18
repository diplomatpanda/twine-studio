import {load} from '../load';
import {TwineElectronWindow} from '../../../../../electron/shared';
import {fakeUnloadedStoryFormat} from '../../../../../test-util';

describe('story formats Electron IPC load', () => {
	const electronWindow = window as TwineElectronWindow;

	function mockLoadStoryFormats(data: any) {
		Object.assign(electronWindow, {
			twineElectron: {
				loadStoryFormats: async function () {
					return data;
				}
			}
		});
	}

	afterEach(() => delete electronWindow.twineElectron);

	it('resolves to data from calling loadStoryFormats on the twineElectron global', async () => {
		const storyFormats = [fakeUnloadedStoryFormat(), fakeUnloadedStoryFormat()];

		mockLoadStoryFormats(storyFormats);
		expect(await load()).toEqual([
			{...storyFormats[0], id: expect.any(String)},
			{...storyFormats[1], id: expect.any(String)}
		]);
	});

	it('preserves editor code trust metadata from the Electron bridge', async () => {
		const storyFormat = {
			...fakeUnloadedStoryFormat(),
			editorCodeTrust: {
				url: 'https://example.com/custom-format.js',
				sha256: 'abc123'
			}
		};

		mockLoadStoryFormats([storyFormat]);
		expect(await load()).toEqual([
			{...storyFormat, id: expect.any(String)}
		]);
	});

	it("resolves to an empty array if loadStoryFormats doesn't return an array", async () => {
		mockLoadStoryFormats('bad');
		expect(await load()).toEqual([]);
		mockLoadStoryFormats(0);
		expect(await load()).toEqual([]);
		mockLoadStoryFormats(undefined);
		expect(await load()).toEqual([]);
		mockLoadStoryFormats(null);
		expect(await load()).toEqual([]);
		mockLoadStoryFormats({});
		expect(await load()).toEqual([]);
	});
});
