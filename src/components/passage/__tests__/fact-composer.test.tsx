import * as React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import {FactComposer} from '../fact-composer';

function setup(formatName = 'Harlowe') {
	const onAdd = jest.fn();
	const result = render(
		<FactComposer
			id="fact-test"
			formatName={formatName}
			formatVersion="3.3.9"
			passageNames={['Library']}
			onAdd={onAdd}
		/>
	);
	fireEvent.click(screen.getByRole('button', {name: 'studio.fact.add'}));
	return {...result, onAdd};
}

describe('FactComposer', () => {
	it('only inserts a fact after explicit submit', () => {
		const {onAdd} = setup();
		fireEvent.change(screen.getByLabelText('studio.fact.name'), {
			target: {value: 'clue'}
		});
		expect(onAdd).not.toHaveBeenCalled();
		fireEvent.submit(screen.getByRole('form'));
		expect(onAdd).toHaveBeenCalledWith('(set: $clue to true)');
	});
	it('inserts numeric conditional choices without resetting facts', () => {
		const {onAdd} = setup();
		fireEvent.change(screen.getByLabelText('studio.fact.name'), {
			target: {value: 'trust'}
		});
		fireEvent.change(screen.getByLabelText('studio.fact.action'), {
			target: {value: 'condition'}
		});
		fireEvent.change(screen.getByLabelText('studio.fact.value'), {
			target: {value: 'number'}
		});
		fireEvent.change(screen.getByLabelText('studio.fact.number'), {
			target: {value: '3'}
		});
		fireEvent.change(screen.getByLabelText('studio.fact.comparison'), {
			target: {value: 'gte'}
		});
		fireEvent.change(screen.getByLabelText('studio.choice.label'), {
			target: {value: 'Ask for help'}
		});
		fireEvent.change(screen.getByLabelText('studio.choice.destination'), {
			target: {value: 'Library'}
		});
		fireEvent.submit(screen.getByRole('form'));
		expect(onAdd).toHaveBeenCalledWith(
			'(if: $trust >= 3)[[[Ask for help->Library]]]'
		);
	});
	it.each([
		['Harlowe', '3.3.9', '2', '(set: $trust to it + 2)'],
		['SugarCube', '2.37.3', '-2', '<<set $trust -= 2>>']
	])('adds a reviewed numeric change for %s', (formatName, formatVersion, amount, expected) => {
		const onAdd = jest.fn();
		render(<FactComposer id="fact-change" formatName={formatName}
			formatVersion={formatVersion} passageNames={[]} onAdd={onAdd} />);
		fireEvent.click(screen.getByRole('button', {name: 'studio.fact.add'}));
		fireEvent.change(screen.getByLabelText('studio.fact.name'), {target: {value: 'trust'}});
		fireEvent.change(screen.getByLabelText('studio.fact.action'), {target: {value: 'change'}});
		fireEvent.change(screen.getByLabelText('studio.fact.changeAmount'), {target: {value: amount}});
		expect(onAdd).not.toHaveBeenCalled();
		fireEvent.submit(screen.getByRole('form'));
		expect(onAdd).toHaveBeenCalledWith(expected);
	});
	it('blocks an empty or zero numeric change', () => {
		const {onAdd} = setup();
		fireEvent.change(screen.getByLabelText('studio.fact.name'), {target: {value: 'trust'}});
		fireEvent.change(screen.getByLabelText('studio.fact.action'), {target: {value: 'change'}});
		const amount = screen.getByLabelText('studio.fact.changeAmount');
		fireEvent.submit(screen.getByRole('form'));
		expect(onAdd).not.toHaveBeenCalled();
		fireEvent.change(amount, {target: {value: 'not a number'}});
		fireEvent.submit(screen.getByRole('form'));
		expect(onAdd).not.toHaveBeenCalled();
	});
	it('inserts conditional dialogue without creating a destination', () => {
		const {onAdd} = setup();
		fireEvent.change(screen.getByLabelText('studio.fact.name'), {target: {value: 'trust'}});
		fireEvent.change(screen.getByLabelText('studio.fact.action'), {target: {value: 'dialogue'}});
		fireEvent.change(screen.getByLabelText('studio.fact.value'), {target: {value: 'number'}});
		fireEvent.change(screen.getByLabelText('studio.fact.number'), {target: {value: '3'}});
		fireEvent.change(screen.getByLabelText('studio.fact.comparison'), {target: {value: 'gte'}});
		fireEvent.change(screen.getByLabelText('studio.fact.dialogueText'), {target: {value: 'Maya trusts you.'}});
		expect(screen.queryByLabelText('studio.choice.destination')).not.toBeInTheDocument();
		fireEvent.submit(screen.getByRole('form'));
		expect(onAdd).toHaveBeenCalledWith('(if: $trust >= 3)[Maya trusts you.]');
	});
	it('blocks invalid input and cancels without edits', () => {
		const {onAdd} = setup();
		fireEvent.change(screen.getByLabelText('studio.fact.name'), {
			target: {value: 'x)[bad]'}
		});
		fireEvent.submit(screen.getByRole('form'));
		expect(onAdd).not.toHaveBeenCalled();
		fireEvent.keyDown(screen.getByRole('form'), {key: 'Escape'});
		expect(screen.getByRole('button', {name: 'studio.fact.add'})).toHaveFocus();
	});
	it('keeps unsupported formats in source editing', () => {
		setup('Chapbook');
		expect(screen.getByText('studio.choice.unsupported')).toBeInTheDocument();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
	});
	it('has no basic accessibility violations', async () => {
		const {container} = setup();
		expect(await axe(container)).toHaveNoViolations();
	});
});
