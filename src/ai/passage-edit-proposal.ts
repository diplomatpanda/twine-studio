import {parseLinks} from '../util/parse-links';
import {conditionalChoiceSource, FactComparison, StoryFactValue} from '../util/story-fact-source';
import {Passage, Story} from '../store/stories/stories.types';

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
}

export interface PassageEditSnapshot {
	storyId: string;
	passageId: string;
	storyFormat: string;
	storyFormatVersion: string;
	text: string;
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
		(!proposal?.destination || story.passages.some(candidate =>
			candidate.id === proposal.destination?.id && candidate.name === proposal.destination.name
		))
	);
}
