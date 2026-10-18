import {test, expect} from '@playwright/test';
import escape from 'lodash/escape';

test('authored preview scripts cannot read editor data or escape to the parent', async ({page, context}, testInfo) => {
	await context.route('**/preview-popup-check', route => route.fulfill({
		contentType: 'text/html',
		body: '<!doctype html><p>Sandbox popup</p>'
	}));
	const script = `
		window.previewProbe = {};
		for (const [name, attempt] of Object.entries({
			parentDocument: () => parent.document.body,
			parentStorage: () => parent.localStorage.clear(),
			parentBridge: () => parent.twineElectron,
			topNavigation: () => { top.location.href = 'about:blank#escaped'; }
		})) {
			try { attempt(); window.previewProbe[name] = 'accessible'; }
			catch { window.previewProbe[name] = 'blocked'; }
		}
		localStorage.setItem('twine-studio-preview-boundary', 'preview');
		sessionStorage.setItem('slot', 'temporary session');
	`;
	const fixture = `<tw-storydata name="Isolated preview" startnode="1" creator="Fixture"
		creator-version="1" ifid="1040C358-89CD-4272-93C7-E5DB7A47E12F"
		format="Snowman" format-version="2.1.4">
		<style role="stylesheet" type="text/twine-css"></style>
		<script role="script" type="text/twine-javascript">${script}</script>
		<tw-passagedata pid="1" name="Start" tags="" position="100,100" size="100,100">
			${escape('Preview is running. [[Next]] <a href="/preview-popup-check" target="_blank">Open popup</a> <a href="data:text/plain,preview%20save" download="preview-save.txt">Download save</a>')}
		</tw-passagedata>
		<tw-passagedata pid="2" name="Next" tags="" position="250,100" size="100,100">
			${escape('Saved value: <%= localStorage.getItem("twine-studio-preview-boundary") %>')}
		</tw-passagedata>
	</tw-storydata>`;
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.evaluate(() =>
		localStorage.setItem('twine-studio-preview-boundary', 'editor')
	);
	await page.getByRole('tab', {name: 'Library', exact: true}).click();
	await page.getByRole('button', {name: 'Import', exact: true}).click();
	await page.locator('input[type=file]').setInputFiles({
		name: 'isolated-preview.html',
		mimeType: 'text/html',
		buffer: Buffer.from(fixture)
	});
	await page.getByRole('button', {name: 'Isolated preview', exact: true}).dblclick();
	await page.getByRole('tab', {name: 'Build', exact: true}).click();
	const popup = page.waitForEvent('popup');
	await page.getByRole('button', {name: 'Play', exact: true}).click();
	const preview = await popup;
	const story = preview.frameLocator('iframe[title="Story preview"]');
	await expect(story.locator('body')).toContainText('Preview is running.');
	await expect(preview.getByRole('note')).toContainText('Preview saves are temporary');
	await preview.screenshot({path: testInfo.outputPath('isolated-preview.png')});
	const frame = preview.frames().find(frame => frame.parentFrame())!;
	expect(await frame.evaluate(() => (window as any).previewProbe)).toEqual({
		parentDocument: 'blocked',
		parentStorage: 'blocked',
		parentBridge: 'blocked',
		topNavigation: 'blocked'
	});
	expect(preview.url()).toContain('/play');
	expect(await page.evaluate(() =>
		localStorage.getItem('twine-studio-preview-boundary')
	)).toBe('editor');
	const nestedPopup = preview.waitForEvent('popup');
	await story.getByRole('link', {name: 'Open popup', exact: true}).click();
	const opened = await nestedPopup;
	await expect(opened.getByText('Sandbox popup')).toBeVisible();
	expect(await opened.evaluate(() => {
		try { return localStorage.getItem('twine-studio-preview-boundary'); }
		catch { return 'blocked'; }
	})).toBe('blocked');
	await opened.close();
	const download = preview.waitForEvent('download');
	await story.getByRole('link', {name: 'Download save', exact: true}).click();
	expect((await download).suggestedFilename()).toBe('preview-save.txt');
	await story.getByRole('link', {name: 'Next', exact: true}).click();
	await expect(story.locator('body')).toContainText('Saved value: preview');
	expect(await frame.evaluate(() => sessionStorage.getItem('slot'))).toBe('temporary session');
	await frame.evaluate(() => localStorage.setItem('preview-only-slot', 'saved'));
	await preview.reload();
	await expect(story.locator('body')).toContainText('Preview is running.');
	const reloadedFrame = preview.frames().find(frame => frame.parentFrame())!;
	expect(await reloadedFrame.evaluate(() => localStorage.getItem('preview-only-slot'))).toBeNull();
	await preview.close();
	for (const action of ['Test', 'Proof']) {
		const opening = page.waitForEvent('popup');
		await page.getByRole('button', {name: action, exact: true}).click();
		const launched = await opening;
		await expect(launched.frameLocator('iframe[title="Story preview"]').locator('body'))
			.toContainText('Preview is running.');
		await launched.close();
	}
});
