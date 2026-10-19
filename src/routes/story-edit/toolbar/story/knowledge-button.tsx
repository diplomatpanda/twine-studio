import {IconBook2} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../../../components/control/icon-button';
import {StoryKnowledgeDialog, useDialogsContext} from '../../../../dialogs';
import {Story} from '../../../../store/stories';

export const KnowledgeButton: React.FC<{story: Story}> = ({story}) => {
	const {dispatch} = useDialogsContext();
	const {t} = useTranslation();
	return <IconButton icon={<IconBook2 />} label={t('studio.knowledge.title')}
		onClick={() => dispatch({type: 'addDialog', component: StoryKnowledgeDialog, props: {storyId: story.id}})} />;
};
