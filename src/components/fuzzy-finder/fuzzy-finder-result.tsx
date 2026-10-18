import {IconChevronsRight} from '@tabler/icons';
import classNames from 'classnames';
import * as React from 'react';
import './fuzzy-finder-result.css';

export interface FuzzyFinderResultProps {
	detail: string;
	heading: string;
	onClick: () => void;
	selected?: boolean;
}

export const FuzzyFinderResult = React.forwardRef<
	HTMLButtonElement,
	FuzzyFinderResultProps
>((props, ref) => {
	const {detail, heading, onClick, selected} = props;

	return (
		<button
			className={classNames('fuzzy-finder-result', {selected})}
			aria-current={selected ? 'true' : undefined}
			onClick={onClick}
			ref={ref}
		>
			<IconChevronsRight />
			<span className="heading">{heading}</span>
			<span className="detail">{detail}</span>
		</button>
	);
});

FuzzyFinderResult.displayName = 'FuzzyFinderResult';
