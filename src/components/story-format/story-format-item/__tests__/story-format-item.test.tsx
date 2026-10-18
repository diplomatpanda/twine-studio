import {fireEvent, render, screen} from '@testing-library/react';
import {axe} from 'jest-axe';
import * as React from 'react';
import {
	fakeFailedStoryFormat,
	fakeLoadedStoryFormat,
	fakePendingStoryFormat
} from '../../../../test-util';
import {StoryFormatItem, StoryFormatItemProps} from '../story-format-item';

jest.mock('../story-format-item-details');

describe('<StoryFormatItem>', () => {
	function renderComponent(props?: Partial<StoryFormatItemProps>) {
		return render(
			<StoryFormatItem
				defaultFormat={false}
				editorExtensionsDisabled={false}
				format={fakeLoadedStoryFormat()}
				onChangeEditorCodeTrust={jest.fn()}
				onChangeEditorExtensionsDisabled={jest.fn()}
				onDelete={jest.fn()}
				onUseAsDefault={jest.fn()}
				onUseAsProofing={jest.fn()}
				proofingFormat={false}
				{...props}
			/>
		);
	}

	function fakePackagedStoryFormat() {
		return fakeLoadedStoryFormat({
			name: 'Harlowe',
			url: 'story-formats/harlowe-3.3.9/format.js',
			version: '3.3.9'
		});
	}

	it('shows a loading icon if the format is loading', () => {
		renderComponent({format: fakePendingStoryFormat()});
		expect(document.querySelector('.icon-loading')).toBeInTheDocument();
	});

	it('allows revoking approval even after approved code fails to load', () => {
		const onChangeEditorCodeTrust = jest.fn();
		renderComponent({
			onChangeEditorCodeTrust,
			format: fakeFailedStoryFormat({
				editorCodeTrust: {
					url: 'https://example.com/format.js',
					sha256: 'approved-source'
				}
			})
		});
		fireEvent.click(
			screen.getByRole('button', {
				name: 'components.storyFormatItem.revokeEditorCodeTrust'
			})
		);
		fireEvent.click(
			screen.getAllByRole('button', {
				name: 'components.storyFormatItem.revokeEditorCodeTrust'
			})[1]
		);
		expect(onChangeEditorCodeTrust).toHaveBeenCalledWith(false);
	});

	it('shows an error icon if the format failed to load', () => {
		renderComponent({format: fakeFailedStoryFormat()});
		expect(
			document.querySelector('.icon-tabler-alert-triangle')
		).toBeInTheDocument();
	});

	describe('when the format is loaded', () => {
		it('displays the format name and version', () => {
			renderComponent({format: fakeLoadedStoryFormat()});
			expect(
				screen.getByText('components.storyFormatItem.name')
			).toBeInTheDocument();
		});

		it("shows a badge if the format isn't user-added", () => {
			const format = fakeLoadedStoryFormat();

			format.userAdded = false;
			renderComponent({format});
			expect(
				screen.getByText('components.storyFormatItem.builtIn')
			).toBeInTheDocument();
		});

		it("doesn't show that badge if the format is user-added", () => {
			const format = fakeLoadedStoryFormat();

			format.userAdded = true;
			renderComponent({format});
			expect(
				screen.queryByText('components.storyFormatItem.builtIn')
			).not.toBeInTheDocument();
		});

		it('shows a badge if the format is the default format', () => {
			renderComponent({defaultFormat: true, format: fakeLoadedStoryFormat()});
			expect(
				screen.getByText('components.storyFormatItem.defaultFormat')
			).toBeInTheDocument();
		});

		it("doesn't show that badge if the format isn't the default format", () => {
			renderComponent({defaultFormat: false, format: fakeLoadedStoryFormat()});
			expect(
				screen.queryByText('components.storyFormatItem.defaultFormat')
			).not.toBeInTheDocument();
		});

		it('shows a badge if the format is a proofing format', () => {
			const format = fakeLoadedStoryFormat();

			(format as any).properties.proofing = true;
			renderComponent({format});
			expect(
				screen.getByText('components.storyFormatItem.proofing')
			).toBeInTheDocument();
		});

		it("doesn't show the same badge if the format is not proofing", () => {
			const format = fakeLoadedStoryFormat();

			(format as any).properties.proofing = false;
			renderComponent({format});
			expect(
				screen.queryByText('components.storyFormatItem.proofing')
			).not.toBeInTheDocument();
		});

		it('shows a badge if the format is the preferred proofing format', () => {
			const format = fakeLoadedStoryFormat();

			(format as any).properties.proofing = true;
			renderComponent({format, proofingFormat: true});
			expect(
				screen.getByText('components.storyFormatItem.proofingFormat')
			).toBeInTheDocument();
		});

		it("doesn't show the same badge if the format is not the preferred proofing format", () => {
			const format = fakeLoadedStoryFormat();

			(format as any).properties.proofing = true;
			renderComponent({format, proofingFormat: false});
			expect(
				screen.queryByText('components.storyFormatItem.proofingFormat')
			).not.toBeInTheDocument();
		});

		it('highlights itself if the format is the preferred proofing format', () => {
			const format = fakeLoadedStoryFormat();

			(format as any).properties.proofing = true;
			renderComponent({format, proofingFormat: true});
			expect(document.querySelector('.story-format-item')).toHaveClass(
				'highlighted'
			);
		});

		it('highlights itself if the format is the default format', () => {
			const format = fakeLoadedStoryFormat();

			(format as any).properties.proofing = false;
			renderComponent({format, defaultFormat: true});
			expect(document.querySelector('.story-format-item')).toHaveClass(
				'highlighted'
			);
		});

		it("doesn't highlight itself if the format is neither the proofing or default format", () => {
			renderComponent({format: fakeLoadedStoryFormat()});
			expect(document.querySelector('.story-format-item')).not.toHaveClass(
				'highlighted'
			);
		});

		it('shows format details', () => {
			renderComponent({format: fakeLoadedStoryFormat()});
			expect(
				screen.getByTestId('mock-story-format-item-details')
			).toBeInTheDocument();
		});

		it('shows a button that calls the onDelete prop if the format is user-added', () => {
			const onDelete = jest.fn();

			renderComponent({
				onDelete,
				format: fakeLoadedStoryFormat({userAdded: true})
			});
			expect(onDelete).not.toHaveBeenCalled();
			fireEvent.click(screen.getByRole('button', {name: 'common.delete'}));
			expect(onDelete).toHaveBeenCalledTimes(1);
		});

		it("doesn't show that button if the format isn't user-added", () => {
			renderComponent({format: fakeLoadedStoryFormat({userAdded: false})});
			expect(
				screen.queryByRole('button', {name: 'common.delete'})
			).not.toBeInTheDocument();
		});

		it('shows a trust control for custom editor code with a source hash', () => {
			const format = fakeLoadedStoryFormat(
				{url: 'https://example.com/custom-format.js', userAdded: true},
				{
					editorCode: {
						url: 'https://example.com/custom-format.js',
						source: 'window.storyFormat({});',
						sha256: 'abc123'
					}
				}
			);
			const onChangeEditorCodeTrust = jest.fn();
			renderComponent({format, onChangeEditorCodeTrust});

			const label = 'components.storyFormatItem.trustEditorCode';
			fireEvent.click(screen.getByRole('button', {name: label}));
			fireEvent.click(screen.getAllByRole('button', {name: label}).at(-1)!);

			expect(onChangeEditorCodeTrust).toHaveBeenCalledWith(true);
		});

		it('shows the revoke warning for trusted custom editor code', () => {
			const url = 'https://example.com/custom-format.js';
			const format = fakeLoadedStoryFormat(
				{url, userAdded: true, editorCodeTrust: {url, sha256: 'abc123'}},
				{
					editorCode: {url, source: 'window.storyFormat({});', sha256: 'abc123'}
				}
			);
			const onChangeEditorCodeTrust = jest.fn();
			renderComponent({format, onChangeEditorCodeTrust});

			const label = 'components.storyFormatItem.revokeEditorCodeTrust';
			fireEvent.click(screen.getByRole('button', {name: label}));
			expect(
				screen.getByText(
					'components.storyFormatItem.revokeEditorCodeTrustWarning'
				)
			).toBeInTheDocument();
			fireEvent.click(screen.getAllByRole('button', {name: label}).at(-1)!);

			expect(onChangeEditorCodeTrust).toHaveBeenCalledWith(false);
			expect(
				screen.getByRole('checkbox', {
					name: 'components.storyFormatItem.useEditorExtensions'
				})
			).toBeInTheDocument();
		});

		it('shows an approval status and no extensions checkbox for untrusted code', () => {
			const format = fakeLoadedStoryFormat(
				{url: 'https://example.com/custom-format.js', userAdded: true},
				{
					editorCode: {
						url: 'https://example.com/custom-format.js',
						source: 'window.storyFormat({});',
						sha256: 'abc123'
					}
				}
			);
			renderComponent({format});

			expect(
				screen.getByText('components.storyFormatItem.editorCodeUntrusted')
			).toBeInTheDocument();
			expect(
				screen.queryByRole('checkbox', {
					name: 'components.storyFormatItem.useEditorExtensions'
				})
			).not.toBeInTheDocument();
		});

		it('allows revoking approval when the source hash changes', () => {
			const url = 'https://example.com/custom-format.js';
			const format = fakeLoadedStoryFormat(
				{url, userAdded: true, editorCodeTrust: {url, sha256: 'old-hash'}},
				{
					editorCode: {
						url,
						source: 'window.storyFormat({});',
						sha256: 'new-hash'
					}
				}
			);
			const onChangeEditorCodeTrust = jest.fn();
			renderComponent({format, onChangeEditorCodeTrust});

			expect(
				screen.getByText('components.storyFormatItem.editorCodeChanged')
			).toBeInTheDocument();
			const trustLabel = 'components.storyFormatItem.trustEditorCode';
			fireEvent.click(screen.getByRole('button', {name: trustLabel}));
			fireEvent.click(
				screen.getAllByRole('button', {name: trustLabel}).at(-1)!
			);
			expect(onChangeEditorCodeTrust).toHaveBeenCalledWith(true);
			expect(
				screen.getByRole('button', {
					name: 'components.storyFormatItem.revokeEditorCodeTrust'
				})
			).toBeInTheDocument();
		});

		it('allows revoking approval when the source cannot be hashed', () => {
			const url = 'https://example.com/custom-format.js';
			const format = fakeLoadedStoryFormat(
				{url, userAdded: true, editorCodeTrust: {url, sha256: 'old-hash'}},
				{editorCode: {url, source: 'window.storyFormat({});'}}
			);
			const onChangeEditorCodeTrust = jest.fn();
			renderComponent({format, onChangeEditorCodeTrust});

			expect(
				screen.getByText('components.storyFormatItem.editorCodeUnverifiable')
			).toBeInTheDocument();
			const label = 'components.storyFormatItem.revokeEditorCodeTrust';
			fireEvent.click(screen.getByRole('button', {name: label}));
			fireEvent.click(screen.getAllByRole('button', {name: label}).at(-1)!);
			expect(onChangeEditorCodeTrust).toHaveBeenCalledWith(false);
		});

		it('does not show a trust control without a source hash', () => {
			const format = fakeLoadedStoryFormat(
				{url: 'https://example.com/custom-format.js', userAdded: true},
				{
					editorCode: {
						url: 'https://example.com/custom-format.js',
						source: 'window.storyFormat({});'
					}
				}
			);
			renderComponent({format});

			expect(
				screen.queryByRole('button', {
					name: 'components.storyFormatItem.trustEditorCode'
				})
			).not.toBeInTheDocument();
			expect(
				screen.getByText('components.storyFormatItem.editorCodeUnverifiable')
			).toBeInTheDocument();
			expect(
				screen.queryByRole('checkbox', {
					name: 'components.storyFormatItem.useEditorExtensions'
				})
			).not.toBeInTheDocument();
		});

		describe('When editor extensions for the format are enabled', () => {
			it('shows a checked checkbox', () => {
				renderComponent({
					editorExtensionsDisabled: false,
					format: fakePackagedStoryFormat()
				});
				expect(
					screen.getByRole('checkbox', {
						name: 'components.storyFormatItem.useEditorExtensions'
					})
				).toBeChecked();
			});

			it('calls the onChangeEditorExtensionsEnabled prop when clicked', () => {
				const onChangeEditorExtensionsDisabled = jest.fn();

				renderComponent({
					onChangeEditorExtensionsDisabled,
					editorExtensionsDisabled: false,
					format: fakePackagedStoryFormat()
				});
				expect(onChangeEditorExtensionsDisabled).not.toHaveBeenCalled();
				fireEvent.click(
					screen.getByRole('checkbox', {
						name: 'components.storyFormatItem.useEditorExtensions'
					})
				);
				expect(onChangeEditorExtensionsDisabled.mock.calls).toEqual([[true]]);
			});
		});

		describe('When editor extensions for the format are disabled', () => {
			it('shows an unchecked checkbox', () => {
				renderComponent({
					editorExtensionsDisabled: true,
					format: fakePackagedStoryFormat()
				});
				expect(
					screen.getByRole('checkbox', {
						name: 'components.storyFormatItem.useEditorExtensions'
					})
				).not.toBeChecked();
			});

			it('calls the onChangeEditorExtensionsEnabled prop when clicked', () => {
				const onChangeEditorExtensionsDisabled = jest.fn();

				renderComponent({
					onChangeEditorExtensionsDisabled,
					editorExtensionsDisabled: true,
					format: fakePackagedStoryFormat()
				});
				expect(onChangeEditorExtensionsDisabled).not.toHaveBeenCalled();
				fireEvent.click(
					screen.getByRole('checkbox', {
						name: 'components.storyFormatItem.useEditorExtensions'
					})
				);
				expect(onChangeEditorExtensionsDisabled.mock.calls).toEqual([[false]]);
			});
		});
	});

	it('is accessible', async () => {
		const {container} = renderComponent();

		expect(await axe(container)).toHaveNoViolations();
	});
});
