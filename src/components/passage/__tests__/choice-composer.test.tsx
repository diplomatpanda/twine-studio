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
	it('explains source fallback for unsupported formats', () => {
		setup('Custom');
		expect(screen.getByText('studio.choice.unsupported')).toBeInTheDocument();
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
	});
	it('has no basic accessibility violations', async () => {
		const {container} = setup();
		expect(await axe(container)).toHaveNoViolations();
	});
});
