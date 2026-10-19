import {fireEvent, render, screen} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {axe} from 'jest-axe';
import * as React from 'react';
import {Router} from 'react-router-dom';
import {FakeStateProvider, fakeStory, StoryInspector} from '../../../test-util';
import {StoryStarterDialog} from '../story-starter';

describe('<StoryStarterDialog>', () => {
	function renderDialog(format = {name: 'Harlowe', version: '3.3.9'}) {
		const history = createMemoryHistory();
		const onClose = jest.fn();
		const result = render(<Router history={history}>
			<FakeStateProvider stories={[]} prefs={{storyFormat: format}}>
				<StoryStarterDialog collapsed={false} onChangeCollapsed={jest.fn()}
					onChangeHighlighted={jest.fn()} onChangeMaximized={jest.fn()}
					onChangeProps={jest.fn()} onClose={onClose} />
				<StoryInspector />
			</FakeStateProvider>
		</Router>);
		return {history, onClose, result};
	}

	it('creates a six-passage story and opens it', () => {
		const {history, onClose} = renderDialog();
		fireEvent.change(screen.getByLabelText('studio.starter.storyName'), {target: {value: 'Radio Story'}});
		fireEvent.change(screen.getByLabelText('studio.starter.premise'), {target: {value: 'A radio receives tomorrow.'}});
		fireEvent.click(screen.getByRole('button', {name: 'studio.starter.create'}));
		const story = screen.getByTestId('story-inspector-default');
		expect(story.dataset.name).toBe('Radio Story');
		expect(story.querySelectorAll('[data-name]')).toHaveLength(6);
		expect(story.dataset.startPassage).toBe(story.querySelector('[data-name]')?.getAttribute('data-id'));
		expect(history.location.pathname).toBe(`/stories/${story.dataset.id}`);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('disables unsupported format creation and has no basic accessibility violations', async () => {
		const {result} = renderDialog({name: 'Chapbook', version: '2.0.0'});
		expect(screen.getByRole('button', {name: 'studio.starter.create'})).toBeDisabled();
		expect(screen.getByRole('status')).toBeInTheDocument();
		expect(await axe(result.container)).toHaveNoViolations();
	});

	it('disables a title that collides with an existing story filename', () => {
		const story = fakeStory();
		story.name = 'Radio: Tomorrow';
		const history = createMemoryHistory();
		render(<Router history={history}>
			<FakeStateProvider stories={[story]} prefs={{storyFormat: {name: 'Harlowe', version: '3.3.9'}}}>
				<StoryStarterDialog collapsed={false} onChangeCollapsed={jest.fn()}
					onChangeHighlighted={jest.fn()} onChangeMaximized={jest.fn()}
					onChangeProps={jest.fn()} onClose={jest.fn()} />
			</FakeStateProvider>
		</Router>);
		fireEvent.change(screen.getByLabelText('studio.starter.storyName'), {target: {value: 'Radio? Tomorrow'}});
		fireEvent.change(screen.getByLabelText('studio.starter.premise'), {target: {value: 'An idea'}});
		expect(screen.getByRole('button', {name: 'studio.starter.create'})).toBeDisabled();
	});

	it('requires plain prose before adding the idea to playable source', () => {
		renderDialog();
		fireEvent.change(screen.getByLabelText('studio.starter.premise'), {
			target: {value: 'A radio [[jumps->Ending]]'}
		});
		expect(screen.getByRole('button', {name: 'studio.starter.create'})).toBeDisabled();
		expect(screen.getByText('studio.starter.plainText')).toBeInTheDocument();
	});
});
