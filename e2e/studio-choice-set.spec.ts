import {expect, test} from '@playwright/test';
import {createServer} from 'http';
import {readFile} from 'fs/promises';

for (const scenario of [
	{format: 'Harlowe', version: '3.3.9', codeMirror: true},
	{format: 'Harlowe', version: '3.3.9', codeMirror: false},
	{format: 'SugarCube', version: '2.37.3', codeMirror: true}
]) {
	test(`choice set publishes two routes: ${scenario.format}, enhanced editor ${scenario.codeMirror}`, async ({page, context}, testInfo) => {
		test.setTimeout(60000);
		await page.addInitScript(selected => {
			if (localStorage.getItem('twine-studio-prefs')) return;
			const prefs = {
				welcomeSeen: true,
				useCodeMirror: selected.codeMirror,
				storyFormat: {name: selected.format, version: selected.version}
			};
			localStorage.setItem('twine-studio-prefs', Object.keys(prefs).join(','));
			for (const [name, value] of Object.entries(prefs)) {
				localStorage.setItem(`twine-studio-prefs-${name}`, JSON.stringify({name, value}));
			}
		}, scenario);
		await page.setViewportSize({width: 375, height: 900});
		await page.goto('http://127.0.0.1:5189');
		await page.getByRole('button', {name: 'New', exact: true}).click();
		await page.getByRole('textbox').fill('Two roads');
		await page.getByRole('button', {name: 'Create', exact: true}).click();
		await page.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
		await page.getByLabel('Passage Text', {exact: true}).type('Choose a road.');
		await page.getByRole('button', {name: 'Add choice', exact: true}).click();
		await page.getByRole('button', {name: 'Add another choice'}).click();
		const labels = page.getByRole('textbox', {name: 'Choice text', exact: true});
		const destinations = page.getByLabel('Destination passage', {exact: true});
		await labels.nth(0).fill('Enter the forest');
		await destinations.nth(0).fill('Forest');
		await labels.nth(1).fill('Follow the river');
		await destinations.nth(1).fill('River');
		await page.screenshot({path: testInfo.outputPath('choice-set-375.png')});
		await page.getByRole('button', {name: 'Insert choices'}).click();
		const firstLink = scenario.format === 'Harlowe'
			? '[[Enter the forest->Forest]]' : '[[Enter the forest|Forest]]';
		const secondLink = scenario.format === 'Harlowe'
			? '[[Follow the river->River]]' : '[[Follow the river|River]]';
		const text = `Choose a road.\n\n${firstLink}\n${secondLink}`;
		const editor = page.getByRole('dialog', {name: 'Untitled Passage', exact: true});
		if (scenario.codeMirror) {
			await expect(editor.locator('.CodeMirror-code')).toContainText(firstLink);
			await expect(editor.locator('.CodeMirror-code')).toContainText(secondLink);
			await page.getByLabel('Passage Text', {exact: true}).press('Control+z');
			await expect(editor.locator('.CodeMirror-code')).not.toContainText(firstLink);
			await expect(editor.locator('.CodeMirror-code')).not.toContainText(secondLink);
			await page.getByLabel('Passage Text', {exact: true}).press('Control+y');
			await expect(editor.locator('.CodeMirror-code')).toContainText(secondLink);
		} else {
			await expect(page.getByLabel('Passage Text', {exact: true})).toHaveValue(text);
		}
		await page.getByRole('button', {name: 'Close', exact: true}).click();
		if (!scenario.codeMirror) {
			await expect(editor).not.toBeVisible();
			await page.screenshot({path: testInfo.outputPath('after-close-375.png')});
			const undo = page.getByRole('button', {name: /^Undo/});
			await page.getByRole('button', {name: 'More toolbar controls'}).click({timeout: 5000});
			await expect(page.getByRole('button', {name: 'Earlier toolbar controls'})).toBeVisible();
			const undoBounds = await undo.boundingBox();
			expect(undoBounds && undoBounds.x + undoBounds.width).toBeLessThanOrEqual(375);
			await undo.click();
			await expect(page.getByRole('button', {name: 'Forest', exact: true})).not.toBeVisible();
			await expect(page.getByRole('button', {name: 'River', exact: true})).not.toBeVisible();
			await page.getByRole('button', {name: /^Redo/}).click();
		}
		for (const [name, ending] of [
			['Forest', 'The forest keeps the secret.'],
			['River', 'The river carries the answer.']
		]) {
			await page.getByRole('button', {name, exact: true}).dblclick();
			await page.getByLabel('Passage Text', {exact: true}).type(ending);
			await page.getByRole('button', {name: 'Close', exact: true}).click();
		}
		await page.reload();
		await expect(page.getByRole('button', {name: 'Forest', exact: true})).toContainText('The forest keeps the secret.');
		await expect(page.getByRole('button', {name: 'River', exact: true})).toContainText('The river carries the answer.');
		await page.getByRole('tab', {name: 'Build', exact: true}).click();
		const downloadPromise = page.waitForEvent('download');
		await page.getByRole('button', {name: 'Publish to File', exact: true}).click();
		const download = await downloadPromise;
		const htmlPath = testInfo.outputPath('choice-set-published.html');
		await download.saveAs(htmlPath);
		const html = await readFile(htmlPath, 'utf8');
		expect(html).toContain('Enter the forest');
		expect(html).toContain('Follow the river');
		const server = createServer((_request, response) => {
			response.setHeader('Content-Type', 'text/html; charset=utf-8');
			response.end(html);
		});
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		try {
			const port = (server.address() as {port: number}).port;
			for (const [choice, ending] of [
				['Enter the forest', 'The forest keeps the secret.'],
				['Follow the river', 'The river carries the answer.']
			]) {
				const player = await context.newPage();
				try {
					await player.goto(`http://127.0.0.1:${port}`);
					await player.locator(scenario.format === 'Harlowe' ? 'tw-link' : 'a.link-internal')
						.filter({hasText: choice}).click();
					await expect(player.locator(scenario.format === 'Harlowe' ? 'tw-passage' : '.passage')).toContainText(ending);
				} finally {
					await player.close();
				}
			}
		} finally {
			await new Promise<void>(resolve => server.close(() => resolve()));
		}
	});
}
