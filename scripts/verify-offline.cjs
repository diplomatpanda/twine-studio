/* Build first with npm run build:web. Uses a disposable browser profile. */
const {chromium, firefox, webkit, expect} = require('@playwright/test');
const {createServer} = require('node:http');
const {readFile} = require('node:fs/promises');
const path = require('node:path');

async function main() {
	const browserName = process.argv[2] || 'chromium';
	const browserType = {chromium, firefox, webkit}[browserName];
	if (!browserType)
		throw new Error('Browser must be chromium, firefox or webkit');
	const formatName = process.argv[3] || 'Harlowe';
	const formats = {
		Harlowe: {version: '3.3.9', text: 'Answer: 42'},
		SugarCube: {version: '2.37.3', text: '<<set $answer = 42>>Answer: <<= $answer>>'},
		Chapbook: {version: '2.3.1', text: 'answer: 42\n--\nAnswer: {answer}'},
		Snowman: {version: '2.1.4', text: 'Answer: <%= 6 * 7 %>'}
	};
	if (!formats[formatName])
		throw new Error('Format must be Harlowe, SugarCube, Chapbook or Snowman');
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
	let serverStopped = false;
	try {
		browser = await browserType.launch();
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
		if (formatName !== 'Harlowe') {
			await page.evaluate(format => {
				const prefs = {
					welcomeSeen: true,
					storyFormat: {name: format.name, version: format.version}
				};
				localStorage.setItem('twine-studio-prefs', Object.keys(prefs).join(','));
				for (const [name, value] of Object.entries(prefs))
					localStorage.setItem(`twine-studio-prefs-${name}`,
						JSON.stringify({name, value}));
			}, {name: formatName, version: formats[formatName].version});
		}
		if (browserName === 'chromium') {
			await context.setOffline(true);
		} else {
			// Firefox and WebKit's Playwright offline switch rejects a top-level
			// navigation before their service worker can serve it. Stopping the
			// server tests the user-visible disconnected-origin behavior instead.
			await new Promise(resolve => server.close(resolve));
			serverStopped = true;
		}
		await page.reload();
		await expect(
			page.getByRole('button', {name: 'New', exact: true})
		).toBeVisible();
		if (formatName !== 'Harlowe') {
			await page.getByRole('button', {name: 'New', exact: true}).click();
			await page.getByRole('textbox').fill(`Offline ${formatName}`);
			await page.getByRole('button', {name: 'Create', exact: true}).click();
			await page.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
			await page.getByLabel('Passage Text', {exact: true})
				.type(formats[formatName].text);
			await page.getByRole('button', {name: 'Close', exact: true}).click();
			await page.reload();
			await page.getByRole('tab', {name: 'Build', exact: true}).click();
			const previewPromise = page.waitForEvent('popup');
			await page.getByRole('button', {name: 'Play', exact: true}).click();
			const preview = await previewPromise;
			await expect(preview.frameLocator('iframe[title="Story preview"]')
				.locator('body')).toContainText('Answer: 42');
			await preview.close();
			const downloadPromise = page.waitForEvent('download');
			await page.getByRole('button', {name: 'Publish to File', exact: true})
				.click();
			const html = await readFile(await (await downloadPromise).path(), 'utf8');
			const publishedText = await page.evaluate(html =>
				new DOMParser().parseFromString(html, 'text/html')
					.querySelector('tw-passagedata')?.textContent, html);
			if (publishedText !== formats[formatName].text || !html.includes('tw-storydata'))
				throw new Error('Offline export missing format source');
			console.log(JSON.stringify({browser: browserName, format: formatName,
				offlineReload: true, createEditSaveReload: true,
				nativePreview: true, htmlExport: true}));
			return;
		}
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
		const previewFrame = preview.frameLocator('iframe[title="Story preview"]');
		await previewFrame
			.locator('tw-link')
			.filter({hasText: 'Finish'})
			.click();
		await expect(previewFrame.locator('tw-passage')).toContainText(
			'Saved offline. The End.'
		);
		await expect(previewFrame.locator('tw-error, .error')).toHaveCount(0);
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
				browser: browserName,
				format: formatName,
				offlineReload: true,
				createEditSaveReload: true,
				nativeHarlowePreview: true,
				htmlExport: true
			})
		);
	} finally {
		if (browser) await browser.close();
		if (!serverStopped)
			await new Promise(resolve => server.close(resolve));
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
