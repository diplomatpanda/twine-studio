import * as React from 'react';
import {StoryEditToolbarProps} from '../story-edit-toolbar';

export const StoryEditToolbar: React.FC<StoryEditToolbarProps> = props => (
	<div data-testid="mock-story-edit-toolbar">
		<button onClick={() => props.onFocusBranch(props.story.passages[2] ?? props.story.passages[0])}>
			mock-focus-branch
		</button>
		<button onClick={props.onShowFullMap}>mock-show-full-map</button>
	</div>
);
