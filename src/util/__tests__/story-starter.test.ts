import {readFileSync} from 'fs';
import {join} from 'path';
import {parseLinks} from '../parse-links';
import {buildStoryStarter, storyStarterPatterns} from '../story-starter';

const messages = JSON.parse(readFileSync(
	join(__dirname, '../../../public/locales/en-US.json'), 'utf8'
));
const t = (key: string): string => key.split('.').reduce(
	(value, part) => value?.[part], messages
) as string;

describe('story starter', () => {
	it.each([
		['Harlowe', '3.3.9', '->'],
		['SugarCube', '2.37.3', '|']
	])('creates reachable choices and two endings for %s', (format, version, separator) => {
		for (const pattern of storyStarterPatterns) {
			const starter = buildStoryStarter('The radio hears tomorrow.', pattern, format, version, t);
			const {passages} = starter;
			const names = passages.map(passage => passage.name);
			expect(passages).toHaveLength(6);
			expect(new Set(names).size).toBe(6);
			expect(new Set(passages.map(passage => passage.id)).size).toBe(6);
			expect(starter.startPassage).toBe(passages[0].id);
			expect(passages[0].text).toContain('The radio hears tomorrow.');
			expect(passages[0].text).toContain(separator);
			expect(parseLinks(passages[0].text)).toEqual([names[1], names[2]]);
			expect(parseLinks(passages[1].text)).toEqual([names[3]]);
			expect(parseLinks(passages[2].text)).toEqual([names[3]]);
			expect(parseLinks(passages[3].text)).toEqual([names[4], names[5]]);
			expect(parseLinks(passages[4].text)).toEqual([]);
			expect(parseLinks(passages[5].text)).toEqual([]);
			expect(starter.knowledge[0]).toMatchObject({
			kind: 'plot-thread', status: 'planned', note: 'The radio hears tomorrow.', scope: 'story'
			});
		}
	});

	it('rejects unsupported formats and empty premises', () => {
		expect(() => buildStoryStarter('', 'branch', 'Harlowe', '3.3.9', t)).toThrow();
		expect(() => buildStoryStarter('An idea', 'branch', 'Chapbook', '2.0.0', t)).toThrow();
		expect(() => buildStoryStarter('[[Run->End]]', 'branch', 'Harlowe', '3.3.9', t)).toThrow();
		expect(() => buildStoryStarter('(set: $clue to true)', 'branch', 'Harlowe', '3.3.9', t)).toThrow();
	});
});
