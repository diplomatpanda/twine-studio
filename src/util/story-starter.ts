import {v4 as uuid} from '@lukeed/uuid';
import {passageDefaults} from '../store/stories/defaults';
import {Passage, Story} from '../store/stories/stories.types';
import {choiceSetSource, supportsChoiceBuilder} from './choice-source';

export const storyStarterPatterns = ['branch', 'mystery', 'conversation'] as const;
export type StoryStarterPattern = typeof storyStarterPatterns[number];

type Translate = (key: string) => string;

/** The idea is inserted as passage prose, so reject format markup. */
export function isPlainStarterIdea(value: string) {
	return value.trim().length > 0 && value.length <= 500 &&
		/^[\p{L}\p{M}\p{N}\s.,!?;:'’"“”—–-]+$/u.test(value) &&
		!value.includes("''");
}

const positions = [
	{left: 80, top: 140},
	{left: 360, top: 0},
	{left: 360, top: 280},
	{left: 640, top: 140},
	{left: 920, top: 0},
	{left: 920, top: 280}
];

/** A small playable scaffold. Its prose is deliberately short and editable. */
export function buildStoryStarter(
	premise: string,
	pattern: StoryStarterPattern,
	formatName: string,
	formatVersion: string,
	t: Translate
): Pick<Story, 'knowledge' | 'passages' | 'startPassage'> {
	if (!isPlainStarterIdea(premise)) throw new Error('Enter a short plain-text premise.');
	const idea = premise.trim().replace(/\s+/g, ' ');
	if (!storyStarterPatterns.includes(pattern)) throw new Error('Unknown story starter.');
	if (!supportsChoiceBuilder(formatName, formatVersion)) {
		throw new Error('This story format is not supported by the starter.');
	}

	const key = `studio.starter.pattern.${pattern}`;
	const names = positions.map((_, index) => t(`${key}.passage${index}Name`));
	if (names.some(name => !name.trim()) || new Set(names).size !== names.length) {
		throw new Error('The starter needs six distinct passage names.');
	}
	const links: Record<number, Array<{label: string; destination: string}>> = {
		0: [1, 2].map(index => ({label: t(`${key}.choice0${index}`), destination: names[index]})),
		1: [{label: t(`${key}.choice13`), destination: names[3]}],
		2: [{label: t(`${key}.choice23`), destination: names[3]}],
		3: [4, 5].map(index => ({label: t(`${key}.choice3${index}`), destination: names[index]}))
	};
	const passages: Passage[] = names.map((name, index) => {
		const body = t(`${key}.passage${index}Text`);
		const choices = links[index]
			? `\n\n${choiceSetSource(formatName, formatVersion, links[index])}`
			: '';
		return {
			...passageDefaults(), ...positions[index],
			id: uuid(), story: '', name,
			width: 180, height: 120,
			text: `${index === 0 ? `${idea}\n\n` : ''}${body}${choices}`
		};
	});

	return {
		passages,
		startPassage: passages[0].id,
		knowledge: [{
			id: uuid(), kind: 'plot-thread', status: 'planned',
			title: t('studio.starter.premiseNote'), note: idea, scope: 'story'
		}]
	};
}
