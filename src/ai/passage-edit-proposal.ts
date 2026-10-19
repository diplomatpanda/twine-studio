import {parseLinks} from '../util/parse-links';
import {choiceSetSource, choiceSource} from '../util/choice-source';
import {conditionalChoiceSource, FactComparison, StoryFactValue} from '../util/story-fact-source';
import {Passage, Story} from '../store/stories/stories.types';
import {AiKnowledgeContextEntry} from '../electron/shared/electron-shared.types';
import {aiKnowledgeForPassage} from './knowledge-context';

const twineMetadataNames = new Set(['StoryTitle', 'StoryData']);
const sugarCubeSpecialNames = new Set([
	'PassageDone', 'PassageFooter', 'PassageHeader', 'PassageReady',
	'StoryAuthor', 'StoryBanner', 'StoryCaption', 'StoryDisplayTitle',
	'StoryInit', 'StoryInterface', 'StoryMenu', 'StoryShare', 'StorySubtitle'
]);

export interface PassageEditProposal {
	schemaVersion: 1;
	summary: string;
	operation: {
		type: 'updatePassageText';
		passageId: string;
		proposedText: string;
		rationale: string;
	};
	warnings: string[];
	destination?: {id: string; name: string};
	newPassage?: {name: string};
	newPassages?: Array<{name: string; label: string}>;
}

export interface PassageEditSnapshot {
	storyId: string;
	passageId: string;
	storyFormat: string;
	storyFormatVersion: string;
	text: string;
	storyPassages?: Passage[];
	knowledge?: AiKnowledgeContextEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, names: string[]) {
	return Object.keys(value).length === names.length &&
		names.every(name => Object.prototype.hasOwnProperty.call(value, name));
}

function hasBoundedText(value: unknown, max: number): value is string {
	return typeof value === 'string' && value.length > 0 && value.length <= max;
}

function linkTags(text: string) {
	return (text.match(/\[\[.*?\]\]/g) ?? []).sort();
}

/** Treat model output as data. This first coding action may not change links. */
export function parsePassageEditProposal(
	raw: string,
	snapshot: PassageEditSnapshot
): PassageEditProposal {
	if (raw.length > 131072) {
		throw new Error('The proposal is too large to review safely.');
	}

	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		throw new Error('The assistant did not return a valid edit proposal.');
	}

	if (
		!isRecord(value) ||
		!hasOnlyKeys(value, ['schemaVersion', 'summary', 'operation', 'warnings']) ||
		value.schemaVersion !== 1 ||
		!hasBoundedText(value.summary, 500) ||
		!Array.isArray(value.warnings) ||
		value.warnings.length > 10 ||
		!value.warnings.every(warning =>
			hasBoundedText(warning, 500)
		) ||
		!isRecord(value.operation) ||
		!hasOnlyKeys(value.operation, [
			'type',
			'passageId',
			'proposedText',
			'rationale'
		]) ||
		value.operation.type !== 'updatePassageText' ||
		value.operation.passageId !== snapshot.passageId ||
		!hasBoundedText(value.operation.proposedText, 65536) ||
		!hasBoundedText(value.operation.rationale, 1000)
	) {
		throw new Error('The assistant returned an unsupported edit proposal.');
	}

	const proposal = value as unknown as PassageEditProposal;
	if (proposal.operation.proposedText === snapshot.text) {
		throw new Error('The assistant proposed no change.');
	}
	if (
		JSON.stringify(linkTags(proposal.operation.proposedText)) !==
		JSON.stringify(linkTags(snapshot.text)) ||
		JSON.stringify(parseLinks(proposal.operation.proposedText).sort()) !==
		JSON.stringify(parseLinks(snapshot.text).sort())
	) {
		throw new Error('This coding action cannot change passage links.');
	}
	return proposal;
}

