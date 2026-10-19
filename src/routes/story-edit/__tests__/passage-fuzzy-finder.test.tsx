import {fireEvent, render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import * as React from 'react';
import {FakeStateProvider, fakeStory, StoryInspector} from '../../../test-util';
import {
	PassageFuzzyFinder,
	PassageFuzzyFinderProps
} from '../passage-fuzzy-finder';

describe('PassageFuzzyFinder', () => {
	function renderComponent(
		props?: Partial<PassageFuzzyFinderProps>,
		story = fakeStory()
	) {
		return render(
			<FakeStateProvider stories={[story]}>
				<PassageFuzzyFinder
					onClose={jest.fn()}
					onOpen={jest.fn()}
					open
					setCenter={jest.fn()}
					story={story}
					{...props}
				/>
				<StoryInspector />
			</FakeStateProvider>
		);
	}

	describe('When closed', () => {
		// Can't figure out how to trigger this in jsdom.

		it.todo('calls the onOpen prop when the P key is pressed');
	});

	describe('When open', () => {
		it('calls the onClose prop when the fuzzy finder is closed', () => {
			const onClose = jest.fn();

			renderComponent({onClose});
			expect(onClose).not.toHaveBeenCalled();
			fireEvent.click(screen.getByRole('button', {name: 'Close'}));
			expect(onClose).toHaveBeenCalledTimes(1);
		});

		it('updates results based on what the user enters', () => {
			const story = fakeStory(1);

			story.passages[0].name = 'a name';
			story.passages[0].text = 'text';
			renderComponent({}, story);
			fireEvent.change(screen.getByRole('textbox'), {target: {value: 'a'}});
			expect(
				screen.getByRole('button', {name: 'a name text'})
			).toBeInTheDocument();
		});

		it('finds and opens a passage by an attached Story Knowledge note', () => {
			const story = fakeStory(2);
			story.passages[0].name = 'Cellar';
			story.passages[1].name = 'Garden';
			story.passages[0].text = 'A quiet room.';
			story.passages[1].text = 'Flowers grow here.';
			story.knowledge = [
				{id: 'clue', kind: 'plot-thread', status: 'planned', title: 'Silver compass', note: 'Points toward the clue.', scope: 'passage', passageName: 'Cellar'},
				{id: 'world', kind: 'world-rule', status: 'established', title: 'Celestial axiom', note: 'Sky is dark.', scope: 'story'}
			];
			const setCenter = jest.fn();
			renderComponent({setCenter}, story);
			fireEvent.change(screen.getByRole('textbox'), {target: {value: 'silver compass'}});
			const result = screen.getByRole('button', {name: 'Cellar components.passageFuzzyFinder.knowledgeMatch'});
			expect(screen.queryByRole('button', {name: /Garden/})).not.toBeInTheDocument();
			fireEvent.click(result);
			expect(setCenter).toHaveBeenCalledWith(story.passages[0]);
		});

		it('shows all passages alphabetically before searching', () => {
			const story = fakeStory(3);
			story.passages[0].name = 'C passage';
			story.passages[1].name = 'A passage';
			story.passages[2].name = 'B passage';

			renderComponent({}, story);

			expect(screen.getAllByRole('button')).toHaveLength(4);
			expect(
				screen
					.getAllByRole('button')
					.slice(1)
					.map(button => button.querySelector('.heading')?.textContent)
			).toEqual(['A passage', 'B passage', 'C passage']);
		});

		it('filters to passages with no standard-link path from Start and resets on reopen', () => {
			const story = fakeStory(3);
			story.passages[0].name = 'Start';
			story.passages[1].name = 'Linked';
			story.passages[2].name = 'Loose';
			story.passages[0].text = '[[Linked]]';
			const {rerender} = renderComponent({}, story);
			fireEvent.click(screen.getByRole('checkbox', {name: 'components.passageFuzzyFinder.onlyWithoutPath'}));
			expect(screen.getByRole('button', {name: /Loose/})).toBeInTheDocument();
			expect(screen.queryByRole('button', {name: /Linked/})).not.toBeInTheDocument();
			expect(screen.getByText('components.passageFuzzyFinder.pathLimit')).toBeInTheDocument();
			rerender(
				<FakeStateProvider stories={[story]}>
					<PassageFuzzyFinder onClose={jest.fn()} onOpen={jest.fn()} open={false} setCenter={jest.fn()} story={story} />
				</FakeStateProvider>
			);
			rerender(
				<FakeStateProvider stories={[story]}>
					<PassageFuzzyFinder onClose={jest.fn()} onOpen={jest.fn()} open setCenter={jest.fn()} story={story} />
				</FakeStateProvider>
			);
			expect(screen.getByRole('checkbox', {name: 'components.passageFuzzyFinder.onlyWithoutPath'})).not.toBeChecked();
			expect(screen.getAllByRole('button').some(button =>
				button.querySelector('.heading')?.textContent === 'Linked'
			)).toBe(true);
		});

		it('asks for a start passage when none exists', () => {
			const story = fakeStory(2);
			story.startPassage = 'missing';
			renderComponent({}, story);
			fireEvent.click(screen.getByRole('checkbox', {name: 'components.passageFuzzyFinder.onlyWithoutPath'}));
			expect(screen.getByText('components.passageFuzzyFinder.missingStart')).toBeInTheDocument();
		});

		describe('When a result is selected', () => {
			it('centers the view on a passage and selects it when a result is selected', () => {
				const setCenter = jest.fn();
				const story = fakeStory(1);

				story.passages[0].name = 'a name';
				story.passages[0].selected = false;
				story.passages[0].text = 'text';
				renderComponent({setCenter}, story);
				fireEvent.change(screen.getByRole('textbox'), {target: {value: 'a'}});
				expect(setCenter).not.toHaveBeenCalled();
				fireEvent.click(screen.getByRole('button', {name: 'a name text'}));
				expect(setCenter.mock.calls).toEqual([[story.passages[0]]]);
			});

			it('calls the onClose prop', () => {
				const onClose = jest.fn();
				const story = fakeStory(1);

				story.passages[0].name = 'a name';
				story.passages[0].selected = false;
				story.passages[0].text = 'text';
				renderComponent({onClose}, story);
				fireEvent.change(screen.getByRole('textbox'), {target: {value: 'a'}});
				expect(onClose).not.toHaveBeenCalled();
				fireEvent.click(screen.getByRole('button', {name: 'a name text'}));
				expect(onClose).toHaveBeenCalledTimes(1);
			});
		});
	});

	it('is accessible', async () => {
		renderComponent();

		expect(await axe(document.querySelector('.fuzzy-finder')!)).toHaveNoViolations();
	});
});
