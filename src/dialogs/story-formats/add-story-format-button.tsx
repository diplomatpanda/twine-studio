import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {IconPlus} from '@tabler/icons';
import {
	createFromProperties,
	useStoryFormatsContext,
	StoryFormatProperties
} from '../../store/story-formats';
import {
	PromptButton,
	PromptButtonValidator
} from '../../components/control/prompt-button';
import {fetchStoryFormatProperties} from '../../util/story-format';
import './add-story-format-button.css';

function isValidUrl(value: string) {
	try {
		new URL(value);
		return true;
	} catch (e) {
		/* empty */
	}

	return false;
}

export const AddStoryFormatButton: React.FC = () => {
	const {dispatch, formats} = useStoryFormatsContext();
	const [newFormatUrl, setNewFormatUrl] = React.useState('');
	const validatedProperties = React.useRef<
		{url: string; properties: StoryFormatProperties} | undefined
	>();
	const latestUrl = React.useRef('');
	const {t} = useTranslation();

	function handleSubmit(url: string) {
		const snapshot = validatedProperties.current;

		if (!snapshot || snapshot.url !== url) return;

		dispatch(createFromProperties(url, snapshot.properties));
	}

	const validate: PromptButtonValidator = async value => {
		if (value.trim() === '') {
			return {valid: false};
		}

		if (!isValidUrl(value)) {
			return {
				message: t('dialogs.storyFormats.addStoryFormatButton.invalidUrl'),
				valid: false
			};
		}

		try {
			const requestedUrl = value;
			const properties = await fetchStoryFormatProperties(requestedUrl);

			// A response for an earlier URL must never be used after the user edits
			// the field while the request is in flight.
			if (latestUrl.current !== requestedUrl) {
				return {valid: false};
			}

			if (
				formats.some(
					format =>
						format.name === properties.name &&
						format.version === properties.version
				)
			) {
				return {
					message: t('dialogs.storyFormats.addStoryFormatButton.alreadyAdded', {
						storyFormatName: properties.name,
						storyFormatVersion: properties.version
					}),
					valid: false
				};
			}

			validatedProperties.current = {url: requestedUrl, properties};
			return {
				message: t('dialogs.storyFormats.addStoryFormatButton.addPreview', {
					storyFormatName: properties.name,
					storyFormatVersion: properties.version
				}),
				valid: true
			};
		} catch (error) {
			return {
				message: t('dialogs.storyFormats.addStoryFormatButton.fetchError', {
					errorMessage: (error as Error).message
				}),
				valid: false
			};
		}
	};

	return (
		<span className="add-format-button">
			<PromptButton
				icon={<IconPlus />}
				label={t('common.add')}
				onChange={event => {
					const value = event.target.value;
					latestUrl.current = value;
					validatedProperties.current = undefined;
					setNewFormatUrl(value);
				}}
				onSubmit={handleSubmit}
				prompt={t('dialogs.storyFormats.addStoryFormatButton.prompt')}
				submitIcon={<IconPlus />}
				submitLabel={t('common.add')}
				submitVariant="create"
				validate={validate}
				validateOn="submit"
				value={newFormatUrl}
			/>
		</span>
	);
};
