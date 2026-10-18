import {
	executeEditorCode,
	hasEditorCodeTrust,
	isPackagedFormat
} from '../editor-code';
import {storyFormatUrl} from '../fetch-properties';
import {fakeLoadedStoryFormat} from '../../../test-util';

function installScriptRunner(
	run: (source: string, script: HTMLScriptElement) => void
) {
	const appendChild = document.head.appendChild.bind(document.head);
	return jest
		.spyOn(document.head, 'appendChild')
		.mockImplementation((node: Node) => {
			if (node instanceof HTMLScriptElement) {
				run(node.textContent ?? '', node);
				return node;
			}
			return appendChild(node);
		});
}

function formatWithProperties(
	props: Partial<Parameters<typeof fakeLoadedStoryFormat>[1]> = {},
	overrides: any = {}
) {
	const format = fakeLoadedStoryFormat(overrides, props);
	if (format.loadState !== 'loaded') {
		throw new Error('Expected a loaded format');
	}
	format.properties.name = format.name;
	format.properties.version = format.version;
	return format;
}

describe('story format editor-code trust', () => {
	it('trusts only a packaged URL with its packaged name and version', () => {
		const format = formatWithProperties(
			{},
			{
				name: 'Harlowe',
				version: '3.3.9',
				url: 'story-formats/harlowe-3.3.9/format.js',
				userAdded: false
			}
		);
		format.properties.editorCode = {
			url: storyFormatUrl(format.url),
			source: 'window.storyFormat({})',
			sha256: 'packaged-hash'
		};

		expect(isPackagedFormat(format)).toBe(true);
		expect(hasEditorCodeTrust(format, format.properties)).toBe(true);
	});

	it('does not trust a spoofed packaged identity or a remote URL without consent', () => {
		const spoofed = formatWithProperties(
			{},
			{
				name: 'Harlowe',
				version: '3.3.9',
				url: 'https://evil.example/format.js',
				userAdded: false
			}
		);
		spoofed.properties.editorCode = {
			url: spoofed.url,
			source: 'window.storyFormat({})',
			sha256: 'remote-hash'
		};

		expect(isPackagedFormat(spoofed)).toBe(false);
		expect(hasEditorCodeTrust(spoofed, spoofed.properties)).toBe(false);

		const wrongName = formatWithProperties(
			{},
			{
				name: 'Not Harlowe',
				version: '3.3.9',
				url: 'story-formats/harlowe-3.3.9/format.js',
				userAdded: false
			}
		);
		wrongName.properties.editorCode = {
			url: storyFormatUrl(wrongName.url),
			source: 'window.storyFormat({})',
			sha256: 'packaged-hash'
		};

		expect(isPackagedFormat(wrongName)).toBe(false);
		expect(hasEditorCodeTrust(wrongName, wrongName.properties)).toBe(false);
	});

	it('requires the canonical custom URL and matching source hash', () => {
		const format = formatWithProperties(
			{},
			{
				name: 'Custom',
				version: '1.0.0',
				url: 'https://example.com/format.js#ignored',
				userAdded: false,
				editorCodeTrust: {
					url: 'https://example.com/format.js',
					sha256: 'approved-hash'
				}
			}
		);
		format.properties.editorCode = {
			url: 'https://example.com/format.js',
			source: 'window.storyFormat({})',
			sha256: 'approved-hash'
		};

		expect(hasEditorCodeTrust(format, format.properties)).toBe(true);
		format.properties.editorCode.sha256 = 'changed-hash';
		expect(hasEditorCodeTrust(format, format.properties)).toBe(false);
	});
});

describe('executeEditorCode', () => {
	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
		delete (window as any).storyFormat;
	});

	it('passes through function closures and restores the prior callback', async () => {
		const prior = jest.fn();
		(window as any).storyFormat = prior;
		const source = 'window.storyFormat({editorExtensions: closure})';
		const closureValue = 'closure survived';
		const mode = () => closureValue;
		let remove!: jest.SpyInstance;
		const appendChild = installScriptRunner((scriptSource, script) => {
			expect(scriptSource).toBe(source);
			remove = jest.spyOn(script, 'remove');
			(window as any).storyFormat({
				name: 'Custom',
				version: '1.0.0',
				source: '{{STORY_DATA}}',
				editorExtensions: {twine: {'2': {codeMirror: {mode}}}}
			});
		});

		const properties = await executeEditorCode(source);

		expect(
			(properties.editorExtensions?.twine?.['2'].codeMirror?.mode as any)()
		).toBe(closureValue);
		expect((window as any).storyFormat).toBe(prior);
		expect(remove).toHaveBeenCalled();
		expect(appendChild).toHaveBeenCalledTimes(1);
	});

	it('serializes concurrent executions and cleans up each script', async () => {
		const sources: string[] = [];
		const removes: jest.SpyInstance[] = [];
		const appendChild = installScriptRunner((source, script) => {
			sources.push(source);
			removes.push(jest.spyOn(script, 'remove'));
			(window as any).storyFormat({
				name: source,
				version: '1.0.0',
				source: '{{STORY_DATA}}'
			});
		});

		const first = executeEditorCode('first');
		const second = executeEditorCode('second');
		const [firstProperties, secondProperties] = await Promise.all([
			first,
			second
		]);

		expect(sources).toEqual(['first', 'second']);
		expect(firstProperties.name).toBe('first');
		expect(secondProperties.name).toBe('second');
		expect(removes.every(remove => remove.mock.calls.length > 0)).toBe(true);
		expect(appendChild).toHaveBeenCalledTimes(2);
	});

	it('cancels queued execution when its approval is revoked', async () => {
		let finishFirst!: () => void;
		const appendChild = installScriptRunner((source, script) => {
			if (source === 'first') {
				jest.spyOn(script, 'remove');
				finishFirst = () =>
					(window as any).storyFormat({
						name: 'first',
						version: '1.0.0',
						source: '{{STORY_DATA}}'
					});
			}
		});

		const first = executeEditorCode('first');
		await Promise.resolve();
		const second = executeEditorCode('second', () => false);
		finishFirst();
		await first;
		await expect(second).rejects.toThrow('superseded');
		expect(appendChild).toHaveBeenCalledTimes(1);
	});

	it('times out and restores the callback and script', async () => {
		jest.useFakeTimers();
		const prior = jest.fn();
		(window as any).storyFormat = prior;
		let remove!: jest.SpyInstance;
		installScriptRunner((_source, script) => {
			remove = jest.spyOn(script, 'remove');
			// Deliberately never call storyFormat.
		});

		const pending = executeEditorCode('never-returns');
		await Promise.resolve();
		jest.advanceTimersByTime(5000);

		await expect(pending).rejects.toThrow('did not return a format');
		expect((window as any).storyFormat).toBe(prior);
		expect(remove).toHaveBeenCalled();
	});
});
