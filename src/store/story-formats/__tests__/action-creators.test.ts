import {
	createFromProperties,
	deleteFormat,
	loadAllFormatProperties,
	loadFormatProperties,
	setFormatEditorCodeTrust
} from '../action-creators';
import {StoryFormat, StoryFormatProperties} from '../story-formats.types';
import {fetchStoryFormatProperties} from '../../../util/story-format/fetch-properties';
import * as editorCode from '../../../util/story-format/editor-code';
import {
	fakeFailedStoryFormat,
	fakeLoadedStoryFormat,
	fakePendingStoryFormat,
	fakeStoryFormatProperties,
	fakeUnloadedStoryFormat
} from '../../../test-util';

jest.mock('../../../util/story-format/fetch-properties');
jest.mock('../../../util/story-format/editor-code', () => ({
	executeEditorCode: jest.fn(),
	hasEditorCodeTrust: jest.fn()
}));

describe('createFromProperties', () => {
	it('returns a create action with the URL and properties specified', () => {
		const fakeProps = fakeStoryFormatProperties();

		expect(createFromProperties('mock-url', fakeProps)).toEqual({
			type: 'create',
			props: {
				name: fakeProps.name,
				url: 'mock-url',
				userAdded: true,
				version: fakeProps.version
			}
		});
	});

	it('throws an error if there is no name or version in the properties', () => {
		const fakeProps = fakeStoryFormatProperties();
		const missingName: any = {...fakeProps};
		const missingVersion: any = {...fakeProps};
		const missingBoth: any = {...fakeProps};

		delete missingName.name;
		delete missingVersion.version;
		delete missingBoth.name;
		delete missingBoth.version;

		expect(() => createFromProperties('mock-url', missingName)).toThrow();
		expect(() => createFromProperties('mock-url', missingVersion)).toThrow();
		expect(() => createFromProperties('mock-url', missingBoth)).toThrow();
	});
});

describe('deleteFormat', () => {
	it('returns a delete action', () => {
		const format = fakePendingStoryFormat();

		expect(deleteFormat(format)).toEqual({type: 'delete', id: format.id});
	});
});

describe('loadAllFormatProperties', () => {
	let dispatch: jest.Mock;
	let formats: StoryFormat[];

	beforeEach(() => {
		dispatch = jest.fn();
		formats = [
			fakeFailedStoryFormat(),
			fakeLoadedStoryFormat(),
			fakePendingStoryFormat(),
			fakeUnloadedStoryFormat()
		];
		(fetchStoryFormatProperties as jest.Mock).mockImplementation(
			(url: string) => {
				const format = formats.find(item => item.url === url)!;
				return Promise.resolve({
					name: format.name,
					version: format.version,
					source: '{{STORY_DATA}}'
				});
			}
		);
	});

	it('loads all formats either in unloaded or error loadState', () => {
		// This is testing it indirectly :(

		loadAllFormatProperties(formats)(dispatch, () => formats);
		expect(dispatch.mock.calls).toEqual([
			[{type: 'update', id: formats[0].id, props: {loadState: 'loading'}}],
			[{type: 'update', id: formats[3].id, props: {loadState: 'loading'}}]
		]);
	});

	it('returns a promise that resolves when all formats have loaded or failed', async () => {
		await loadAllFormatProperties(formats)(dispatch, () => formats);
		expect(dispatch.mock.calls).toEqual([
			[{type: 'update', id: formats[0].id, props: {loadState: 'loading'}}],
			[{type: 'update', id: formats[3].id, props: {loadState: 'loading'}}],
			[
				{
					type: 'update',
					id: formats[0].id,
					props: {
						loadState: 'loaded',
						properties: {
							name: formats[0].name,
							version: formats[0].version,
							source: '{{STORY_DATA}}'
						}
					}
				}
			],
			[
				{
					type: 'update',
					id: formats[3].id,
					props: {
						loadState: 'loaded',
						properties: {
							name: formats[3].name,
							version: formats[3].version,
							source: '{{STORY_DATA}}'
						}
					}
				}
			]
		]);
	});
});

