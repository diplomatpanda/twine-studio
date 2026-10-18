import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconArrowFork, IconCheck, IconPlus, IconX} from '@tabler/icons';
import {IconButton} from '../control/icon-button';
import {TextInput} from '../control/text-input';
import {
	choiceSetSource,
	isPlainChoiceText,
	supportsChoiceBuilder
} from '../../util/choice-source';
import './choice-composer.css';

export interface ChoiceComposerProps {
	disabled?: boolean;
	formatName: string;
	formatVersion: string;
	id: string;
	passageNames: string[];
	onAdd: (source: string) => void;
}

interface ChoiceRow {
	id: number;
	label: string;
	destination: string;
}

export const ChoiceComposer: React.FC<ChoiceComposerProps> = props => {
	const [open, setOpen] = React.useState(false);
	const [rows, setRows] = React.useState<ChoiceRow[]>([
		{id: 0, label: '', destination: ''}
	]);
	const nextRowId = React.useRef(1);
	const rowInputRefs = React.useRef<Record<number, HTMLInputElement | null>>({});
	const focusNewRow = React.useRef<number>();
	const buttonRef = React.useRef<HTMLButtonElement>(null);
	const addAnotherRef = React.useRef<HTMLButtonElement>(null);
	const {t} = useTranslation();
	const supported = supportsChoiceBuilder(
		props.formatName,
		props.formatVersion
	);
	const valid = rows.every(
		row => isPlainChoiceText(row.label) && isPlainChoiceText(row.destination)
	);

	React.useEffect(() => {
		if (open) rowInputRefs.current[rows[0].id]?.focus();
	}, [open]);
	React.useEffect(() => {
		if (focusNewRow.current !== undefined) {
			rowInputRefs.current[focusNewRow.current]?.focus();
			focusNewRow.current = undefined;
		}
	}, [rows.length]);

	function updateRow(id: number, field: 'label' | 'destination', value: string) {
		setRows(current => current.map(row =>
			row.id === id ? {...row, [field]: value} : row
		));
	}

	function addRow() {
		const id = nextRowId.current++;
		focusNewRow.current = id;
		setRows(current => [...current, {id, label: '', destination: ''}]);
	}

	function removeRow(id: number) {
		addAnotherRef.current?.focus();
		setRows(current => current.filter(row => row.id !== id));
		delete rowInputRefs.current[id];
	}

	function close() {
		setRows([{id: nextRowId.current++, label: '', destination: ''}]);
		setOpen(false);
		buttonRef.current?.focus();
	}

	return (
		<div className="choice-composer">
			<IconButton
				buttonType="button"
				ref={buttonRef}
				disabled={props.disabled}
				icon={<IconArrowFork />}
				label={t('studio.choice.add')}
				onClick={() => open ? close() : setOpen(true)}
			/>
			{open && (
				<form
					aria-label={t('studio.choice.add')}
					onSubmit={event => {
						event.preventDefault();
						if (!supported || !valid || props.disabled) return;
						props.onAdd(
							choiceSetSource(
								props.formatName,
								props.formatVersion,
								rows
							)
						);
						setRows([{id: nextRowId.current++, label: '', destination: ''}]);
						setOpen(false);
					}}
					onKeyDown={event => {
						if (event.key === 'Escape') {
							event.stopPropagation();
							close();
						}
					}}
				>
					{supported ? (
						<>
							<p>{t('studio.choice.help')}</p>
							<div className="choice-composer-rows">
								{rows.map((row, index) => {
									const rowValid = isPlainChoiceText(row.label) &&
										isPlainChoiceText(row.destination);
									const existing = props.passageNames.includes(row.destination.trim());
									return (
										<div
											aria-label={t('studio.choice.optionNumber', {number: index + 1})}
											className="choice-composer-row"
											key={row.id}
											role="group"
										>
											{rows.length > 1 && <strong>{t('studio.choice.optionNumber', {number: index + 1})}</strong>}
											<div className="choice-composer-fields">
												<TextInput
													ref={element => {rowInputRefs.current[row.id] = element;}}
													value={row.label}
													onChange={event => updateRow(row.id, 'label', event.target.value)}
												>
													{t('studio.choice.label')}
												</TextInput>
												<TextInput
													value={row.destination}
													list={`${props.id}-destinations`}
													onChange={event => updateRow(row.id, 'destination', event.target.value)}
												>
													{t('studio.choice.destination')}
												</TextInput>
											</div>
											<p role="status">
												{row.destination && t(existing ? 'studio.choice.existing' : 'studio.choice.new')}
											</p>
											{(row.label || row.destination) && !rowValid && (
												<p>{t('studio.choice.plainText')}</p>
											)}
											{rows.length > 1 && <IconButton
												buttonType="button"
												icon={<IconX />}
												label={t('studio.choice.removeOption', {number: index + 1})}
												onClick={() => removeRow(row.id)}
											/>}
										</div>
									);
								})}
							</div>
							<datalist id={`${props.id}-destinations`}>
								{props.passageNames.filter(isPlainChoiceText).map(name => (
									<option key={name} value={name} />
								))}
							</datalist>
							<IconButton
								buttonType="button"
								ref={addAnotherRef}
								icon={<IconPlus />}
								label={t('studio.choice.addAnother')}
								onClick={addRow}
							/>
							<IconButton
								buttonType="submit"
								disabled={!valid || props.disabled}
								icon={<IconCheck />}
								label={t(rows.length === 1 ? 'studio.choice.insert' : 'studio.choice.insertSet')}
							/>
						</>
					) : (
						<p>{t('studio.choice.unsupported')}</p>
					)}
					<IconButton
						buttonType="button"
						icon={<IconX />}
						label={t('common.cancel')}
						onClick={event => {
							event.preventDefault();
							close();
						}}
					/>
				</form>
			)}
		</div>
	);
};
