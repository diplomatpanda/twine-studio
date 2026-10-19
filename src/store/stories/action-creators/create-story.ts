import {v4 as uuid} from '@lukeed/uuid';
import {Thunk} from 'react-hook-thunk-reducer';
import {PrefsState} from '../../prefs';
import {StoriesAction, StoriesState, Story} from '../stories.types';
import {storyFileNameKey} from '../../../electron/shared/story-filename';

/**
 * Creates a new story with the default story format.
 */
export function createStory(
	stories: Story[],
	prefs: PrefsState,
	props: Partial<Omit<Story, 'id'>> & Pick<Story, 'name'>
): Thunk<StoriesState, StoriesAction> {
	const id = uuid();

	if (props.name.trim() === '') {
		throw new Error('Story name cannot be empty');
	}

	if (
		stories.some(story => storyFileNameKey(story) === storyFileNameKey(props))
	) {
		throw new Error(`A story already uses the filename for "${props.name}"`);
	}

	return dispatch => {
		dispatch({
			type: 'createStory',
			props: {
				id,
				storyFormat: prefs.storyFormat.name,
				storyFormatVersion: prefs.storyFormat.version,
				...props
			}
		});

		return id;
	};
}