/** The model selects parameters; trusted code generates the passage source. */
export function parseConditionalChoiceProposal(
	raw: string,
	snapshot: PassageEditSnapshot,
	story: Story
): PassageEditProposal {
	if (raw.length > 131072) throw new Error('The proposal is too large to review safely.');
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		throw new Error('The assistant did not return a valid edit proposal.');
	}
	if (!isRecord(value) ||
		!hasOnlyKeys(value, ['schemaVersion', 'summary', 'operation', 'warnings']) ||
		value.schemaVersion !== 1 || !hasBoundedText(value.summary, 500) ||
		!Array.isArray(value.warnings) || value.warnings.length > 10 ||
		!value.warnings.every(warning => hasBoundedText(warning, 500)) ||
		!isRecord(value.operation) ||
		!hasOnlyKeys(value.operation, ['type', 'passageId', 'factName', 'comparison', 'value', 'label', 'destinationId', 'rationale']) ||
		value.operation.type !== 'appendConditionalChoice' ||
		value.operation.passageId !== snapshot.passageId ||
		!hasBoundedText(value.operation.factName, 40) ||
		!['eq', 'gte', 'lte'].includes(value.operation.comparison as string) ||
		!(typeof value.operation.value === 'boolean' ||
			(typeof value.operation.value === 'number' && Number.isFinite(value.operation.value))) ||
		!hasBoundedText(value.operation.label, 120) ||
		!hasBoundedText(value.operation.destinationId, 512) ||
		!hasBoundedText(value.operation.rationale, 1000) ||
		story.id !== snapshot.storyId ||
		story.storyFormat !== snapshot.storyFormat ||
		story.storyFormatVersion !== snapshot.storyFormatVersion) {
		throw new Error('The assistant returned an unsupported edit proposal.');
	}
	const operation = value.operation;
	const destination = story.passages.slice(0, 100).find(passage => passage.id === operation.destinationId);
	if (!destination) throw new Error('The proposed destination no longer exists.');
	const source = conditionalChoiceSource(
		snapshot.storyFormat,
		snapshot.storyFormatVersion,
		operation.factName as string,
		operation.comparison as FactComparison,
		operation.value as StoryFactValue,
		operation.label as string,
		destination.name
	);
	const proposedText = snapshot.text + (snapshot.text && !snapshot.text.endsWith('\n') ? '\n' : '') + source;
	if (proposedText.length > 65536) throw new Error('The proposal is too large to review safely.');
	return {
		schemaVersion: 1,
		summary: value.summary as string,
		operation: {
			type: 'updatePassageText', passageId: snapshot.passageId, proposedText,
			rationale: operation.rationale as string
		},
		warnings: value.warnings as string[],
		destination: {id: destination.id, name: destination.name}
	};
}

/** A branch proposal appends one local link; the store creates its empty destination. */
export function parseNewBranchProposal(
	raw: string,
	snapshot: PassageEditSnapshot,
	story: Story
): PassageEditProposal {
	if (raw.length > 131072) throw new Error('The proposal is too large to review safely.');
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		throw new Error('The assistant did not return a valid edit proposal.');
	}
	if (!isRecord(value) ||
		!hasOnlyKeys(value, ['schemaVersion', 'summary', 'operation', 'warnings']) ||
		value.schemaVersion !== 1 || !hasBoundedText(value.summary, 500) ||
		!Array.isArray(value.warnings) || value.warnings.length > 10 ||
		!value.warnings.every(warning => hasBoundedText(warning, 500)) ||
		!isRecord(value.operation) ||
		!hasOnlyKeys(value.operation, ['type', 'passageId', 'name', 'label', 'rationale']) ||
		value.operation.type !== 'appendNewBranch' ||
		value.operation.passageId !== snapshot.passageId ||
		!hasBoundedText(value.operation.name, 120) ||
		!hasBoundedText(value.operation.label, 120) ||
		!hasBoundedText(value.operation.rationale, 1000) ||
		story.id !== snapshot.storyId ||
		story.storyFormat !== snapshot.storyFormat ||
		story.storyFormatVersion !== snapshot.storyFormatVersion) {
		throw new Error('The assistant returned an unsupported edit proposal.');
	}
	const operation = value.operation;
	const name = (operation.name as string).trim();
	if (story.passages.some(passage => passage.name === name) || parseLinks(snapshot.text).includes(name)) {
		throw new Error('The proposed branch passage name is already in use.');
	}
	if (twineMetadataNames.has(name) ||
		(snapshot.storyFormat === 'SugarCube' && sugarCubeSpecialNames.has(name))) {
		throw new Error('The proposed branch passage name is reserved.');
	}
	const source = choiceSource(
		snapshot.storyFormat, snapshot.storyFormatVersion,
		operation.label as string, name
	);
	const proposedText = snapshot.text + (snapshot.text && !snapshot.text.endsWith('\n') ? '\n' : '') + source;
	if (proposedText.length > 65536) throw new Error('The proposal is too large to review safely.');
	return {
		schemaVersion: 1,
		summary: value.summary as string,
		operation: {
			type: 'updatePassageText', passageId: snapshot.passageId, proposedText,
			rationale: operation.rationale as string
		},
		warnings: value.warnings as string[],
		newPassage: {name}
	};
}

