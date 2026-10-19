import {fireEvent, render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import * as React from 'react';
import {FakeStateProvider, fakeStory} from '../../../test-util';
import {StoryKnowledgeDialog} from '../story-knowledge';

describe('<StoryKnowledgeDialog>', () => {
	function renderDialog() {
		const story = fakeStory();
		const result = render(<FakeStateProvider stories={[story]}>
			<StoryKnowledgeDialog storyId={story.id} collapsed={false}
				onChangeCollapsed={jest.fn()} onChangeHighlighted={jest.fn()}
				onChangeMaximized={jest.fn()} onChangeProps={jest.fn()}
				onClose={jest.fn()} />
		</FakeStateProvider>);
		return {story, result};
	}

	it('adds, edits and removes a passage-linked note', () => {
		const {story} = renderDialog();
		fireEvent.change(screen.getByLabelText('studio.knowledge.entryTitle'), {target: {value: 'The missing key'}});
		fireEvent.change(screen.getByLabelText('studio.knowledge.note'), {target: {value: 'Only the author knows where it is.'}});
		fireEvent.change(screen.getByLabelText('studio.knowledge.scopeLabel'), {target: {value: 'passage'}});
		fireEvent.change(screen.getByLabelText('studio.knowledge.passageScope'), {target: {value: story.passages[0].name}});
		fireEvent.click(screen.getByRole('button', {name: 'studio.knowledge.addEntry'}));
		expect(screen.getByText('The missing key')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', {name: 'common.edit'}));
		fireEvent.change(screen.getByLabelText('studio.knowledge.entryTitle'), {target: {value: 'The hidden key'}});
		fireEvent.click(screen.getByRole('button', {name: 'studio.knowledge.saveEntry'}));
		expect(screen.getByText('The hidden key')).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', {name: 'common.delete'}));
		expect(screen.queryByText('The hidden key')).not.toBeInTheDocument();
	});

	it('has no basic accessibility violations', async () => {
		const {result} = renderDialog();
		expect(await axe(result.container)).toHaveNoViolations();
	});
});
