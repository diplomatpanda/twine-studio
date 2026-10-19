import {choiceSource, isPlainChoiceText, supportsChoiceBuilder} from './choice-source';

export type StoryFactValue = boolean | number;
export type FactComparison = 'eq' | 'gte' | 'lte';

const factNamePattern = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

function validateFactName(name: string) {
	if (!factNamePattern.test(name)) {
		throw new Error(
			'Fact names must start with a letter and contain only letters, numbers, and underscores.'
		);
	}
}

function validateFactValue(value: StoryFactValue) {
	if (typeof value !== 'boolean' && typeof value !== 'number') {
		throw new Error('Facts must use a yes/no value or a number.');
	}
	if (
		typeof value === 'number' &&
		(!Number.isFinite(value) || Math.abs(value) > 1_000_000_000)
	) {
		throw new Error(
			'Fact numbers must be finite and between -1000000000 and 1000000000.'
		);
	}
}

function validateFormat(formatName: string, formatVersion: string) {
	if (!supportsChoiceBuilder(formatName, formatVersion)) {
		throw new Error(
			'This story format is not supported by the story fact builder.'
		);
	}
}

function sourceValue(value: StoryFactValue) {
	validateFactValue(value);
	const text = String(value);
	// JavaScript stringifies tiny numbers in exponent notation. Emit plain
	// decimal literals so the format parser does not need exponent support.
	const [mantissa, exponent] = text.split('e-');
	if (!exponent) return text;
	return `${Number(value) < 0 ? '-' : ''}0.${'0'.repeat(Number(exponent) - 1)}${mantissa.replace('-', '').replace('.', '')}`;
}

export function assignFactSource(
	formatName: string,
	formatVersion: string,
	name: string,
	value: StoryFactValue
): string {
	validateFormat(formatName, formatVersion);
	validateFactName(name);
	const serializedValue = sourceValue(value);

	return formatName === 'Harlowe'
		? `(set: $${name} to ${serializedValue})`
		: `<<set $${name} = ${serializedValue}>>`;
}

/** Change an initialized numeric fact by a signed amount. */
export function changeFactSource(
	formatName: string,
	formatVersion: string,
	name: string,
	amount: number
): string {
	validateFormat(formatName, formatVersion);
	validateFactName(name);
	validateFactValue(amount);
	if (amount === 0) throw new Error('The amount must be nonzero.');
	const magnitude = sourceValue(Math.abs(amount));
	const operator = amount > 0 ? '+' : '-';
	return formatName === 'Harlowe'
		? `(set: $${name} to it ${operator} ${magnitude})`
		: `<<set $${name} ${operator}= ${magnitude}>>`;
}

export function conditionalChoiceSource(
	formatName: string,
	formatVersion: string,
	name: string,
	operator: FactComparison,
	value: StoryFactValue,
	label: string,
	destination: string
): string {
	validateFormat(formatName, formatVersion);
	validateFactName(name);
	if (!['eq', 'gte', 'lte'].includes(operator)) {
		throw new Error('Unknown comparison.');
	}
	if (operator !== 'eq' && typeof value !== 'number') {
		throw new Error('Greater-than and less-than comparisons require a number.');
	}
	const serializedValue = sourceValue(value);
	const link = choiceSource(formatName, formatVersion, label, destination);

	if (formatName === 'Harlowe') {
		const comparison =
			operator === 'eq' ? 'is' : operator === 'gte' ? '>=' : '<=';
		return `(if: $${name} ${comparison} ${serializedValue})[${link}]`;
	}

	const comparison =
		operator === 'eq' ? '===' : operator === 'gte' ? '>=' : '<=';
	return `<<if $${name} ${comparison} ${serializedValue}>>${link}<</if>>`;
}

/** Show a short, plain-text line only when a fact meets the condition. */
export function conditionalTextSource(
	formatName: string,
	formatVersion: string,
	name: string,
	operator: FactComparison,
	value: StoryFactValue,
	text: string
): string {
	validateFormat(formatName, formatVersion);
	validateFactName(name);
	if (!['eq', 'gte', 'lte'].includes(operator) ||
		(operator !== 'eq' && typeof value !== 'number')) {
		throw new Error('Invalid text condition.');
	}
	if (text.length > 500 || !isPlainChoiceText(text)) {
		throw new Error('Conditional text must be short plain text.');
	}
	const serializedValue = sourceValue(value);
	if (formatName === 'Harlowe') {
		const comparison = operator === 'eq' ? 'is' : operator === 'gte' ? '>=' : '<=';
		return `(if: $${name} ${comparison} ${serializedValue})[${text.trim()}]`;
	}
	const comparison = operator === 'eq' ? '===' : operator === 'gte' ? '>=' : '<=';
	return `<<if $${name} ${comparison} ${serializedValue}>>${text.trim()}<</if>>`;
}
