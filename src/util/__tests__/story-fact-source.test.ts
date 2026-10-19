import {
	assignFactSource,
	changeFactSource,
	conditionalChoiceSource,
	conditionalTextSource,
	FactComparison
} from '../story-fact-source';

describe('assignFactSource', () => {
	it.each([
		['Harlowe', '3.3.9', 'hasKey', '(set: $hasKey to true)', true],
		['Harlowe', '3.3.9', 'score', '(set: $score to -1000000000)', -1000000000],
		['SugarCube', '2.37.3', 'hasKey', '<<set $hasKey = false>>', false],
		['SugarCube', '2.37.3', 'score', '<<set $score = 1000000000>>', 1000000000]
	])(
		'generates a native assignment for %s %s',
		(name, version, factName, expected, value) => {
			expect(assignFactSource(name, version, factName, value)).toBe(expected);
		}
	);

	it.each(['', '1score', 'score-name', 'score name', 'é', 'score$'])(
		'rejects unsafe fact names: %s',
		name => {
			expect(() => assignFactSource('Harlowe', '3.3.9', name, true)).toThrow();
		}
	);

	it('accepts the maximum fact name length', () => {
		expect(assignFactSource('Harlowe', '3.3.9', 'a'.repeat(40), false)).toBe(
			`(set: $${'a'.repeat(40)} to false)`
		);
	});

	it.each([NaN, Infinity, -Infinity, 1_000_000_001, -1_000_000_001])(
		'rejects invalid numeric values: %s',
		value => {
			expect(() =>
				assignFactSource('SugarCube', '2.37.3', 'score', value)
			).toThrow();
		}
	);

	it.each([
		['Harlowe', '2.1.0'],
		['SugarCube', '1.0.35'],
		['Custom', '1.0.0']
	])('rejects unsupported format/version %s %s', (name, version) => {
		expect(() => assignFactSource(name, version, 'score', 1)).toThrow();
	});
});

describe('conditionalTextSource', () => {
	it.each([
		['Harlowe', '3.3.9', '(if: $trust >= 3)[Maya trusts you.]'],
		['SugarCube', '2.37.3', '<<if $trust >= 3>>Maya trusts you.<</if>>']
	])('shows numeric conditional dialogue in %s', (format, version, expected) => {
		expect(conditionalTextSource(format, version, 'trust', 'gte', 3, 'Maya trusts you.')).toBe(expected);
	});
	it('rejects markup and mismatched condition values', () => {
		expect(() => conditionalTextSource('Harlowe', '3.3.9', 'trust', 'gte', true, 'Hello')).toThrow();
		expect(() => conditionalTextSource('Harlowe', '3.3.9', 'trust', 'eq', 3, 'Hello][(set: $trust to 9)')).toThrow();
		expect(() => conditionalTextSource('SugarCube', '2.37.3', 'trust', 'eq', 3, '<<set $trust = 9>>')).toThrow();
	});
});

describe('changeFactSource', () => {
	it.each([
		['Harlowe', '3.3.9', 2, '(set: $trust to it + 2)'],
		['Harlowe', '3.3.9', -3, '(set: $trust to it - 3)'],
		['SugarCube', '2.37.3', 2, '<<set $trust += 2>>'],
		['SugarCube', '2.37.3', -3, '<<set $trust -= 3>>']
	])('changes a numeric fact for %s %s by %s', (format, version, amount, expected) => {
		expect(changeFactSource(format as string, version as string, 'trust', amount as number)).toBe(expected);
	});
	it.each([0, NaN, Infinity, -Infinity, 1_000_000_001])(
		'rejects an invalid change amount: %s', amount => {
			expect(() => changeFactSource('Harlowe', '3.3.9', 'trust', amount)).toThrow();
		}
	);
	it('preserves fact name and format validation', () => {
		expect(() => changeFactSource('Harlowe', '3.3.9', 'trust-name', 1)).toThrow();
		expect(() => changeFactSource('Chapbook', '2.0.0', 'trust', 1)).toThrow();
	});
});

describe('conditionalChoiceSource', () => {
	it.each([
		[
			'Harlowe',
			'3.3.9',
			'hasKey',
			'eq',
			true,
			'(if: $hasKey is true)[[[Open->Vault]]]'
		],
		[
			'Harlowe',
			'3.3.9',
			'score',
			'eq',
			4,
			'(if: $score is 4)[[[Open->Vault]]]'
		],
		[
			'Harlowe',
			'3.3.9',
			'score',
			'gte',
			4,
			'(if: $score >= 4)[[[Open->Vault]]]'
		],
		[
			'Harlowe',
			'3.3.9',
			'score',
			'lte',
			4,
			'(if: $score <= 4)[[[Open->Vault]]]'
		],
		[
			'SugarCube',
			'2.37.3',
			'hasKey',
			'eq',
			true,
			'<<if $hasKey === true>>[[Open|Vault]]<</if>>'
		],
		[
			'SugarCube',
			'2.37.3',
			'score',
			'gte',
			4,
			'<<if $score >= 4>>[[Open|Vault]]<</if>>'
		],
		[
			'SugarCube',
			'2.37.3',
			'score',
			'lte',
			4,
			'<<if $score <= 4>>[[Open|Vault]]<</if>>'
		]
	])(
		'generates a conditional link for %s %s %s',
		(name, version, factName, operator, value, expected) => {
			expect(
				conditionalChoiceSource(
					name,
					version,
					factName,
					operator as FactComparison,
					value,
					'Open',
					'Vault'
				)
			).toBe(expected);
		}
	);

	it.each(['gte', 'lte'])('requires numbers for %s comparisons', operator => {
		expect(() =>
			conditionalChoiceSource(
				'Harlowe',
				'3.3.9',
				'score',
				operator as 'gte' | 'lte',
				true,
				'Open',
				'Vault'
			)
		).toThrow();
	});

	it('uses the shared link safety validation for injected labels', () => {
		expect(() =>
			conditionalChoiceSource(
				'Harlowe',
				'3.3.9',
				'hasKey',
				'eq',
				true,
				'Open]] (set: $hacked to true)',
				'Vault'
			)
		).toThrow();
	});

	it('preserves Unicode labels and destinations', () => {
		expect(
			conditionalChoiceSource(
				'SugarCube',
				'2.37.3',
				'score',
				'eq',
				1,
				'Aller à la forêt',
				'森'
			)
		).toBe('<<if $score === 1>>[[Aller à la forêt|森]]<</if>>');
	});

	it('does not initialize or reset the fact in a condition', () => {
		const source = conditionalChoiceSource(
			'Harlowe',
			'3.3.9',
			'hasKey',
			'eq',
			false,
			'Open',
			'Vault'
		);
		expect(source).not.toContain('(set:');
		expect(source).not.toContain('<<set');
	});
	it('serializes tiny numbers without exponent notation', () => {
		expect(assignFactSource('Harlowe', '3.3.9', 'small', 1.25e-7)).toBe(
			'(set: $small to 0.000000125)'
		);
		expect(assignFactSource('SugarCube', '2.37.3', 'small', -1.25e-7)).toBe(
			'<<set $small = -0.000000125>>'
		);
	});
});
