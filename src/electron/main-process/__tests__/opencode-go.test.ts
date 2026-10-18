import {
	aiAvailability,
	cancelAiPassageEdit,
	requestAiPassageEdit
} from '../opencode-go';

const payload = {
	sessionId: 'story-session-1',
	storyFormat: 'SugarCube',
	storyFormatVersion: '2.36.1',
	passageId: 'passage-1',
	passageName: 'Start',
	passageText: '<<if $door>>[[door]]<</if>>',
	instruction: 'repair-format-syntax'
};

function response(value: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: new Headers({'content-length': JSON.stringify(value).length.toString()}),
		body: null,
		text: jest.fn().mockResolvedValue(JSON.stringify(value))
	} as unknown as Response;
}

describe('OpenCode Go desktop adapter', () => {
	const fetchMock = jest.fn();
	const previousKey = process.env.TWINE_STUDIO_OPENCODE_GO_KEY;

	beforeEach(() => {
		jest.clearAllMocks();
		(global as any).fetch = fetchMock;
		process.env.TWINE_STUDIO_OPENCODE_GO_KEY = 'test-key-that-must-not-leak';
	});

	afterEach(() => {
		if (previousKey === undefined) delete process.env.TWINE_STUDIO_OPENCODE_GO_KEY;
		else process.env.TWINE_STUDIO_OPENCODE_GO_KEY = previousKey;
	});

	it('reports unconfigured without making a network request', async () => {
		delete process.env.TWINE_STUDIO_OPENCODE_GO_KEY;
		expect(await aiAvailability()).toEqual({
			configured: false,
			reason: 'OpenCode Go is not configured.'
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('discovers the supported DeepSeek model and sends the required headers', async () => {
		fetchMock
			.mockResolvedValueOnce(response({data: [{id: 'deepseek-v4.1-flash'}]}))
			.mockResolvedValueOnce(
				response({
					choices: [{message: {content: '{"schemaVersion":1}'}}]
				})
			);

		const result = await requestAiPassageEdit(payload, async () => true);
		expect(result).toBe('{"schemaVersion":1}');
		const [modelsUrl, modelsInit] = fetchMock.mock.calls[0];
		const [completionUrl, completionInit] = fetchMock.mock.calls[1];
		expect(modelsUrl).toBe('https://opencode.ai/inference/go/v1/models');
		expect(completionUrl).toBe(
			'https://opencode.ai/inference/go/openai/v1/chat/completions'
		);
		expect(modelsInit.redirect).toBe('error');
		expect(completionInit.redirect).toBe('error');
		expect(modelsInit.headers.Authorization).toBeUndefined();
		expect(completionInit.headers.Authorization).toBe(
			'Bearer test-key-that-must-not-leak'
		);
		expect(completionInit.headers['x-opencode-session']).toBe(
			payload.sessionId
		);
		expect(completionInit.headers['User-Agent']).toContain('Twine-Studio');
		expect(JSON.stringify(completionInit.body)).toContain(
		'updatePassageText'
		);
		// The bridge result contains model output only; provider credentials are not
		// returned to the renderer.
		expect(result.includes('test-key-that-must-not-leak')).toBe(false);
	});

	it('does not claim availability when the preferred model is absent', async () => {
		fetchMock.mockResolvedValue(response({data: [{id: 'other-model'}]}));
		expect(await aiAvailability()).toEqual({
			configured: false,
			reason: 'DeepSeek V4.1 Flash is not available on OpenCode Go.'
		});
	});

	it('normalizes provider failures without exposing the key', async () => {
		fetchMock.mockResolvedValue(response({error: 'secret-key-adjacent'}, 401));
		const failure = await aiAvailability();
		expect(failure).toEqual({
			configured: false,
			reason: 'The OpenCode Go key was rejected.'
		});
		expect(JSON.stringify(failure)).not.toContain('test-key-that-must-not-leak');
	});

	it('rejects general fiction instructions before contacting the provider', async () => {
		await expect(
			requestAiPassageEdit({...payload, instruction: 'Write a story about a cabin.'}, async () => true)
		).rejects.toThrow('structured story code repair');
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('does not contact the provider when native confirmation is declined', async () => {
		await expect(requestAiPassageEdit(payload, async () => false)).rejects.toThrow(
			'not approved'
		);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('allows only one active request and cancels it', async () => {
		let rejectCompletion!: (error: Error) => void;
		let aborted = false;
		fetchMock.mockResolvedValueOnce(
			response({data: [{id: 'deepseek-v4.1-flash'}]})
		);
		fetchMock.mockImplementationOnce(
			(_url: string, init: RequestInit) =>
				new Promise((_resolve, reject) => {
					rejectCompletion = reject;
					init.signal?.addEventListener('abort', () => {
						aborted = true;
						rejectCompletion(Object.assign(new Error('aborted'), {name: 'AbortError'}));
					});
				})
		);
		const request = requestAiPassageEdit(payload, async () => true);
		await new Promise(resolve => setTimeout(resolve, 0));
		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(rejectCompletion).toBeDefined();
		await expect(requestAiPassageEdit(payload, async () => true)).rejects.toThrow('already running');
		cancelAiPassageEdit('another-session');
		expect(aborted).toBe(false);
		cancelAiPassageEdit(payload.sessionId);
		await expect(request).rejects.toThrow('canceled');
	});
});
