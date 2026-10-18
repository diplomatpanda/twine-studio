import {StoryFormat} from '../../store/story-formats';

/**
 * Returns a namespace prefix for a story format that is compatible with
 * CodeMirror names (modes and commands).
 */
export function namespaceForFormat(format: StoryFormat) {
	return `${encodeURIComponent(
		JSON.stringify([format.id, format.name, format.version])
	)}:`;
}
