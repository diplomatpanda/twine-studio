import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconCheck, IconAdjustments, IconX} from '@tabler/icons';
import {IconButton} from '../control/icon-button';
import {TextInput} from '../control/text-input';
import {TextSelect} from '../control/text-select';
import {
	isPlainChoiceText,
	supportsChoiceBuilder
} from '../../util/choice-source';
import {
	assignFactSource,
	conditionalChoiceSource
} from '../../util/story-fact-source';
import './choice-composer.css';

export interface FactComposerProps {
	disabled?: boolean;
	formatName: string;
	formatVersion: string;
	id: string;
	passageNames: string[];
	onAdd: (source: string) => void;
}

export const FactComposer: React.FC<FactComposerProps> = props => {
	const {t} = useTranslation();
	const [open, setOpen] = React.useState(false);
	const [action, setAction] = React.useState('remember');
	const [name, setName] = React.useState('');
	const [kind, setKind] = React.useState('yes');
	const [number, setNumber] = React.useState('0');
	const [operator, setOperator] = React.useState<'eq' | 'gte' | 'lte'>('eq');
	const [label, setLabel] = React.useState('');
	const [destination, setDestination] = React.useState('');
	const trigger = React.useRef<HTMLButtonElement>(null);
	const nameInput = React.useRef<HTMLInputElement>(null);
	const supported = supportsChoiceBuilder(
		props.formatName,
		props.formatVersion
	);
	const value = kind === 'number' ? Number(number) : kind === 'yes';
	let source = '';
	try {
		if (kind !== 'number' || number.trim()) {
			source =
				action === 'remember'
					? assignFactSource(props.formatName, props.formatVersion, name, value)
					: conditionalChoiceSource(
							props.formatName,
							props.formatVersion,
							name,
							kind === 'number' ? operator : 'eq',
							value,
							label,
							destination
						);
		}
	} catch {
		// Invalid input remains in the form; nothing reaches the story source.
	}
	React.useEffect(() => {
		if (open) nameInput.current?.focus();
	}, [open]);
	const close = () => {
		setOpen(false);
		trigger.current?.focus();
	};
	return (
		<div className="choice-composer">
			<IconButton
				buttonType="button"
				ref={trigger}
				disabled={props.disabled}
				icon={<IconAdjustments />}
				label={t('studio.fact.add')}
				onClick={() => setOpen(!open)}
			/>
			{open && (
				<form
					aria-label={t('studio.fact.add')}
					onKeyDown={event => {
						if (event.key === 'Escape') {
							event.stopPropagation();
							close();
						}
					}}
					onSubmit={event => {
						event.preventDefault();
						if (!source || props.disabled) return;
						props.onAdd(source);
						setName('');
						setLabel('');
						setDestination('');
						setOpen(false);
					}}
				>
					{supported ? (
						<>
							<p>{t('studio.fact.help')}</p>
							<TextSelect
								value={action}
								onChange={event => setAction(event.target.value)}
								options={['remember', 'condition'].map(key => ({
									value: key,
									label: t(`studio.fact.${key}`)
								}))}
							>
								{t('studio.fact.action')}
							</TextSelect>
							<TextInput
								ref={nameInput}
								value={name}
								onChange={event => setName(event.target.value)}
								placeholder="clue"
							>
								{t('studio.fact.name')}
							</TextInput>
							<TextSelect
								value={kind}
								onChange={event => setKind(event.target.value)}
								options={['yes', 'no', 'number'].map(key => ({
									value: key,
									label: t(`studio.fact.${key}`)
								}))}
							>
								{t('studio.fact.value')}
							</TextSelect>
							{kind === 'number' && (
								<TextInput
									value={number}
									onChange={event => setNumber(event.target.value)}
								>
									{t('studio.fact.number')}
								</TextInput>
							)}
							{action === 'condition' && (
								<>
									{kind === 'number' && (
										<TextSelect
											value={operator}
											onChange={event =>
												setOperator(event.target.value as typeof operator)
											}
											options={['eq', 'gte', 'lte'].map(key => ({
												value: key,
												label: t(`studio.fact.${key}`)
											}))}
										>
											{t('studio.fact.comparison')}
										</TextSelect>
									)}
									<TextInput
										value={label}
										onChange={event => setLabel(event.target.value)}
									>
										{t('studio.choice.label')}
									</TextInput>
									<TextInput
										value={destination}
										list={`${props.id}-fact-destinations`}
										onChange={event => setDestination(event.target.value)}
									>
										{t('studio.choice.destination')}
									</TextInput>
									<datalist id={`${props.id}-fact-destinations`}>
										{props.passageNames
											.filter(isPlainChoiceText)
											.map(passageName => (
												<option key={passageName} value={passageName} />
											))}
									</datalist>
									<p>{t('studio.fact.conditionHelp')}</p>
								</>
							)}
							<p>{t('studio.fact.nameHelp')}</p>
							{!source && name && (
								<p role="status">{t('studio.fact.invalid')}</p>
							)}
							<IconButton
								buttonType="submit"
								disabled={!source || props.disabled}
								icon={<IconCheck />}
								label={t('studio.fact.insert')}
							/>
						</>
					) : (
						<p>{t('studio.choice.unsupported')}</p>
					)}
					<IconButton
						buttonType="button"
						icon={<IconX />}
						label={t('common.cancel')}
						onClick={close}
					/>
				</form>
			)}
		</div>
	);
};
