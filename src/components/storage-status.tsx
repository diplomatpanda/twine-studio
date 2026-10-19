import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {saveAs} from 'file-saver';
import {useStoriesContext} from '../store/stories';
import {
	getStorageStatus,
	subscribeStorageStatus,
	retryStorageChanges,
	discardConflictingEditorDrafts,
	discardOrphanEditorDrafts,
	exportStorageRecovery
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
	const titleKey = status.unreadableStoryRecords
		? 'studio.storage.unreadableStoryTitle'
		: status.ambiguousDrafts
		? 'studio.storage.ambiguousDraftTitle'
		: status.orphanDrafts
		? 'studio.storage.orphanDraftTitle'
		: status.recoveredDraftConflict
		? 'studio.storage.draftConflictTitle'
		: status.conflict ? 'studio.storage.conflictTitle'
		: status.saving ? 'studio.storage.saving' : 'studio.storage.unsaved';
	const helpKey = status.unreadableStoryRecords
		? 'studio.storage.unreadableStoryHelp'
		: status.ambiguousDrafts
		? 'studio.storage.ambiguousDraftHelp'
		: status.orphanDrafts
		? 'studio.storage.orphanDraftHelp'
		: status.recoveredDraftConflict
		? 'studio.storage.draftConflictHelp'
		: status.conflict
			? 'studio.storage.conflictHelp'
			: status.saving ? 'studio.storage.savingHelp'
			: status.durable ? 'studio.storage.recovered' : 'studio.storage.keepOpen';
	return (
		<aside className="storage-status" role={status.saving ? 'status' : 'alert'}>
			<strong>{t(titleKey)}</strong>
			<p>{t(helpKey)}</p>
			{!status.conflict && status.error && <p>{status.error}</p>}
			{!status.conflict && !status.saving && !status.ambiguousDrafts && !status.orphanDrafts && !status.unreadableStoryRecords && <button
				onClick={() => {
					try {
						retryStorageChanges();
					} catch {
						/* Persistent status already contains the error. */
					}
				}}
			>
				{t('studio.storage.retry')}
			</button>}
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
			<button onClick={() =>
				saveAs(
					new Blob([exportStorageRecovery()], {type: 'application/json'}),
					'Twine Studio recovery.json'
				)
			}>{t('studio.storage.exportRaw')}</button>
			{status.orphanDrafts && !status.hasDurableDrafts && !status.unreadableStoryRecords && <button onClick={discardOrphanEditorDrafts}>
				{t('studio.storage.discardOrphanDrafts')}
			</button>}
			{status.recoveredDraftConflict && !status.hasDurableDrafts && !status.unreadableStoryRecords && <button onClick={() => {
				discardConflictingEditorDrafts();
				window.location.reload();
			}}>{t('studio.storage.discardRecoveredDraft')}</button>}
		</aside>
	);
};
