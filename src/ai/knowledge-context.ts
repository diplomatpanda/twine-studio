import {AiKnowledgeContextEntry, MAX_AI_KNOWLEDGE_ENTRIES} from '../electron/shared/electron-shared.types';
import {Passage, Story} from '../store/stories/stories.types';

/** Never infer which named branch applies to the selected passage. */
export function aiKnowledgeForPassage(
	story: Story,
	passage: Passage
): AiKnowledgeContextEntry[] {
	const relevant = story.knowledge.filter(entry =>
		entry.status === 'established' &&
		(entry.scope === 'story' ||
			(entry.scope === 'passage' && entry.passageName === passage.name))
	);
	return [
		...relevant.filter(entry => entry.scope === 'passage'),
		...relevant.filter(entry => entry.scope === 'story')
	].slice(0, MAX_AI_KNOWLEDGE_ENTRIES).map(entry => ({
		scope: entry.scope as 'story' | 'passage',
		kind: entry.kind,
		status: 'established',
		title: entry.title,
		note: entry.note
	}));
}
