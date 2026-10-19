import Fuse from 'fuse.js';
import uniq from 'lodash/uniq';
import {Passage, StorySearchFlags, Story} from './stories.types';
import {createRegExp} from '../../util/regexp';
import {parseLinks} from '../../util/parse-links';
import {passageReferenceNames} from '../../util/passage-references';
import {StoryKnowledgeEntry} from './story-knowledge';

export function passageWithId(
	stories: Story[],
	storyId: string,
	passageId: string
) {
	const story = storyWithId(stories, storyId);
	const result = story.passages.find(p => p.id === passageId);

	if (result) {
		return result;
	}

	throw new Error(
		`There is no passage with ID "${passageId}" in a story with ID "${storyId}".`
	);
}

export function passageWithName(
	stories: Story[],
	storyId: string,
	passageName: string
) {
	const story = storyWithId(stories, storyId);
	const result = story.passages.find(p => p.name === passageName);

	if (result) {
		return result;
	}

	throw new Error(
		`There is no passage with name "${passageName}" in a story with ID "${storyId}".`
	);
}

/**
 * Returns connections between passages in a structure optimized for rendering.
 * Connections are divided between draggable and fixed, depending on whether
 * either of their passages are selected (and could be dragged by the user).
 */
export function passageConnections(
	passages: Passage[],
	connectionParser?: (text: string) => string[],
	knownPassageNames?: Set<string>
) {
	const parser = connectionParser ?? ((text: string) => parseLinks(text, true));
	const passageMap = new Map(passages.map(p => [p.name, p]));
	const result = {
		draggable: {
			broken: new Set<Passage>(),
			connections: new Map<Passage, Set<Passage>>(),
			self: new Set<Passage>()
		},
		fixed: {
			broken: new Set<Passage>(),
			connections: new Map<Passage, Set<Passage>>(),
			self: new Set<Passage>()
		}
	};

	passages.forEach(passage =>
		parser(passage.text).forEach(targetName => {
			if (targetName === passage.name) {
				(passage.selected ? result.draggable : result.fixed).self.add(passage);
			} else {
				const targetPassage = passageMap.get(targetName);

				if (targetPassage) {
					const target =
						passage.selected || targetPassage.selected
							? result.draggable
							: result.fixed;

					if (target.connections.has(passage)) {
						target.connections.get(passage)!.add(targetPassage);
					} else {
						target.connections.set(passage, new Set([targetPassage]));
					}
				} else if (!knownPassageNames?.has(targetName)) {
					(passage.selected ? result.draggable : result.fixed).broken.add(
						passage
					);
				}
			}
		})
	);

	return result;
}

/** Passages with no path from Start through ordinary [[...]] links. */
export function passagesWithoutStandardLinkPath(story: Story): Passage[] {
	return passagesWithoutReferencePath(story);
}

/** Passages with no known static path from the start passage. */
export function passagesWithoutReferencePath(
	story: Story,
	formatReferences?: (text: string) => string[]
): Passage[] {
	const start = story.passages.find(passage => passage.id === story.startPassage);
	if (!start) return [];

	const byName = new Map(story.passages.map(passage => [passage.name, passage]));
	const visited = new Set([start.id]);
	const pending = [start];
	for (let index = 0; index < pending.length; index++) {
		for (const name of passageReferenceNames(pending[index].text, formatReferences)) {
			const target = byName.get(name);
			if (target && !visited.has(target.id)) {
				visited.add(target.id);
				pending.push(target);
			}
		}
	}
	return story.passages.filter(passage => !visited.has(passage.id));
}

/** Passages that lead to, or can be reached from, one passage through static links. */
export function passagesInFocusedBranch(
	story: Story,
	anchorId: string,
	formatReferences?: (text: string) => string[]
): Passage[] {
	const anchor = story.passages.find(passage => passage.id === anchorId);
	if (!anchor) return [];

	const byName = new Map(story.passages.map(passage => [passage.name, passage]));
	const outgoing = new Map<string, string[]>();
	const incoming = new Map<string, string[]>();
	for (const source of story.passages) {
		let names: string[];
		try {
			names = passageReferenceNames(source.text, formatReferences);
		} catch {
			// A faulty format extension cannot hide ordinary Twine connections.
			names = passageReferenceNames(source.text);
		}
		for (const name of names) {
			const target = byName.get(name);
			if (!target) continue;
			outgoing.set(source.id, [...(outgoing.get(source.id) ?? []), target.id]);
			incoming.set(target.id, [...(incoming.get(target.id) ?? []), source.id]);
		}
	}

	const visible = new Set([anchorId]);
	for (const edges of [incoming, outgoing]) {
		const visited = new Set([anchorId]);
		const pending = [anchorId];
		for (let index = 0; index < pending.length; index++) {
			for (const id of edges.get(pending[index]) ?? []) {
				if (!visited.has(id)) {
					visited.add(id);
					visible.add(id);
					pending.push(id);
				}
			}
		}
	}
	return story.passages.filter(passage => visible.has(passage.id));
}

/**
 * Returns a set of passages matching a fuzzy search crtieria.
 */
