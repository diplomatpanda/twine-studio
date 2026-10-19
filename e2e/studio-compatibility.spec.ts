import {test, expect} from '@playwright/test';
import {readFile} from 'fs/promises';
import {createServer} from 'http';
import escape from 'lodash/escape';

// These are preservation fixtures, not claims of full format-language coverage.
for (const format of [
	{
		name: 'Harlowe',
		version: '3.3.9',
		text: '(set: $answer to 42)Answer: (print: $answer)'
	},
	{
		name: 'SugarCube',
		version: '2.37.3',
		text: '<<set $answer = 42>>Answer: <<= $answer>>'
	},
	{
		name: 'Chapbook',
		version: '2.3.1',
		text: 'answer: 42\n--\nAnswer: {answer}'
	},
	{name: 'Snowman', version: '2.1.4', text: 'Answer: <%= 6 * 7 %>'}
]) {
	test(`preserves ${format.name} source, script and stylesheet through import/edit/export`, async ({
		page,
		context
	}, testInfo) => {
		const title = `Compatibility ${format.name}`;
		const script = 'window.fixtureMarker = "original script";';
		const css = 'body { --fixture-color: #abcdef; }';
		const fixture = `<tw-storydata name="${title}" startnode="1" creator="Fixture" creator-version="1" ifid="DA39B002-3690-4BCD-9CBE-09F7FDBE1860" format="${format.name}" format-version="${format.version}"><style role="stylesheet" type="text/twine-css">${css}</style><script role="script" type="text/twine-javascript">${script}</script><tw-passagedata pid="1" name="Start" tags="preserved" position="100,100" size="100,100">${escape(format.text)}</tw-passagedata></tw-storydata>`;
		await page.goto('http://127.0.0.1:5189');
		await page.getByRole('button', {name: 'Skip', exact: true}).click();
		await page.getByRole('tab', {name: 'Library', exact: true}).click();
		await page.getByRole('button', {name: 'Import', exact: true}).click();
		await page
			.locator('input[type=file]')
			.setInputFiles({
				name: 'fixture.html',
				mimeType: 'text/html',
				buffer: Buffer.from(fixture)
			});
		await page.getByRole('button', {name: title, exact: true}).dblclick();
		await page.getByRole('button', {name: 'Start', exact: true}).dblclick();
		const area = page.getByLabel('Passage Text', {exact: true});
		await area.press('Control+End');
		await area.type('\nA new sentence.');
		await page.getByRole('button', {name: 'Close', exact: true}).click();
		await page.getByRole('tab', {name: 'Build', exact: true}).click();
		const previewPromise = page.waitForEvent('popup');
		await page.getByRole('button', {name: 'Play', exact: true}).click();
		const preview = await previewPromise;
		try {
			const previewFrame = preview.frameLocator(
				'iframe[title="Story preview"]'
			);
			await expect(previewFrame.locator('body')).toContainText('Answer: 42');
			await expect(previewFrame.locator('body')).toContainText(
				'A new sentence.'
			);
			await expect(previewFrame.locator('tw-error, .error')).toHaveCount(0);
		} finally {
			await preview.close();
		}
		const downloadPromise = page.waitForEvent('download');
		await page
			.getByRole('button', {name: 'Publish to File', exact: true})
			.click();
		const download = await downloadPromise;
		const path = testInfo.outputPath('roundtrip.html');
		await download.saveAs(path);
		const html = await readFile(path, 'utf8');
		const preserved = await page.evaluate(html => {
			const doc = new DOMParser().parseFromString(html, 'text/html');
			return {
				text: doc.querySelector('tw-passagedata')?.textContent,
				tags: doc.querySelector('tw-passagedata')?.getAttribute('tags'),
				script: doc.querySelector('script[role=script]')?.textContent,
				css: doc.querySelector('style[role=stylesheet]')?.textContent
			};
		}, html);
		expect(preserved).toEqual({
			text: `${format.text}\nA new sentence.`,
			tags: 'preserved',
			script,
			css
		});
		const server = createServer((_req, res) => {
			res.setHeader('Content-Type', 'text/html; charset=utf-8');
			res.end(html);
		});
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		const player = await context.newPage();
		try {
			await player.goto(
				`http://127.0.0.1:${(server.address() as {port: number}).port}`
			);
			await expect(player.locator('body')).toContainText('Answer: 42');
			await expect(player.locator('body')).toContainText('A new sentence.');
			expect(
				await player.evaluate(
					() => (window as unknown as {fixtureMarker: string}).fixtureMarker
				)
			).toBe('original script');
			expect(
				await player.evaluate(() =>
					getComputedStyle(document.body)
						.getPropertyValue('--fixture-color')
						.trim()
				)
			).toBe('#abcdef');
			await expect(player.locator('tw-error, .error')).toHaveCount(0);
		} finally {
			await player.close();
			await new Promise<void>(resolve => server.close(() => resolve()));
		}
	});
}

