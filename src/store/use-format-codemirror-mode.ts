import CodeMirror from 'codemirror';
import * as React from 'react';
import {
	formatWithNameAndVersion,
	loadFormatProperties,
	useStoryFormatsContext
} from './story-formats';
import {formatEditorExtensions, namespaceForFormat} from '../util/story-format';
import {formatEditorExtensionsDisabled, usePrefsContext} from './prefs';

/**
 * Sets up a CodeMirror mode for a format, if the format has defined one via
 * properties.codeMirror.mode. Once one is fully set up, this returns the name
 * of that mode. If the mode is being set up or the format hasn't defined one,
 * this returns undefined.
 */
export function useFormatCodeMirrorMode(
	formatName: string,
	formatVersion: string
) {
	const {dispatch, formats} = useStoryFormatsContext();
	const format = formatWithNameAndVersion(formats, formatName, formatVersion);
	const loadedProperties =
		format.loadState === 'loaded' ? format.properties : undefined;
	const {prefs} = usePrefsContext();
	const [modeName, setModeName] = React.useState<string>();
	const extensionsDisabled = formatEditorExtensionsDisabled(
		prefs,
		formatName,
		formatVersion
	);

	React.useEffect(() => {
		if (extensionsDisabled || format.loadState !== 'loaded') {
			setModeName(undefined);
			if (format.loadState === 'unloaded' && !extensionsDisabled) {
				dispatch(loadFormatProperties(format));
			}
			return;
		}

		const editorExtensions = formatEditorExtensions(format);

		if (editorExtensions?.codeMirror?.mode) {
			CodeMirror.defineMode(
				namespaceForFormat(format),
				editorExtensions.codeMirror.mode
			);
			setModeName(namespaceForFormat(format));
		} else {
			setModeName(undefined);
		}
	}, [
		dispatch,
		extensionsDisabled,
		format.id,
		format.name,
		format.version,
		format.loadState,
		loadedProperties
	]);

	return modeName;
}
