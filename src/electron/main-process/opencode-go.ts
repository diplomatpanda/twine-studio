import {AiAvailability, AiPassageEditPayload} from '../shared';
import {supportsChoiceBuilder} from '../../util/choice-source';

const MODELS_URL = 'https://opencode.ai/inference/go/v1/models';
const COMPLETIONS_URL =
	'https://opencode.ai/inference/go/openai/v1/chat/completions';
const API_KEY_ENV = 'TWINE_STUDIO_OPENCODE_GO_KEY';
const USER_AGENT = 'Twine-Studio/0.1.0-alpha.1 structured-edit';
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 128 * 1024;
const MAX_TEXT_LENGTH = 64 * 1024;
const MAX_FIELD_LENGTH = 512;
const SYSTEM_PROMPTS: Record<AiPassageEditPayload['instruction'], string> = {
	'repair-format-syntax': 'You are a Twine Studio coding assistant. Repair only story-format syntax or code in the selected passage. Preserve prose, facts, and all link targets. Return exactly one JSON object with schemaVersion 1, summary, operation, and warnings. operation must be updatePassageText with the given passageId, proposedText, and rationale. Do not use Markdown fences. Do not add, remove, or rename passages or links. Do not answer general fiction-writing requests.',
	'propose-conditional-choice': 'You are a Twine Studio coding assistant. Propose one Harlowe or SugarCube conditional choice, based on the author request and selected passage code. Return exactly one JSON object with schemaVersion 1, summary, operation, and warnings. operation must contain only type appendConditionalChoice, the given passageId, factName, comparison (eq, gte, or lte), boolean or numeric value, plain-text label, destinationId from the supplied list, and rationale. The app generates source locally. Do not write proposed source, create passages, alter existing code, or answer general fiction-writing requests. Warn if the fact may need initialization. Do not use Markdown fences.',
	'propose-new-branch': 'You are a Twine Studio coding assistant. Propose one new branch from the selected passage. Return exactly one JSON object with schemaVersion 1, summary, operation, and warnings. operation must contain only type appendNewBranch, the given passageId, a plain-text name for one new destination passage, a plain-text choice label, and rationale. The app generates the link and an empty passage locally. Do not write passage prose or source code, edit existing text, create multiple passages, or answer general fiction-writing requests. Do not use Markdown fences.'
};

let activeRequest: {controller: AbortController; sessionId: string} | undefined;

function configuredKey() {
	const key = process.env[API_KEY_ENV];
	return typeof key === 'string' && key.trim() ? key.trim() : undefined;
}

function validateString(
	value: unknown,
	field: string,
	maxLength: number,
	allowEmpty = false
): asserts value is string {
	if (
		typeof value !== 'string' ||
		(!allowEmpty && value.trim() === '') ||
		value.length > maxLength
	) {
		throw new Error(`Invalid AI request: ${field}.`);
	}
}

function validatePayload(payload: unknown): asserts payload is AiPassageEditPayload {
	if (!payload || typeof payload !== 'object') {
		throw new Error('Invalid AI request.');
	}

	const value = payload as Record<string, unknown>;
	validateString(value.sessionId, 'session', 128);
	validateString(value.storyFormat, 'story format', MAX_FIELD_LENGTH);
	validateString(value.storyFormatVersion, 'story format version', MAX_FIELD_LENGTH);
	validateString(value.passageId, 'passage ID', MAX_FIELD_LENGTH);
	validateString(value.passageName, 'passage name', MAX_FIELD_LENGTH);
	validateString(value.passageText, 'passage text', MAX_TEXT_LENGTH, true);
	if (value.instruction !== 'repair-format-syntax' && value.instruction !== 'propose-conditional-choice' && value.instruction !== 'propose-new-branch') {
		throw new Error('OpenCode Go is limited to structured story code editing.');
	}
	if (value.instruction === 'repair-format-syntax' && (
		!['Harlowe', 'SugarCube'].includes(value.storyFormat as string) ||
		!/(?:<<[^>]+>>|\([a-z][\w-]*:)/i.test(value.passageText as string)
	)) {
		throw new Error('This action needs Harlowe or SugarCube code in the selected passage.');
	}
	if (value.instruction === 'propose-conditional-choice' || value.instruction === 'propose-new-branch') {
		if (!supportsChoiceBuilder(value.storyFormat as string, value.storyFormatVersion as string)) {
			throw new Error('This story format is not supported by the structured choice assistant.');
		}
		validateString(value.request, 'story code request', 500);
	}
	if (value.instruction === 'propose-conditional-choice') {
		if (!Array.isArray(value.destinations) || value.destinations.length === 0 || value.destinations.length > 100 ||
			!value.destinations.every(destination => destination && typeof destination === 'object' &&
				typeof destination.id === 'string' && destination.id.length > 0 && destination.id.length <= 512 &&
				typeof destination.name === 'string' && destination.name.length > 0 && destination.name.length <= 512)) {
			throw new Error('Invalid AI request: destinations.');
		}
	}
}

function abortError() {
	return new Error('The OpenCode Go request was canceled.');
}

function friendlyHttpError(status: number) {
	if (status === 401 || status === 403) {
		return new Error('The OpenCode Go key was rejected.');
	}
	if (status === 429) return new Error('OpenCode Go rate limit reached.');
	if (status >= 500) return new Error('OpenCode Go is temporarily unavailable.');
	return new Error(`OpenCode Go request failed (${status}).`);
}

async function readBounded(response: Response) {
	const contentLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
		throw new Error('OpenCode Go returned an oversized response.');
	}

	if (!response.body) {
		const text = await response.text();
		if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
			throw new Error('OpenCode Go returned an oversized response.');
		}
		return text;
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let size = 0;
	let output = '';
	let reading = true;
	try {
		while (reading) {
			const part = await reader.read();
			if (part.done) {
				output += decoder.decode();
				reading = false;
				continue;
			}
			size += part.value.byteLength;
			if (size > MAX_RESPONSE_BYTES) {
				await reader.cancel();
				throw new Error('OpenCode Go returned an oversized response.');
			}
			output += decoder.decode(part.value, {stream: true});
		}
		return output;
	} finally {
		reader.releaseLock();
	}
}

