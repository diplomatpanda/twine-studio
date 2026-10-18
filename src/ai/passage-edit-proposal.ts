import {parseLinks} from '../util/parse-links';
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

/** An accepted edit must still target the same passage and exact source revision. */
export function canApplyPassageEdit(
	snapshot: PassageEditSnapshot,
	story: Story,
	passage: Passage
) {
	return (
		story.id === snapshot.storyId &&
		passage.story === snapshot.storyId &&
		passage.id === snapshot.passageId &&
		story.storyFormat === snapshot.storyFormat &&
		story.storyFormatVersion === snapshot.storyFormatVersion &&
		passage.text === snapshot.text
	);
}
