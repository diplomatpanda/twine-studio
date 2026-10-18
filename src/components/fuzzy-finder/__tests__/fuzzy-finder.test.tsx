import {fireEvent, render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import * as React from 'react';
import {FuzzyFinder, FuzzyFinderProps} from '../fuzzy-finder';

describe('FuzzyFinder', () => {
	function renderComponent(props?: Partial<FuzzyFinderProps>) {
		return render(
			<FuzzyFinder
				noResultsText="mock-no-results"
				onChangeSearch={jest.fn()}
				onClose={jest.fn()}
				onSelectResult={jest.fn()}
				prompt="mock-prompt"
				results={[{detail: 'result-1-detail', heading: 'result-2-heading'}]}
				search="mock-search"
				{...props}
			/>
		);
	}

	it('displays a prompt', () => {
		renderComponent({prompt: 'test-prompt'});
		expect(screen.getByText('test-prompt')).toBeInTheDocument();
	});

	it('displays a text field with the search prop as value', () => {
		renderComponent({search: 'test-search'});
		expect(screen.getByRole('textbox')).toHaveValue('test-search');
	});

	it('selects the first result with Enter when the search is empty', () => {
		const onSelectResult = jest.fn();
		renderComponent({search: '', onSelectResult});

		screen.getByRole('textbox').focus();
		fireEvent.keyDown(screen.getByRole('textbox'), {
			code: 'Enter',
			key: 'Enter'
		});

		expect(onSelectResult).toHaveBeenCalledWith(0);
	});

	it('moves through empty-search results with the arrow keys', () => {
		const onSelectResult = jest.fn();
		renderComponent({
			onSelectResult,
			results: [
				{detail: 'first', heading: 'first'},
				{detail: 'second', heading: 'second'}
			],
			search: ''
		});
		const input = screen.getByRole('textbox');
		input.focus();

		fireEvent.keyDown(input, {code: 'ArrowDown', key: 'ArrowDown'});
		fireEvent.keyDown(input, {code: 'Enter', key: 'Enter'});

		expect(onSelectResult).toHaveBeenCalledWith(1);
	});

	it('announces the currently selected result', () => {
		renderComponent({
			results: [
				{detail: 'first', heading: 'first'},
				{detail: 'second', heading: 'second'}
			],
			search: ''
		});
		const input = screen.getByRole('textbox');
		input.focus();

		expect(screen.getByRole('status')).toHaveTextContent('first');
		fireEvent.keyDown(input, {code: 'ArrowDown', key: 'ArrowDown'});
		expect(screen.getByRole('status')).toHaveTextContent('second');
	});

	it('does not select or close while an IME composition is active', () => {
		const onClose = jest.fn();
		const onSelectResult = jest.fn();
		renderComponent({onClose, onSelectResult, search: ''});
		const input = screen.getByRole('textbox');
		input.focus();

		fireEvent.keyDown(input, {
			code: 'Enter',
			isComposing: true,
			key: 'Enter'
		});
		fireEvent.keyDown(input, {
			code: 'Escape',
			isComposing: true,
			key: 'Escape'
		});

		expect(onSelectResult).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('closes when Escape is pressed from a result button', () => {
		const onClose = jest.fn();
		renderComponent({onClose, search: ''});
		const result = screen.getByRole('button', {name: /result-2-heading/});
		result.focus();

		fireEvent.keyDown(result, {code: 'Escape', key: 'Escape'});

		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('restores focus to the previously focused trigger when closed', () => {
		const TestFinder: React.FC = () => {
			const [open, setOpen] = React.useState(false);
			return (
				<>
					<button type="button" onClick={() => setOpen(true)}>Trigger</button>
					{open && (
						<FuzzyFinder
							noResultsText="mock-no-results"
							onChangeSearch={jest.fn()}
							onClose={() => setOpen(false)}
							onSelectResult={jest.fn()}
							prompt="mock-prompt"
							results={[
								{detail: 'result-detail', heading: 'result-heading'}
							]}
							search=""
						/>
					)}
				</>
			);
		};

		render(<TestFinder />);
		const trigger = screen.getByRole('button', {name: 'Trigger'});
		trigger.focus();
		fireEvent.click(trigger);
		const input = screen.getByRole('textbox');
		input.focus();
		fireEvent.keyDown(input, {key: 'Escape'});

		expect(trigger).toHaveFocus();
	});

	// jsdom doesn't seem to implement focus in a way that works for these tests.
	it.todo('focuses the text field when initially mounted');

	it('calls the onChangeSearch prop when the text field is changed', () => {
		const onChangeSearch = jest.fn();

		renderComponent({onChangeSearch});
		expect(onChangeSearch).not.toHaveBeenCalled();
		fireEvent.change(screen.getByRole('textbox'), {
			target: {value: 'test-change'}
		});
		expect(onChangeSearch.mock.calls).toEqual([['test-change']]);
	});

	it('displays a close button which calls the onClose prop', () => {
		const onClose = jest.fn();

		renderComponent({onClose});
		expect(onClose).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', {name: 'Close'}));
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	it('displays a result for every entry in the results prop', () => {
		renderComponent({
			results: [
				{detail: 'test-detail-1', heading: 'test-heading-1'},
				{detail: 'test-detail-2', heading: 'test-heading-2'}
			]
		});

		expect(screen.getByText('test-detail-1')).toBeInTheDocument();
		expect(screen.getByText('test-detail-2')).toBeInTheDocument();
	});

	it('displays the noResultsText prop if there are no results', () => {
		renderComponent({
			noResultsText: 'test-no-results',
			results: []
		});
		expect(screen.getByText('test-no-results')).toBeInTheDocument();
	});

	it("doesn't display the noResultsText prop if there are results", () => {
		renderComponent({
			noResultsText: 'test-no-results',
			results: [{detail: 'test-detail-1', heading: 'test-heading-1'}]
		});
		expect(screen.queryByText('test-no-results')).not.toBeInTheDocument();
	});

	it('calls the onSelectResult prop with the array index when a result is clicked', () => {
		const onSelectResult = jest.fn();

		renderComponent({
			onSelectResult,
			results: [{detail: 'test-detail-1', heading: 'test-heading-1'}]
		});
		expect(onSelectResult).not.toHaveBeenCalled();
		fireEvent.click(screen.getByText('test-detail-1'));
		expect(onSelectResult.mock.calls).toEqual([[0]]);
	});

	it('is accessible', async () => {
		const {container} = renderComponent();

		expect(await axe(container)).toHaveNoViolations();
	});
});
