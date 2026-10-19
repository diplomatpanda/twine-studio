import {v4 as uuid} from '@lukeed/uuid';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {CardContent} from '../../components/container/card';
import {DialogCard} from '../../components/container/dialog-card';
import {addPassageEditors, useDialogsContext} from '../context';
import {DialogComponentProps} from '../dialogs.types';
import {storyWithId, updateStory} from '../../store/stories';
import {
	StoryKnowledgeEntry, StoryKnowledgeKind, StoryKnowledgeStatus,
	storyKnowledgeKinds, storyKnowledgeStatuses
} from '../../store/stories/story-knowledge';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import './story-knowledge.css';

export interface StoryKnowledgeDialogProps extends DialogComponentProps {
	storyId: string;
}

export const StoryKnowledgeDialog: React.FC<StoryKnowledgeDialogProps> = props => {
	const {storyId, ...dialogProps} = props;
	const {dispatch, stories} = useUndoableStoriesContext();
	const {dispatch: dialogsDispatch} = useDialogsContext();
	const {t} = useTranslation();
	const story = storyWithId(stories, storyId);
	const [filter, setFilter] = React.useState<StoryKnowledgeKind | 'all'>('all');
	const [editingId, setEditingId] = React.useState<string>();
	const [kind, setKind] = React.useState<StoryKnowledgeKind>('character');
	const [status, setStatus] = React.useState<StoryKnowledgeStatus>('planned');
	const [title, setTitle] = React.useState('');
	const [note, setNote] = React.useState('');
	const [scope, setScope] = React.useState<StoryKnowledgeEntry['scope']>('story');
	const [passageName, setPassageName] = React.useState('');
	const [branchName, setBranchName] = React.useState('');

	function resetForm() {
		setEditingId(undefined);
		setKind('character');
		setStatus('planned');
		setTitle('');
		setNote('');
		setScope('story');
		setPassageName('');
		setBranchName('');
	}

	function save(event: React.FormEvent) {
		event.preventDefault();
		if (!title.trim() || (scope === 'passage' && !passageName) ||
			(scope === 'branch' && !branchName.trim()) ||
			(!editingId && story.knowledge.length >= 500)) return;
		const entry: StoryKnowledgeEntry = {
			id: editingId ?? uuid(), kind, status,
			title: title.trim(), note: note.trim(), scope,
			...(scope === 'passage' ? {passageName} : {}),
			...(scope === 'branch' ? {branchName: branchName.trim()} : {})
		};
		const knowledge = editingId
			? story.knowledge.map(existing => existing.id === editingId ? entry : existing)
			: [...story.knowledge, entry];
		dispatch(updateStory(stories, story, {knowledge}), 'studio.knowledge.undoChange');
		resetForm();
	}

	function edit(entry: StoryKnowledgeEntry) {
		setEditingId(entry.id);
		setKind(entry.kind);
		setStatus(entry.status);
		setTitle(entry.title);
		setNote(entry.note);
		setScope(entry.scope);
		setPassageName(entry.passageName ?? '');
		setBranchName(entry.branchName ?? '');
	}

	function remove(entry: StoryKnowledgeEntry) {
		dispatch(updateStory(stories, story, {
			knowledge: story.knowledge.filter(existing => existing.id !== entry.id)
		}), 'studio.knowledge.undoChange');
		if (editingId === entry.id) resetForm();
	}

	const visible = story.knowledge.filter(entry => filter === 'all' || entry.kind === filter);

	return (
		<DialogCard {...dialogProps} className="story-knowledge-dialog"
			headerLabel={t('studio.knowledge.title')} maximizable>
			<CardContent>
				<p>{t('studio.knowledge.help')}</p>
				<label>{t('studio.knowledge.filter')}{' '}
					<select value={filter} onChange={event => setFilter(event.target.value as typeof filter)}>
						<option value="all">{t('studio.knowledge.all')}</option>
						{storyKnowledgeKinds.map(value => <option key={value} value={value}>{t(`studio.knowledge.kind.${value}`)}</option>)}
					</select>
				</label>
				{visible.length ? (
					<ul className="story-knowledge-list">
						{visible.map(entry => {
							const passage = entry.scope === 'passage'
								? story.passages.find(item => item.name === entry.passageName)
								: undefined;
							return <li key={entry.id}>
								<strong>{entry.title}</strong>
								<span>{t(`studio.knowledge.kind.${entry.kind}`)} · {t(`studio.knowledge.status.${entry.status}`)}</span>
								<span>{entry.scope === 'story' ? t('studio.knowledge.storyWide')
									: entry.scope === 'branch' ? t('studio.knowledge.branchNamed', {name: entry.branchName})
									: passage ? t('studio.knowledge.passageNamed', {name: passage.name})
									: t('studio.knowledge.missingPassage', {name: entry.passageName})}</span>
								{entry.note && <p>{entry.note}</p>}
								<div className="story-knowledge-actions">
									{passage && <button type="button" onClick={() => dialogsDispatch(addPassageEditors(story.id, [passage.id]))}>{t('studio.knowledge.openPassage')}</button>}
									<button type="button" onClick={() => edit(entry)}>{t('common.edit')}</button>
									<button type="button" onClick={() => remove(entry)}>{t('common.delete')}</button>
								</div>
							</li>;
						})}
					</ul>
				) : <p>{t('studio.knowledge.empty')}</p>}
				<form onSubmit={save}>
					<h3>{editingId ? t('studio.knowledge.editEntry') : t('studio.knowledge.addEntry')}</h3>
					<label>{t('studio.knowledge.kindLabel')}
						<select value={kind} onChange={event => setKind(event.target.value as StoryKnowledgeKind)}>
							{storyKnowledgeKinds.map(value => <option key={value} value={value}>{t(`studio.knowledge.kind.${value}`)}</option>)}
						</select>
					</label>
					<label>{t('studio.knowledge.statusLabel')}
						<select value={status} onChange={event => setStatus(event.target.value as StoryKnowledgeStatus)}>
							{storyKnowledgeStatuses.map(value => <option key={value} value={value}>{t(`studio.knowledge.status.${value}`)}</option>)}
						</select>
					</label>
					<label>{t('studio.knowledge.entryTitle')}
						<input required maxLength={160} value={title} onChange={event => setTitle(event.target.value)} />
					</label>
					<label>{t('studio.knowledge.note')}
						<textarea maxLength={2000} value={note} onChange={event => setNote(event.target.value)} />
					</label>
					<label>{t('studio.knowledge.scopeLabel')}
						<select value={scope} onChange={event => setScope(event.target.value as StoryKnowledgeEntry['scope'])}>
							<option value="story">{t('studio.knowledge.storyWide')}</option>
							<option value="passage">{t('studio.knowledge.passageScope')}</option>
							<option value="branch">{t('studio.knowledge.branchScope')}</option>
						</select>
					</label>
					{scope === 'passage' && <label>{t('studio.knowledge.passageScope')}
						<select required value={passageName} onChange={event => setPassageName(event.target.value)}>
							<option value="">{t('studio.knowledge.choosePassage')}</option>
							{passageName && !story.passages.some(passage => passage.name === passageName) &&
								<option value={passageName}>{t('studio.knowledge.missingPassage', {name: passageName})}</option>}
							{story.passages.map(passage => <option key={passage.id} value={passage.name}>{passage.name}</option>)}
						</select>
					</label>}
					{scope === 'branch' && <label>{t('studio.knowledge.branchName')}
						<input required maxLength={160} value={branchName} onChange={event => setBranchName(event.target.value)} />
					</label>}
					<div className="story-knowledge-actions">
						<button type="submit" disabled={!editingId && story.knowledge.length >= 500}>{editingId ? t('studio.knowledge.saveEntry') : t('studio.knowledge.addEntry')}</button>
						{editingId && <button type="button" onClick={resetForm}>{t('common.cancel')}</button>}
					</div>
				</form>
			</CardContent>
		</DialogCard>
	);
};