describe('loadFormatProperties', () => {
	const fetchPropertiesMock = fetchStoryFormatProperties as jest.Mock;
	let dispatch: jest.Mock;
	let format: StoryFormat;

	beforeEach(() => {
		dispatch = jest.fn();
		fetchPropertiesMock.mockReset();
		(editorCode.executeEditorCode as jest.Mock).mockReset();
		(editorCode.hasEditorCodeTrust as jest.Mock).mockReturnValue(false);
		format = fakePendingStoryFormat();
	});

	it('sets the format state to loading while properties are being fetched', () => {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		fetchPropertiesMock.mockImplementationOnce(() => new Promise(() => {}));
		loadFormatProperties(format)(dispatch);
		expect(dispatch.mock.calls).toEqual([
			[{type: 'update', id: format.id, props: {loadState: 'loading'}}]
		]);
	});

	describe('when fetching properties succeeds', () => {
		let properties: StoryFormatProperties;

		beforeEach(() => {
			properties = fakeStoryFormatProperties();
			properties.name = format.name;
			properties.version = format.version;
			fetchPropertiesMock.mockImplementationOnce((url: string) => {
				if (url !== format.url) {
					throw new Error('Asked to load incorrect story format URL');
				}

				return Promise.resolve(properties);
			});
		});

		it('sets the format properties and state as loaded', async () => {
			await loadFormatProperties(format)(dispatch);
			expect(dispatch.mock.calls.length).toBe(2);

			// First call is tested above.

			expect(dispatch.mock.calls[1]).toEqual([
				{
					type: 'update',
					id: format.id,
					props: {loadState: 'loaded', properties}
				}
			]);
		});

		it('loads the format properties even if the format previously failed to load', async () => {
			format = fakeFailedStoryFormat();
			properties.name = format.name;
			properties.version = format.version;
			await loadFormatProperties(format)(dispatch);
			expect(dispatch.mock.calls).toEqual([
				[{type: 'update', id: format.id, props: {loadState: 'loading'}}],
				[
					{
						type: 'update',
						id: format.id,
						props: {loadState: 'loaded', properties}
					}
				]
			]);
		});

		it('returns the format properties', async () =>
			expect(await loadFormatProperties(format)(dispatch)).toBe(properties));

		it('allows concurrent loads of the same format to both resolve', async () => {
			fetchPropertiesMock.mockReset();
			let resolveFirst!: (value: StoryFormatProperties) => void;
			let resolveSecond!: (value: StoryFormatProperties) => void;
			fetchPropertiesMock
				.mockImplementationOnce(
					() => new Promise(resolve => (resolveFirst = resolve))
				)
				.mockImplementationOnce(
					() => new Promise(resolve => (resolveSecond = resolve))
				);

			const first = loadFormatProperties(format)(dispatch);
			const second = loadFormatProperties(format)(dispatch);
			resolveFirst(properties);
			resolveSecond({...properties});

			expect(await first).toBe(properties);
			expect(await second).toEqual(properties);
		});

		it('does not execute custom editor code or hydrate before consent', async () => {
			properties.editorCode = {
				url: format.url,
				source: 'window.storyFormat({})',
				sha256: 'approved-hash'
			};
			properties.hydrate = 'this.hydrated = true';
			const execute = editorCode.executeEditorCode as jest.Mock;

			await loadFormatProperties(format)(dispatch);

			expect(execute).not.toHaveBeenCalled();
			expect(dispatch.mock.calls[1][0].props.properties).toBe(properties);
			expect(
				(dispatch.mock.calls[1][0].props.properties as any).hydrated
			).toBeUndefined();
		});

		it('rejects a fetched format whose identity changed', async () => {
			properties.name = 'Different format';
			await loadFormatProperties(format)(dispatch);

			expect(dispatch.mock.calls[1][0].props.loadState).toBe('error');
			expect(dispatch.mock.calls[1][0].props.loadError.message).toMatch(
				/name or version changed/
			);
		});

		it('does not execute editor code when the approved hash no longer matches', async () => {
			const approvedUrl = 'https://example.com/format.js';
			format = fakePendingStoryFormat({
				name: properties.name,
				version: properties.version,
				url: approvedUrl,
				editorCodeTrust: {url: approvedUrl, sha256: 'old-hash'}
			});
			properties.editorCode = {
				url: approvedUrl,
				source: 'window.storyFormat({})',
				sha256: 'new-hash'
			};
			properties.hydrate = 'this.hydrated = true';
			const execute = editorCode.executeEditorCode as jest.Mock;

			await loadFormatProperties(format)(dispatch);

			expect(execute).not.toHaveBeenCalled();
			expect(dispatch.mock.calls[1][0].props.loadState).toBe('loaded');
			expect(
				(dispatch.mock.calls[1][0].props.properties as any).hydrated
			).toBeUndefined();
		});

		it('executes the approved snapshot and revokes it without executing again', async () => {
			const approvedUrl = 'https://example.com/format.js';
			format = fakeLoadedStoryFormat({
				name: properties.name,
				version: properties.version,
				url: approvedUrl,
				editorCodeTrust: {url: approvedUrl, sha256: 'approved-hash'}
			});
			if (format.loadState !== 'loaded') {
				throw new Error('Expected a loaded format');
			}
			properties = format.properties;
			properties.name = format.name;
			properties.version = format.version;
			properties.editorCode = {
				url: approvedUrl,
				source: 'window.storyFormat({})',
				sha256: 'approved-hash'
			};
			const execute = editorCode.executeEditorCode as jest.Mock;
			execute.mockResolvedValue({} as StoryFormatProperties);
			(editorCode.hasEditorCodeTrust as jest.Mock).mockReturnValue(true);

			await setFormatEditorCodeTrust(format, true)(dispatch);
			expect(execute).toHaveBeenCalledWith(
				'window.storyFormat({})',
				expect.any(Function)
			);
			expect(dispatch.mock.calls[0]).toEqual([
				{
					type: 'update',
					id: format.id,
					props: {
						editorCodeTrust: {url: format.url, sha256: 'approved-hash'}
					}
				}
			]);

			fetchPropertiesMock.mockResolvedValue(properties);
			const callsBeforeRevoke = execute.mock.calls.length;
			(editorCode.hasEditorCodeTrust as jest.Mock).mockReturnValue(false);
			await setFormatEditorCodeTrust(
				{
					...format,
					editorCodeTrust: {url: format.url, sha256: 'approved-hash'}
				},
				false
			)(dispatch);

			expect(execute).toHaveBeenCalledTimes(callsBeforeRevoke);
			expect(dispatch.mock.calls).toContainEqual([
				{
					type: 'update',
					id: format.id,
					props: {editorCodeTrust: undefined}
				}
			]);
		});

		it('ignores a late approved load after the same format is revoked', async () => {
			fetchPropertiesMock.mockReset();
			const approvedUrl = 'https://example.com/format.js';
			format = fakePendingStoryFormat({
				url: approvedUrl,
				editorCodeTrust: {url: approvedUrl, sha256: 'approved-hash'}
			});
		const approvedProperties = fakeStoryFormatProperties();
		approvedProperties.name = format.name;
		approvedProperties.version = format.version;
		approvedProperties.editorCode = {
			url: approvedUrl,
			source: 'window.storyFormat({})',
			sha256: 'approved-hash'
		};
		const revokedProperties = {
			...approvedProperties,
			editorCode: undefined
		};
		let resolveApproved!: (value: StoryFormatProperties) => void;
		fetchPropertiesMock
			.mockImplementationOnce(
				() => new Promise(resolve => (resolveApproved = resolve))
			)
			.mockResolvedValueOnce(revokedProperties);
		(editorCode.hasEditorCodeTrust as jest.Mock).mockReturnValue(true);

		const approvedLoad = loadFormatProperties(format)(dispatch);
		await Promise.resolve();
		const revokeLoad = setFormatEditorCodeTrust(
			{...format, loadState: 'loading'},
			false
		)(dispatch);
		resolveApproved(approvedProperties);
		await Promise.all([approvedLoad, revokeLoad]);

		const loadedDispatches = dispatch.mock.calls.filter(
			call => call[0].props?.loadState === 'loaded'
		);
		expect(loadedDispatches).toHaveLength(1);
		expect(loadedDispatches[0][0].props.properties).toBe(revokedProperties);
	});

		it('ignores a late approved load error after the same format is revoked', async () => {
			fetchPropertiesMock.mockReset();
			const approvedUrl = 'https://example.com/format.js';
			format = fakePendingStoryFormat({
				url: approvedUrl,
				editorCodeTrust: {url: approvedUrl, sha256: 'approved-hash'}
			});
			const revokedProperties = fakeStoryFormatProperties();
			revokedProperties.name = format.name;
			revokedProperties.version = format.version;
			let rejectApproved!: (error: Error) => void;
			fetchPropertiesMock
				.mockImplementationOnce(
					() => new Promise((_resolve, reject) => (rejectApproved = reject))
				)
				.mockResolvedValueOnce(revokedProperties);
			(editorCode.hasEditorCodeTrust as jest.Mock).mockReturnValue(false);

			const approvedLoad = loadFormatProperties(format)(dispatch);
			await Promise.resolve();
			const revokeLoad = setFormatEditorCodeTrust(
				{...format, loadState: 'loading'},
				false
			)(dispatch);
			rejectApproved(new Error('stale load failed'));
			await Promise.all([approvedLoad, revokeLoad]);

			expect(
				dispatch.mock.calls.some(call => call[0].props?.loadState === 'error')
			).toBe(false);
		});

		it('ignores a load that finishes after the format is deleted', async () => {
			fetchPropertiesMock.mockReset();
			const pendingProperties = fakeStoryFormatProperties();
			pendingProperties.name = format.name;
			pendingProperties.version = format.version;
			let resolveLoad!: (value: StoryFormatProperties) => void;
			fetchPropertiesMock.mockImplementationOnce(
				() => new Promise(resolve => (resolveLoad = resolve))
			);
			let state: StoryFormat[] = [format];

			const load = loadFormatProperties(format)(dispatch, () => state);
			await Promise.resolve();
			state = [];
			resolveLoad(pendingProperties);
			await load;

			expect(
				dispatch.mock.calls.some(
					call => call[0].props?.loadState === 'loaded'
				)
			).toBe(false);
		});
	});

	describe('when fetching properties fails', () => {
		let loadError: Error;

		beforeEach(() => {
			loadError = new Error();

			fetchPropertiesMock.mockImplementationOnce((url: string) => {
				if (url !== format.url) {
					throw new Error('Asked to load incorrect story format URL');
				}

				return Promise.reject(loadError);
			});
		});

		it("sets the load error and state as 'error' if loading properties fails", async () => {
			await loadFormatProperties(format)(dispatch);
			expect(dispatch.mock.calls.length).toBe(2);

			// First call is tested above.

			expect(dispatch.mock.calls[1]).toEqual([
				{type: 'update', id: format.id, props: {loadError, loadState: 'error'}}
			]);
		});
	});

	describe('when the format is already loaded', () => {
		beforeEach(() => (format = fakeLoadedStoryFormat()));

		it('dispatches no actions', async () => {
			await loadFormatProperties(format)(dispatch);
			expect(dispatch.mock.calls).toEqual([]);
		});

		it('returns the previously loaded properties', async () => {
			const loadedProps = (format as StoryFormat & {loadState: 'loaded'})
				.properties;

			expect(await loadFormatProperties(format)(dispatch)).toBe(loadedProps);
		});
	});
});
