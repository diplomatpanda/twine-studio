import {Thunk} from 'react-hook-thunk-reducer';
import {fetchStoryFormatProperties} from '../../util/story-format/fetch-properties';
import {
	executeEditorCode,
	hasEditorCodeTrust
} from '../../util/story-format/editor-code';
import {
	StoryFormat,
	StoryFormatProperties,
	StoryFormatsAction,
	StoryFormatsDispatch
} from './story-formats.types';

interface ActiveFormatLoad {
	format: StoryFormat;
	pending: number;
	token: object;
}

const activeFormatLoads = new Map<string, ActiveFormatLoad>();

type StoryFormatsStateGetter = () => StoryFormat[];

function sameFormatIdentity(left: StoryFormat, right: StoryFormat) {
	return (
		left.id === right.id &&
		left.name === right.name &&
		left.version === right.version &&
		left.url === right.url &&
		left.editorCodeTrust?.url === right.editorCodeTrust?.url &&
		left.editorCodeTrust?.sha256 === right.editorCodeTrust?.sha256
	);
}

function beginFormatLoad(format: StoryFormat) {
	const current = activeFormatLoads.get(format.id);
	if (current && sameFormatIdentity(current.format, format)) {
		current.pending++;
		return current.token;
	}

	const next = {format, pending: 1, token: {}};
	activeFormatLoads.set(format.id, next);
	return next.token;
}

function isCurrentFormatLoad(formatId: string, token: object) {
	return activeFormatLoads.get(formatId)?.token === token;
}

function finishFormatLoad(formatId: string, token: object) {
	const current = activeFormatLoads.get(formatId);
	if (!current || current.token !== token) {
		return;
	}

	current.pending--;
	if (current.pending === 0) {
		activeFormatLoads.delete(formatId);
	}
}

function isCurrentFormat(
	format: StoryFormat,
	getState?: StoryFormatsStateGetter
) {
	if (!getState) {
		return true;
	}

	const current = getState().find(candidate => candidate.id === format.id);
	return !!current &&
		current.name === format.name &&
		current.version === format.version &&
		current.url === format.url &&
		current.editorCodeTrust?.url === format.editorCodeTrust?.url &&
		current.editorCodeTrust?.sha256 === format.editorCodeTrust?.sha256;
}

/**
 * Creates a new story format based on properties (probably loaded externally).
 */
export function createFromProperties(
	url: string,
	properties: StoryFormatProperties
): StoryFormatsAction {
	if (!properties.name || !properties.version) {
		throw new Error('Missing required properties for a new story format');
	}

	return {
		type: 'create',
		props: {
			url,
			name: properties.name,
			userAdded: true,
			version: properties.version
		}
	};
}

/**
 * Deletes a story format.
 */
export function deleteFormat(format: StoryFormat): StoryFormatsAction {
	return {type: 'delete', id: format.id};
}