export function passagesMatchingFuzzySearch(
	passages: Passage[],
	search: string,
	count = 5
) {
	if (search.trim() === '') {
		return [...passages].sort(
			(left, right) =>
				left.name.localeCompare(right.name, undefined, {
					numeric: true,
					sensitivity: 'base'
				}) || left.id.localeCompare(right.id)
		);
	}

	const fuse = new Fuse(passages, {
		ignoreLocation: true,
		keys: [
			{name: 'name', weight: 0.6},
			{name: 'text', weight: 0.25},
			{name: 'tags', weight: 0.15}
		]
	});

	return fuse.search(search, {limit: count}).map(({item}) => item);
}

/** Find passage-scoped knowledge alongside passage names, text, and tags. */
export function passagesMatchingFuzzySearchWithKnowledge(
	passages: Passage[],
	knowledge: StoryKnowledgeEntry[],
	search: string,
	count = 5
): Array<{passage: Passage; knowledge?: StoryKnowledgeEntry}> {
	if (!search.trim()) {
		return passagesMatchingFuzzySearch(passages, search).map(passage => ({passage}));
	}

	const notesByPassage = new Map<string, StoryKnowledgeEntry[]>();
	for (const entry of knowledge) {
		if (entry.scope !== 'passage' || !entry.passageName) continue;
		const notes = notesByPassage.get(entry.passageName) ?? [];
		notes.push(entry);
		notesByPassage.set(entry.passageName, notes);
	}
	const records = passages.map(passage => ({
		passage,
		notes: notesByPassage.get(passage.name) ?? []
	}));
	const fuse = new Fuse(records, {
		ignoreLocation: true,
		includeMatches: true,
		includeScore: true,
		keys: [
			{name: 'passage.name', weight: 0.55},
			{name: 'passage.text', weight: 0.22},
			{name: 'passage.tags', weight: 0.13},
			{name: 'notes.title', weight: 0.06},
			{name: 'notes.note', weight: 0.04}
		]
	});

	const found = fuse.search(search);
	const hasNoteMatch = found.some(({matches}) => matches?.some(match =>
		match.key === 'notes.title' || match.key === 'notes.note'
	));
	return found.filter(({score, matches}) =>
		!hasNoteMatch || (score ?? 1) < 0.6 || matches?.some(match =>
			match.key === 'notes.title' || match.key === 'notes.note'
		)
	).slice(0, count).map(({item, matches}) => {
		const noteMatch = matches?.find(match =>
			(match.key === 'notes.title' || match.key === 'notes.note') &&
			match.refIndex !== undefined
		);
		return {
			passage: item.passage,
			...(noteMatch ? {knowledge: item.notes[noteMatch.refIndex!]} : {})
		};
	});
}

/**
 * Returns all passages matching a search criteria. Use
 * `highlightPassageMatches()` to highlight exactly what matched.
 */
export function passagesMatchingSearch(
	passages: Passage[],
	search: string,
	flags: StorySearchFlags
): Passage[] {
	if (search === '') {
		return [];
	}

	const {includePassageNames, matchCase, useRegexes} = flags;
	let matcher: RegExp;

	try {
		matcher = createRegExp(search, {matchCase, useRegexes});
	} catch (error) {
		// The regexp was malformed. Take no action.
		return [];
	}

	return passages.reduce((result, passage) => {
		if (
			matcher.test(passage.text) ||
			(includePassageNames && matcher.test(passage.name))
		) {
			return [...result, passage];
		}

		return result;
	}, [] as Passage[]);
}

export function storyPassageTags(story: Story) {
	return Array.from(
		story.passages.reduce((result, passage) => {
			passage.tags && passage.tags.forEach(tag => result.add(tag));
			return result;
		}, new Set<string>())
	).sort();
}

/** Static internal links whose named destination has not been created. */
export function brokenStoryLinks(story: Story, formatReferences?: (text: string) => string[]) {
	const names = new Set(story.passages.map(passage => passage.name));
	return story.passages.flatMap(source =>
		passageReferenceNames(source.text, formatReferences)
			.filter(target => !names.has(target))
			.map(target => ({sourceId: source.id, sourceName: source.name, target}))
	);
}

export function storyStats(story: Story) {
	const links = story.passages.reduce<string[]>(
		(links, passage) => [
			...links,
			...parseLinks(passage.text).filter(link => links.indexOf(link) === -1)
		],
		[]
	);

	const brokenLinks = uniq(links).filter(
		link => !story.passages.some(passage => passage.name === link)
	);

	return {
		brokenLinks,
		links,
		characters: story.passages.reduce(
			(count, passage) => count + passage.text.length,
			0
		),
		passages: story.passages.length,
		words: story.passages.reduce(
			(count, passage) => count + passage.text.split(/\s+/).length,
			0
		)
	};
}

export function storyTags(stories: Story[]) {
	return Array.from(
		stories.reduce((result, story) => {
			story.tags && story.tags.forEach(tag => result.add(tag));
			return result;
		}, new Set<string>())
	).sort();
}

export function storyWithId(stories: Story[], storyId: string) {
	const result = stories.find(s => s.id === storyId);

	if (result) {
		return result;
	}

	throw new Error(`There is no story with ID "${storyId}".`);
}

export function storyWithName(stories: Story[], name: string) {
	const result = stories.find(s => s.name === name);

	if (result) {
		return result;
	}

	throw new Error(`There is no story with name "${name}".`);
}
