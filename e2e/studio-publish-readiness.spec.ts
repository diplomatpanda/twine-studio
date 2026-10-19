import {expect, test} from '@playwright/test';
import {readFile} from 'fs/promises';

test('publish preflight opens a broken source and allows publishing after repair', async ({page}, testInfo) => {
	await page.addInitScript(() => {
		localStorage.setItem('twine-studio-prefs', 'welcomeSeen,useCodeMirror');
		localStorage.setItem('twine-studio-prefs-welcomeSeen', JSON.stringify({name: 'welcomeSeen', value: true}));
		localStorage.setItem('twine-studio-prefs-useCodeMirror', JSON.stringify({name: 'useCodeMirror', value: false}));
	});
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Publish readiness test');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	await page.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	const editor = page.getByRole('dialog', {name: 'Untitled Passage', exact: true});
	await page.getByLabel('Passage Text', {exact: true}).fill('[[Missing Door]]');
	await editor.getByRole('button', {name: 'Close', exact: true}).click();
	await expect(editor).not.toBeVisible();
	// The editor creates a destination for a newly typed link. Removing that
	// destination models a story with a stale link after deletion or import.
	await page.getByRole('button', {name: 'Missing Door', exact: true}).click();
	await page.getByRole('tab', {name: 'Passage', exact: true}).click();
	await page.getByRole('button', {name: 'Delete', exact: true}).click();
	await expect(page.getByRole('button', {name: 'Missing Door', exact: true})).not.toBeVisible();
	await page.getByRole('tab', {name: 'Build', exact: true}).click();
	await page.getByRole('button', {name: 'Publish to File', exact: true}).click();
	const warning = page.getByRole('dialog', {name: 'Check links before publishing'});
	await expect(warning).toBeVisible();
	await expect(warning).toContainText('1 link points to a passage that does not exist yet.');
	await expect(warning).toContainText('Untitled Passage → Missing Door');
	if (testInfo.project.name === 'chromium') {
		await page.setViewportSize({width: 375, height: 812});
		await page.screenshot({path: testInfo.outputPath('publish-warning-375px.png')});
	}
	const overrideDownload = page.waitForEvent('download');
	await warning.getByRole('button', {name: 'Publish anyway'}).click();
	await overrideDownload;
	await expect(warning).not.toBeVisible();
	await page.getByRole('button', {name: 'Publish to File', exact: true}).click();
	await expect(warning).toBeVisible();
	await warning.getByRole('button', {name: 'Edit Untitled Passage'}).click();
	await expect(warning).not.toBeVisible();
	await expect(page.getByRole('dialog', {name: 'Untitled Passage', exact: true})).toBeVisible();
	await page.getByLabel('Passage Text', {exact: true}).fill('The story ends here.');
	await editor.getByRole('button', {name: 'Close', exact: true}).click();
	await expect(editor).not.toBeVisible();
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', {name: 'Publish to File', exact: true}).click();
	const download = await downloadPromise;
	const htmlPath = testInfo.outputPath('repaired-story.html');
	await download.saveAs(htmlPath);
	const html = await readFile(htmlPath, 'utf8');
	expect(html).toContain('The story ends here.');
	await expect(warning).not.toBeVisible();
});
