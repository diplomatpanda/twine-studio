import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {withPreviewStorage} from '../../util/preview-storage';
import './story-player.css';

export const StoryPlayer: React.FC<{html: string}> = ({html}) => {
	const {t} = useTranslation();
	const source = React.useMemo(() => withPreviewStorage(html), [html]);

	return (
		<main className="story-player">
			<p className="story-player-notice" role="note">
				{t('components.storyPlayer.temporarySaves', {
					defaultValue:
						'Preview saves are temporary. Publish to test persistent saves.'
				})}
			</p>
			<iframe
				title={t('components.storyPlayer.title', {defaultValue: 'Story preview'})}
				// Never add allow-same-origin or allow-popups-to-escape-sandbox:
				// authored scripts must not reach the editor or its browser storage.
				sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
				srcDoc={source}
			/>
		</main>
	);
};
