import {v4 as uuid} from '@lukeed/uuid';
import {Passage, Story, UpdateStoryAction} from '../store/stories/stories.types';
import {passageDefaults} from '../store/stories/defaults';
import {rectsIntersect} from '../util/geometry';
import {PassageEditProposal} from './passage-edit-proposal';

/** One story action keeps the new link and its destination in one save transaction. */
export function newBranchAction(
	story: Story,
	source: Passage,
	proposal: PassageEditProposal
): UpdateStoryAction {
	const newPassages = proposal.newPassages ??
		(proposal.newPassage ? [proposal.newPassage] : []);
	if (newPassages.length < 1 || newPassages.length > 2 ||
		new Set(newPassages.map(passage => passage.name)).size !== newPassages.length ||
		proposal.operation.passageId !== source.id ||
		source.story !== story.id ||
		!story.passages.some(passage => passage.id === source.id) ||
		newPassages.some(newPassage => story.passages.some(passage =>
			passage.name === newPassage.name))) {
		throw new Error('The proposed branch is no longer available.');
	}
	const defaults = passageDefaults();
	const gap = 25;
	const top = source.top + source.height + gap;
	const destinations: Passage[] = [];
	for (const newPassage of newPassages) {
		let left = source.left + (source.width - defaults.width) / 2;
		let clear = false;
		for (let attempt = 0; attempt <= story.passages.length + destinations.length; attempt++) {
			const blockedBy = [...story.passages, ...destinations].find(passage =>
				rectsIntersect(passage, {
					left, top, width: defaults.width, height: defaults.height
				}));
			if (!blockedBy) {
				clear = true;
				break;
			}
			left = blockedBy.left + blockedBy.width + gap;
		}
		if (!clear) throw new Error('Could not place the proposed branch on the map.');
		destinations.push({
			...defaults,
			id: uuid(),
			story: story.id,
			name: newPassage.name,
			left,
			top
		});
	}
	return {
		type: 'updateStory',
		storyId: story.id,
		props: {
			passages: [
				...story.passages.map(passage => passage.id === source.id
					? {...passage, text: proposal.operation.proposedText}
					: passage),
				...destinations
			]
		}
	};
}
