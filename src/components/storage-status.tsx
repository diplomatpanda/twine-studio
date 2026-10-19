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
import {clearMatchingEditorDraft} from '../store/persistence/local-storage/editor-drafts';
import {discardDurableEditorDraft, listDurableEditorDrafts} from '../store/persistence/local-storage/durable-editor-drafts';
import './storage-status.css';

export const StorageStatus: React.FC = () => {
	const [status, setStatus] = React.useState(getStorageStatus);
	const [discardingId, setDiscardingId] = React.useState<string>();
	const [resolution, setResolution] = React.useState('');
	const [reloadAfterReview, setReloadAfterReview] = React.useState(false);
	const {stories} = useStoriesContext();
	const {t} = useTranslation();
	React.useEffect(
		() => subscribeStorageStatus(() => setStatus(getStorageStatus())),
		[]
	);
	if (!status.dirty) return null;
	const durableDrafts = listDurableEditorDrafts();
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
			{durableDrafts.length > 0 && <section className="storage-status-drafts" aria-label={t('studio.storage.draftsTitle')}>
				<h3>{t('studio.storage.draftsTitle')}</h3>
				{durableDrafts.map((draft, index) => {
					const passage = stories.find(story => story.id === draft.storyId)
						?.passages.find(candidate => candidate.id === draft.passageId);
					return <details key={draft.id}>
						<summary>{t('studio.storage.draftLabel', {
							number: index + 1,
							passage: passage?.name ?? t('studio.storage.missingDraftPassage')
						})}</summary>
						<p>{t('studio.storage.draftText')}</p>
						<pre>{draft.text}</pre>
						{discardingId === draft.id ? <>
							<p>{t('studio.storage.discardDraftWarning')}</p>
							<button onClick={async () => {
								const removed = await discardDurableEditorDraft(draft);
								if (removed) clearMatchingEditorDraft(draft);
								setDiscardingId(undefined);
								setResolution(t(removed
									? 'studio.storage.draftRemoved'
									: 'studio.storage.draftNotRemoved'));
								setReloadAfterReview(previous => previous || removed);
								setStatus(getStorageStatus());
							}}>{t('studio.storage.confirmDiscardDraft')}</button>
							<button onClick={() => setDiscardingId(undefined)}>{t('studio.storage.keepDraft')}</button>
						</> : <button onClick={() => setDiscardingId(draft.id)}>
							{t('studio.storage.discardDraft')}
						</button>}
					</details>;
				})}
			</section>}
			{resolution && <p role="status">{resolution}</p>}
			{reloadAfterReview && <button onClick={() => window.location.reload()}>
				{t('studio.storage.reloadAfterReview')}
			</button>}
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
