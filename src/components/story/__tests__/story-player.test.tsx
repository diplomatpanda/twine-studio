import * as React from 'react';
import {render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import {StoryPlayer} from '../story-player';

describe('StoryPlayer', () => {
	it('confines authored HTML to an opaque sandbox with no top navigation or escaping popups', () => {
		render(<StoryPlayer html="<script>window.authored = true;</script>" />);
		const player = screen.getByTitle('components.storyPlayer.title');
		expect(player).toHaveAttribute(
			'sandbox',
			'allow-scripts allow-forms allow-modals allow-popups allow-downloads'
		);
		expect(player).toHaveAttribute('srcdoc', expect.stringContaining('window.authored'));
		expect(screen.getByRole('note')).toHaveTextContent('components.storyPlayer.temporarySaves');
	});

	it('has an accessible notice and frame title', async () => {
		const {container} = render(<StoryPlayer html="<p>Story</p>" />);
		expect(await axe(container)).toHaveNoViolations();
	});
});
