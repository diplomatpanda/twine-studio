import {IconBulb} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconButton} from '../../../../components/control/icon-button';
import {StoryStarterDialog, useDialogsContext} from '../../../../dialogs';

export const StoryStarterButton: React.FC = () => {
	const {dispatch} = useDialogsContext();
	const {t} = useTranslation();
	return <IconButton icon={<IconBulb />} label={t('studio.starter.title')}
		onClick={() => dispatch({type: 'addDialog', component: StoryStarterDialog})} />;
};
