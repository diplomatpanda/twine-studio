import {satisfies} from 'semver';

/** Only format families and major versions exercised by Studio's runtime tests. */
export function supportsChoiceBuilder(name: string, version: string): boolean {
	return (
		(name === 'Harlowe' && satisfies(version, '>=3.0.0 <4.0.0')) ||
		(name === 'SugarCube' && satisfies(version, '>=2.0.0 <3.0.0'))
	);
}

// The plain-language helper must not turn labels into macros or link delimiters.
// More elaborate names remain available through the ordinary source editor.
export function isPlainChoiceText(value: string): boolean {
	return (
		value.trim().length > 0 && /^[\p{L}\p{M}\p{N} .,!?'’"“”—–-]+$/u.test(value)
	);
}

export function choiceSource(
	formatName: string,
	formatVersion: string,
	label: string,
	destination: string
): string {
	if (!supportsChoiceBuilder(formatName, formatVersion)) {
		throw new Error(
			'This story format is not supported by the choice builder.'
		);
	}
	if (!isPlainChoiceText(label) || !isPlainChoiceText(destination)) {
		throw new Error('Use plain text for the choice and destination.');
	}
	const separator = formatName === 'Harlowe' ? '->' : '|';
	return `[[${label.trim()}${separator}${destination.trim()}]]`;
}

/** Generate a single passage update for a reviewed set of choices. */
export function choiceSetSource(
	formatName: string,
	formatVersion: string,
	choices: Array<{label: string; destination: string}>
): string {
	if (choices.length === 0) {
		throw new Error('Add at least one choice.');
	}
	return choices
		.map(({label, destination}) =>
			choiceSource(formatName, formatVersion, label, destination)
		)
		.join('\n');
}
