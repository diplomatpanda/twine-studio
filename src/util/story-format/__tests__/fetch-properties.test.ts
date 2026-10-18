import {fetchStoryFormatProperties, storyFormatUrl} from '../fetch-properties';

function respondFromSandbox(properties: unknown) {
	const appendChild = jest
		.spyOn(document.body, 'appendChild')
		.mockImplementation((node: Node) => {
			const result = HTMLElement.prototype.appendChild.call(
				document.body,
				node
			);

			if ((node as HTMLElement).tagName === 'IFRAME') {
				const frame = node as HTMLIFrameElement;
				const nonceMatch = frame.srcdoc.match(/const nonce = (".*?");/);
				if (!nonceMatch) {
					throw new Error('Sandbox nonce was not installed');
				}

				window.queueMicrotask(() =>
					window.dispatchEvent(
						new MessageEvent('message', {
							data: {nonce: JSON.parse(nonceMatch[1]), properties},
							source: frame.contentWindow
						})
					)
				);
			}

			return result;
		});

	return appendChild;
}

describe('story format URL validation', () => {
	it('canonicalizes hashes while preserving the query string', () => {
		expect(storyFormatUrl('https://example.com/format.js?v=1#fragment')).toBe(
			'https://example.com/format.js?v=1'
		);
	});

	it('rejects executable and unsupported schemes', () => {
		expect(() => storyFormatUrl('javascript:alert(1)')).toThrow();
		expect(() => storyFormatUrl('data:text/javascript,alert(1)')).toThrow();
	});
});

describe('fetchStoryFormatProperties', () => {
	const formatSource =
		'window.storyFormat({name:"Mock",version:"1.0.0",source:"{{STORY_DATA}}"})';

	beforeEach(() => {
		jest.restoreAllMocks();
		(global.fetch as jest.Mock | undefined) = jest.fn();
	});

	it('reads the response without executing it in the editor and returns an exact source snapshot', async () => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			text: async () => formatSource
		});
		const appendChild = respondFromSandbox({
			name: 'Mock',
			version: '1.0.0',
			source: '{{STORY_DATA}}',
			ignored: '<script>alert(1)</script>'
		});

		const properties = await fetchStoryFormatProperties(
			'https://example.com/format.js#ignored'
		);

		expect(global.fetch).toHaveBeenCalledWith(
			'https://example.com/format.js?callback=storyFormat',
			expect.objectContaining({credentials: 'omit'})
		);
		expect(properties).toEqual(
			expect.objectContaining({
				name: 'Mock',
				version: '1.0.0',
				source: '{{STORY_DATA}}',
				editorCode: expect.objectContaining({
					url: 'https://example.com/format.js',
					source: formatSource
				})
			})
		);
		expect((properties as any).ignored).toBeUndefined();
		expect(appendChild).toHaveBeenCalled();
	});

	it('rejects sandbox metadata missing a required field', async () => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			text: async () => formatSource
		});
		respondFromSandbox({name: 'Mock', version: '1.0.0'});

		await expect(
			fetchStoryFormatProperties('https://example.com/format.js')
		).rejects.toThrow('missing its source');
	});

	it('falls back to an external sandbox script when CORS text fetch fails', async () => {
		(global.fetch as jest.Mock).mockRejectedValue(new TypeError('CORS'));
		const appendChild = respondFromSandbox({
			name: 'Mock',
			version: '1.0.0',
			source: '{{STORY_DATA}}'
		});

		const properties = await fetchStoryFormatProperties(
			'https://example.com/format.js'
		);
		const frame = appendChild.mock.calls
			.map(([node]) => node as HTMLIFrameElement)
			.find(node => node.tagName === 'IFRAME');

		expect(frame?.srcdoc).toContain(
			'script.src = "https://example.com/format.js?callback=storyFormat"'
		);
		expect(properties.editorCode).toBeUndefined();
	});

	it('does not accept a message from another window', async () => {
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			text: async () => formatSource
		});
		const appendChild = jest
			.spyOn(document.body, 'appendChild')
			.mockImplementation((node: Node) => {
				const result = HTMLElement.prototype.appendChild.call(
					document.body,
					node
				);
				if ((node as HTMLElement).tagName === 'IFRAME') {
					const frame = node as HTMLIFrameElement;
					const nonce = JSON.parse(
						frame.srcdoc.match(/const nonce = (".*?");/)![1]
					);
					window.dispatchEvent(
						new MessageEvent('message', {
							data: {
								nonce,
								properties: {
									name: 'Mock',
									version: '1.0.0',
									source: '{{STORY_DATA}}'
								}
							},
							source: window
						})
					);
				}
				return result;
			});

		await expect(
			fetchStoryFormatProperties('https://example.com/format.js', 1)
		).rejects.toThrow('Timed out');
		appendChild.mockRestore();
	});
});
