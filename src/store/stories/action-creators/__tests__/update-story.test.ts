import {updateStory} from '../update-story';
import {Story} from '../../stories.types';
import {fakeStory} from '../../../../test-util';

describe('updateStory action creator', () => {
	let state: Story[];
	let story: Story;

	beforeEach(() => {
		state = [fakeStory(), fakeStory()];
		story = fakeStory();
	});

	it('returns an updateStory action', () => {
		expect(updateStory(state, story, {zoom: 2})).toEqual({
			type: 'updateStory',
			props: {zoom: 2},
			storyId: story.id
		});
	});

	it('throws an error if the change would cause a name conflict with another story', () => {
		expect(() => updateStory(state, story, {name: state[0].name})).toThrow();
		expect(() => updateStory(state, story, {name: story.name})).not.toThrow();
	});

	it('rejects different names that map to the same filename', () => {
		state[0].name = 'Radio: Tomorrow';
		expect(() => updateStory(state, story, {name: 'Radio? Tomorrow'})).toThrow();
	});
});
