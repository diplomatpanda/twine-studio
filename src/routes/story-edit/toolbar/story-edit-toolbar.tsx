import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {RouteToolbar} from '../../../components/route-toolbar';
import {AppActions, BuildActions} from '../../../route-actions';
import {Passage, Story} from '../../../store/stories';
import {Point} from '../../../util/geometry';
import {PassageActions} from './passage/passage-actions';
import {StoryActions} from './story/story-actions';
import {UndoRedoButtons} from './undo-redo-buttons';
import {ZoomButtons} from './zoom-buttons';

export interface StoryEditToolbarProps {
	focusPassage?: Passage;
	getCenter: () => Point;
	onFocusBranch: (passage: Passage) => void;
	onOpenFuzzyFinder: () => void;
	onShowFullMap: () => void;
	story: Story;
	visiblePassageIds: Set<string>;
}

export const StoryEditToolbar: React.FC<StoryEditToolbarProps> = props => {
	const {focusPassage, getCenter, onFocusBranch, onOpenFuzzyFinder, onShowFullMap,
		story, visiblePassageIds} = props;
	const {t} = useTranslation();

	return (
		<RouteToolbar
			pinnedControls={
				<>
					<ZoomButtons story={story} />
					<UndoRedoButtons />
				</>
			}
			tabs={{
				[t('common.passage')]: (
					<PassageActions
						focusPassage={focusPassage}
						getCenter={getCenter}
						onFocusBranch={onFocusBranch}
						onOpenFuzzyFinder={onOpenFuzzyFinder}
						onShowFullMap={onShowFullMap}
						story={story}
						visiblePassageIds={visiblePassageIds}
					/>
				),
				[t('common.story')]: <StoryActions story={story} />,
				[t('common.build')]: <BuildActions story={story} />,
				[t('common.appName')]: <AppActions />
			}}
		/>
	);
};
