export const storyKnowledgeKinds = [
	'character', 'relationship', 'location', 'world-rule', 'plot-thread',
	'player-choice', 'timeline-event', 'question', 'ending'
] as const;

export const storyKnowledgeStatuses = [
	'established', 'planned', 'inference', 'mystery', 'outdated'
] as const;

export type StoryKnowledgeKind = typeof storyKnowledgeKinds[number];
export type StoryKnowledgeStatus = typeof storyKnowledgeStatuses[number];

export interface StoryKnowledgeEntry {
	id: string;
	kind: StoryKnowledgeKind;
	status: StoryKnowledgeStatus;
	title: string;
	note: string;
	/** An empty scope is never inferred. The author chooses where the note applies. */
	scope: 'story' | 'passage' | 'branch';
	passageName?: string;
	branchName?: string;
}

const MAX_ENTRIES = 500;

export function parseStoryKnowledge(value: unknown): StoryKnowledgeEntry[] {
	if (!Array.isArray(value) || value.length > MAX_ENTRIES) {
		throw new Error('Story knowledge has an invalid entry list.');
	}
	const ids = new Set<string>();
	return value.map(raw => {
		if (!raw || typeof raw !== 'object') throw new Error('Story knowledge has an invalid entry.');
		const entry = raw as Record<string, unknown>;
		if (typeof entry.id !== 'string' || !entry.id || entry.id.length > 128 || ids.has(entry.id) ||
			!storyKnowledgeKinds.includes(entry.kind as StoryKnowledgeKind) ||
			!storyKnowledgeStatuses.includes(entry.status as StoryKnowledgeStatus) ||
			typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 160 ||
			typeof entry.note !== 'string' || entry.note.length > 2000 ||
			!['story', 'passage', 'branch'].includes(entry.scope as string) ||
			(entry.scope === 'passage' && (typeof entry.passageName !== 'string' || !entry.passageName || entry.passageName.length > 512)) ||
			(entry.scope === 'branch' && (typeof entry.branchName !== 'string' || !entry.branchName.trim() || entry.branchName.length > 160))) {
			throw new Error('Story knowledge has an invalid entry.');
		}
		ids.add(entry.id);
		return {
			id: entry.id,
			kind: entry.kind,
			status: entry.status,
			title: entry.title,
			note: entry.note,
			scope: entry.scope,
			...(entry.scope === 'passage' ? {passageName: entry.passageName} : {}),
			...(entry.scope === 'branch' ? {branchName: entry.branchName} : {})
		} as StoryKnowledgeEntry;
	});
}
