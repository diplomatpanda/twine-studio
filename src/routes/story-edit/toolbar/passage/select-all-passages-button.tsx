import {IconMarquee} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../../../components/control/icon-button';
import {
	selectAllPassages,
	Story,
	useStoriesContext
} from '../../../../store/stories';

export interface SelectAllPassagesButtonProps {
	story: Story;
	visiblePassageIds?: Set<string>;
}

export const SelectAllPassagesButton: React.FC<SelectAllPassagesButtonProps> = props => {
	const {story, visiblePassageIds} = props;
	const {dispatch} = useStoriesContext();
	const {t} = useTranslation();

	return (
		<IconButton
			icon={<IconMarquee />}
			label={t('common.selectAll')}
			onClick={() => dispatch(selectAllPassages(visiblePassageIds
				? {...story, passages: story.passages.filter(passage => visiblePassageIds.has(passage.id))}
				: story))}
		/>
	);
};
