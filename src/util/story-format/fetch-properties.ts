import {StoryFormatProperties} from '../../store/story-formats/story-formats.types';

const maxSourceLength = 16 * 1024 * 1024;
const stringFields = [
	'name',
	'version',
	'source',
	'author',
	'description',
	'image',
	'url',
	'license',
	'hydrate'
] as const;

/** Canonical identity for a format file, including its query string. */
export function storyFormatUrl(value: string): string {
	const url = new URL(value, document.baseURI);
	if (
		!['http:', 'https:'].includes(url.protocol) &&
		!(url.protocol === 'file:' && window.location.protocol === 'file:')
	) {
		throw new Error(
			'Story formats require an HTTP(S) URL or a local desktop file.'
		);
	}
	url.hash = '';
	return url.href;
}

function validateProperties(value: unknown): StoryFormatProperties {
	if (!value || typeof value !== 'object') {
		throw new Error('The format did not return story format data.');
	}
	const data = value as Record<string, unknown>;
	for (const key of ['name', 'version', 'source']) {
		if (typeof data[key] !== 'string' || !data[key]) {
			throw new Error(`The format is missing its ${key}.`);
		}
	}
	const result: Record<string, string | boolean> = {};
	for (const key of stringFields) {
		if (typeof data[key] === 'string') {
			if ((data[key] as string).length > maxSourceLength) {
				throw new Error('The story format is too large.');
			}
			result[key] = data[key] as string;
		}
	}
	if (typeof data.proofing === 'boolean') {
		result.proofing = data.proofing;
	}
	return result as unknown as StoryFormatProperties;
}

/** Execute the JSONP wrapper only in an opaque-origin, script-only frame. */
function extractProperties(
	url: string,
	source: string | undefined,
	timeout: number
) {
	return new Promise<StoryFormatProperties>((resolve, reject) => {
		const frame = document.createElement('iframe');
		const nonce = Array.from(crypto.getRandomValues(new Uint32Array(4))).join(
			'-'
		);
		frame.hidden = true;
		frame.setAttribute('sandbox', 'allow-scripts');
		frame.setAttribute('aria-hidden', 'true');
		const cleanup = () => {
			window.clearTimeout(timer);
			window.removeEventListener('message', receive);
			frame.remove();
		};
		const receive = (event: MessageEvent) => {
			if (event.source !== frame.contentWindow || event.data?.nonce !== nonce) {
				return;
			}
			cleanup();
			try {
				if (event.data.error) {
					throw new Error('Unable to read the story format.');
				}
				resolve(validateProperties(event.data.properties));
			} catch (error) {
				reject(error);
			}
		};
		const timer = window.setTimeout(() => {
			cleanup();
			reject(new Error('Timed out reading the story format.'));
		}, timeout);
		// Escape '<' so a format containing </script> cannot terminate bootstrap.
		const literal = (value: unknown) =>
			JSON.stringify(value).replace(/</g, '\\u003c');
		frame.srcdoc = `<!doctype html><script>(() => {
			const nonce = ${literal(nonce)};
			const send = data => parent.postMessage({nonce, ...data}, '*');
			window.storyFormat = data => {
				try {
					const properties = {};
					for (const key of ${literal(stringFields)}) {
						if (typeof data[key] === 'string') properties[key] = data[key];
					}
					if (typeof data.proofing === 'boolean') properties.proofing = data.proofing;
					send({properties});
				} catch (_) { send({error: true}); }
			};
			const script = document.createElement('script');
			script.onerror = () => send({error: true});
			${source === undefined ? `script.src = ${literal(url)};` : `script.textContent = ${literal(source)};`}
			document.head.appendChild(script);
		})();</script>`;
		window.addEventListener('message', receive);
		document.body.appendChild(frame);
	});
}

/** Read a format without granting its JavaScript access to the editor. */
export async function fetchStoryFormatProperties(
	url: string,
	timeout = 5000
): Promise<StoryFormatProperties> {
	const canonicalUrl = storyFormatUrl(url);
	const requestUrl = new URL(canonicalUrl);
	requestUrl.searchParams.set('callback', 'storyFormat');
	const controller = new AbortController();
	const timer = window.setTimeout(() => controller.abort(), timeout);
	let source: string | undefined;
	try {
		const response = await fetch(requestUrl.href, {
			credentials: 'omit',
			signal: controller.signal
		});
		if (response.ok) {
			source = await response.text();
		}
	} catch (_) {
		// Older JSONP hosts need not permit CORS. They remain usable in isolation,
		// but cannot offer editor code approval without a readable source snapshot.
	} finally {
		window.clearTimeout(timer);
	}
	if (source !== undefined && source.length > maxSourceLength) {
		throw new Error('The story format is too large.');
	}
	const properties = await extractProperties(requestUrl.href, source, timeout);
	if (source !== undefined) {
		const digest =
			crypto.subtle &&
			(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source)));
		const sha256 = digest
			? Array.from(new Uint8Array(digest))
					.map(byte => byte.toString(16).padStart(2, '0'))
					.join('')
			: undefined;
		properties.editorCode = {url: canonicalUrl, source, sha256};
	}
	return properties;
}
