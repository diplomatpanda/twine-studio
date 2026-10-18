import * as React from 'react';
import {LoadingCurtain} from '../components/loading-curtain';
import {usePersistence} from './persistence/use-persistence';
import {usePrefsContext} from './prefs';
import {useStoriesContext} from './stories';
import {useStoryFormatsContext} from './story-formats';
import {useStoriesRepair} from './use-stories-repair';
import {saveAs} from 'file-saver';
import {exportStorageRecovery, startStoryStorageGuard} from './persistence/local-storage/transaction';
import {isElectronRenderer} from '../util/is-electron';
import {useTranslation} from 'react-i18next';

export const StateLoader: React.FC = ({children}) => {
	const {t} = useTranslation(undefined, {useSuspense: false});
	const [initing, setIniting] = React.useState(false);
	const [inited, setInited] = React.useState(false);
	const [loadError, setLoadError] = React.useState<Error>();
	const [prefsRepaired, setPrefsRepaired] = React.useState(false);
	const [formatsRepaired, setFormatsRepaired] = React.useState(false);
	const [storiesRepaired, setStoriesRepaired] = React.useState(false);
	const {dispatch: prefsDispatch, prefs: prefsState} = usePrefsContext();
	const {dispatch: storiesDispatch} = useStoriesContext();
	const {dispatch: formatsDispatch, formats: formatsState} =
		useStoryFormatsContext();
	const repairStories = useStoriesRepair();
	const {prefs, stories, storyFormats} = usePersistence();
	React.useEffect(() => {
		if (!isElectronRenderer()) return startStoryStorageGuard();
	}, []);

	// Done in steps so that the repair action can see the inited state, and then
	// each repair action can see the results of the preceding ones.
	//
	// Repairs must go:
	// formats -> prefs (so it can repair bad format preferences) -> stories

	React.useEffect(() => {
		async function run() {
			if (!initing) {
				const formatsState = await storyFormats.load();
				const prefsState = await prefs.load();
				const storiesState = await stories.load();

				formatsDispatch({type: 'init', state: formatsState});
				prefsDispatch({type: 'init', state: prefsState});
				storiesDispatch({type: 'init', state: storiesState});
				setInited(true);
			}
		}

		run().catch(error => setLoadError(error as Error));
		setIniting(true);
	}, [
		formatsDispatch,
		inited,
		initing,
		prefs,
		prefsDispatch,
		stories,
		storiesDispatch,
		storyFormats
	]);

	React.useEffect(() => {
		if (inited && !formatsRepaired) {
			formatsDispatch({type: 'repair'});
			setFormatsRepaired(true);
		}
	}, [formatsDispatch, formatsRepaired, inited]);

	React.useEffect(() => {
		if (inited && formatsRepaired && !prefsRepaired) {
			prefsDispatch({type: 'repair', allFormats: formatsState});
			setPrefsRepaired(true);
		}
	}, [formatsRepaired, formatsState, inited, prefsDispatch, prefsRepaired]);

	React.useEffect(() => {
		if (inited && formatsRepaired && prefsRepaired && !storiesRepaired) {
			repairStories();
			setStoriesRepaired(true);
		}
	}, [
		formatsDispatch,
		formatsRepaired,
		formatsState,
		inited,
		prefsDispatch,
		prefsRepaired,
		prefsState.storyFormat.name,
		prefsState.storyFormat.version,
		repairStories,
		stories,
		storiesDispatch,
		storiesRepaired
	]);

	if (loadError)
		return (
			<main role="alert" style={{padding: '2rem'}}>
				<h1>
					{t(
						'studio.storage.loadFailed',
						'Your saved work could not be opened'
					)}
				</h1>
				<p>{loadError.message}</p>
				<p>
					{t(
						'studio.storage.preserve',
						'Keep your saved data. Export recovery data before clearing storage or reinstalling.'
					)}
				</p>
				{!isElectronRenderer() && (
					<button
						onClick={() =>
							saveAs(
								new Blob([exportStorageRecovery()], {type: 'application/json'}),
								'Twine Studio recovery.json'
							)
						}
					>
						{t('studio.storage.exportRaw', 'Export recovery data')}
					</button>
				)}
				<button
					onClick={() => {
						setLoadError(undefined);
						setIniting(false);
					}}
				>
					{t('studio.storage.retryOpening', 'Retry opening')}
				</button>
			</main>
		);
	return inited && formatsRepaired && prefsRepaired && storiesRepaired ? (
		<>{children}</>
	) : (
		<LoadingCurtain />
	);
};
