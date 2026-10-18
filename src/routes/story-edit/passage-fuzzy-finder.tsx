import * as React from 'react';
import {createPortal} from 'react-dom';
import {useHotkeys} from 'react-hotkeys-hook';
import {useTranslation} from 'react-i18next';
import {CSSTransition} from 'react-transition-group';
import {FuzzyFinder} from '../../components/fuzzy-finder';
import {
	passagesMatchingFuzzySearch,
	passagesWithoutStandardLinkPath,
	selectPassage,
	Story,
	useStoriesContext
} from '../../store/stories';
import {Point} from '../../util/geometry';

export interface PassageFuzzyFinderProps {
	onClose: () => void;
	onOpen: () => void;
	open?: boolean;
	setCenter: (value: Point) => void;
	story: Story;
}

export const PassageFuzzyFinder: React.FC<PassageFuzzyFinderProps> = props => {
	const {onClose, onOpen, open, setCenter, story} = props;
	const {dispatch} = useStoriesContext();
	const [search, setSearch] = React.useState('');
	const [onlyWithoutPath, setOnlyWithoutPath] = React.useState(false);
	const hasStart = story.passages.some(passage => passage.id === story.startPassage);
	React.useEffect(() => {
		if (!open) {
			setSearch('');
			setOnlyWithoutPath(false);
		}
	}, [open]);
	const candidatePassages = React.useMemo(
		() => onlyWithoutPath ? passagesWithoutStandardLinkPath(story) : story.passages,
		[onlyWithoutPath, story]
	);
	const matches = React.useMemo(
		() => passagesMatchingFuzzySearch(candidatePassages, search),
		[candidatePassages, search]
	);
	const results = React.useMemo(
		() =>
			matches.map(({name, tags, text}) => ({
				heading: name,
				detail:
					search.trim() === ''
						? tags.slice(0, 3).join(', ') ||
							text.replace(/\s+/g, ' ').slice(0, 80)
						: text.slice(0, 200)
			})),
		[matches, search]
	);
	useHotkeys('p', onOpen);
	const {t} = useTranslation();
	const noResultsKey = onlyWithoutPath && !hasStart
		? 'components.passageFuzzyFinder.missingStart'
		: onlyWithoutPath && !search.trim()
			? 'components.passageFuzzyFinder.noUnlinked'
			: 'components.passageFuzzyFinder.noResults';

	function handleChangeSearch(value: string) {
		setSearch(value);
	}

	function handleSelectResult(index: number) {
		if (!matches[index]) return;
		setCenter(matches[index]);
		dispatch(selectPassage(story, matches[index], true));
		setSearch('');
		onClose();
	}

	// Escape the fixed map's stacking context so wrapped toolbar actions cannot
	// cover the search controls. React context and selection ownership stay here.
	return createPortal(
		<CSSTransition
			classNames="pop"
			mountOnEnter
			timeout={200}
			unmountOnExit
			in={open}
		>
			<FuzzyFinder
				controls={
					<>
						<label>
							<input
								checked={onlyWithoutPath}
								onChange={event => setOnlyWithoutPath(event.target.checked)}
								type="checkbox"
							/>
							{t('components.passageFuzzyFinder.onlyWithoutPath')}
						</label>
						{onlyWithoutPath && <p>{t('components.passageFuzzyFinder.pathLimit')}</p>}
					</>
				}
				noResultsText={t(noResultsKey)}
				onClose={onClose}
				onChangeSearch={handleChangeSearch}
				onSelectResult={handleSelectResult}
				prompt={t('components.passageFuzzyFinder.prompt')}
				search={search}
				results={results}
				selectionResetKey={onlyWithoutPath}
				showEmptyResults={onlyWithoutPath}
			/>
		</CSSTransition>,
		document.body
	);
};
