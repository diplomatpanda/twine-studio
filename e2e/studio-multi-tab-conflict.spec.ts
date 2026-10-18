import {expect, test, Page} from '@playwright/test';
import {readFile} from 'fs/promises';

function savedPassages(page: Page) {
	return page.evaluate(() => Object.keys(localStorage)
		.filter(key => key.startsWith('twine-studio-passages-'))
		.map(key => localStorage.getItem(key))
		.join('\n'));
}

test('a stale editor tab preserves its draft without overwriting another tab', async ({page, context}, testInfo) => {
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Shared story');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	await page.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	const staleTab = await context.newPage();
	await staleTab.goto('http://127.0.0.1:5189');
	await staleTab.getByRole('button', {name: 'Shared story', exact: true}).dblclick();
	await staleTab.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	await staleTab.getByLabel('Passage Text', {exact: true}).type('Writer A saved sentence.');
	await staleTab.getByRole('button', {name: 'Close', exact: true}).click();
	await expect.poll(() => savedPassages(page)).toContain('Writer A saved sentence.');
	await page.getByLabel('Passage Text', {exact: true}).type('Writer B local draft.');
	const warning = page.getByRole('alert').filter({hasText: 'Another tab changed saved stories'});
	await expect(warning).toBeVisible();
	await page.getByLabel('Passage Text', {exact: true}).type(' Final unsaved tail.');
	await page.screenshot({path: testInfo.outputPath('conflict-warning.png')});
	await expect.poll(() => savedPassages(page))
		.toContain('Writer A saved sentence.');
	expect(await savedPassages(page))
		.not.toContain('Writer B local draft.');
	const downloadPromise = page.waitForEvent('download');
	await warning.getByRole('button', {name: 'Export story backup'}).click();
	const download = await downloadPromise;
	const backup = await readFile((await download.path())!, 'utf8');
	expect(backup).toContain('Writer B local draft.');
	expect(backup).toContain('Final unsaved tail.');
});

test('two tabs can save different stories', async ({page, context}) => {
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	for (const name of ['North', 'South']) {
		await page.getByRole('button', {name: 'New', exact: true}).click();
		await page.getByRole('textbox').fill(name);
		await page.getByRole('button', {name: 'Create', exact: true}).click();
		await page.getByRole('button', {name: 'Back', exact: true}).click();
	}
	const other = await context.newPage();
	await other.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'North', exact: true}).dblclick();
	await other.getByRole('button', {name: 'South', exact: true}).dblclick();
	await page.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	await other.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	await page.getByLabel('Passage Text', {exact: true}).type('North story text.');
	await page.getByRole('button', {name: 'Close', exact: true}).click();
	await other.getByLabel('Passage Text', {exact: true}).type('South story text.');
	await other.getByRole('button', {name: 'Close', exact: true}).click();
	await expect.poll(() => savedPassages(page)).toContain('North story text.');
	await expect.poll(() => savedPassages(page)).toContain('South story text.');
	await expect(page.getByRole('alert').filter({hasText: 'Another tab changed saved stories'}))
		.toHaveCount(0);
	await expect(other.getByRole('alert').filter({hasText: 'Another tab changed saved stories'}))
		.toHaveCount(0);
});
