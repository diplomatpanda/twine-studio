import {choiceSource, supportsChoiceBuilder} from '../choice-source';
import {parseLinks} from '../parse-links';

describe('choiceSource', () => {
	it.each([
		['Harlowe', '3.3.9'],
		['SugarCube', '2.37.3']
	])('creates a native link for %s', (name, version) => {
		const source = choiceSource(
			name,
			version,
			' Follow the signal ',
			' Radio room '
		);
		expect(source).toBe(
			name === 'Harlowe'
				? '[[Follow the signal->Radio room]]'
				: '[[Follow the signal|Radio room]]'
		);
		expect(parseLinks(source)).toEqual(['Radio room']);
	});
	it.each([
		'',
		'  ',
		'Door]]',
		'A|B',
		'$variable',
		'<script>',
		'(print: 1)',
		'A\nB',
		'A->B'
	])('rejects unsafe input %s', value => {
		expect(() => choiceSource('Harlowe', '3.3.9', value, 'Room')).toThrow();
		expect(() => choiceSource('Harlowe', '3.3.9', 'Go', value)).toThrow();
	});
	it.each([
		['Harlowe', '2.1.0'],
		['SugarCube', '1.0.35'],
		['Custom', '1.0.0'],
		['Harlowe', 'not-a-version']
	])('does not guess syntax for %s %s', (name, version) => {
		expect(supportsChoiceBuilder(name, version)).toBe(false);
		expect(() => choiceSource(name, version, 'Go', 'Room')).toThrow();
	});
	it('preserves international names', () => {
		expect(choiceSource('Harlowe', '3.3.9', 'Aller à la forêt', '森')).toBe(
			'[[Aller à la forêt->森]]'
		);
	});
});
