import * as React from 'react';
import {IconFilter, IconX} from '@tabler/icons';
import {useTranslation} from 'react-i18next';
import {ButtonBar} from '../../../../components/container/button-bar';
import {IconButton} from '../../../../components/control/icon-button';
import {RenamePassageButton} from '../../../../components/passage/rename-passage-button';
import {
	Passage,
	Story,
	updatePassage,
	useStoriesContext
} from '../../../../store/stories';
import {Point} from '../../../../util/geometry';
import {CreatePassageButton} from './create-passage-button';
import {DeletePassagesButton} from './delete-passages-button';
import {EditPassagesButton} from './edit-passages-buttons';
import {GoToPassageButton} from './go-to-passage-button';
import {SelectAllPassagesButton} from './select-all-passages-button';
import {DeselectAllPassagesButton} from './deselect-all-passages-button';
import {StartAtPassageButton} from './start-at-passage-button';
import {TestPassageButton} from './test-passage-button';

export interface PassageActionsProps {
	focusPassage?: Passage;
	getCenter: () => Point;
	onFocusBranch: (passage: Passage) => void;
	onOpenFuzzyFinder: () => void;
	onShowFullMap: () => void;
	story: Story;
	visiblePassageIds: Set<string>;
}

export const PassageActions: React.FC<PassageActionsProps> = props => {
	const {
		focusPassage,
		getCenter,
		onFocusBranch,
		onOpenFuzzyFinder,
		onShowFullMap,
		story,
		visiblePassageIds
	} = props;
	const {dispatch} = useStoriesContext();
	const {t} = useTranslation();
	const selectedPassages = React.useMemo(
		() =>
			story.passages.filter(
				passage => passage.selected && visiblePassageIds.has(passage.id)
			),
		[story.passages, visiblePassageIds]
	);
	const soloSelectedPassage = React.useMemo(
		() => (selectedPassages.length === 1 ? selectedPassages[0] : undefined),
		[selectedPassages]
	);

	function handleRename(name: string, passage?: Passage) {
		if (!passage) {
			throw new Error('Passage is unset');
		}

		// Don't create newly linked passages here because the update action will
		// try to recreate the passage as it's been renamed--it sees new links in
		// existing passages, updates them, but does not see that the passage name
		// has been updated since that hasn't happened yet.

		dispatch(updatePassage(story, passage, {name}, {dontUpdateOthers: true}));
	}

	return (
		<ButtonBar>
			<CreatePassageButton
				getCenter={getCenter}
				onCreate={focusPassage ? onShowFullMap : undefined}
				story={story}
			/>
			<EditPassagesButton passages={selectedPassages} story={story} />
			<RenamePassageButton
				onRename={name => handleRename(name, soloSelectedPassage)}
				passage={soloSelectedPassage}
				story={story}
			/>
			<DeletePassagesButton passages={selectedPassages} story={story} />
			<TestPassageButton passage={soloSelectedPassage} story={story} />
			<StartAtPassageButton passage={soloSelectedPassage} story={story} />
			<GoToPassageButton onOpenFuzzyFinder={onOpenFuzzyFinder} />
			{focusPassage ? (
				<IconButton
					icon={<IconX />}
					label={t('routes.storyEdit.branchFocus.showAll')}
					onClick={onShowFullMap}
				/>
			) : (
				<IconButton
					disabled={!soloSelectedPassage}
					icon={<IconFilter />}
					label={t('routes.storyEdit.branchFocus.focus')}
					onClick={() => soloSelectedPassage && onFocusBranch(soloSelectedPassage)}
				/>
			)}
			<SelectAllPassagesButton
				story={story}
				visiblePassageIds={visiblePassageIds}
			/>
			<DeselectAllPassagesButton
				story={story}
				selectedPassages={selectedPassages}
			/>
		</ButtonBar>
	);
};
