import {v4 as uuid} from '@lukeed/uuid';
import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {
	canApplyPassageEdit,
	parseConditionalChoiceProposal,
	parsePassageEditProposal,
	PassageEditProposal,
	PassageEditSnapshot
} from '../../ai/passage-edit-proposal';
import {TwineElectronWindow} from '../../electron/shared/electron-shared.types';
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
	const [conditionalRequest, setConditionalRequest] = React.useState('');
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState('');
	const [proposal, setProposal] = React.useState<PassageEditProposal>();
	const [snapshot, setSnapshot] = React.useState<PassageEditSnapshot>();
	const sessionId = React.useRef(uuid());
	const requestGeneration = React.useRef(0);

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

	async function request(instruction: 'repair-format-syntax' | 'propose-conditional-choice') {
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
		if (instruction === 'propose-conditional-choice' && !conditionalRequest.trim()) return;
		const generation = ++requestGeneration.current;
		const source: PassageEditSnapshot = {
			storyId: story.id,
			passageId: passage.id,
			storyFormat: story.storyFormat,
			storyFormatVersion: story.storyFormatVersion,
			text: passage.text
		};
		setSnapshot(source);
		setProposal(undefined);
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
				instruction,
				...(instruction === 'propose-conditional-choice' ? {
					request: conditionalRequest.trim(),
					destinations: story.passages.slice(0, 100).map(({id, name}) => ({id, name}))
				} : {})
			});
			if (generation === requestGeneration.current) {
				setProposal(instruction === 'repair-format-syntax'
					? parsePassageEditProposal(raw, source)
					: parseConditionalChoiceProposal(raw, source, story));
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
		if (!snapshot || !proposal) return;
		if (!canApplyPassageEdit(snapshot, story, passage, proposal)) {
			setError(t('studio.ai.stale'));
			setProposal(undefined);
			return;
		}
		dispatch(
			updatePassage(
				story,
				passage,
				{text: proposal.operation.proposedText},
				{dontUpdateOthers: true}
			),
			'studio.ai.undo'
		);
		onClose();
	}

	const stale = !!snapshot && !canApplyPassageEdit(snapshot, story, passage, proposal);
	const conditionalSupported = supportsChoiceBuilder(story.storyFormat, story.storyFormatVersion);

	return (
		<section className="passage-ai-review" aria-label={t('studio.ai.title')}>
			<h3>{t('studio.ai.title')}</h3>
			<p>{t('studio.ai.help')}</p>
			{!bridge?.requestAiPassageEdit ? (
				<p>{t('studio.ai.desktopOnly')}</p>
			) : availability && !availability.configured ? (
				<p>{availability.reason || t('studio.ai.setup')}</p>
			) : (
				<>
					<p>{t('studio.ai.model', {model: availability?.model ?? '…'})}</p>
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
					<button disabled={!availability?.configured || !consent || busy || !conditionalRequest.trim() || !conditionalSupported}
						onClick={() => void request('propose-conditional-choice')} type="button">
						{t('studio.ai.requestConditional')}
					</button>
					{!conditionalSupported && <p>{t('studio.ai.conditionalUnsupported')}</p>}
				</>
			)}
			{error && <p role="alert">{error}</p>}
			{proposal && snapshot && (
				<div className="passage-ai-review-proposal">
					<h4>{t('studio.ai.proposal')}</h4>
					<p>{proposal.summary}</p>
					<p>{proposal.operation.rationale}</p>
					{proposal.warnings.map((warning, index) => (
						<p key={index}>{warning}</p>
					))}
					<div className="passage-ai-review-diff">
						<div><h5>{t('studio.ai.before')}</h5><pre>{snapshot.text}</pre></div>
						<div><h5>{t('studio.ai.after')}</h5><pre>{proposal.operation.proposedText}</pre></div>
					</div>
					{stale && <p role="alert">{t('studio.ai.stale')}</p>}
					<button disabled={stale} onClick={accept} type="button">
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
