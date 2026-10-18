import {renderHook} from '@testing-library/react-hooks';
import CodeMirror from 'codemirror';
import {
	fakeLoadedStoryFormat,
	fakePrefs,
	fakeUnloadedStoryFormat
} from '../../test-util';
import {usePrefsContext} from '../prefs';
import {
	loadFormatProperties,
	StoryFormat,
	useStoryFormatsContext
} from '../story-formats';
import {useFormatCodeMirrorToolbar} from '../use-format-codemirror-toolbar';
import {namespaceForFormat} from '../../util/story-format/namespace';

jest.mock('codemirror');
jest.mock('../prefs/prefs-context');
jest.mock('../story-formats/story-formats-context');
jest.mock('../story-formats/action-creators');

describe('useFormatCodeMirrorToolbar()', () => {
	const loadFormatPropertiesMock = loadFormatProperties as jest.Mock;
	let format: StoryFormat;
	let dispatchMock: jest.Mock;

	beforeEach(() => {
		(CodeMirror.commands as any) = {};
		dispatchMock = jest.fn();
	});

	describe('when the format extensions are enabled', () => {
		beforeEach(() =>
			(usePrefsContext as jest.Mock).mockReturnValue({
				dispatch: jest.fn(),
				prefs: fakePrefs()
			})
		);

		describe('when the format is unloaded', () => {
			beforeEach(() => {
				format = fakeUnloadedStoryFormat();
				loadFormatPropertiesMock.mockReturnValue({mockLoadFormatAction: true});
				(useStoryFormatsContext as jest.Mock).mockReturnValue({
					dispatch: dispatchMock,
					formats: [format]
				});
			});

			it('returns undefined', () =>
				expect(
					renderHook(() =>
						useFormatCodeMirrorToolbar(format.name, format.version)
					).result.current
				).toBeUndefined());

			it('loads the format', () => {
				renderHook(() =>
					useFormatCodeMirrorToolbar(format.name, format.version)
				);
				expect(dispatchMock.mock.calls).toEqual([
					[{mockLoadFormatAction: true}]
				]);
				expect(loadFormatPropertiesMock.mock.calls).toEqual([[format]]);
			});
		});

		describe('when the format is loaded', () => {
			const mockCommands = {mockCommand: jest.fn()};
			const mockToolbarFunction = jest.fn();

			beforeEach(() => {
				format = fakeLoadedStoryFormat();
				format.name = 'Predictable Name';
				format.version = '1.2.3';
				(format as any).properties.editorExtensions = {
					twine: {
						'^2.0.0': {
							codeMirror: {
								commands: mockCommands,
								toolbar: mockToolbarFunction
							}
						}
					}
				};
				(useStoryFormatsContext as jest.Mock).mockReturnValue({
					dispatch: dispatchMock,
					formats: [format]
				});
			});

			it('adds CodeMirror commands defined by the format, namespacing them', () => {
				renderHook(() =>
					useFormatCodeMirrorToolbar(format.name, format.version)
				);
				expect(
					(CodeMirror.commands as any)[
						namespaceForFormat(format) + 'mockCommand'
					]
				).toBe(mockCommands.mockCommand);
			});

			it('does not overwrite existing CodeMirror commands', () => {
				jest.spyOn(console, 'warn').mockReturnValue();

				const origCommand = jest.fn();

				(CodeMirror.commands as any)[
					namespaceForFormat(format) + 'mockCommand'
				] = origCommand;
				renderHook(() =>
					useFormatCodeMirrorToolbar(format.name, format.version)
				);
				expect(
					(CodeMirror.commands as any)[
						namespaceForFormat(format) + 'mockCommand'
					]
				).toBe(origCommand);
			});

			describe('the function it returns', () => {
				it('calls the CodeMirror toolbar function if defined', () => {
					const {result} = renderHook(() =>
						useFormatCodeMirrorToolbar(format.name, format.version)
					);

					expect(mockToolbarFunction).not.toHaveBeenCalled();
					(result.current as any)();
					expect(mockToolbarFunction).toHaveBeenCalledTimes(1);
				});

				it("namespaces command names in the toolbar function's return value", () => {
					(
						(format as any).properties.editorExtensions.twine['^2.0.0']
							.codeMirror.toolbar as jest.Mock
					).mockReturnValue([
						{type: 'button', command: 'mockCommand'},
						{type: 'menu', items: [{type: 'button', command: 'mockCommand2'}]}
					]);

					const {result} = renderHook(() =>
						useFormatCodeMirrorToolbar(format.name, format.version)
					);

					const items = (result.current as any)();

					expect(items).toEqual([
						{
							type: 'button',
							command: namespaceForFormat(format) + 'mockCommand'
						},
						{
							type: 'menu',
							items: [
								{
									type: 'button',
									command: namespaceForFormat(format) + 'mockCommand2'
								}
							]
						}
					]);
				});

				it('ignores submenus', () => {
					(
						(format as any).properties.editorExtensions.twine['^2.0.0']
							.codeMirror.toolbar as jest.Mock
					).mockReturnValue([
						{
							type: 'menu',
							items: [
								{
									type: 'menu',
									items: [{type: 'button', command: 'mockCommand2'}]
								}
							]
						}
					]);

					const {result} = renderHook(() =>
						useFormatCodeMirrorToolbar(format.name, format.version)
					);

					const items = (result.current as any)();

					expect(items).toEqual([{type: 'menu', items: []}]);
				});

				it('ignores separators outside of a menu', () => {
					(
						(format as any).properties.editorExtensions.twine['^2.0.0']
							.codeMirror.toolbar as jest.Mock
					).mockReturnValue([{type: 'separator'}]);

					const {result} = renderHook(() =>
						useFormatCodeMirrorToolbar(format.name, format.version)
					);

					const items = (result.current as any)();

					expect(items).toEqual([]);
				});
			});
		});

		it('clears disabled extensions and installs commands from a new properties snapshot', () => {
			const firstCommand = jest.fn();
			const firstToolbar = jest.fn();
			format = fakeLoadedStoryFormat();
			format.name = 'Predictable Name';
			format.version = '1.2.3';
			const loadedFormat = format as Extract<
				StoryFormat,
				{loadState: 'loaded'}
			>;
			loadedFormat.properties.editorExtensions = {
				twine: {
					'^2.0.0': {
						codeMirror: {
							commands: {firstCommand},
							toolbar: firstToolbar
						}
					}
				}
			};
			const context = {dispatch: dispatchMock, formats: [format]};
			const prefs = fakePrefs();
			(useStoryFormatsContext as jest.Mock).mockReturnValue(context);
			(usePrefsContext as jest.Mock).mockReturnValue({
				dispatch: jest.fn(),
				prefs
			});

			const {result, rerender} = renderHook(() =>
				useFormatCodeMirrorToolbar(format.name, format.version)
			);
			expect(result.current).toBeDefined();
			expect(
				(CodeMirror.commands as any)[
					namespaceForFormat(format) + 'firstCommand'
				]
			).toBe(firstCommand);

			prefs.disabledStoryFormatEditorExtensions = [
				{name: format.name, version: format.version}
			];
			rerender();
			expect(result.current).toBeUndefined();
			expect(
				(CodeMirror.commands as any)[
					namespaceForFormat(format) + 'firstCommand'
				]
			).toBeUndefined();

			const secondCommand = jest.fn();
			const secondToolbar = jest.fn();
			format = {
				...loadedFormat,
				properties: {
					...loadedFormat.properties,
					editorExtensions: {
						twine: {
							'^2.0.0': {
								codeMirror: {
									commands: {secondCommand},
									toolbar: secondToolbar
								}
							}
						}
					}
				}
			};
			context.formats = [format];
			prefs.disabledStoryFormatEditorExtensions = [];
			rerender();
			expect(result.current).toBeDefined();
			expect(
				(CodeMirror.commands as any)[
					namespaceForFormat(format) + 'secondCommand'
				]
			).toBe(secondCommand);
		});

		it('activates the toolbar after an untrusted load is replaced by approved properties', () => {
			format = fakeLoadedStoryFormat();
			format.name = 'Predictable Name';
			format.version = '1.2.3';
			const context = {dispatch: dispatchMock, formats: [format]};
			(useStoryFormatsContext as jest.Mock).mockReturnValue(context);
			(usePrefsContext as jest.Mock).mockReturnValue({
				dispatch: jest.fn(),
				prefs: fakePrefs()
			});

			const {result, rerender} = renderHook(() =>
				useFormatCodeMirrorToolbar(format.name, format.version)
			);
			expect(result.current).toBeUndefined();

			const command = jest.fn();
			const toolbar = jest.fn();
			const loadedFormat = format as Extract<
				StoryFormat,
				{loadState: 'loaded'}
			>;
			format = {
				...loadedFormat,
				properties: {
					...loadedFormat.properties,
					editorExtensions: {
						twine: {
							'^2.0.0': {
								codeMirror: {commands: {command}, toolbar}
							}
						}
					}
				}
			};
			context.formats = [format];
			rerender();

			expect(result.current).toBeDefined();
			expect(
				(CodeMirror.commands as any)[namespaceForFormat(format) + 'command']
			).toBe(command);
		});

		it('keeps a shared command installed while another toolbar instance remains mounted', () => {
			format = fakeLoadedStoryFormat();
			format.name = 'Predictable Name';
			format.version = '1.2.3';
			const command = jest.fn();
			(format as any).properties.editorExtensions = {
				twine: {'^2.0.0': {codeMirror: {commands: {command}}}}
			};
			(useStoryFormatsContext as jest.Mock).mockReturnValue({
				dispatch: dispatchMock,
				formats: [format]
			});

			const first = renderHook(() =>
				useFormatCodeMirrorToolbar(format.name, format.version)
			);
			const second = renderHook(() =>
				useFormatCodeMirrorToolbar(format.name, format.version)
			);
			expect(
				(CodeMirror.commands as any)[namespaceForFormat(format) + 'command']
			).toBe(command);

			first.unmount();
			expect(
				(CodeMirror.commands as any)[namespaceForFormat(format) + 'command']
			).toBe(command);
			second.unmount();
			expect(
				(CodeMirror.commands as any)[namespaceForFormat(format) + 'command']
			).toBeUndefined();
		});

		it('does not route commands between names that normalize to the same legacy namespace', () => {
			const first = fakeLoadedStoryFormat({
				id: 'format-a',
				name: 'Foo Bar',
				version: '1.0.0'
			});
			const second = fakeLoadedStoryFormat({
				id: 'format-b',
				name: 'Foo-Bar',
				version: '1.0.0'
			});
			const firstCommand = jest.fn();
			const secondCommand = jest.fn();
			(
				first as Extract<StoryFormat, {loadState: 'loaded'}>
			).properties.editorExtensions = {
				twine: {'^2.0.0': {codeMirror: {commands: {insert: firstCommand}}}}
			};
			(
				second as Extract<StoryFormat, {loadState: 'loaded'}>
			).properties.editorExtensions = {
				twine: {'^2.0.0': {codeMirror: {commands: {insert: secondCommand}}}}
			};
			(useStoryFormatsContext as jest.Mock).mockReturnValue({
				dispatch: dispatchMock,
				formats: [first, second]
			});

			const firstHook = renderHook(() =>
				useFormatCodeMirrorToolbar(first.name, first.version)
			);
			const secondHook = renderHook(() =>
				useFormatCodeMirrorToolbar(second.name, second.version)
			);

			const firstCommandName = namespaceForFormat(first) + 'insert';
			const secondCommandName = namespaceForFormat(second) + 'insert';
			expect(firstCommandName).not.toBe(secondCommandName);
			expect((CodeMirror.commands as any)[firstCommandName]).toBe(firstCommand);
			expect((CodeMirror.commands as any)[secondCommandName]).toBe(
				secondCommand
			);
			(CodeMirror.commands as any)[firstCommandName]();
			(CodeMirror.commands as any)[secondCommandName]();
			expect(firstCommand).toHaveBeenCalledTimes(1);
			expect(secondCommand).toHaveBeenCalledTimes(1);

			firstHook.unmount();
			secondHook.unmount();
		});
	});
});
