import {fakeStory} from '../../test-util';
import {canApplyPassageEdit, PassageEditSnapshot} from '../passage-edit-proposal';
import {aiKnowledgeForPassage} from '../knowledge-context';

it('selects only established story-wide and selected-passage notes, passage first', () => {
	const story = fakeStory(2);
	const [selected, other] = story.passages;
	story.knowledge = [
		{id: 'global', kind: 'world-rule', status: 'established', title: 'No magic', note: 'Magic is gone.', scope: 'story'},
		{id: 'other', kind: 'character', status: 'established', title: 'Other route', note: 'A secret.', scope: 'passage', passageName: other.name},
		{id: 'branch', kind: 'ending', status: 'established', title: 'Branch outcome', note: 'A death.', scope: 'branch', branchName: 'Red path'},
		{id: 'planned', kind: 'plot-thread', status: 'planned', title: 'Possible ending', note: 'Maybe.', scope: 'story'},
		{id: 'local', kind: 'character', status: 'established', title: 'Maya', note: 'Maya knows the map.', scope: 'passage', passageName: selected.name},
		{id: 'inferred', kind: 'location', status: 'inference', title: 'Hidden place', note: 'Perhaps.', scope: 'passage', passageName: selected.name}
	];
	expect(aiKnowledgeForPassage(story, selected)).toEqual([
		{scope: 'passage', kind: 'character', status: 'established', title: 'Maya', note: 'Maya knows the map.'},
		{scope: 'story', kind: 'world-rule', status: 'established', title: 'No magic', note: 'Magic is gone.'}
	]);
});

it('caps sent notes and invalidates a proposal when opted-in context changes', () => {
	const story = fakeStory(1);
	const passage = story.passages[0];
	story.knowledge = Array.from({length: 8}, (_, index) => ({
		id: `note-${index}`, kind: 'world-rule' as const, status: 'established' as const,
		title: `Rule ${index}`, note: `Fact ${index}`, scope: 'story' as const
	}));
	const knowledge = aiKnowledgeForPassage(story, passage);
	expect(knowledge).toHaveLength(4);
	const snapshot: PassageEditSnapshot = {
		storyId: story.id, passageId: passage.id,
		storyFormat: story.storyFormat, storyFormatVersion: story.storyFormatVersion,
		text: passage.text, knowledge
	};
	expect(canApplyPassageEdit(snapshot, story, passage)).toBe(true);
	story.knowledge[0].note = 'Changed after request';
	expect(canApplyPassageEdit(snapshot, story, passage)).toBe(false);
});
