/* Build first with npm run build:web. Uses a disposable browser profile. */
const {chromium, expect} = require('@playwright/test');
const {createServer} = require('node:http');
const {readFile} = require('node:fs/promises');
const path = require('node:path');

async function main() {
	const root = path.resolve(__dirname, '../dist/web');
	const server = createServer(async (req, res) => {
		try {
			const pathname = decodeURIComponent(
				new URL(req.url, 'http://local').pathname
			);
			const file = path.resolve(
				root,
				`.${pathname === '/' ? '/index.html' : pathname}`
			);
			if (!file.startsWith(root + path.sep)) {
				res.writeHead(403).end();
				return;
			}
			const contentTypes = {
				'.html': 'text/html',
				'.js': 'application/javascript',
				'.css': 'text/css',
				'.json': 'application/json',
				'.svg': 'image/svg+xml',
				'.webmanifest': 'application/manifest+json'
			};
			res.setHeader(
				'Content-Type',
				contentTypes[path.extname(file)] || 'application/octet-stream'
			);
			res.end(await readFile(file));
		} catch {
			res.writeHead(404).end();
		}
	});
	await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
	let browser;
	try {
		browser = await chromium.launch();
		const context = await browser.newContext();
		const page = await context.newPage();
		page.on('console', message => {
			if (message.type() === 'error') console.error(message.text());
		});
		await page.goto(`http://127.0.0.1:${server.address().port}`);
		await page.getByRole('button', {name: 'Skip', exact: true}).click();
		await page.evaluate(async () => {
			await Promise.race([
				navigator.serviceWorker.ready,
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error('Service worker did not become ready')),
						15000
					)
				)
			]);
		});
		await page.waitForFunction(() =>
			Boolean(navigator.serviceWorker.controller)
		);
		await context.setOffline(true);
		await page.reload();
		await expect(
			page.getByRole('button', {name: 'New', exact: true})
		).toBeVisible();
		await page.getByRole('button', {name: 'New', exact: true}).click();
		await page.getByRole('textbox').fill('Offline draft');
		await page.getByRole('button', {name: 'Create', exact: true}).click();
		await page
			.getByRole('button', {name: 'Untitled Passage', exact: true})
			.dblclick();
		await page
			.getByLabel('Passage Text', {exact: true})
			.type('Written offline. [[Finish->Ending]]');
		await page.getByRole('button', {name: 'Close', exact: true}).click();
		await page.getByRole('button', {name: 'Ending', exact: true}).dblclick();
		await page
			.getByLabel('Passage Text', {exact: true})
			.type('Saved offline. The End.');
		await page.getByRole('button', {name: 'Close', exact: true}).click();
		await page.reload();
		await expect(
			page.getByRole('button', {name: 'Ending', exact: true})
		).toContainText('Saved offline.');
		await page.getByRole('tab', {name: 'Build', exact: true}).click();
		const previewPromise = page.waitForEvent('popup');
		await page.getByRole('button', {name: 'Play', exact: true}).click();
		const preview = await previewPromise;
		await preview.locator('tw-link').filter({hasText: 'Finish'}).click();
		await expect(preview.locator('tw-passage')).toContainText(
			'Saved offline. The End.'
		);
		await preview.close();
		const downloadPromise = page.waitForEvent('download');
		await page
			.getByRole('button', {name: 'Publish to File', exact: true})
			.click();
		const download = await downloadPromise;
		const html = await readFile(await download.path(), 'utf8');
		if (
			!html.includes('Saved offline. The End.') ||
			!html.includes('tw-storydata')
		)
			throw new Error('Offline export missing story');
		console.log(
			JSON.stringify({
				offlineReload: true,
				createEditSaveReload: true,
				nativeHarlowePreview: true,
				htmlExport: true
			})
		);
	} finally {
		if (browser) await browser.close();
		await new Promise(resolve => server.close(resolve));
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
