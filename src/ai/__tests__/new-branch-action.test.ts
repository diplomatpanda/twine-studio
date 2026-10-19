import {fakeStory} from '../../test-util';
import {rectsIntersect} from '../../util/geometry';
import {PassageEditProposal} from '../passage-edit-proposal';
import {newBranchAction} from '../new-branch-action';

it('builds one story update with the new passage clear of existing map cards', () => {
	const story = fakeStory(2);
	const source = story.passages[0];
	const blocker = story.passages[1];
	source.left = 0;
	source.top = 0;
	source.width = source.height = 100;
	blocker.left = 0;
	blocker.top = 125;
	blocker.width = blocker.height = 100;
	const proposal: PassageEditProposal = {
		schemaVersion: 1,
		summary: 'Add a branch',
		operation: {
			type: 'updatePassageText', passageId: source.id,
			proposedText: 'Original\n[[Go|Cabin]]', rationale: 'One new route.'
		},
		warnings: [],
		newPassage: {name: 'Cabin'}
	};
	const action = newBranchAction(story, source, proposal);
	const passages = action.props.passages!;
	expect(action.type).toBe('updateStory');
	expect(passages).toHaveLength(3);
	expect(passages[0].text).toBe('Original\n[[Go|Cabin]]');
	expect(passages[1]).toBe(blocker);
	expect(passages[2]).toEqual(expect.objectContaining({name: 'Cabin', text: '', story: story.id}));
	expect(rectsIntersect(passages[2], blocker)).toBe(false);
	expect(rectsIntersect(passages[2], source)).toBe(false);
});

it('places two empty branches without overlapping the source, blockers or each other', () => {
	const story = fakeStory(2);
	const source = story.passages[0];
	const blocker = story.passages[1];
	source.left = source.top = 0;
	source.width = source.height = 100;
	blocker.left = 0;
	blocker.top = 125;
	blocker.width = blocker.height = 100;
	const proposal: PassageEditProposal = {
		schemaVersion: 1, summary: 'Add two routes',
		operation: {
			type: 'updatePassageText', passageId: source.id,
			proposedText: 'Original\n[[Investigate|Cabin]]\n[[Continue|Road]]',
			rationale: 'Two destinations.'
		},
		warnings: [], newPassages: [
			{name: 'Cabin', label: 'Investigate'},
			{name: 'Road', label: 'Continue'}
		]
	};
	const passages = newBranchAction(story, source, proposal).props.passages!;
	expect(passages).toHaveLength(4);
	expect(passages[0].text).toContain('[[Continue|Road]]');
	expect(passages.slice(2).map(passage => passage.name)).toEqual(['Cabin', 'Road']);
	for (const passage of passages.slice(2)) {
		expect(passage.text).toBe('');
		expect(rectsIntersect(passage, source)).toBe(false);
		expect(rectsIntersect(passage, blocker)).toBe(false);
	}
	expect(rectsIntersect(passages[2], passages[3])).toBe(false);
});
