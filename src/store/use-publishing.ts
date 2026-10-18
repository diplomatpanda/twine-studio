import * as React from 'react';
import {
	publishArchive,
	publishStory,
	publishStoryWithFormat,
	PublishOptions
} from '../util/publish';
import {usePrefsContext} from './prefs';
import {
	formatWithNameAndVersion,
	loadFormatProperties,
	useStoryFormatsContext,
	StoryFormat,
	StoryFormatProperties,
	StoryFormatsDispatch
} from './story-formats';
import {storyWithId, useStoriesContext} from './stories';
import {getAppInfo} from '../util/app-info';

type FormatLoadThunk = ReturnType<typeof loadFormatProperties>;

/**
 * The thunk reducer returns a thunk's value at runtime, although its React
 * Dispatch type is necessarily void-returning. Keep publishing on that
 * runtime path so format loads receive the live state getter and cannot run
 * after the format has been deleted or revoked.
 */
function loadPropertiesForPublishing(
	format: StoryFormat,
	dispatch: StoryFormatsDispatch
): Promise<StoryFormatProperties | undefined> {
	return (dispatch as unknown as (
		action: FormatLoadThunk
	) => Promise<StoryFormatProperties | undefined>)(loadFormatProperties(format));
}

export interface UsePublishingProps {
	proofStory: (storyId: string) => Promise<string>;
	publishArchive: (storyIds?: string[]) => Promise<string>;
	publishStory: (
		storyId: string,
		publishOptions?: PublishOptions
	) => Promise<string>;
	publishStoryData: (storyId: string) => string;
}

/**
 * A React hook to publish stories from context. You probably want to use
 * `useStoryLaunch` instead--this is for doing the actual binding of the story
 * and story format.
 */
export function usePublishing(): UsePublishingProps {
	// As little logic as possible should live here--instead it should be in
	// util/publish.ts.

	const {prefs} = usePrefsContext();
	const {dispatch: storyFormatsDispatch, formats} = useStoryFormatsContext();
	const {stories} = useStoriesContext();

	return {
		publishArchive: React.useCallback(
			async () => publishArchive(stories, getAppInfo()),
			[stories]
		),
		proofStory: React.useCallback(
			async storyId => {
				const story = storyWithId(stories, storyId);
				const format = formatWithNameAndVersion(
					formats,
					prefs.proofingFormat.name,
					prefs.proofingFormat.version
				);
				const formatProperties = await loadPropertiesForPublishing(
					format,
					storyFormatsDispatch
				);

				if (!formatProperties) {
					throw new Error(`Couldn't load story format properties`);
				}

				return publishStoryWithFormat(
					story,
					formatProperties.source,
					getAppInfo()
				);
			},
			[
				formats,
				prefs.proofingFormat.name,
				prefs.proofingFormat.version,
				stories,
				storyFormatsDispatch
			]
		),
		publishStory: React.useCallback(
			async (storyId, publishOptions) => {
				const story = storyWithId(stories, storyId);
				const format = formatWithNameAndVersion(
					formats,
					story.storyFormat,
					story.storyFormatVersion
				);
				const formatProperties = await loadPropertiesForPublishing(
					format,
					storyFormatsDispatch
				);

				if (!formatProperties) {
					throw new Error(`Couldn't load story format properties`);
				}

				return publishStoryWithFormat(
					story,
					formatProperties.source,
					getAppInfo(),
					publishOptions
				);
			},
			[formats, stories, storyFormatsDispatch]
		),
		publishStoryData: React.useCallback(
			(storyId: string) => {
				const story = storyWithId(stories, storyId);

				return publishStory(story, getAppInfo(), {startOptional: true});
			},
			[stories]
		)
	};
}