async function loadFormatThunk(
	format: StoryFormat,
	dispatch: StoryFormatsDispatch,
	snapshot?: StoryFormatProperties,
	getState?: StoryFormatsStateGetter
) {
	const loadToken = beginFormatLoad(format);
	dispatch({
		type: 'update',
		id: format.id,
		props: {loadState: 'loading'}
	});

	try {
		let properties = snapshot ?? (await fetchStoryFormatProperties(format.url));
		if (
			!isCurrentFormatLoad(format.id, loadToken) ||
			!isCurrentFormat(format, getState)
		) {
			return;
		}
		if (
			properties.name !== format.name ||
			properties.version !== format.version
		) {
			throw new Error(
				'The format name or version changed. Add the updated format separately.'
			);
		}
		const trusted = hasEditorCodeTrust(format, properties);
		if (trusted && properties.editorCode) {
			const extensions = await executeEditorCode(
				properties.editorCode.source,
				() =>
					isCurrentFormatLoad(format.id, loadToken) &&
					isCurrentFormat(format, getState)
			);
			if (
				!isCurrentFormatLoad(format.id, loadToken) ||
				!isCurrentFormat(format, getState)
			) {
				return;
			}
			properties = {...extensions, ...properties};
		}
		if (
			!isCurrentFormatLoad(format.id, loadToken) ||
			!isCurrentFormat(format, getState)
		) {
			return;
		}

		// If the format contains a `hydrate` property, try running it and merge in
		// properties that function creates by modifiying what's bound to its
		// `this`. This allows creation of properties that can't be serialized to
		// JSON on the format. The hydrate function cannot override properties
		// already present in the format properties, e.g. to change its source.

		if (trusted && properties.hydrate) {
			try {
				const hydrateResult: Partial<StoryFormatProperties> = {};

				// eslint-disable-next-line no-new-func
				const hydrateFunc = new Function(properties.hydrate);

				hydrateFunc.call(hydrateResult);
				properties = {...hydrateResult, ...properties};
			} catch (e) {
				console.error(
					`Format ${format.id} has a hydrate property but it threw an error when called`,
					e
				);
			}
		}
		if (
			!isCurrentFormatLoad(format.id, loadToken) ||
			!isCurrentFormat(format, getState)
		) {
			return;
		}

		dispatch({
			type: 'update',
			id: format.id,
			props: {properties, loadState: 'loaded'}
		});

		return properties;
	} catch (loadError) {
		if (
			!isCurrentFormatLoad(format.id, loadToken) ||
			!isCurrentFormat(format, getState)
		) {
			return;
		}
		dispatch({
			type: 'update',
			id: format.id,
			props: {loadError: loadError as unknown as Error, loadState: 'error'}
		});
	} finally {
		finishFormatLoad(format.id, loadToken);
	}
}

/** Consent binds to the displayed URL and exact source, never a later download. */
export function setFormatEditorCodeTrust(
	format: StoryFormat,
	trusted: boolean
) {
	return async (
		dispatch: StoryFormatsDispatch,
		getState?: StoryFormatsStateGetter
	) => {
		const snapshot =
			format.loadState === 'loaded' ? format.properties : undefined;
		const code = snapshot?.editorCode;
		if (trusted && !code?.sha256) {
			throw new Error(
				'Read the format source before approving its editor code.'
			);
		}
		const editorCodeTrust =
			trusted && code?.sha256
				? {url: code.url, sha256: code.sha256}
				: undefined;
		dispatch({type: 'update', id: format.id, props: {editorCodeTrust}});
		// Revocation reads metadata again in isolation to discard active extension
		// functions. Restarting is still required to remove executed side effects.
		return loadFormatThunk(
			{...format, editorCodeTrust},
			dispatch,
			trusted ? snapshot : undefined,
			getState
		);
	};
}

/**
 * Loads all format properties. If loading previously failed, this will try
 * again.
 */
export function loadAllFormatProperties(
	formats: StoryFormat[]
): Thunk<StoryFormat[], StoryFormatsAction> {
	const toLoad = formats.filter(
		f => f.loadState !== 'loaded' && f.loadState !== 'loading'
	);

	if (!toLoad) {
		return () => {};
	}

	return async (
		dispatch: StoryFormatsDispatch,
		getState: StoryFormatsStateGetter
	) => {
		await Promise.allSettled(
			toLoad.map(format => loadFormatThunk(format, dispatch, undefined, getState))
		);
	};
}

/**
 * Loads a format's properties. If loading previously failed, this function will
 * try again. This returns a thunk which in turns returns a promise resolving to
 * the format properties, which can be useful if you need them immediately.
 */
export function loadFormatProperties(format: StoryFormat) {
	if (format.loadState === 'loaded') {
		return () => format.properties;
	}

	return async (
		dispatch: StoryFormatsDispatch,
		getState?: StoryFormatsStateGetter
	) => await loadFormatThunk(format, dispatch, undefined, getState);
}
