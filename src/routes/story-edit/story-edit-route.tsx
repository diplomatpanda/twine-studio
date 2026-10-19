import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {useParams} from 'react-router-dom';
import {MainContent} from '../../components/container/main-content';
import {DocumentTitle} from '../../components/document-title/document-title';
import {DialogsContextProvider} from '../../dialogs';
import {usePrefsContext} from '../../store/prefs';
import {
	passagesInFocusedBranch,
	Passage,
	selectPassage,
	storyWithId
} from '../../store/stories';
import {useFormatReferenceParser} from '../../store/use-format-reference-parser';
import {
	UndoableStoriesContextProvider,
	useUndoableStoriesContext
} from '../../store/undoable-stories';
import {MarqueeablePassageMap} from './marqueeable-passage-map';
import {PassageFuzzyFinder} from './passage-fuzzy-finder';
import {StoryEditToolbar} from './toolbar';
import {useInitialPassageCreation} from './use-initial-passage-creation';
import {usePassageChangeHandlers} from './use-passage-change-handlers';
import {useViewCenter} from './use-view-center';
import {useZoomShortcuts} from './use-zoom-shortcuts';
import {useZoomTransition} from './use-zoom-transition';
import './story-edit-route.css';

export const InnerStoryEditRoute: React.FC = () => {
	const {storyId} = useParams<{storyId: string}>();
	const {prefs} = usePrefsContext();
	const {t} = useTranslation();
	const {dispatch: storiesDispatch, stories} = useUndoableStoriesContext();
	const story = storyWithId(stories, storyId);
	const [fuzzyFinderOpen, setFuzzyFinderOpen] = React.useState(false);
	const [focusPassageId, setFocusPassageId] = React.useState<string>();
	const focusPassage = story.passages.find(
		passage => passage.id === focusPassageId
	);
	const formatReferences = useFormatReferenceParser(
		story.storyFormat,
		story.storyFormatVersion
	);
	const visiblePassages = React.useMemo(
		() =>
			focusPassage
				? passagesInFocusedBranch(story, focusPassage.id, formatReferences)
				: story.passages,
		[focusPassage, formatReferences, story]
	);
	const visiblePassageIds = React.useMemo(
		() => new Set(visiblePassages.map(passage => passage.id)),
		[visiblePassages]
	);
	const knownPassageNames = React.useMemo(
		() =>
			focusPassage
				? new Set(story.passages.map(passage => passage.name))
				: undefined,
		[focusPassage, story.passages]
	);
	const visibleStory = React.useMemo(
		() => (focusPassage ? {...story, passages: visiblePassages} : story),
		[focusPassage, story, visiblePassages]
	);
	const mainContent = React.useRef<HTMLDivElement>(null);
	const {getCenter, setCenter} = useViewCenter(story, mainContent);
	const {
		handleDeselectPassage,
		handleDragPassages,
		handleEditPassage,
		handleSelectPassage,
		handleSelectRect
	} = usePassageChangeHandlers(visibleStory);
	const visibleZoom = useZoomTransition(story.zoom, mainContent.current);

	useZoomShortcuts(story);
	useInitialPassageCreation(story, getCenter);
	React.useEffect(() => {
		if (focusPassageId && !focusPassage) {
			setFocusPassageId(undefined);
		}
	}, [focusPassage, focusPassageId]);

	function handleFocusBranch(passage: Passage) {
		storiesDispatch(selectPassage(story, passage, true));
		setFocusPassageId(passage.id);
		setCenter(passage);
	}

	return (
		<div className="story-edit-route">
			<DocumentTitle title={story.name} />
			<StoryEditToolbar
				focusPassage={focusPassage}
				getCenter={getCenter}
				onFocusBranch={handleFocusBranch}
				onOpenFuzzyFinder={() => setFuzzyFinderOpen(true)}
				onShowFullMap={() => setFocusPassageId(undefined)}
				story={story}
				visiblePassageIds={visiblePassageIds}
			/>
			<MainContent grabbable padded={false} ref={mainContent}>
				{focusPassage && (
					<div className="branch-focus-banner" role="status">
						<span>
							{t('routes.storyEdit.branchFocus.summary', {
								name: focusPassage.name,
								visible: visiblePassages.length,
								total: story.passages.length
							})}
						</span>
						<button onClick={() => setFocusPassageId(undefined)} type="button">
							{t('routes.storyEdit.branchFocus.showAll')}
						</button>
					</div>
				)}
				<MarqueeablePassageMap
					container={mainContent}
					formatName={story.storyFormat}
					formatVersion={story.storyFormatVersion}
					knownPassageNames={knownPassageNames}
					onDeselect={handleDeselectPassage}
					onDrag={handleDragPassages}
					onEdit={handleEditPassage}
					onSelect={handleSelectPassage}
					onSelectRect={handleSelectRect}
					passages={visiblePassages}
					startPassageId={story.startPassage}
					tagColors={story.tagColors}
					tagDisplay={prefs.passageTagDisplay}
					visibleZoom={visibleZoom}
					zoom={story.zoom}
				/>
				<PassageFuzzyFinder
					onClose={() => setFuzzyFinderOpen(false)}
					onOpen={() => setFuzzyFinderOpen(true)}
					onSelectPassage={() => setFocusPassageId(undefined)}
					open={fuzzyFinderOpen}
					setCenter={setCenter}
					story={story}
				/>
			</MainContent>
		</div>
	);
};

// This is a separate component so that the inner one can use
// `useDialogsContext()` and `useUndoableStoriesContext()` inside it.

export const StoryEditRoute: React.FC = () => (
	<UndoableStoriesContextProvider>
		<DialogsContextProvider>
			<InnerStoryEditRoute />
		</DialogsContextProvider>
	</UndoableStoriesContextProvider>
);
