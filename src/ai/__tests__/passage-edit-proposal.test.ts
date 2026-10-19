import {fakeStory} from '../../test-util';
import {
	canApplyPassageEdit,
	parseConditionalChoiceProposal,
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

describe('AI conditional choice proposal boundary', () => {
	function fixture() {
		const story = fakeStory(2);
		story.storyFormat = 'SugarCube';
		story.storyFormatVersion = '2.36.1';
		story.passages[0].text = 'The door is locked.';
		story.passages[1].name = 'Garden';
		const snapshot: PassageEditSnapshot = {
			storyId: story.id, passageId: story.passages[0].id,
			storyFormat: story.storyFormat, storyFormatVersion: story.storyFormatVersion,
			text: story.passages[0].text
		};
		const operation = {
			type: 'appendConditionalChoice', passageId: snapshot.passageId,
			factName: 'hasKey', comparison: 'eq', value: true,
			label: 'Enter the garden', destinationId: story.passages[1].id,
			rationale: 'Only readers with the key can enter.'
		};
		const response = (changes: Record<string, unknown> = {}) => JSON.stringify({
			schemaVersion: 1, summary: 'Add a gated route.',
			operation: {...operation, ...changes}, warnings: []
		});
		return {story, snapshot, response};
	}

	it('generates a reviewed format-specific choice to an existing passage', () => {
		const {story, snapshot, response} = fixture();
		const proposal = parseConditionalChoiceProposal(response(), snapshot, story);
		expect(proposal.operation.proposedText).toBe(
			'The door is locked.\n<<if $hasKey === true>>[[Enter the garden|Garden]]<</if>>'
		);
		expect(canApplyPassageEdit(snapshot, story, story.passages[0], proposal)).toBe(true);
		story.passages[1].name = 'Renamed';
		expect(canApplyPassageEdit(snapshot, story, story.passages[0], proposal)).toBe(false);
	});

	it('generates the Harlowe form from the same structured parameters', () => {
		const {story, snapshot, response} = fixture();
		story.storyFormat = snapshot.storyFormat = 'Harlowe';
		story.storyFormatVersion = snapshot.storyFormatVersion = '3.3.9';
		const proposal = parseConditionalChoiceProposal(response(), snapshot, story);
		expect(proposal.operation.proposedText).toBe(
			'The door is locked.\n(if: $hasKey is true)[[[Enter the garden->Garden]]]'
		);
	});

	it('rejects invented targets, unsafe parameters and unrequested source', () => {
		const {story, snapshot, response} = fixture();
		expect(() => parseConditionalChoiceProposal(response({destinationId: 'invented'}), snapshot, story)).toThrow(/destination/);
		expect(() => parseConditionalChoiceProposal(response({factName: 'x);evil()'}), snapshot, story)).toThrow();
		expect(() => parseConditionalChoiceProposal(response({label: '[[Injected]]'}), snapshot, story)).toThrow();
		expect(() => parseConditionalChoiceProposal(response({comparison: 'execute'}), snapshot, story)).toThrow();
		expect(() => parseConditionalChoiceProposal(response({proposedText: 'malicious'}), snapshot, story)).toThrow();
	});
});
