import {IconX} from '@tabler/icons';
import classnames from 'classnames';
import * as React from 'react';
import {Card} from '../container/card';
import {IconButton} from '../control/icon-button';
import {TextInput} from '../control/text-input';
import {FuzzyFinderResult, FuzzyFinderResultProps} from './fuzzy-finder-result';
import './fuzzy-finder.css';

export interface FuzzyFinderProps {
	noResultsText: string;
	onChangeSearch: (value: string) => void;
	onClose: () => void;
	onSelectResult: (index: number) => void;
	prompt: string;
	results: Omit<FuzzyFinderResultProps, 'onClick'>[];
	search: string;
}

export const FuzzyFinder: React.FC<FuzzyFinderProps> = props => {
	const {
		noResultsText,
		onChangeSearch,
		onClose,
		onSelectResult,
		prompt,
		search,
		results
	} = props;
	const [selectedResult, setSelectedResult] = React.useState(0);
	const containerRef = React.useRef<HTMLDivElement>(null);
	const inputRef = React.useRef<HTMLInputElement>(null);
	const resultRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
	const returnFocusRef = React.useRef<HTMLElement | null>(null);

	function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) {
			return;
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			onClose();
			return;
		}

		if (event.target !== inputRef.current) {
			return;
		}

		if (event.nativeEvent.isComposing) {
			return;
		}

		const key = event.key;
		if (key === 'Enter') {
			if (results[selectedResult]) {
				event.preventDefault();
				onSelectResult(selectedResult);
			}
			return;
		}

		if (key !== 'ArrowUp' && key !== 'ArrowDown') {
			return;
		}

		event.preventDefault();
		setSelectedResult(value => {
			if (results.length === 0) return 0;
			if (key === 'ArrowUp') {
				return value === 0 ? results.length - 1 : value - 1;
			}
			return value >= results.length - 1 ? 0 : value + 1;
		});
	}

	React.useEffect(() => {
		setSelectedResult(0);
	}, [search]);

	React.useEffect(() => {
		setSelectedResult(value =>
			results.length === 0 ? 0 : Math.min(value, results.length - 1)
		);
	}, [results.length]);

	React.useEffect(() => {
		resultRefs.current[selectedResult]?.scrollIntoView?.({block: 'nearest'});
	}, [results, selectedResult]);

	React.useEffect(() => {
		// Automatically focus the search input on mount.
		//
		// This timeout is needed to avoid stealing focus too early. If this
		// component is mounted in reaction to a hotkey, the input will receive the
		// hotkey input.

		const timeout = window.setTimeout(() => {
			if (containerRef.current) {
				containerRef.current.querySelector('input')?.focus();
			}
		}, 0);

		return () => window.clearTimeout(timeout);
	}, []);

	React.useEffect(() => {
		returnFocusRef.current =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;

		return () => {
			const activeElement = document.activeElement;
			if (
				(activeElement === document.body ||
					containerRef.current?.contains(activeElement)) &&
				returnFocusRef.current
			) {
				returnFocusRef.current.focus();
			}
		};
	}, []);

	return (
		<div className="fuzzy-finder" onKeyDown={handleKeyDown} ref={containerRef}>
			<div
				aria-atomic="true"
				aria-live="polite"
				className="screen-reader-only"
				role="status"
			>
				{results[selectedResult]?.heading ?? ''}
			</div>
			<Card>
				<div className="search">
					<TextInput
						onChange={event => onChangeSearch(event.target.value)}
						ref={inputRef}
						value={search}
					>
						{prompt}
					</TextInput>
					<IconButton
						icon={<IconX />}
						iconOnly
						label="Close"
						onClick={onClose}
						tooltipPosition="bottom"
					/>
				</div>
				<div
					className={classnames('results', {'has-results': results.length > 0})}
				>
					{search.trim().length > 0 && results.length === 0 && (
						<div className="no-results">{noResultsText}</div>
					)}
					{results.length > 0 && (
						<ol>
							{results.map((props, index) => (
								<li key={`${props.heading}-${index}`}>
									<FuzzyFinderResult
										{...props}
										onClick={() => onSelectResult(index)}
										ref={element => {
											resultRefs.current[index] = element;
										}}
										selected={index === selectedResult}
									/>
								</li>
							))}
						</ol>
					)}
				</div>
			</Card>
		</div>
	);
};
