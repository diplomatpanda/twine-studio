import DOMPurify from 'dompurify';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {StoryFormat} from '../../../store/story-formats';

const safeMetadataConfig = {
	ALLOWED_TAGS: [
		'a',
		'b',
		'blockquote',
		'br',
		'code',
		'del',
		'em',
		'i',
		'kbd',
		'li',
		'mark',
		'ol',
		'p',
		'pre',
		's',
		'small',
		'strong',
		'sub',
		'sup',
		'u',
		'ul'
	],
	ALLOWED_ATTR: ['href', 'title'],
	ALLOW_DATA_ATTR: false,
	ALLOW_ARIA_ATTR: false,
	FORBID_TAGS: ['embed', 'form', 'iframe', 'math', 'object', 'script', 'style', 'svg'],
	FORBID_ATTR: ['style'],
	ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i
};

export function sanitizeStoryFormatMetadata(value: string) {
	return DOMPurify.sanitize(value, safeMetadataConfig);
}

export interface StoryFormatItemDetailsProps {
	format: StoryFormat;
}

export const StoryFormatItemDetails: React.FC<StoryFormatItemDetailsProps> = ({
	format
}) => {
	const {t} = useTranslation();

	if (format.loadState === 'unloaded' || format.loadState === 'loading') {
		return (
			<div className="story-format-details">
				<p>{t('components.storyFormatItem.loadingFormat')}</p>
			</div>
		);
	}

	if (format.loadState === 'error') {
		return (
			<div className="story-format-details">
				<p>
					{t('components.storyFormatItem.loadError', {
						errorMessage: format.loadError.message
					})}
				</p>
			</div>
		);
	}

	return (
		<div className="story-format-details">
			{format.properties.author && (
				<p
					className="story-format-author"
					dangerouslySetInnerHTML={{
						__html: sanitizeStoryFormatMetadata(
							t('components.storyFormatItem.author', {
								author: format.properties.author
							})
						)
					}}
				/>
			)}
			{format.properties.description && (
				<div
					className="story-format-description"
					dangerouslySetInnerHTML={{
						__html: sanitizeStoryFormatMetadata(
							format.properties.description
						)
					}}
				/>
			)}
			{format.properties.license && (
				<p className="story-format-license">
					{t('components.storyFormatItem.license', {
						license: format.properties.license
					})}
				</p>
			)}
		</div>
	);
};
