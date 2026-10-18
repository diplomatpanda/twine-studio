import * as React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import {ChoiceComposer} from '../choice-composer';

function setup(formatName = 'Harlowe') {
	const onAdd = jest.fn();
	const result = render(
		<ChoiceComposer
			id="test"
			formatName={formatName}
			formatVersion="3.3.9"
			passageNames={['Radio room']}
			onAdd={onAdd}
		/>
	);
	fireEvent.click(screen.getByRole('button', {name: 'studio.choice.add'}));
	return {...result, onAdd};
}

describe('ChoiceComposer', () => {
	it('creates a reviewed link only on explicit submit', () => {
		const {onAdd} = setup();
		fireEvent.change(screen.getByLabelText('studio.choice.label'), {
			target: {value: 'Follow the signal'}
		});
		fireEvent.change(screen.getByLabelText('studio.choice.destination'), {
			target: {value: 'Radio room'}
		});
		expect(screen.getByRole('status')).toHaveTextContent(
			'studio.choice.existing'
		);
		expect(onAdd).not.toHaveBeenCalled();
		fireEvent.submit(screen.getByRole('form'));
		expect(onAdd).toHaveBeenCalledWith('[[Follow the signal->Radio room]]');
		expect(screen.queryByRole('form')).not.toBeInTheDocument();
	});
	it('does not submit invalid source and can cancel without editing', () => {
		const {onAdd} = setup();
		fireEvent.change(screen.getByLabelText('studio.choice.label'), {
			target: {value: '[[bad]]'}
		});
		fireEvent.submit(screen.getByRole('form'));
		expect(onAdd).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole('button', {name: 'common.cancel'}));
		expect(onAdd).not.toHaveBeenCalled();
		expect(
			screen.getByRole('button', {name: 'studio.choice.add'})
		).toHaveFocus();
	});
	it('discards every draft row when canceled and reopened', () => {
		const {onAdd} = setup();
		fireEvent.change(screen.getByLabelText('studio.choice.label'), {
			target: {value: 'First draft'}
		});
		fireEvent.click(screen.getByRole('button', {name: 'studio.choice.addAnother'}));
		fireEvent.change(screen.getAllByLabelText('studio.choice.label')[1], {
			target: {value: 'Second draft'}
		});
		fireEvent.click(screen.getByRole('button', {name: 'common.cancel'}));
		fireEvent.click(screen.getByRole('button', {name: 'studio.choice.add'}));
		expect(screen.getAllByLabelText('studio.choice.label')).toHaveLength(1);
		expect(screen.getByLabelText('studio.choice.label')).toHaveValue('');
		expect(screen.getByLabelText('studio.choice.destination')).toHaveValue('');
		fireEvent.change(screen.getByLabelText('studio.choice.label'), {
			target: {value: 'Escape draft'}
		});
		fireEvent.keyDown(screen.getByRole('form'), {key: 'Escape'});
		fireEvent.click(screen.getByRole('button', {name: 'studio.choice.add'}));
		expect(screen.getByLabelText('studio.choice.label')).toHaveValue('');
		expect(onAdd).not.toHaveBeenCalled();
	});
	it('inserts a reviewed choice set in one update and rejects incomplete rows', () => {
		const {onAdd} = setup();
		fireEvent.click(screen.getByRole('button', {name: 'studio.choice.addAnother'}));
		const labels = screen.getAllByLabelText('studio.choice.label');
		const destinations = screen.getAllByLabelText('studio.choice.destination');
		expect(labels).toHaveLength(2);
		expect(labels[1]).toHaveFocus();
		fireEvent.change(labels[0], {target: {value: 'Answer the signal'}});
		fireEvent.change(destinations[0], {target: {value: 'Radio room'}});
		expect(screen.getByRole('button', {name: 'studio.choice.insertSet'})).toBeDisabled();
		fireEvent.change(labels[1], {target: {value: 'Turn it off'}});
		fireEvent.change(destinations[1], {target: {value: 'Quiet ending'}});
		fireEvent.submit(screen.getByRole('form'));
		expect(onAdd).toHaveBeenCalledTimes(1);
		expect(onAdd).toHaveBeenCalledWith(
			'[[Answer the signal->Radio room]]\n[[Turn it off->Quiet ending]]'
		);
	});
	it('removes a choice row without adding source', () => {
		const {onAdd} = setup();
		fireEvent.click(screen.getByRole('button', {name: 'studio.choice.addAnother'}));
		fireEvent.click(screen.getAllByRole('button', {name: 'studio.choice.removeOption'})[1]);
		expect(screen.getAllByLabelText('studio.choice.label')).toHaveLength(1);
		expect(screen.getByRole('button', {name: 'studio.choice.addAnother'})).toHaveFocus();
		expect(onAdd).not.toHaveBeenCalled();
	});
	it('explains source fallback for unsupported formats', () => {
		setup('Custom');
		expect(screen.getByText('studio.choice.unsupported')).toBeInTheDocument();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
	});
	it('has no basic accessibility violations', async () => {
		const {container} = setup();
		fireEvent.click(screen.getByRole('button', {name: 'studio.choice.addAnother'}));
		expect(await axe(container)).toHaveNoViolations();
	});
});