/** A two-way fork is generated locally from two bounded model-selected labels. */
export function parseTwoWayBranchProposal(
	raw: string,
	snapshot: PassageEditSnapshot,
	story: Story
): PassageEditProposal {
	if (raw.length > 131072) throw new Error('The proposal is too large to review safely.');
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		throw new Error('The assistant did not return a valid edit proposal.');
	}
	if (!isRecord(value) ||
		!hasOnlyKeys(value, ['schemaVersion', 'summary', 'operation', 'warnings']) ||
		value.schemaVersion !== 1 || !hasBoundedText(value.summary, 500) ||
		!Array.isArray(value.warnings) || value.warnings.length > 10 ||
		!value.warnings.every(warning => hasBoundedText(warning, 500)) ||
		!isRecord(value.operation) ||
		!hasOnlyKeys(value.operation, ['type', 'passageId', 'choices', 'rationale']) ||
		value.operation.type !== 'appendTwoWayBranch' ||
		value.operation.passageId !== snapshot.passageId ||
		!hasBoundedText(value.operation.rationale, 1000) ||
		!Array.isArray(value.operation.choices) ||
		value.operation.choices.length !== 2 ||
		!value.operation.choices.every(choice =>
			isRecord(choice) && hasOnlyKeys(choice, ['name', 'label']) &&
			hasBoundedText(choice.name, 120) && hasBoundedText(choice.label, 120)
		) ||
		story.id !== snapshot.storyId ||
		story.storyFormat !== snapshot.storyFormat ||
		story.storyFormatVersion !== snapshot.storyFormatVersion) {
		throw new Error('The assistant returned an unsupported edit proposal.');
	}
	const choices = (value.operation.choices as Array<{name: string; label: string}>)
		.map(choice => ({name: choice.name.trim(), label: choice.label.trim()}));
	if (choices[0].name === choices[1].name || choices[0].label === choices[1].label) {
		throw new Error('The two branch choices must be distinct.');
	}
	for (const choice of choices) {
		if (story.passages.some(passage => passage.name === choice.name) ||
			parseLinks(snapshot.text).includes(choice.name)) {
			throw new Error('A proposed branch passage name is already in use.');
		}
		if (twineMetadataNames.has(choice.name) ||
			(snapshot.storyFormat === 'SugarCube' && sugarCubeSpecialNames.has(choice.name))) {
			throw new Error('A proposed branch passage name is reserved.');
		}
	}
	const source = choiceSetSource(snapshot.storyFormat, snapshot.storyFormatVersion,
		choices.map(choice => ({label: choice.label, destination: choice.name})));
	const proposedText = snapshot.text +
		(snapshot.text && !snapshot.text.endsWith('\n') ? '\n' : '') + source;
	if (proposedText.length > 65536) throw new Error('The proposal is too large to review safely.');
	return {
		schemaVersion: 1,
		summary: value.summary as string,
		operation: {
			type: 'updatePassageText', passageId: snapshot.passageId, proposedText,
			rationale: value.operation.rationale as string
		},
		warnings: value.warnings as string[],
		newPassages: choices
	};
}

/** Keep the preview and accepted source identical when the author omits a route. */
export function selectTwoWayBranchChoices(
	proposal: PassageEditProposal,
	snapshot: PassageEditSnapshot,
	selectedNames: string[]
): PassageEditProposal | undefined {
	if (!proposal.newPassages) return proposal;
	if (selectedNames.length < 1 || selectedNames.length > proposal.newPassages.length ||
		new Set(selectedNames).size !== selectedNames.length) return undefined;
	const choices = proposal.newPassages.filter(({name}) => selectedNames.includes(name));
	if (choices.length !== selectedNames.length) return undefined;
	const source = choiceSetSource(snapshot.storyFormat, snapshot.storyFormatVersion,
		choices.map(({name, label}) => ({label, destination: name})));
	return {
		...proposal,
		operation: {
			...proposal.operation,
			proposedText: snapshot.text +
				(snapshot.text && !snapshot.text.endsWith('\n') ? '\n' : '') + source
		},
		newPassages: choices
	};
}

/** An accepted edit must still target the same passage and exact source revision. */
export function canApplyPassageEdit(
	snapshot: PassageEditSnapshot,
	story: Story,
	passage: Passage,
	proposal?: PassageEditProposal
) {
	return (
		story.id === snapshot.storyId &&
		passage.story === snapshot.storyId &&
		passage.id === snapshot.passageId &&
		story.storyFormat === snapshot.storyFormat &&
		story.storyFormatVersion === snapshot.storyFormatVersion &&
		passage.text === snapshot.text &&
		(!snapshot.knowledge || JSON.stringify(aiKnowledgeForPassage(story, passage)) ===
			JSON.stringify(snapshot.knowledge)) &&
		(!proposal?.newPassage && !proposal?.newPassages ||
			story.passages === snapshot.storyPassages) &&
		(!proposal?.destination || story.passages.some(candidate =>
			candidate.id === proposal.destination?.id && candidate.name === proposal.destination.name
		)) &&
		[...(proposal?.newPassage ? [proposal.newPassage] : []),
			...(proposal?.newPassages ?? [])].every(newPassage =>
			!story.passages.some(candidate => candidate.name === newPassage.name) &&
			!parseLinks(snapshot.text).includes(newPassage.name))
	);
}
