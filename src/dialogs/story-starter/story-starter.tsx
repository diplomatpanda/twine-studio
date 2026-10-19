import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {CardContent} from '../../components/container/card';
import {DialogCard} from '../../components/container/dialog-card';
import {usePrefsContext} from '../../store/prefs';
import {createStory, storyDefaults, useStoriesContext} from '../../store/stories';
import {buildStoryStarter, isPlainStarterIdea, StoryStarterPattern, storyStarterPatterns} from '../../util/story-starter';
import {unusedName} from '../../util/unused-name';
import {supportsChoiceBuilder} from '../../util/choice-source';
import {DialogComponentProps} from '../dialogs.types';
import {storyFileNameKey} from '../../electron/shared/story-filename';
import './story-starter.css';

export const StoryStarterDialog: React.FC<DialogComponentProps> = props => {
	const {dispatch, stories} = useStoriesContext();
	const {prefs} = usePrefsContext();
	const history = useHistory();
	const {t} = useTranslation();
	const [name, setName] = React.useState(() => unusedName(
		storyDefaults().name, stories.map(story => story.name)
	));
	const [premise, setPremise] = React.useState('');
	const [pattern, setPattern] = React.useState<StoryStarterPattern>('branch');
	const [error, setError] = React.useState('');
	const format = prefs.storyFormat;
	const supported = supportsChoiceBuilder(format.name, format.version);
	const duplicateName = stories.some(story =>
		storyFileNameKey(story) === storyFileNameKey({name: name.trim()})
	);
	const canCreate = supported && !!name.trim() && isPlainStarterIdea(premise) && !duplicateName;

	function create(event: React.FormEvent) {
		event.preventDefault();
		if (!canCreate) return;
		try {
			const starter = buildStoryStarter(
				premise, pattern, format.name, format.version, key => t(key)
			);
			const id = createStory(stories, prefs, {...starter, name: name.trim()})(
				dispatch, () => stories
			);
			props.onClose();
			history.push(`/stories/${id}`);
		} catch (failure) {
			setError((failure as Error).message);
		}
	}

	return <DialogCard {...props} className="story-starter-dialog"
		headerLabel={t('studio.starter.title')} maximizable>
		<CardContent>
			<p>{t('studio.starter.help')}</p>
			<form onSubmit={create}>
				<label>{t('studio.starter.storyName')}
					<input required maxLength={160} value={name}
						onChange={event => {setName(event.target.value); setError('');}} />
				</label>
				{duplicateName && <p role="alert">{t('routes.storyList.toolbar.createStoryButton.nameConflict')}</p>}
				<label>{t('studio.starter.premise')}
					<textarea required maxLength={500} value={premise}
						onChange={event => {setPremise(event.target.value); setError('');}} />
				</label>
				{premise && !isPlainStarterIdea(premise) &&
					<p role="status">{t('studio.starter.plainText')}</p>}
				<label>{t('studio.starter.structure')}
					<select value={pattern} onChange={event => setPattern(event.target.value as StoryStarterPattern)}>
						{storyStarterPatterns.map(value =>
							<option value={value} key={value}>{t(`studio.starter.pattern.${value}.label`)}</option>
						)}
					</select>
				</label>
				<p>{t(`studio.starter.pattern.${pattern}.description`)}</p>
				<p>{t('studio.starter.preview')}</p>
				<ol>{[0, 1, 2, 3, 4, 5].map(index =>
					<li key={index}>{t(`studio.starter.pattern.${pattern}.passage${index}Name`)}</li>
				)}</ol>
				{!supported && <p role="status">{t('studio.starter.unsupported', {format: format.name})}</p>}
				{error && <p role="alert">{error}</p>}
				<button type="submit" disabled={!canCreate}>{t('studio.starter.create')}</button>
			</form>
		</CardContent>
	</DialogCard>;
};
