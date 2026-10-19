import {v4 as uuid} from '@lukeed/uuid';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {addPassageEditors, useDialogsContext} from '../context';
import {Passage, Story} from '../../store/stories';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {useFormatReferenceParser} from '../../store/use-format-reference-parser';
import {passageDefaults} from '../../store/stories/defaults';
import {rectsIntersect} from '../../util/geometry';
import {passageReferenceNames} from '../../util/passage-references';
import './passage-links.css';

export interface PassageLinksProps {
	backPassageId?: string;
	passage: Passage;
	story: Story;
}

export const PassageLinks: React.FC<PassageLinksProps> = ({backPassageId, passage, story}) => {
	const {dispatch: dialogsDispatch} = useDialogsContext();
	const {dispatch: storiesDispatch} = useUndoableStoriesContext();
	const {t} = useTranslation();
	const formatReferences = useFormatReferenceParser(story.storyFormat, story.storyFormatVersion);
	const outgoing = React.useMemo(() => passageReferenceNames(passage.text, formatReferences),
		[passage.text, formatReferences]);
	const incoming = React.useMemo(() => story.passages.filter(other =>
		other.id !== passage.id && passageReferenceNames(other.text, formatReferences).includes(passage.name)
	), [formatReferences, passage.id, passage.name, story.passages]);
	const previous = story.passages.find(other => other.id === backPassageId);
	const passageByName = new Map(story.passages.map(other => [other.name, other]));

	function open(target: Passage) {
		dialogsDispatch(addPassageEditors(story.id, [target.id]));
	}

	function createAndOpen(name: string) {
		// Place the repaired destination beside its source without covering another
		// passage. Normal link edits create destinations automatically; this path is
		// for links already missing in imported or edited stories.
		const defaults = passageDefaults();
		const id = uuid();
		const left = passage.left + passage.width + 25;
		let top = passage.top;
		while (story.passages.some(other => rectsIntersect(other, {
			left, top, width: defaults.width, height: defaults.height
		}))) {
			top += defaults.height + 25;
		}
		storiesDispatch({type: 'createPassages', storyId: story.id, props: [{id, name, left, top}]},
			t('studio.passageLinks.createUndo'));
		dialogsDispatch(addPassageEditors(story.id, [id]));
	}

	return (
		<details className="passage-links">
			<summary>{t('studio.passageLinks.title', {count: outgoing.length + incoming.length})}</summary>
			<div className="passage-links-content">
				{previous && <button type="button" onClick={() => open(previous)}>
					{t('studio.passageLinks.back', {name: previous.name})}
				</button>}
				{story.startPassage === passage.id && <p>{t('studio.passageLinks.start')}</p>}
				<div>
					<strong>{t('studio.passageLinks.outgoing')}</strong>
					{outgoing.length ? <ul>{outgoing.map(name => {
						const target = passageByName.get(name);
						return <li key={name}>
							{target ? <button type="button" onClick={() => open(target)}>{name}</button> :
								<><span>{name}</span> <button
									aria-label={t('studio.passageLinks.createNamed', {name})}
									type="button"
									onClick={() => createAndOpen(name)}
								>
									{t('studio.passageLinks.create')}
								</button></>}
						</li>;
					})}</ul> : <p>{t('studio.passageLinks.none')}</p>}
				</div>
				<div>
					<strong>{t('studio.passageLinks.incoming')}</strong>
					{incoming.length ? <ul>{incoming.map(source =>
						<li key={source.id}><button type="button" onClick={() => open(source)}>{source.name}</button></li>
					)}</ul> : <p>{t('studio.passageLinks.none')}</p>}
				</div>
			</div>
		</details>
	);
};
