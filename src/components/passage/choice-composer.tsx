import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconArrowFork, IconCheck, IconX} from '@tabler/icons';
import {IconButton} from '../control/icon-button';
import {TextInput} from '../control/text-input';
import {
	choiceSource,
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

export const ChoiceComposer: React.FC<ChoiceComposerProps> = props => {
	const [open, setOpen] = React.useState(false);
	const [label, setLabel] = React.useState('');
	const [destination, setDestination] = React.useState('');
	const labelRef = React.useRef<HTMLInputElement>(null);
	const buttonRef = React.useRef<HTMLButtonElement>(null);
	const {t} = useTranslation();
	const supported = supportsChoiceBuilder(
		props.formatName,
		props.formatVersion
	);
	const valid = isPlainChoiceText(label) && isPlainChoiceText(destination);
	const existing = props.passageNames.includes(destination.trim());

	React.useEffect(() => {
		if (open) labelRef.current?.focus();
	}, [open]);

	function close() {
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
				onClick={() => setOpen(!open)}
			/>
			{open && (
				<form
					aria-label={t('studio.choice.add')}
					onSubmit={event => {
						event.preventDefault();
						if (!supported || !valid || props.disabled) return;
						props.onAdd(
							choiceSource(
								props.formatName,
								props.formatVersion,
								label,
								destination
							)
						);
						setLabel('');
						setDestination('');
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
							<TextInput
								ref={labelRef}
								value={label}
								onChange={event => setLabel(event.target.value)}
							>
								{t('studio.choice.label')}
							</TextInput>
							<TextInput
								value={destination}
								list={`${props.id}-destinations`}
								onChange={event => setDestination(event.target.value)}
							>
								{t('studio.choice.destination')}
							</TextInput>
							<datalist id={`${props.id}-destinations`}>
								{props.passageNames.filter(isPlainChoiceText).map(name => (
									<option key={name} value={name} />
								))}
							</datalist>
							<p role="status">
								{destination &&
									t(existing ? 'studio.choice.existing' : 'studio.choice.new')}
							</p>
							{(label || destination) && !valid && (
								<p>{t('studio.choice.plainText')}</p>
							)}
							<IconButton
								buttonType="submit"
								disabled={!valid || props.disabled}
								icon={<IconCheck />}
								label={t('studio.choice.insert')}
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
