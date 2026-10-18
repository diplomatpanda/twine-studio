import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {saveAs} from 'file-saver';
import {useStoriesContext} from '../store/stories';
import {
	getStorageStatus,
	subscribeStorageStatus,
	retryStorageChanges
} from '../store/persistence/local-storage/transaction';
import {publishArchive} from '../util/publish';
import {getAppInfo} from '../util/app-info';
import './storage-status.css';

export const StorageStatus: React.FC = () => {
	const [status, setStatus] = React.useState(getStorageStatus);
	const {stories} = useStoriesContext();
	const {t} = useTranslation();
	React.useEffect(
		() => subscribeStorageStatus(() => setStatus(getStorageStatus())),
		[]
	);
	if (!status.dirty) return null;
	return (
		<aside className="storage-status" role="alert">
			<strong>{t('studio.storage.unsaved')}</strong>
			<p>
				{t(
					status.durable
						? 'studio.storage.recovered'
						: 'studio.storage.keepOpen'
				)}
			</p>
			<p>{status.error}</p>
			<button
				onClick={() => {
					try {
						retryStorageChanges();
					} catch {
						/* Persistent status already contains the error. */
					}
				}}
			>
				{t('studio.storage.retry')}
			</button>
			<button
				onClick={() =>
					saveAs(
						new Blob([publishArchive(stories, getAppInfo())], {
							type: 'text/html;charset=utf-8'
						}),
						'Twine Studio rescue.html'
					)
				}
			>
				{t('studio.storage.export')}
			</button>
		</aside>
	);
};
