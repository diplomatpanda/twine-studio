import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import * as React from 'react';
import {TwineElectronWindow} from '../../../electron/shared/electron-shared.types';
import {updatePassage, useStoriesContext} from '../../../store/stories';
import {useUndoableStoriesContext} from '../../../store/undoable-stories';
import {FakeStateProvider, fakeStory, StoryInspector} from '../../../test-util';
import {PassageAiReview} from '../passage-ai-review';

const bridge = {
	aiAvailability: jest.fn(),
	requestAiPassageEdit: jest.fn(),
	cancelAiPassageEdit: jest.fn()
};

const Fixture: React.FC<{onClose: () => void}> = ({onClose}) => {
	const {dispatch, stories} = useStoriesContext();
	const {undo, redo} = useUndoableStoriesContext();
	const story = stories[0];
	const passage = story.passages[0];
	return (
		<>
			<PassageAiReview onClose={onClose} passage={passage} story={story} />
			<button
				onClick={() =>
					dispatch(
						updatePassage(story, passage, {text: 'writer changed the passage'}, {dontUpdateOthers: true})
					)
				}
				type="button"
			>
				Writer edit
			</button>
			<StoryInspector />
			<button onClick={() => undo?.()} type="button">Undo proposal</button>
			<button onClick={() => redo?.()} type="button">Redo proposal</button>
		</>
	);
};

function proposal(passageId: string) {
	return JSON.stringify({
		schemaVersion: 1,
		summary: 'Fix the macro syntax.',
		operation: {
			type: 'updatePassageText',
			passageId,
			proposedText: 'repaired macro code',
			rationale: 'The original macro was missing its closing marker.'
		},
		warnings: []
	});
}

