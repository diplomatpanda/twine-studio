import * as React from 'react';
import {formatEditorExtensions} from '../util/story-format';
import {
	formatWithNameAndVersion,
	loadFormatProperties,
	useStoryFormatsContext
} from './story-formats';
import {formatEditorExtensionsDisabled, usePrefsContext} from './prefs';

const emptyFunc = () => [];

export function useFormatReferenceParser(
	formatName: string,
	formatVersion: string
) {
	const {prefs} = usePrefsContext();
	const {dispatch, formats} = useStoryFormatsContext();
	const format = formatWithNameAndVersion(formats, formatName, formatVersion);
	const loadedProperties =
		format.loadState === 'loaded' ? format.properties : undefined;
	const extensionsDisabled = formatEditorExtensionsDisabled(
		prefs,
		formatName,
		formatVersion
	);

	React.useEffect(() => {
		if (extensionsDisabled) {
			return;
		}

		if (format.loadState === 'unloaded') {
			dispatch(loadFormatProperties(format));
		}
	}, [
		dispatch,
		extensionsDisabled,
		format.id,
		format.name,
		format.version,
		format.loadState
	]);

	const editorExtensions = React.useMemo(() => {
		if (extensionsDisabled || format.loadState !== 'loaded') {
			return undefined;
		}

		return formatEditorExtensions(format);
	}, [
		extensionsDisabled,
		format.id,
		format.name,
		format.version,
		format.loadState,
		loadedProperties
	]);

	if (extensionsDisabled) {
		return emptyFunc;
	}

	return editorExtensions?.references?.parsePassageText ?? emptyFunc;
}
