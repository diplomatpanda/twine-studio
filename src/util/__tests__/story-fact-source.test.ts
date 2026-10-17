import {
	assignFactSource,
	conditionalChoiceSource,
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