describe('<PassageAiReview>', () => {
	const onClose = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
		bridge.aiAvailability.mockResolvedValue({configured: true, model: 'deepseek-v4.1-flash'});
		(window as TwineElectronWindow).twineElectron = bridge as any;
	});

	afterEach(() => {
		delete (window as TwineElectronWindow).twineElectron;
	});

	async function ready(story = fakeStory(1)) {
		story.passages[0].text = 'original macro code';
		render(
			<FakeStateProvider stories={[story]}>
				<Fixture onClose={onClose} />
			</FakeStateProvider>
		);
		await waitFor(() =>
			expect(screen.getByText('studio.ai.model')).toBeInTheDocument()
		);
		fireEvent.click(screen.getByRole('checkbox'));
		return story;
	}

	it('sends only selected passage context and never changes source before acceptance', async () => {
		const story = fakeStory(1);
		bridge.requestAiPassageEdit.mockResolvedValue(proposal(story.passages[0].id));
		await ready(story);
		fireEvent.click(screen.getByRole('button', {name: 'studio.ai.request'}));
		await screen.findByText('Fix the macro syntax.');
		expect(bridge.requestAiPassageEdit).toHaveBeenCalledWith(
			expect.objectContaining({
				passageId: story.passages[0].id,
				passageText: 'original macro code',
				storyFormat: story.storyFormat,
				instruction: 'repair-format-syntax'
			})
		);
		expect(screen.getByTestId(`passage-${story.passages[0].id}`)).toHaveTextContent('original macro code');
		fireEvent.click(screen.getByRole('button', {name: 'studio.ai.accept'}));
		expect(screen.getByTestId(`passage-${story.passages[0].id}`)).toHaveTextContent('repaired macro code');
		expect(onClose).toHaveBeenCalled();
	});

	it('rejects a proposal without modifying the passage', async () => {
		const story = fakeStory(1);
		bridge.requestAiPassageEdit.mockResolvedValue(proposal(story.passages[0].id));
		await ready(story);
		fireEvent.click(screen.getByRole('button', {name: 'studio.ai.request'}));
		await screen.findByText('Fix the macro syntax.');
		fireEvent.click(screen.getByRole('button', {name: 'studio.ai.reject'}));
		expect(screen.queryByText('Fix the macro syntax.')).not.toBeInTheDocument();
		expect(screen.getByTestId(`passage-${story.passages[0].id}`)).toHaveTextContent('original macro code');
	});

	it('previews a conditional choice and applies only after acceptance', async () => {
		const story = fakeStory(2);
		story.storyFormat = 'SugarCube';
		story.storyFormatVersion = '2.36.1';
		story.passages[1].name = 'Garden';
		bridge.requestAiPassageEdit.mockResolvedValue(JSON.stringify({
			schemaVersion: 1, summary: 'Gate the route on a key.',
			operation: {
				type: 'appendConditionalChoice', passageId: story.passages[0].id,
				factName: 'hasKey', comparison: 'eq', value: true,
				label: 'Go to garden', destinationId: story.passages[1].id,
				rationale: 'The route requires a key.'
			}, warnings: []
		}));
		await ready(story);
		fireEvent.change(screen.getByRole('textbox'), {
			target: {value: 'If the reader has a key, link to Garden.'}
		});
		fireEvent.click(screen.getByRole('button', {name: 'studio.ai.requestConditional'}));
		await screen.findByText('Gate the route on a key.');
		expect(bridge.requestAiPassageEdit).toHaveBeenCalledWith(expect.objectContaining({
			instruction: 'propose-conditional-choice',
			request: 'If the reader has a key, link to Garden.',
			destinations: expect.arrayContaining([{id: story.passages[1].id, name: 'Garden'}])
		}));
		expect(screen.getByTestId(`passage-${story.passages[0].id}`)).toHaveTextContent('original macro code');
		fireEvent.click(screen.getByRole('button', {name: 'studio.ai.accept'}));
		expect(screen.getByTestId(`passage-${story.passages[0].id}`)).toHaveTextContent('Go to garden');
	});

	it('creates one new branch passage and undoes source and destination together', async () => {
		const story = fakeStory(1);
		story.storyFormat = 'SugarCube';
		story.storyFormatVersion = '2.36.1';
		bridge.requestAiPassageEdit.mockResolvedValue(JSON.stringify({
			schemaVersion: 1, summary: 'Add a cabin route.',
			operation: {
				type: 'appendNewBranch', passageId: story.passages[0].id,
				name: 'Cabin', label: 'Investigate the cabin',
				rationale: 'Create a new route.'
			}, warnings: []
		}));
		await ready(story);
		fireEvent.change(screen.getByRole('textbox'), {
			target: {value: 'Add a choice to investigate the cabin.'}
		});
		fireEvent.click(screen.getByRole('button', {name: 'studio.ai.requestBranch'}));
		await screen.findByText('Add a cabin route.');
		expect(bridge.requestAiPassageEdit).toHaveBeenCalledWith(expect.objectContaining({
			instruction: 'propose-new-branch', request: 'Add a choice to investigate the cabin.'
		}));
		expect(screen.getByTestId('story-inspector-default').querySelector('[data-name="Cabin"]')).toBeNull();
		fireEvent.click(screen.getByRole('button', {name: 'studio.ai.accept'}));
		expect(screen.getByTestId(`passage-${story.passages[0].id}`)).toHaveTextContent('[[Investigate the cabin|Cabin]]');
		expect(screen.getByTestId('story-inspector-default').querySelector('[data-name="Cabin"]')).not.toBeNull();
		fireEvent.click(screen.getByRole('button', {name: 'Undo proposal'}));
		expect(screen.getByTestId(`passage-${story.passages[0].id}`)).toHaveTextContent('original macro code');
		expect(screen.getByTestId('story-inspector-default').querySelector('[data-name="Cabin"]')).toBeNull();
		fireEvent.click(screen.getByRole('button', {name: 'Redo proposal'}));
		expect(screen.getByTestId(`passage-${story.passages[0].id}`)).toHaveTextContent('[[Investigate the cabin|Cabin]]');
		expect(screen.getByTestId('story-inspector-default').querySelector('[data-name="Cabin"]')).not.toBeNull();
	});

	it('blocks acceptance after a writer edits the passage', async () => {
		const story = fakeStory(1);
		bridge.requestAiPassageEdit.mockResolvedValue(proposal(story.passages[0].id));
		await ready(story);
		fireEvent.click(screen.getByRole('button', {name: 'studio.ai.request'}));
		await screen.findByText('Fix the macro syntax.');
		fireEvent.click(screen.getByRole('button', {name: 'Writer edit'}));
		expect(screen.getByRole('button', {name: 'studio.ai.accept'})).toBeDisabled();
		expect(screen.getByTestId(`passage-${story.passages[0].id}`)).toHaveTextContent('writer changed the passage');
	});
});
