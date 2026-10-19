import {act, fireEvent, render, screen} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {axe} from 'jest-axe';
import * as React from 'react';
import {Helmet} from 'react-helmet';
import {Route, Router} from 'react-router-dom';
import {Story, useStoriesContext} from '../../../store/stories';
import {
	fakeLoadedStoryFormat,
	FakeStateProvider,
	FakeStateProviderProps,
	fakeStory,
	StoryInspector
} from '../../../test-util';
import {InnerStoryEditRoute} from '../story-edit-route';
import {useZoomShortcuts} from '../use-zoom-shortcuts';

jest.mock('../toolbar/story-edit-toolbar');
jest.mock('../use-zoom-shortcuts');
jest.mock('../../../components/passage/passage-map/passage-map');

const TestStoryEditRoute: React.FC = () => {
	const {stories} = useStoriesContext();

	return (
		<Router
			history={createMemoryHistory({
				initialEntries: [`/stories/${stories[0].id}`]
			})}
		>
			<Route path="/stories/:storyId">
				<InnerStoryEditRoute />
				<StoryInspector />
			</Route>
		</Router>
	);
};

describe('<StoryEditRoute>', () => {
	const useZoomShortcutsMock = useZoomShortcuts as jest.Mock;

	async function renderComponent(
		story: Story,
		contexts?: FakeStateProviderProps
	) {
		const format = fakeLoadedStoryFormat();

		format.name = story.storyFormat;
		format.version = story.storyFormatVersion;

		jest.useFakeTimers();

		const result = render(
			<FakeStateProvider
				{...contexts}
				stories={[story]}
				storyFormats={[format]}
			>
				<TestStoryEditRoute />
			</FakeStateProvider>
		);

		act(() => {
			jest.runAllTimers();
		});

		jest.useRealTimers();

		// Need this because of <PromptButton>
		await act(async () => Promise.resolve());
		return result;
	}

	it('sets the document title to the story name', async () => {
		const story = fakeStory();

		await renderComponent(story);
		expect(Helmet.peek().title).toBe(story.name);
	});

	it('displays the toolbar', async () => {
		await renderComponent(fakeStory());
		expect(screen.getByTestId('mock-story-edit-toolbar')).toBeInTheDocument();
	});

	it('displays a passage map', async () => {
		await renderComponent(fakeStory());
		expect(screen.getByTestId('mock-passage-map')).toBeInTheDocument();
	});

	it('focuses a branch without changing story passages or saved positions', async () => {
		HTMLElement.prototype.scrollTo = jest.fn();
		const story = fakeStory(5);
		story.passages.forEach((passage, index) => {passage.name = `P${index}`; passage.text = '';});
		story.passages[0].text = '[[P1]]';
		story.passages[1].text = '[[P2]]';
		story.passages[2].text = '[[P3]]';
		await renderComponent(story);
		fireEvent.click(screen.getByText('mock-focus-branch'));
		expect(screen.getByText('routes.storyEdit.branchFocus.summary')).toBeInTheDocument();
		expect(screen.queryByTestId(`mock-passage-${story.passages[4].id}`)).not.toBeInTheDocument();
		expect(screen.getByTestId(`mock-passage-${story.passages[3].id}`)).toBeInTheDocument();
		expect(screen.getByTestId('story-inspector-default').querySelectorAll('[data-testid^="passage-"]'))
			.toHaveLength(5);
		for (const passage of story.passages) {
			const saved = screen.getByTestId(`passage-${passage.id}`);
			expect(saved).toHaveAttribute('data-left', String(passage.left));
			expect(saved).toHaveAttribute('data-top', String(passage.top));
		}
		fireEvent.click(screen.getByText('mock-show-full-map'));
		expect(screen.getByTestId(`mock-passage-${story.passages[4].id}`)).toBeInTheDocument();
	});

	it('sets up zoom keyboard shortcuts', async () => {
		await renderComponent(fakeStory());
		expect(useZoomShortcutsMock).toHaveBeenCalled();
	});

	it('is accessible', async () => {
		const {container} = await renderComponent(fakeStory());

		expect(await axe(container)).toHaveNoViolations();
	});
});
