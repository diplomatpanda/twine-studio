import {TwineElectronWindow} from '../../../../electron/shared';
import {Story} from '../../../stories/stories.types';
import {importStories} from '../../../../util/import';
import {parseStoryKnowledge} from '../../../stories/story-knowledge';

export async function load(): Promise<Story[]> {
	const {twineElectron} = window as TwineElectronWindow;

	if (!twineElectron) {
		throw new Error('Electron bridge is not present on window.');
	}

	const stories = await twineElectron.loadStories();

	if (stories && Array.isArray(stories)) {
		return stories.reduce((result, file) => {
			const story = importStories(file.htmlSource, file.mtime);

			if (story[0]) {
				if (file.knowledge && file.knowledge.ifid !== story[0].ifid) {
					throw new Error(`Story knowledge does not match the IFID of ${story[0].name}. The sidecar was left unchanged.`);
				}
				return [...result, {
					...story[0],
					knowledge: parseStoryKnowledge(file.knowledge?.entries ?? [])
				}];
			}

			console.warn('Could not hydrate story: ', file.htmlSource);
			return result;
		}, [] as Story[]);
	} else {
		console.warn('No stories to hydrate in Electron bridge');
	}

	return [];
}
