import * as React from 'react';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {axe} from 'jest-axe';
import {useDialogsContext} from '../../context';
import {fakeLoadedStoryFormat, fakeStory, FakeStateProvider, StoryInspector} from '../../../test-util';
import {useFormatReferenceParser} from '../../../store/use-format-reference-parser';
import {PassageLinks, passageReferenceNames} from '../passage-links';

jest.mock('../../../store/use-format-reference-parser');
jest.mock('../passage-edit-stack', () => ({PassageEditStack: () => null}));
const referenceParserMock = useFormatReferenceParser as jest.Mock;

const DialogInspector: React.FC = () => {
	const {dialogs} = useDialogsContext();
	return <output data-testid="dialog-passages">
		{dialogs[0]?.props?.passageIds?.join(',') ?? ''}
	</output>;
};

function setup(customReference = false) {
	const story = fakeStory(3);
	const format = fakeLoadedStoryFormat();
	story.storyFormat = format.name;
	story.storyFormatVersion = format.version;
	const [start, room, returnPassage] = story.passages;
	start.name = 'Start';
	start.text = customReference ? '(go-to: "Secret")' : 'Read this. [[Go to room->Room]] [[Missing]]';
	room.name = customReference ? 'Secret' : 'Room';
	returnPassage.name = 'Return';
	returnPassage.text = '[[Start]]';
	story.startPassage = start.id;
	const result = render(<FakeStateProvider stories={[story]} storyFormats={[format]}>
		<PassageLinks backPassageId={returnPassage.id} passage={start} story={story} />
		<DialogInspector />
		<StoryInspector />
	</FakeStateProvider>);
	fireEvent.click(screen.getByText('studio.passageLinks.title'));
	return {...result, story, start, room, returnPassage};
}

describe('PassageLinks', () => {
	beforeEach(() => referenceParserMock.mockReturnValue(() => []));
	it('combines ordinary links with format-provided passage references', () => {
		expect(passageReferenceNames('[[Room]]', () => ['Secret', 'Room']))
			.toEqual(['Room', 'Secret']);
		referenceParserMock.mockReturnValue((text: string) =>
			text.includes('(go-to:') ? ['Secret'] : []);
		setup(true);
		expect(screen.getByRole('button', {name: 'Secret'})).toBeInTheDocument();
		expect(screen.queryByRole('button', {name: 'studio.passageLinks.createNamed'}))
			.not.toBeInTheDocument();
	});
	it('shows incoming and outgoing links and opens a destination', () => {
		const {room, returnPassage} = setup();
		expect(screen.getByText('studio.passageLinks.start')).toBeInTheDocument();
		expect(screen.getByText('studio.passageLinks.outgoing')).toBeInTheDocument();
		expect(screen.getByText('studio.passageLinks.incoming')).toBeInTheDocument();
		expect(screen.getByRole('button', {name: 'studio.passageLinks.back'})).toBeInTheDocument();
		fireEvent.click(screen.getByRole('button', {name: 'Room'}));
		expect(screen.getByTestId('dialog-passages')).toHaveTextContent(room.id);
		expect(screen.getByTestId('dialog-passages')).not.toHaveTextContent(returnPassage.id);
	});
	it('creates and opens one missing destination', () => {
		const {story} = setup();
		fireEvent.click(screen.getByRole('button', {name: 'studio.passageLinks.createNamed'}));
		const passages = within(screen.getByTestId('story-inspector-default'))
			.getAllByTestId(/^passage-/);
		expect(passages).toHaveLength(4);
		const missing = passages.find(element => element.dataset.name === 'Missing');
		expect(missing).toBeDefined();
		expect(screen.getByTestId('dialog-passages')).toHaveTextContent(missing!.dataset.id!);
		expect(story.passages).toHaveLength(3);
	});
	it('is accessible', async () => {
		const {container} = setup();
		expect(await axe(container)).toHaveNoViolations();
	});
});
