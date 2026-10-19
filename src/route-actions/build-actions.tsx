import {
	IconEdit,
	IconEyeglass,
	IconFileText,
	IconPlayerPlay,
	IconTool,
	IconX
} from '@tabler/icons';
import * as React from 'react';
import {useTranslation} from 'react-i18next/';
import {ButtonBar} from '../components/container/button-bar';
import {CardContent} from '../components/container/card';
import {CardButton} from '../components/control/card-button';
import {IconButton} from '../components/control/icon-button';
import {IconFileTwee} from '../components/image/icon';
import {addPassageEditors, useDialogsContext} from '../dialogs';
import {storyFileName} from '../electron/shared';
import {brokenStoryLinks, passagesWithoutReferencePath, Story} from '../store/stories';
import {useFormatReferenceParser} from '../store/use-format-reference-parser';
import {useUndoableStoriesContext} from '../store/undoable-stories';
import {usePublishing} from '../store/use-publishing';
import {useStoryLaunch} from '../store/use-story-launch';
import {saveHtml, saveTwee} from '../util/save-file';
import {storyToTwee} from '../util/twee';
import './build-actions.css';

export interface BuildActionsProps {
	story?: Story;
}

export const BuildActions: React.FC<BuildActionsProps> = ({story}) => {
	const {publishStory} = usePublishing();
	const [playError, setPlayError] = React.useState<Error>();
	const [proofError, setProofError] = React.useState<Error>();
	const [publishError, setPublishError] = React.useState<Error>();
	const [warningStoryId, setWarningStoryId] = React.useState<string>();
	const [chosenStartId, setChosenStartId] = React.useState('');
	const [testError, setTestError] = React.useState<Error>();
	const {dispatch: dialogsDispatch} = useDialogsContext();
	const {dispatch: storiesDispatch} = useUndoableStoriesContext();
	const {playStory, proofStory, testStory} = useStoryLaunch();
	const {t} = useTranslation();
	const formatReferences = useFormatReferenceParser(story?.storyFormat, story?.storyFormatVersion);
	const {brokenLinks, formatParserFailed, missingStart, unreachable} = React.useMemo(() => {
		if (!story) return {brokenLinks: [], formatParserFailed: false,
			missingStart: false, unreachable: []};
		let formatParserFailed = false;
		const safeFormatReferences = (text: string) => {
			try {
				const references = formatReferences(text);
				if (!Array.isArray(references) || !references.every(name => typeof name === 'string')) {
					throw new Error('Invalid format references');
				}
				return references;
			} catch {
				formatParserFailed = true;
				return [];
			}
		};
		const missingStart = !story.passages.some(passage => passage.id === story.startPassage);
		const brokenLinks = brokenStoryLinks(story, safeFormatReferences);
		const unreachable = missingStart ? [] : passagesWithoutReferencePath(story, safeFormatReferences);
		return {brokenLinks, formatParserFailed, missingStart, unreachable};
	}, [formatReferences, story]);
	const publishWarning = warningStoryId === story?.id &&
		(missingStart || formatParserFailed || brokenLinks.length > 0 || unreachable.length > 0);
	React.useEffect(() => setChosenStartId(''), [story?.id]);

	function resetErrors() {
		setPlayError(undefined);
		setProofError(undefined);
		setPublishError(undefined);
		setWarningStoryId(undefined);
		setTestError(undefined);
	}

	async function handlePlay() {
		if (!story) {
			throw new Error('No story provided to publish');
		}

		resetErrors();

		try {
			await playStory(story.id);
		} catch (error) {
			setPlayError(error as Error);
		}
	}

	async function handleProof() {
		if (!story) {
			throw new Error('No story provided to publish');
		}

		resetErrors();

		try {
			await proofStory(story.id);
		} catch (error) {
			setProofError(error as Error);
		}
	}

	async function publishToFile() {
		if (!story) {
			throw new Error('No story provided to publish');
		}

		try {
			saveHtml(await publishStory(story.id), storyFileName(story));
		} catch (error) {
			setPublishError(error as Error);
		}
	}

	function handlePublishFile() {
		resetErrors();
		if (missingStart || formatParserFailed || brokenLinks.length || unreachable.length) {
			setWarningStoryId(story?.id);
			return;
		}
		void publishToFile();
	}

	function handleEditBrokenLink(sourceId: string) {
		if (!story) return;
		setWarningStoryId(undefined);
		dialogsDispatch(addPassageEditors(story.id, [sourceId]));
	}

	function handleSetStart() {
		if (!story || !story.passages.some(passage => passage.id === chosenStartId)) return;
		storiesDispatch({type: 'updateStory', storyId: story.id,
			props: {startPassage: chosenStartId}}, 'routeActions.build.setStart');
	}

	async function handleTest() {
		if (!story) {
			throw new Error('No story provided to publish');
		}

		resetErrors();

		try {
			await testStory(story.id);
		} catch (error) {
			setTestError(error as Error);
		}
	}

	function handleExportAsTwee() {
		if (!story) {
			throw new Error('No story provided to export');
		}

		saveTwee(storyToTwee(story), storyFileName(story, '.twee'));
	}

	return (
		<ButtonBar>
			<CardButton
				ariaLabel={testError?.message ?? ''}
				disabled={!story}
				icon={<IconTool />}
				label={t('routeActions.build.test')}
				onChangeOpen={() => setTestError(undefined)}
				onClick={handleTest}
				open={!!testError}
			>
				<CardContent>
					<p>{testError?.message}</p>
					<IconButton
						icon={<IconX />}
						label={t('common.close')}
						onClick={() => setTestError(undefined)}
						variant="primary"
					/>
				</CardContent>
			</CardButton>
			<CardButton
				ariaLabel={playError?.message ?? ''}
				disabled={!story}
				icon={<IconPlayerPlay />}
				label={t('routeActions.build.play')}
				onChangeOpen={() => setPlayError(undefined)}
				onClick={handlePlay}
				open={!!playError}
			>
				<CardContent>
					<p>{playError?.message}</p>
					<IconButton
						icon={<IconX />}
						label={t('common.close')}
						onClick={() => setPlayError(undefined)}
						variant="primary"
					/>
				</CardContent>
			</CardButton>
			<CardButton
				ariaLabel={proofError?.message ?? ''}
				disabled={!story}
				icon={<IconEyeglass />}
				label={t('routeActions.build.proof')}
				onChangeOpen={() => setProofError(undefined)}
				onClick={handleProof}
				open={!!proofError}
			>
				<CardContent>
					<p>{proofError?.message}</p>
					<IconButton
						icon={<IconX />}
						label={t('common.close')}
						onClick={() => setProofError(undefined)}
						variant="primary"
					/>
				</CardContent>
			</CardButton>
			<CardButton
				ariaLabel={publishError?.message ?? (publishWarning ? t('routeActions.build.linkWarningTitle') : '')}
				disabled={!story}
				icon={<IconFileText />}
				label={t('routeActions.build.publishToFile')}
				onChangeOpen={() => {
					setPublishError(undefined);
					setWarningStoryId(undefined);
				}}
				onClick={handlePublishFile}
				open={!!publishError || publishWarning}
			>
				<CardContent>
					{publishWarning ? (
						<div className="publish-link-warning">
							<h2>{t('routeActions.build.linkWarningTitle')}</h2>
							{missingStart && <div>
								<p>{t('routeActions.build.missingStart')}</p>
								{story?.passages.length ? <div className="publish-start-picker">
									<label htmlFor="publish-start-passage">{t('routeActions.build.chooseStart')}</label>
									<select id="publish-start-passage" onChange={event => setChosenStartId(event.target.value)} value={chosenStartId}>
										<option value="">{t('routeActions.build.chooseStartPlaceholder')}</option>
										{story.passages.map(passage => <option key={passage.id} value={passage.id}>{passage.name}</option>)}
									</select>
									<button disabled={!chosenStartId} onClick={handleSetStart} type="button">{t('routeActions.build.setStart')}</button>
								</div> : <p>{t('routeActions.build.createPassageFirst')}</p>}
							</div>}
							{brokenLinks.length > 0 && <>
								<p>{t('routeActions.build.linkWarningHelp', {count: brokenLinks.length})}</p>
								<ul>
								{brokenLinks.map(({sourceId, sourceName, target}) => (
									<li key={`${sourceId}-${target}`}>
										<span>{sourceName} → {target}</span>
										<IconButton
											icon={<IconEdit />}
											label={t('routeActions.build.editLinkedPassage', {name: sourceName})}
											onClick={() => handleEditBrokenLink(sourceId)}
										/>
									</li>
								))}
								</ul>
							</>}
							{unreachable.length > 0 && <>
								<p>{t('routeActions.build.unreachableHelp', {count: unreachable.length})}</p>
								<ul>
									{unreachable.slice(0, 20).map(passage => <li key={passage.id}>
										<span>{passage.name}</span>
										<IconButton
											icon={<IconEdit />}
											label={t('routeActions.build.editLinkedPassage', {name: passage.name})}
											onClick={() => handleEditBrokenLink(passage.id)}
										/>
									</li>)}
								</ul>
							</>}
							{formatParserFailed && <p>{t('routeActions.build.formatParserWarning')}</p>}
							<p>{t('routeActions.build.linkWarningLimit')}</p>
							<div className="publish-link-warning-actions">
								{!missingStart && <IconButton
									icon={<IconFileText />}
									label={t('routeActions.build.publishAnyway')}
									onClick={() => {
										setWarningStoryId(undefined);
										void publishToFile();
									}}
									variant="primary"
								/>}
								<IconButton
									icon={<IconX />}
									label={t('common.cancel')}
									onClick={() => setWarningStoryId(undefined)}
								/>
							</div>
						</div>
					) : (
						<>
							<p>{publishError?.message}</p>
							<IconButton
								icon={<IconX />}
								label={t('common.close')}
								onClick={() => setPublishError(undefined)}
								variant="primary"
							/>
						</>
					)}
				</CardContent>
			</CardButton>
			<IconButton
				disabled={!story}
				icon={<IconFileTwee />}
				label={t('routeActions.build.exportAsTwee')}
				onClick={handleExportAsTwee}
			/>
		</ButtonBar>
	);
};
