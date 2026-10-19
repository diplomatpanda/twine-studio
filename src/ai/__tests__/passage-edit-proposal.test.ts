import {fakeStory} from '../../test-util';
import {
	canApplyPassageEdit,
	parseConditionalChoiceProposal,
	parseNewBranchProposal,
	parsePassageEditProposal,
	parseTwoWayBranchProposal,
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

describe('AI two-way branch proposal boundary', () => {
	function fixture(format = 'SugarCube') {
		const story = fakeStory(1);
		story.storyFormat = format;
		story.storyFormatVersion = format === 'SugarCube' ? '2.36.1' : '3.3.9';
		story.passages[0].text = 'A fork in the road.';
		const snapshot: PassageEditSnapshot = {
			storyId: story.id, passageId: story.passages[0].id,
			storyFormat: story.storyFormat, storyFormatVersion: story.storyFormatVersion,
			text: story.passages[0].text, storyPassages: story.passages
		};
		const operation = {
			type: 'appendTwoWayBranch', passageId: snapshot.passageId,
			choices: [
				{name: 'Cabin', label: 'Investigate the cabin'},
				{name: 'Road', label: 'Continue down the road'}
			], rationale: 'Provide two directions.'
		};
		const response = (changes: Record<string, unknown> = {}) => JSON.stringify({
			schemaVersion: 1, summary: 'Add two routes.',
			operation: {...operation, ...changes}, warnings: []
		});
		return {story, snapshot, response};
	}

	it.each([
		['SugarCube', '[[Investigate the cabin|Cabin]]\n[[Continue down the road|Road]]'],
		['Harlowe', '[[Investigate the cabin->Cabin]]\n[[Continue down the road->Road]]']
	])('generates two %s links and validates both destinations', (format, links) => {
		const {story, snapshot, response} = fixture(format);
		const proposal = parseTwoWayBranchProposal(response(), snapshot, story);
		expect(proposal.operation.proposedText).toBe(`A fork in the road.\n${links}`);
		expect(proposal.newPassages).toEqual([{name: 'Cabin'}, {name: 'Road'}]);
		expect(canApplyPassageEdit(snapshot, story, story.passages[0], proposal)).toBe(true);
		expect(canApplyPassageEdit(snapshot, {...story, passages: [...story.passages]}, story.passages[0], proposal)).toBe(false);
		story.passages.push({...story.passages[0], id: 'other', name: 'Road'});
		expect(canApplyPassageEdit(snapshot, story, story.passages[0], proposal)).toBe(false);
	});

	it('rejects duplicate, reserved, unsafe and unreviewed operations', () => {
		const {story, snapshot, response} = fixture();
		expect(() => parseTwoWayBranchProposal(response({choices: [
			{name: 'Cabin', label: 'Investigate'}, {name: 'Cabin', label: 'Continue'}
		]}), snapshot, story)).toThrow(/distinct/);
		expect(() => parseTwoWayBranchProposal(response({choices: [
			{name: 'Cabin', label: 'Go'}, {name: 'Road', label: 'Go'}
		]}), snapshot, story)).toThrow(/distinct/);
		expect(() => parseTwoWayBranchProposal(response({choices: [
			{name: 'Cabin', label: 'Go'}, {name: 'StoryInit', label: 'Continue'}
		]}), snapshot, story)).toThrow(/reserved/);
		expect(() => parseTwoWayBranchProposal(response({choices: [
			{name: 'Cabin]]', label: 'Go'}, {name: 'Road', label: 'Continue'}
		]}), snapshot, story)).toThrow();
		expect(() => parseTwoWayBranchProposal(response({choices: [
			{name: 'Cabin', label: 'Go'}, {name: 'Road', label: 'Continue', script: 'evil'}
		]}), snapshot, story)).toThrow();
		expect(() => parseTwoWayBranchProposal(response({proposedText: 'unreviewed'}), snapshot, story)).toThrow();
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

describe('AI new branch proposal boundary', () => {
	function fixture() {
		const story = fakeStory(1);
		story.storyFormat = 'SugarCube';
		story.storyFormatVersion = '2.36.1';
		story.passages[0].text = 'A fork in the road.';
		const snapshot: PassageEditSnapshot = {
			storyId: story.id, passageId: story.passages[0].id,
			storyFormat: story.storyFormat, storyFormatVersion: story.storyFormatVersion,
			text: story.passages[0].text,
			storyPassages: story.passages
		};
		const operation = {
			type: 'appendNewBranch', passageId: snapshot.passageId,
			name: 'Cabin', label: 'Investigate the cabin',
			rationale: 'This creates a new route.'
		};
		const response = (changes: Record<string, unknown> = {}) => JSON.stringify({
			schemaVersion: 1, summary: 'Add a cabin route.',
			operation: {...operation, ...changes}, warnings: []
		});
		return {story, snapshot, response};
	}

	it('generates one link and describes the new empty destination', () => {
		const {story, snapshot, response} = fixture();
		const proposal = parseNewBranchProposal(response(), snapshot, story);
		expect(proposal.operation.proposedText).toBe(
			'A fork in the road.\n[[Investigate the cabin|Cabin]]'
		);
		expect(proposal.newPassage).toEqual({name: 'Cabin'});
		expect(canApplyPassageEdit(snapshot, story, story.passages[0], proposal)).toBe(true);
		expect(canApplyPassageEdit(snapshot, {...story, passages: [...story.passages]}, story.passages[0], proposal)).toBe(false);
		story.passages.push({...story.passages[0], id: 'new-id', name: 'Cabin'});
		expect(canApplyPassageEdit(snapshot, story, story.passages[0], proposal)).toBe(false);
	});

	it('generates a Harlowe branch link without model-authored syntax', () => {
		const {story, snapshot, response} = fixture();
		story.storyFormat = snapshot.storyFormat = 'Harlowe';
		story.storyFormatVersion = snapshot.storyFormatVersion = '3.3.9';
		const proposal = parseNewBranchProposal(response(), snapshot, story);
		expect(proposal.operation.proposedText).toBe(
			'A fork in the road.\n[[Investigate the cabin->Cabin]]'
		);
	});

	it('rejects existing, reserved, unsafe, and already linked names', () => {
		const {story, snapshot, response} = fixture();
		expect(() => parseNewBranchProposal(response({name: story.passages[0].name}), snapshot, story)).toThrow(/already in use/);
		expect(() => parseNewBranchProposal(response({name: 'StoryData'}), snapshot, story)).toThrow(/reserved/);
		expect(parseNewBranchProposal(response({name: 'Story JavaScript'}), snapshot, story).newPassage).toEqual({name: 'Story JavaScript'});
		expect(() => parseNewBranchProposal(response({name: 'PassageDone'}), snapshot, story)).toThrow(/reserved/);
		expect(() => parseNewBranchProposal(response({name: 'StoryInterface'}), snapshot, story)).toThrow(/reserved/);
		expect(() => parseNewBranchProposal(response({name: 'Cabin]]'}), snapshot, story)).toThrow();
		expect(() => parseNewBranchProposal(response({label: '<<script>>'}), snapshot, story)).toThrow();
		expect(() => parseNewBranchProposal(response({proposedText: 'arbitrary code'}), snapshot, story)).toThrow();
		snapshot.text = '[[Cabin]]';
		expect(() => parseNewBranchProposal(response(), snapshot, story)).toThrow(/already in use/);
	});
});
