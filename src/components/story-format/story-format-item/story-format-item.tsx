import {
	IconAlertTriangle,
	IconShieldCheck,
	IconShieldLock,
	IconStar,
	IconTrash
} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {ConfirmButton} from '../../control/confirm-button';
import {formatImageUrl, StoryFormat} from '../../../store/story-formats';
import {
	hasEditorCodeTrust,
	isPackagedFormat
} from '../../../util/story-format/editor-code';
import {Badge} from '../../badge/badge';
import {IconLoading} from '../../image/icon';
import {StoryFormatItemDetails} from './story-format-item-details';
import './story-format-item.css';
import {CheckboxButton} from '../../control/checkbox-button';
import {IconButton} from '../../control/icon-button';
import classNames from 'classnames';

export interface StoryFormatItemProps {
	defaultFormat: boolean;
	editorExtensionsDisabled: boolean;
	onChangeEditorCodeTrust: (trusted: boolean) => void;
	format: StoryFormat;
	onChangeEditorExtensionsDisabled: (value: boolean) => void;
	onDelete: () => void;
	onUseAsDefault: () => void;
	onUseAsProofing: () => void;
	proofingFormat: boolean;
}

export const StoryFormatItem: React.FC<StoryFormatItemProps> = props => {
	const {
		defaultFormat,
		editorExtensionsDisabled,
		onChangeEditorCodeTrust,
		format,
		onChangeEditorExtensionsDisabled,
		onDelete,
		onUseAsDefault,
		onUseAsProofing,
		proofingFormat
	} = props;
	const {t} = useTranslation();

	let image = <></>;

	if (format.loadState === 'error') {
		image = <IconAlertTriangle />;
	} else if (
		format.loadState === 'unloaded' ||
		format.loadState === 'loading'
	) {
		image = <IconLoading />;
	} else if (format.loadState === 'loaded' && format.properties.image) {
		image = <img src={formatImageUrl(format)} alt="" />;
	}

	let useButton = <></>;
	let editorCodeTrustButton = <></>;
	const packagedFormat =
		format.loadState === 'loaded' && isPackagedFormat(format);
	const loadedProperties =
		format.loadState === 'loaded' ? format.properties : undefined;
	const editorCode = loadedProperties?.editorCode;
	const editorCodeTrusted =
		format.loadState === 'loaded' &&
		hasEditorCodeTrust(format, format.properties);
	const hasPersistedEditorCodeApproval = !!format.editorCodeTrust;
	const editorCodeTrustStatus =
		format.loadState === 'loaded' && !packagedFormat && !editorCodeTrusted
			? hasPersistedEditorCodeApproval
				? editorCode?.sha256
					? 'components.storyFormatItem.editorCodeChanged'
					: 'components.storyFormatItem.editorCodeUnverifiable'
				: editorCode?.sha256
					? 'components.storyFormatItem.editorCodeUntrusted'
					: 'components.storyFormatItem.editorCodeUnverifiable'
			: undefined;

	if (
		!packagedFormat &&
		(format.loadState === 'loaded' || hasPersistedEditorCodeApproval)
	) {
		const canTrustEditorCode = !editorCodeTrusted && !!editorCode?.sha256;
		const canRevokeEditorCodeTrust = hasPersistedEditorCodeApproval;
		const renderEditorCodeTrustButton = (trust: boolean) => (
			<ConfirmButton
				confirmIcon={trust ? <IconShieldLock /> : <IconShieldCheck />}
				confirmLabel={t(
					trust
						? 'components.storyFormatItem.trustEditorCode'
						: 'components.storyFormatItem.revokeEditorCodeTrust',
					{
						defaultValue: trust ? 'Trust editor code' : 'Revoke trust'
					}
				)}
				confirmVariant={trust ? 'primary' : 'danger'}
				icon={trust ? <IconShieldLock /> : <IconShieldCheck />}
				label={t(
					trust
						? 'components.storyFormatItem.trustEditorCode'
						: 'components.storyFormatItem.revokeEditorCodeTrust',
					{
						defaultValue: trust
							? 'Trust editor code'
							: 'Revoke editor code trust'
					}
				)}
				onConfirm={() => onChangeEditorCodeTrust(trust)}
				prompt={t(
					trust
						? 'components.storyFormatItem.trustEditorCodeWarning'
						: 'components.storyFormatItem.revokeEditorCodeTrustWarning',
					{
						defaultValue: trust
							? 'This format editor code can read and change all stories and desktop files. Trust it only if you trust the format source.'
							: 'Revoke trust? Editor code that already ran may have changed stories or desktop files. Restart Twine Studio to apply this change.'
					}
				)}
			/>
		);
		editorCodeTrustButton = (
			<>
				{canTrustEditorCode && renderEditorCodeTrustButton(true)}
				{canRevokeEditorCodeTrust && renderEditorCodeTrustButton(false)}
			</>
		);
	}

	if (format.loadState === 'loaded') {
		if (format.properties.proofing) {
			useButton = (
				<IconButton
					disabled={proofingFormat}
					icon={<IconStar />}
					label={t('components.storyFormatItem.useProofingFormat')}
					onClick={onUseAsProofing}
					variant="primary"
				/>
			);
		} else {
			useButton = (
				<IconButton
					disabled={defaultFormat}
					label={t('components.storyFormatItem.useFormat')}
					onClick={onUseAsDefault}
					icon={<IconStar />}
					variant="primary"
				/>
			);
		}
	}

	return (
		<div
			className={classNames('story-format-item', {
				highlighted: defaultFormat || proofingFormat
			})}
		>
			<div className="story-format-image">{image}</div>
			<div className="story-format-text">
				<div className="story-format-name">
					<h3>
						{t('components.storyFormatItem.name', {
							name: format.name,
							version: format.version
						})}
					</h3>
					{!format.userAdded && (
						<Badge label={t('components.storyFormatItem.builtIn')} />
					)}
					{format.loadState === 'loaded' && format.properties.proofing && (
						<Badge label={t('components.storyFormatItem.proofing')} />
					)}
					{defaultFormat && (
						<Badge label={t('components.storyFormatItem.defaultFormat')} />
					)}
					{proofingFormat && (
						<Badge label={t('components.storyFormatItem.proofingFormat')} />
					)}
				</div>
				<StoryFormatItemDetails format={format} />
				{editorCodeTrustStatus && (
					<p className="story-format-editor-code-status" role="status">
						{t(editorCodeTrustStatus, {
							defaultValue:
								editorCodeTrustStatus ===
								'components.storyFormatItem.editorCodeChanged'
									? 'Publishing works, but editor extensions are disabled because this format source changed since it was approved. Review it before approving again.'
									: editorCodeTrustStatus ===
										  'components.storyFormatItem.editorCodeUntrusted'
										? "Publishing works, but editor extensions are disabled until you approve this format's editor code."
										: 'Publishing works, but editor extensions are unavailable because this format source could not be verified. Use an HTTPS URL with CORS access to enable approval. The format can still be used for stories.'
						})}
					</p>
				)}
			</div>
			<div className="actions">
				{editorCodeTrustButton}
				{useButton}
				{format.userAdded && (
					<IconButton
						label={t('common.delete')}
						icon={<IconTrash />}
						onClick={onDelete}
					/>
				)}
				{format.loadState === 'loaded' &&
					!format.properties.proofing &&
					(packagedFormat || editorCodeTrusted) && (
						<CheckboxButton
							label={t('components.storyFormatItem.useEditorExtensions')}
							onChange={value => onChangeEditorExtensionsDisabled(!value)}
							value={!editorExtensionsDisabled}
						/>
					)}
			</div>
		</div>
	);
};
