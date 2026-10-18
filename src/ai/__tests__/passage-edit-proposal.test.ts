import {fakeStory} from '../../test-util';
import {
	canApplyPassageEdit,
	parsePassageEditProposal,
	PassageEditSnapshot
} from '../passage-edit-proposal';

function fixture() {
	const story = fakeStory(1);
	const passage = story.passages[0];
	passage.text = '<<if $map>>\n[[Cabin]]\n<</if>>';
	const snapshot: PassageEditSnapshot = {
		storyId: story.id,
		passageId: passage.id,
		storyFormat: story.storyFormat,
		storyFormatVersion: story.storyFormatVersion,
		text: passage.text
	};
	return {story, passage, snapshot};
}

function response(passageId: string, proposedText: string) {
	return JSON.stringify({
		schemaVersion: 1,
		summary: 'Correct the closing macro.',
		operation: {
			type: 'updatePassageText',
			passageId,
			proposedText,
			rationale: 'This form matches SugarCube syntax.'
		},
		warnings: []
	});
}

describe('AI passage edit proposal boundary', () => {
	it('accepts one source change that preserves links and IDs', () => {
		const {passage, snapshot} = fixture();
		const proposal = parsePassageEditProposal(
			response(passage.id, '<<if $map>>\n[[Cabin]]\n<</if>>\n'),
			snapshot
		);
		expect(proposal.operation.passageId).toBe(passage.id);
	});

	it('rejects unknown operations, extra commands, malformed JSON, and other passages', () => {
		const {passage, snapshot} = fixture();
		expect(() => parsePassageEditProposal('{oops', snapshot)).toThrow();
		expect(() =>
			parsePassageEditProposal(response('other', 'new'), snapshot)
		).toThrow();
		expect(() =>
			parsePassageEditProposal(
				response(passage.id, 'new').replace('updatePassageText', 'deleteStory'),
				snapshot
			)
		).toThrow();
		const extra = JSON.parse(response(passage.id, 'new'));
		extra.operation.script = 'alert(1)';
		expect(() => parsePassageEditProposal(JSON.stringify(extra), snapshot)).toThrow();
	});

	it('rejects unreviewed link and oversized changes', () => {
		const {passage, snapshot} = fixture();
		expect(() =>
			parsePassageEditProposal(response(passage.id, '[[Road]]'), snapshot)
		).toThrow(/links/);
		expect(() =>
			parsePassageEditProposal(response(passage.id, 'x'.repeat(65537)), snapshot)
		).toThrow();
	});

	it('refuses a proposal after edits, format changes or passage replacement', () => {
		const {story, passage, snapshot} = fixture();
		expect(canApplyPassageEdit(snapshot, story, passage)).toBe(true);
		expect(canApplyPassageEdit(snapshot, story, {...passage, text: 'new'})).toBe(false);
		expect(
			canApplyPassageEdit(snapshot, {...story, storyFormat: 'Harlowe'}, passage)
		).toBe(false);
		expect(canApplyPassageEdit(snapshot, story, {...passage, id: 'other'})).toBe(false);
	});
});
