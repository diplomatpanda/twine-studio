import {parseLinks} from './parse-links';

/** Static passage names understood by Twine and the selected format's editor extension. */
export function passageReferenceNames(
	text: string,
	formatReferences?: (text: string) => string[]
) {
	return Array.from(new Set([
		...parseLinks(text, true),
		...(formatReferences?.(text) ?? [])
	]));
}
