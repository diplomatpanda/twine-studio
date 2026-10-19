import {mkdtemp, readFile, rm, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import {join} from 'path';
import {fakeStory} from '../../../test-util';
import {storyFileName} from '../../shared/story-filename';
import {getStoryDirectoryPath} from '../story-directory';
import {loadStoryKnowledge, renameStoryKnowledge, saveStoryKnowledge} from '../story-knowledge-file';

jest.mock('../story-directory', () => ({getStoryDirectoryPath: jest.fn()}));

describe('story knowledge sidecar', () => {
	let directory: string;

	beforeEach(async () => {
		directory = await mkdtemp(join(tmpdir(), 'twine-knowledge-'));
		(getStoryDirectoryPath as jest.Mock).mockReturnValue(directory);
	});

	afterEach(async () => {
		await rm(directory, {recursive: true, force: true});
	});

	it('saves and restores author notes separately from story HTML', async () => {
		const story = fakeStory();
		story.knowledge = [{
			id: 'note-1', kind: 'character', status: 'established',
			title: 'Hidden motive', note: 'Private author-only fact', scope: 'story'
		}];
		await saveStoryKnowledge(story);
		const filename = storyFileName(story);
		expect(await loadStoryKnowledge(filename)).toEqual({
			version: 1, ifid: story.ifid, entries: story.knowledge
		});
		story.knowledge = [];
		await saveStoryKnowledge(story);
		expect((await loadStoryKnowledge(filename))?.entries).toEqual([]);
	});

	it('moves the sidecar with a renamed story', async () => {
		const story = fakeStory();
		story.knowledge = [{
			id: 'note-1', kind: 'location', status: 'planned',
			title: 'The keep', note: '', scope: 'story'
		}];
		await saveStoryKnowledge(story);
		const renamed = {...story, name: 'Renamed story'};
		await renameStoryKnowledge(story, renamed);
		expect(await loadStoryKnowledge(storyFileName(story))).toBeUndefined();
		expect((await loadStoryKnowledge(storyFileName(renamed)))?.entries).toEqual(story.knowledge);
	});

	it('rejects malformed sidecars without replacing them', async () => {
		const story = fakeStory();
		const filename = join(directory, `${storyFileName(story)}.studio-knowledge.json`);
		await writeFile(filename, '{bad json', 'utf8');
		await expect(loadStoryKnowledge(storyFileName(story))).rejects.toThrow('invalid');
		await expect(saveStoryKnowledge(story)).rejects.toThrow('invalid');
		expect(await readFile(filename, 'utf8')).toBe('{bad json');
	});
});