async function requestJson(
	url: string,
	key: string | undefined,
	sessionId: string,
	signal: AbortSignal,
	init?: RequestInit
) {
	let response: Response;
	try {
		response = await fetch(url, {
			...init,
			redirect: 'error',
			signal,
			headers: {
				Accept: 'application/json',
				...(key ? {Authorization: `Bearer ${key}`} : {}),
				'User-Agent': USER_AGENT,
				'x-opencode-session': sessionId,
				...(init?.headers ?? {})
			}
		});
	} catch (error) {
		if ((error as Error).name === 'AbortError') throw abortError();
		throw new Error('Could not connect to OpenCode Go.');
	}

	if (!response.ok) throw friendlyHttpError(response.status);
	const raw = await readBounded(response);
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		throw new Error('OpenCode Go returned invalid JSON.');
	}
}

function modelId(value: unknown) {
	if (!value || typeof value !== 'object') return undefined;
	const item = value as Record<string, unknown>;
	return typeof item.id === 'string'
		? item.id
		: typeof item.name === 'string'
			? item.name
			: undefined;
}

function findDeepSeekFlash(payload: unknown) {
	const values =
		payload && typeof payload === 'object'
			? (payload as Record<string, unknown>).data ??
			  (payload as Record<string, unknown>).models
			: undefined;
	if (!Array.isArray(values)) return undefined;
	return values.map(modelId).find(id =>
		id === 'deepseek-v4.1-flash' || id === 'opencode-go/deepseek-v4.1-flash'
	);
}

async function discoverModel(sessionId: string, signal: AbortSignal) {
	const models = await requestJson(MODELS_URL, undefined, sessionId, signal);
	return findDeepSeekFlash(models);
}

export async function aiAvailability(): Promise<AiAvailability> {
	const key = configuredKey();
	if (!key) {
		return {configured: false, reason: 'OpenCode Go is not configured.'};
	}
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		const model = await discoverModel('availability', controller.signal);
		return model
			? {configured: true, model}
			: {
				configured: false,
					reason: 'DeepSeek V4.1 Flash is not available on OpenCode Go.'
			  };
	} catch (error) {
		return {
			configured: false,
			reason:
				error instanceof Error ? error.message : 'OpenCode Go is unavailable.'
		};
	} finally {
		clearTimeout(timer);
	}
}

export async function requestAiPassageEdit(
	payload: unknown,
	approve: (payload: AiPassageEditPayload) => Promise<boolean>
): Promise<string> {
	validatePayload(payload);
	if (activeRequest) throw new Error('An OpenCode Go request is already running.');
	const key = configuredKey();
	if (!key) throw new Error('OpenCode Go is not configured.');

	const controller = new AbortController();
	activeRequest = {controller, sessionId: payload.sessionId};
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
	try {
		if (!(await approve(payload))) {
			throw new Error('OpenCode Go request was not approved.');
		}
		if (controller.signal.aborted) throw abortError();
		const model = await discoverModel(payload.sessionId, controller.signal);
		if (!model) {
			throw new Error('DeepSeek V4.1 Flash is not available on OpenCode Go.');
		}

		const response = await requestJson(
			COMPLETIONS_URL,
			key,
			payload.sessionId,
			controller.signal,
			{
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
					model,
					temperature: 0,
					messages: [
						{
							role: 'system',
							content: SYSTEM_PROMPTS[payload.instruction]
						},
						{
							role: 'user',
							content: JSON.stringify({
								task: payload.instruction === 'repair-format-syntax' ? 'repair-selected-passage-code' : payload.instruction,
								storyFormat: payload.storyFormat,
								storyFormatVersion: payload.storyFormatVersion,
								passageId: payload.passageId,
								passageName: payload.passageName,
								passageText: payload.passageText,
								instruction: payload.instruction,
								...(payload.instruction !== 'repair-format-syntax' ? {
									request: payload.request,
									...(payload.instruction === 'propose-conditional-choice' ? {destinations: payload.destinations} : {})
								} : {})
							})
						}
					]
				})
			}
		);
		const choices =
			response && typeof response === 'object'
				? (response as {choices?: unknown}).choices
				: undefined;
		const content =
			Array.isArray(choices) && choices[0] && typeof choices[0] === 'object'
				? (choices[0] as {message?: {content?: unknown}}).message?.content
				: undefined;
		if (typeof content !== 'string' || !content.trim()) {
			throw new Error('OpenCode Go returned no proposal.');
		}
		return content;
	} catch (error) {
		if (error instanceof Error) throw error;
		throw new Error('OpenCode Go request failed.');
	} finally {
		clearTimeout(timer);
		activeRequest = undefined;
	}
}

export function cancelAiPassageEdit(sessionId: unknown) {
	if (typeof sessionId === 'string' && activeRequest?.sessionId === sessionId) {
		activeRequest.controller.abort();
	}
}
