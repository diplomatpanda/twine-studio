import {render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import * as React from 'react';
import {StoryFormat} from '../../../../store/story-formats';
import {
	fakeFailedStoryFormat,
	fakeLoadedStoryFormat,
	fakePendingStoryFormat,
	fakeUnloadedStoryFormat
} from '../../../../test-util';
import {
	StoryFormatItemDetails,
	StoryFormatItemDetailsProps,
	sanitizeStoryFormatMetadata
} from '../story-format-item-details';

describe('<StoryFormatItemDetails>', () => {
	function renderComponent(props?: Partial<StoryFormatItemDetailsProps>) {
		return render(
			<StoryFormatItemDetails format={fakeLoadedStoryFormat()} {...props} />
		);
	}

	it('displays a loading message if the format is unloaded', () => {
		renderComponent({format: fakeUnloadedStoryFormat()});
		expect(
			screen.getByText('components.storyFormatItem.loadingFormat')
		).toBeInTheDocument();
	});

	it('displays a loading message if the format is loading', () => {
		renderComponent({format: fakePendingStoryFormat()});
		expect(
			screen.getByText('components.storyFormatItem.loadingFormat')
		).toBeInTheDocument();
	});

	it('displays an error message if the format failed to load', () => {
		renderComponent({format: fakeFailedStoryFormat()});
		expect(
			screen.getByText('components.storyFormatItem.loadError')
		).toBeInTheDocument();
	});

	describe('when the format is loaded', () => {
		let format: StoryFormat;

		beforeEach(() => {
			format = fakeLoadedStoryFormat();
			renderComponent({format});
		});

		it('displays the format author', () =>
			expect(
				screen.getByText('components.storyFormatItem.author')
			).toBeInTheDocument());

		it('displays the format description', () =>
			expect(
				screen.getByText((format as any).properties.description)
			).toBeInTheDocument());

		it('displays the format license', () =>
			expect(
				screen.getByText('components.storyFormatItem.license')
			).toBeInTheDocument());

		it('preserves basic formatting and safe links in metadata', () => {
			const description =
				'<p><strong>Safe</strong> <em>format</em> ' +
				'<a href="https://example.com">docs</a> ' +
				'<a href="http://example.com">http</a> ' +
				'<a href="mailto:test@example.com">email</a></p>';
			(format as any).properties.description = description;
			const {container} = renderComponent({format});

			expect(container.querySelector('strong')).toHaveTextContent('Safe');
			expect(container.querySelector('em')).toHaveTextContent('format');
			expect(
				Array.from(container.querySelectorAll('a')).map(link =>
					link.getAttribute('href')
				)
			).toEqual([
				'https://example.com',
				'http://example.com',
				'mailto:test@example.com'
			]);
		});

		it('removes scripts, event handlers, embeds, and dangerous links', () => {
			const description =
				'<img src="x" onerror="alert(1)">' +
				'<svg><script>alert(2)</script></svg>' +
				'<style>body { display: none }</style>' +
				'<iframe src="https://evil.example"></iframe>' +
				'<form><input></form>' +
				'<a href="javascript:alert(3)">unsafe</a>' +
				'<a href="data:text/html,unsafe">data</a>';
			(format as any).properties.description = description;
			const {container} = renderComponent({format});
			const metadata = container.querySelector('.story-format-description');

			expect(metadata?.querySelector('img')).toBeNull();
			expect(metadata?.querySelector('svg')).toBeNull();
			expect(metadata?.querySelector('script')).toBeNull();
			expect(metadata?.querySelector('style')).toBeNull();
			expect(metadata?.querySelector('iframe')).toBeNull();
			expect(metadata?.querySelector('form')).toBeNull();
			expect(metadata?.querySelector('[onerror]')).toBeNull();
			expect(metadata?.querySelector('a')?.getAttribute('href')).toBeNull();
		});

		it('sanitizes authored HTML passed through the translated author label', () => {
			expect(
				sanitizeStoryFormatMetadata(
					'<img src=x onerror=alert(1)><strong>Author</strong>'
				)
			).toBe('<strong>Author</strong>');
		});
	});

	it('is accessible', async () => {
		const {container} = renderComponent();

		expect(await axe(container)).toHaveNoViolations();
	});
});
