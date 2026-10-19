import {randomUUID} from 'crypto';
import {readFile, rename, stat, writeFile, unlink} from 'fs/promises';
import {shell} from 'electron';
import path from 'path';
import {Story} from '../../store/stories/stories.types';
import {parseStoryKnowledge, StoryKnowledgeEntry} from '../../store/stories/story-knowledge';
import {storyFileName} from '../shared/story-filename';
import {getStoryDirectoryPath} from './story-directory';

const SUFFIX = '.studio-knowledge.json';
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface StoryKnowledgeSidecar {
	version: 1;
	ifid: string;
	entries: StoryKnowledgeEntry[];
}

function sidecarPath(htmlName: string) {
	return path.join(getStoryDirectoryPath(), `${htmlName}${SUFFIX}`);
}

function isMissing(error: unknown) {
	return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

export async function loadStoryKnowledge(htmlName: string): Promise<StoryKnowledgeSidecar | undefined> {
	const filename = sidecarPath(htmlName);
	let raw: string;
	try {
		if ((await stat(filename)).size > MAX_FILE_BYTES) throw new Error('too large');
		raw = await readFile(filename, 'utf8');
	} catch (error) {
		if (isMissing(error)) return undefined;
		throw new Error(`Could not read story knowledge for ${htmlName}. The sidecar was left unchanged.`);
	}
	try {
		const value = JSON.parse(raw) as Record<string, unknown>;
		if (!value || value.version !== 1 || typeof value.ifid !== 'string' ||
			!value.ifid || value.ifid.length > 128) throw new Error();
		return {version: 1, ifid: value.ifid, entries: parseStoryKnowledge(value.entries)};
	} catch {
		throw new Error(`Story knowledge for ${htmlName} is invalid. The sidecar was left unchanged.`);
	}
}

export async function saveStoryKnowledge(story: Story) {
	const entries = parseStoryKnowledge(story.knowledge ?? []);
	if (!story.ifid || story.ifid.length > 128) throw new Error('Invalid story IFID for knowledge.');
	const filename = storyFileName(story);
	const destination = sidecarPath(filename);
	const existing = await loadStoryKnowledge(filename);
	if (existing && existing.ifid !== story.ifid) {
		throw new Error(`Story knowledge for ${filename} belongs to another story. The sidecar was left unchanged.`);
	}
	if (!entries.length && !existing) return;
	if (existing && JSON.stringify(existing.entries) === JSON.stringify(entries)) return;
	const temporary = `${destination}.${randomUUID()}.tmp`;
	const contents = JSON.stringify({version: 1, ifid: story.ifid, entries});
	try {
		await writeFile(temporary, contents, {encoding: 'utf8', flag: 'wx'});
		await rename(temporary, destination);
	} catch (error) {
		await unlink(temporary).catch(() => undefined);
		throw error;
	}
}

export async function renameStoryKnowledge(oldStory: Story, newStory: Story) {
	const source = sidecarPath(storyFileName(oldStory));
	const destination = sidecarPath(storyFileName(newStory));
	try {
		await rename(source, destination);
	} catch (error) {
		if (!isMissing(error)) throw error;
		// A retry may follow a successful rename but failed tracking refresh.
		try { await stat(destination); }
		catch (destinationError) {
			if (!isMissing(destinationError)) throw destinationError;
		}
	}
}

export async function trashStoryKnowledge(story: Story) {
	const filename = sidecarPath(storyFileName(story));
	try { await stat(filename); }
	catch (error) {
		if (isMissing(error)) return;
		throw error;
	}
	await shell.trashItem(filename);
}
