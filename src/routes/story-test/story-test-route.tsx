import * as React from 'react';
import {useParams} from 'react-router-dom';
import {StoryPlayer} from '../../components/story/story-player';
import {usePublishing} from '../../store/use-publishing';
import {ErrorMessage} from '../../components/error';

export const StoryTestRoute: React.FC = () => {
	const [publishError, setPublishError] = React.useState<Error>();
	const [inited, setInited] = React.useState(false);
	const [html, setHtml] = React.useState<string>();
	const {passageId, storyId} = useParams<{
		passageId: string;
		storyId: string;
	}>();
	const {publishStory} = usePublishing();

	React.useEffect(() => {
		async function load() {
			try {
				setHtml(
					await publishStory(storyId, {
						formatOptions: 'debug',
						startId: passageId
					})
				);
			} catch (error) {
				setPublishError(error as Error);
			}
		}

		if (!inited) {
			setInited(true);
			load();
		}
	}, [inited, passageId, publishStory, storyId]);

	if (publishError) {
		return <ErrorMessage>{publishError.message}</ErrorMessage>;
	}

	return html ? <StoryPlayer html={html} /> : null;
};