test('preserves an advanced SugarCube project through an unrelated edit', async ({
	page, context
}, testInfo) => {
	const title = 'Advanced SugarCube Fixture';
	const script = `Macro.add('badge', {handler() {
		const span = document.createElement('span');
		span.className = 'story-badge';
		span.textContent = this.args[0];
		this.output.appendChild(span);
	}});`;
	const css = '.story-badge { color: rgb(12, 34, 56); font-weight: bold; }';
	const passages = [
		{name: 'StoryInit', pid: 1, tags: '', text: '<<set $trust = 2>>'},
		{name: 'Start', pid: 2, tags: 'chapter-one', text: '<<badge "Navigator">>\n[[Open archive|Archive]]\n[[Leave|Exit]]'},
		{name: 'Archive', pid: 3, tags: 'secret', text: '<<if $trust >= 2>>Archive unlocked.<</if>>\n[[Finish|Exit]]'},
		{name: 'Exit', pid: 4, tags: 'ending', text: 'Exit ending.'}
	];
	const passageMarkup = passages.map(passage =>
		`<tw-passagedata pid="${passage.pid}" name="${passage.name}" ` +
		`tags="${passage.tags}" position="${passage.pid * 100},100" size="100,100">` +
		`${escape(passage.text)}</tw-passagedata>`
	).join('');
	const fixture = [
		`<tw-storydata name="${title}" startnode="2" creator="Fixture" creator-version="1" ` +
			'ifid="C7EAA4D7-F999-41C8-AB38-C535A6827D51" format="SugarCube" format-version="2.37.3">',
		`<style role="stylesheet" type="text/twine-css">${css}</style>`,
		`<script role="script" type="text/twine-javascript">${script}</script>`,
		passageMarkup,
		'</tw-storydata>'
	].join('');
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('tab', {name: 'Library', exact: true}).click();
	await page.getByRole('button', {name: 'Import', exact: true}).click();
	await page.locator('input[type=file]').setInputFiles({
		name: 'advanced-sugarcube.html', mimeType: 'text/html', buffer: Buffer.from(fixture)
	});
	await page.getByRole('button', {name: title, exact: true}).dblclick();
	const exitCard = page.getByRole('button', {name: 'Exit', exact: true});
	await exitCard.click();
	await exitCard.dblclick();
	const editor = page.getByLabel('Passage Text', {exact: true});
	await editor.press('Control+End');
	await editor.type('\nAn unrelated edit.');
	await page.getByRole('button', {name: 'Close', exact: true}).click();
	await page.getByRole('tab', {name: 'Build', exact: true}).click();
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', {name: 'Publish to File', exact: true}).click();
	const download = await downloadPromise;
	const path = testInfo.outputPath('advanced-roundtrip.html');
	await download.saveAs(path);
	const html = await readFile(path, 'utf8');
	const preserved = await page.evaluate(html => {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		return {
			passages: Array.from(doc.querySelectorAll('tw-passagedata')).map(passage => ({
				name: passage.getAttribute('name'),
				tags: passage.getAttribute('tags'),
				text: passage.textContent
			})),
			script: doc.querySelector('script[role=script]')?.textContent,
			css: doc.querySelector('style[role=stylesheet]')?.textContent
		};
	}, html);
	expect(preserved).toEqual({
		passages: passages.map(passage => ({
			name: passage.name,
			tags: passage.tags,
			text: passage.text + (passage.name === 'Exit' ? '\nAn unrelated edit.' : '')
		})),
		script, css
	});
	const server = createServer((_req, res) => {
		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		res.end(html);
	});
	await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
	const player = await context.newPage();
	try {
		await player.goto(`http://127.0.0.1:${(server.address() as {port: number}).port}`);
		await expect(player.locator('.story-badge')).toHaveText('Navigator');
		await expect(player.locator('.story-badge')).toHaveCSS('color', 'rgb(12, 34, 56)');
		await player.getByRole('link', {name: 'Open archive', exact: true}).click();
		await expect(player.locator('.passage')).toContainText('Archive unlocked.');
		await player.getByRole('link', {name: 'Finish', exact: true}).click();
		await expect(player.locator('.passage')).toContainText('An unrelated edit.');
		await expect(player.locator('.error')).toHaveCount(0);
	} finally {
		await player.close();
		await new Promise<void>(resolve => server.close(() => resolve()));
	}
});
