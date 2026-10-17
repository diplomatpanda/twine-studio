import {expect, test} from '@playwright/test';
import {createServer} from 'http';
import {readFile} from 'fs/promises';

test('the original sample plays both endings without the editor or network', async ({
	browser
}) => {
	const html = await readFile('examples/the-last-signal.html', 'utf8');
	const server = createServer((_req, res) => {
		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		res.end(html);
	});
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
	try {
		for (const [choice, ending] of [
			['Answer the signal', 'The signal becomes a promise.'],
			['Turn it off', 'tomorrow belongs to you.']
		]) {
			const context = await browser.newContext();
			try {
				const page = await context.newPage();
				await page.goto(
					`http://127.0.0.1:${(server.address() as {port: number}).port}`
				);
				await expect(page.locator('tw-passage')).toContainText(
					'A radio whispers your name.'
				);
				await context.setOffline(true);
				await page.locator('tw-link').filter({hasText: choice}).click();
				await expect(page.locator('tw-passage')).toContainText(ending);
			} finally {
				await context.close();
			}
		}
	} finally {
		await new Promise<void>(resolve => server.close(() => resolve()));
	}
});

for (const scenario of [
	{format: 'Harlowe', version: '3.3.9', codeMirror: true},
	{format: 'Harlowe', version: '3.3.9', codeMirror: false},
	{format: 'SugarCube', version: '2.37.3', codeMirror: true}
]) {
	test(`choice to published ending: ${scenario.format}, enhanced editor ${scenario.codeMirror}`, async ({
		page,
		context
	}, testInfo) => {
		await page.addInitScript(scenario => {
			if (localStorage.getItem('twine-studio-prefs')) return;
			const prefs = {
				welcomeSeen: true,
				useCodeMirror: scenario.codeMirror,
				storyFormat: {name: scenario.format, version: scenario.version}
			};
			localStorage.setItem('twine-studio-prefs', Object.keys(prefs).join(','));
			for (const [name, value] of Object.entries(prefs)) {
				localStorage.setItem(
					`twine-studio-prefs-${name}`,
					JSON.stringify({name, value})
				);
			}
		}, scenario);
		await page.goto('http://127.0.0.1:5189');
		await page.getByRole('button', {name: 'New', exact: true}).click();
		await page.getByRole('textbox').fill('Signal choice test');
		await page.getByRole('button', {name: 'Create', exact: true}).click();
		await page
			.getByRole('button', {name: 'Untitled Passage', exact: true})
			.dblclick();
		await page
			.getByLabel('Passage Text', {exact: true})
			.type('The radio wakes.');
		// Deliberately open immediately after typing, inside the debounce window.
		await page.getByRole('button', {name: 'Add choice', exact: true}).click();
		await page
			.getByRole('textbox', {name: 'Choice text', exact: true})
			.fill('Answer the signal');
		await page.getByLabel('Destination passage', {exact: true}).fill('Answer');
		await page.screenshot({path: testInfo.outputPath('choice-form.png')});
		await page
			.getByRole('button', {name: 'Insert choice', exact: true})
			.click();
		await expect(page.getByLabel('Passage Text', {exact: true})).toBeFocused();
		const link =
			scenario.format === 'Harlowe'
				? '[[Answer the signal->Answer]]'
				: '[[Answer the signal|Answer]]';
		const editor = page.getByRole('dialog', {
			name: 'Untitled Passage',
			exact: true
		});
		if (scenario.codeMirror) {
			await expect(editor.locator('.CodeMirror-code')).toContainText(link);
			await page.getByLabel('Passage Text', {exact: true}).press('Control+z');
			await expect(editor.locator('.CodeMirror-code')).not.toContainText(link);
			await page.getByLabel('Passage Text', {exact: true}).press('Control+y');
			await expect(editor.locator('.CodeMirror-code')).toContainText(link);
		} else {
			await expect(page.getByLabel('Passage Text', {exact: true})).toHaveValue(
				`The radio wakes.\n\n${link}`
			);
		}
		await page.getByRole('button', {name: 'Close', exact: true}).click();
		if (!scenario.codeMirror) {
			await page.getByRole('button', {name: /^Undo/}).click();
			await expect(
				page.getByRole('button', {name: 'Answer', exact: true})
			).not.toBeVisible();
			await expect(
				page.getByRole('button', {name: 'Untitled Passage', exact: true})
			).toContainText('The radio wakes.');
			await page.getByRole('button', {name: /^Redo/}).click();
		}
		await page.getByRole('button', {name: 'Answer', exact: true}).dblclick();
		await page
			.getByLabel('Passage Text', {exact: true})
			.type('Tomorrow answers. The End.');
		await page.getByRole('button', {name: 'Close', exact: true}).click();
		await page.reload();
		await expect(
			page.getByRole('button', {name: 'Untitled Passage', exact: true})
		).toContainText('The radio wakes.');
		await expect(
			page.getByRole('button', {name: 'Answer', exact: true})
		).toContainText('Tomorrow answers.');
		await page.getByRole('tab', {name: 'Build', exact: true}).click();
		const downloadPromise = page.waitForEvent('download');
		await page
			.getByRole('button', {name: 'Publish to File', exact: true})
			.click();
		const download = await downloadPromise;
		const htmlPath = testInfo.outputPath('published.html');
		await download.saveAs(htmlPath);
		const html = await readFile(htmlPath, 'utf8');
		expect(html).toContain('The radio wakes.');
		expect(html).toContain('Tomorrow answers.');
		// A separate origin serves only the exported file, with no editor or app API.
		const server = createServer((_req, res) => {
			res.setHeader('Content-Type', 'text/html; charset=utf-8');
			res.end(html);
		});
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		const address = server.address() as {port: number};
		const player = await context.newPage();
		try {
			await player.goto(`http://127.0.0.1:${address.port}`);
			await player
				.locator(scenario.format === 'Harlowe' ? 'tw-link' : 'a.link-internal')
				.filter({hasText: 'Answer the signal'})
				.click();
			await expect(
				player.locator(
					scenario.format === 'Harlowe' ? 'tw-passage' : '.passage'
				)
			).toContainText('Tomorrow answers. The End.');
		} finally {
			await player.close();
			await new Promise<void>(resolve => server.close(() => resolve()));
		}
	});
}
