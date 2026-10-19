import {v4 as uuid} from '@lukeed/uuid';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {
	canApplyPassageEdit,
	parseConditionalChoiceProposal,
	parseNewBranchProposal,
	parsePassageEditProposal,
	parseTwoWayBranchProposal,
	selectTwoWayBranchChoices,
	PassageEditProposal,
	PassageEditSnapshot
} from '../../ai/passage-edit-proposal';
import {TwineElectronWindow} from '../../electron/shared/electron-shared.types';
import {newBranchAction} from '../../ai/new-branch-action';
import {aiKnowledgeForPassage} from '../../ai/knowledge-context';
import {Passage, Story, updatePassage} from '../../store/stories';
import {useUndoableStoriesContext} from '../../store/undoable-stories';
import {supportsChoiceBuilder} from '../../util/choice-source';
import './passage-ai-review.css';

export interface PassageAiReviewProps {
	onClose: () => void;
	passage: Passage;
	story: Story;
}

export const PassageAiReview: React.FC<PassageAiReviewProps> = props => {
	const {onClose, passage, story} = props;
	const {dispatch} = useUndoableStoriesContext();
	const {t} = useTranslation();
	const translateRef = React.useRef(t);
	translateRef.current = t;
	const bridge = (window as TwineElectronWindow).twineElectron;
	const [availability, setAvailability] = React.useState<{
		configured: boolean;
		model?: string;
		reason?: string;
	}>();
	const [consent, setConsent] = React.useState(false);
	const [includeKnowledge, setIncludeKnowledge] = React.useState(false);
	const [conditionalRequest, setConditionalRequest] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState('');
	const [proposal, setProposal] = React.useState<PassageEditProposal>();
	const [snapshot, setSnapshot] = React.useState<PassageEditSnapshot>();
	const [selectedBranchNames, setSelectedBranchNames] = React.useState<string[]>([]);
	const reviewProposal = snapshot && proposal
		? selectTwoWayBranchChoices(proposal, snapshot, selectedBranchNames)
		: undefined;
	const availableKnowledge = aiKnowledgeForPassage(story, passage);
	const sessionId = React.useRef(uuid());
	const requestGeneration = React.useRef(0);
	const openCredentialWindow = async () => {
		if (!bridge?.openAiCredentials) return;
		setError('');
		try {
			await bridge.openAiCredentials();
			setAvailability(await bridge.aiAvailability());
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('studio.ai.unavailable'));
		}
	};

	React.useEffect(() => {
		let current = true;
		if (bridge?.aiAvailability) {
			void bridge.aiAvailability().then(
				result => {
					if (current) setAvailability(result);
				},
				() => {
					if (current) setError(translateRef.current('studio.ai.unavailable'));
				}
			);
		}
		return () => {
			current = false;
			requestGeneration.current++;
			if (bridge?.cancelAiPassageEdit) {
				bridge.cancelAiPassageEdit(sessionId.current);
			}
		};
	}, [bridge]);

	async function request(instruction: 'repair-format-syntax' | 'propose-conditional-choice' | 'propose-new-branch' | 'propose-two-way-branch') {
		if (
			busy ||
			!bridge?.requestAiPassageEdit ||
			!availability?.configured ||
			!consent
		) {
			return;
		}
		if (passage.text.length > 12000) {
			setError(t('studio.ai.tooLong'));
			return;
		}
		if (instruction !== 'repair-format-syntax' && !conditionalRequest.trim()) return;
		const knowledge = includeKnowledge ? aiKnowledgeForPassage(story, passage) : [];
		const generation = ++requestGeneration.current;
		const source: PassageEditSnapshot = {
			storyId: story.id,
			passageId: passage.id,
			storyFormat: story.storyFormat,
			storyFormatVersion: story.storyFormatVersion,
			text: passage.text,
			...(knowledge.length ? {knowledge} : {}),
			...(instruction === 'propose-new-branch' || instruction === 'propose-two-way-branch'
				? {storyPassages: story.passages} : {})
		};
		setSnapshot(source);
		setProposal(undefined);
		setSelectedBranchNames([]);
		setError('');
		setBusy(true);
		try {
			const raw = await bridge.requestAiPassageEdit({
				sessionId: sessionId.current,
				storyFormat: story.storyFormat,
				storyFormatVersion: story.storyFormatVersion,
				passageId: passage.id,
				passageName: passage.name,
				passageText: passage.text,
				...(knowledge.length ? {knowledge} : {}),
				instruction,
				...(instruction !== 'repair-format-syntax' ? {
					request: conditionalRequest.trim(),
					...(instruction === 'propose-conditional-choice' ? {
						destinations: story.passages.slice(0, 100).map(({id, name}) => ({id, name}))
					} : {})
				} : {})
			});
			if (generation === requestGeneration.current) {
				const parsed = instruction === 'repair-format-syntax'
					? parsePassageEditProposal(raw, source)
					: instruction === 'propose-conditional-choice'
						? parseConditionalChoiceProposal(raw, source, story)
						: instruction === 'propose-new-branch'
							? parseNewBranchProposal(raw, source, story)
							: parseTwoWayBranchProposal(raw, source, story);
				setProposal(parsed);
				setSelectedBranchNames(parsed.newPassages?.map(({name}) => name) ?? []);
			}
		} catch (cause) {
			if (generation === requestGeneration.current) {
				setError(cause instanceof Error ? cause.message : t('studio.ai.failed'));
			}
		} finally {
			if (generation === requestGeneration.current) setBusy(false);
		}
	}

	function accept() {
		if (!snapshot || !reviewProposal) return;
		if (!canApplyPassageEdit(snapshot, story, passage, reviewProposal)) {
			setError(t('studio.ai.stale'));
			setProposal(undefined);
			return;
		}
		try {
			dispatch(reviewProposal.newPassage || reviewProposal.newPassages
				? newBranchAction(story, passage, reviewProposal)
				: updatePassage(story, passage, {text: reviewProposal.operation.proposedText}, {dontUpdateOthers: true}),
			'studio.ai.undo');
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : t('studio.ai.failed'));
			return;
		}
		onClose();
	}

	const stale = !!snapshot && !!reviewProposal &&
		!canApplyPassageEdit(snapshot, story, passage, reviewProposal);
	const structuredSupported = supportsChoiceBuilder(story.storyFormat, story.storyFormatVersion);

	return (
		<section className="passage-ai-review" aria-label={t('studio.ai.title')}>
			<h3>{t('studio.ai.title')}</h3>
			<p>{t('studio.ai.help')}</p>
			{!bridge?.requestAiPassageEdit ? (
				<p>{t('studio.ai.desktopOnly')}</p>
			) : availability && !availability.configured ? (
				<>
					<p>{availability.reason || t('studio.ai.setup')}</p>
					<button type="button" onClick={() => void openCredentialWindow()}>{t('studio.ai.manageKey')}</button>
				</>
			) : (
				<>
					<p>{t('studio.ai.model', {model: availability?.model ?? '…'})}</p>
					<button type="button" onClick={() => void openCredentialWindow()}>{t('studio.ai.manageKey')}</button>
					<p>
						{t('studio.ai.privacy')}{' '}
						<a href="https://dev.opencode.ai/v2/docs/console/go/#privacy" target="_blank" rel="noopener noreferrer">
							{t('studio.ai.policy')}
						</a>
					</p>
					<label className="passage-ai-review-consent">
						<input
							checked={consent}
							onChange={event => setConsent(event.target.checked)}
							type="checkbox"
						/>
						{t('studio.ai.sendNotice', {name: passage.name})}
					</label>
					{availableKnowledge.length > 0 && <>
						<label className="passage-ai-review-consent">
							<input type="checkbox" checked={includeKnowledge}
								onChange={event => setIncludeKnowledge(event.target.checked)} />
							{t('studio.ai.includeKnowledge', {count: availableKnowledge.length})}
						</label>
						{includeKnowledge && <div className="passage-ai-review-knowledge">
							<p>{t('studio.ai.knowledgePreview')}</p>
							<ul>{availableKnowledge.map((entry, index) => <li key={index}>
								<strong>{entry.title}</strong> · {t(`studio.ai.knowledgeScope.${entry.scope}`)}
								{entry.note && <p>{entry.note}</p>}
							</li>)}</ul>
						</div>}
					</>}
					<button
						disabled={!availability?.configured || !consent || busy}
						onClick={() => void request('repair-format-syntax')}
						type="button"
					>
						{busy ? t('studio.ai.working') : t('studio.ai.request')}
					</button>
					<label>
						{t('studio.ai.conditionalRequest')}
						<textarea maxLength={500} value={conditionalRequest}
							onChange={event => setConditionalRequest(event.target.value)} />
					</label>
					<button disabled={!availability?.configured || !consent || busy || !conditionalRequest.trim() || !structuredSupported}
						onClick={() => void request('propose-conditional-choice')} type="button">
						{t('studio.ai.requestConditional')}
					</button>
					<button disabled={!availability?.configured || !consent || busy || !conditionalRequest.trim() || !structuredSupported}
						onClick={() => void request('propose-new-branch')} type="button">
						{t('studio.ai.requestBranch')}
					</button>
					<button disabled={!availability?.configured || !consent || busy || !conditionalRequest.trim() || !structuredSupported}
						onClick={() => void request('propose-two-way-branch')} type="button">
						{t('studio.ai.requestTwoWayBranch')}
					</button>
					{!structuredSupported && <p>{t('studio.ai.conditionalUnsupported')}</p>}
				</>
			)}
			{error && <p role="alert">{error}</p>}
			{proposal && snapshot && (
				<div className="passage-ai-review-proposal">
					<h4>{t('studio.ai.proposal')}</h4>
					<p>{proposal.summary}</p>
					<p>{proposal.operation.rationale}</p>
					{proposal.newPassage && <p>{t('studio.ai.newPassage', {name: proposal.newPassage.name})}</p>}
					{proposal.newPassages && <fieldset>
						<legend>{t('studio.ai.selectBranchChoices')}</legend>
						{proposal.newPassages.map(newPassage => <label key={newPassage.name}>
							<input type="checkbox"
								checked={selectedBranchNames.includes(newPassage.name)}
								onChange={event => {
									const checked = event.target.checked;
									setSelectedBranchNames(current => checked
										? [...current, newPassage.name]
										: current.filter(name => name !== newPassage.name));
								}} />
							{newPassage.label} → {t('studio.ai.newPassageShort', {name: newPassage.name})}
						</label>)}
					</fieldset>}
					{proposal.warnings.map((warning, index) => (
						<p key={index}>{warning}</p>
					))}
					<div className="passage-ai-review-diff">
						<div><h5>{t('studio.ai.before')}</h5><pre>{snapshot.text}</pre></div>
						<div><h5>{t('studio.ai.after')}</h5><pre>{reviewProposal?.operation.proposedText ?? snapshot.text}</pre></div>
					</div>
					{proposal.newPassages && !reviewProposal && <p role="status">{t('studio.ai.selectOneBranch')}</p>}
					{stale && <p role="alert">{t('studio.ai.stale')}</p>}
					<button disabled={stale || !reviewProposal} onClick={accept} type="button">
						{t('studio.ai.accept')}
					</button>
					<button onClick={() => setProposal(undefined)} type="button">
						{t('studio.ai.reject')}
					</button>
				</div>
			)}
			<button onClick={onClose} type="button">{t('common.close')}</button>
		</section>
	);
};
