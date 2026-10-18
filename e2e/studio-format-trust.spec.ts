import {test, expect, Page} from '@playwright/test';

async function openFormats(page: Page) {
	await page.getByRole('tab', {name: 'Twine Studio', exact: true}).click();
	await page.getByRole('button', {name: 'Story Formats', exact: true}).click();
}

test('custom format code stays isolated until exact-source approval and loses approval after an update', async ({
	page,
	context
}, testInfo) => {
	let revision = 1;
	await context.route('**/custom-format.js*', route =>
		route.fulfill({
			contentType: 'text/javascript',
			body: `(() => {
			try { parent.localStorage.setItem('format-parent-escape', 'unsafe'); } catch (_) {}
			try { localStorage.setItem('format-wrapper', '${revision}'); } catch (_) {}
			window.storyFormat(${JSON.stringify({
				name: 'Custom Fixture',
				version: '1.0.0',
				author:
					"<strong>Safe author</strong><img src=x onerror=\"localStorage.setItem('format-xss','unsafe')\">",
				description: 'Format fixture',
				hydrate: `localStorage.setItem("format-hydrate", "${revision}");`,
				source:
					'<!doctype html><html><body><h1>Custom publication</h1>{{STORY_DATA}}</body></html>'
			})});
		})();`
		})
	);
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await openFormats(page);
	await page.getByRole('button', {name: 'Add', exact: true}).click();
	await page
		.locator('.add-format-button input')
		.fill('http://127.0.0.1:5189/custom-format.js');
	await page
		.locator('.add-format-button form')
		.getByRole('button', {name: 'Add', exact: true})
		.click();
	await page.screenshot({path: testInfo.outputPath('after-add.png')});
	const item = page
		.locator('.story-format-item')
		.filter({has: page.getByRole('heading', {name: 'Custom Fixture 1.0.0'})});
	await expect(item.getByText('Safe author')).toBeVisible();
	await expect(item.locator('.story-format-text img')).toHaveCount(0);
	const markers = () =>
		page.evaluate(() =>
			[
				'format-parent-escape',
				'format-wrapper',
				'format-hydrate',
				'format-xss'
			].map(key => localStorage.getItem(key))
		);
	expect(await markers()).toEqual([null, null, null, null]);
	await item
		.getByRole('button', {name: 'Use As Default Story Format', exact: true})
		.click();
	await page.getByRole('button', {name: 'Close', exact: true}).click();
	await page.getByRole('tab', {name: 'Story', exact: true}).click();
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Custom story');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	await page.getByRole('tab', {name: 'Build', exact: true}).click();
	const popup = page.waitForEvent('popup');
	await page.getByRole('button', {name: 'Play', exact: true}).click();
	const preview = await popup;
	await expect(
		preview
			.frameLocator('iframe[title="Story preview"]')
			.getByRole('heading', {name: 'Custom publication'})
	).toBeVisible();
	await preview.close();
	const download = page.waitForEvent('download');
	await page
		.getByRole('button', {name: 'Publish to File', exact: true})
		.click();
	await (await download).saveAs(testInfo.outputPath('custom.html'));
	expect(await markers()).toEqual([null, null, null, null]);
	await openFormats(page);
	await item
		.getByRole('button', {name: 'Trust editor code', exact: true})
		.click();
	await expect(
		item.getByText(
			'This format editor code can read and change all stories and desktop files. Trust it only if you trust the format source.'
		)
	).toBeVisible();
	await item
		.locator('.confirm-button .card')
		.getByRole('button', {name: 'Trust editor code', exact: true})
		.click();
	await expect(
		item.getByRole('button', {name: 'Revoke editor code trust', exact: true})
	).toBeVisible();
	expect(await markers()).toEqual(['unsafe', '1', '1', null]);
	await page.reload();
	await openFormats(page);
	await expect(
		item.getByRole('button', {name: 'Revoke editor code trust', exact: true})
	).toBeVisible();
	// A source change under the same name, version and URL requires fresh consent.
	revision = 2;
	await page.evaluate(() =>
		['format-parent-escape', 'format-wrapper', 'format-hydrate'].forEach(key =>
			localStorage.removeItem(key)
		)
	);
	await page.reload();
	await openFormats(page);
	await expect(
		item.getByRole('button', {name: 'Trust editor code', exact: true})
	).toBeVisible();
	expect(await markers()).toEqual([null, null, null, null]);
	await page.screenshot({path: testInfo.outputPath('format-trust.png')});
});

test('non-CORS JSONP formats remain usable without parent execution or editor approval', async ({
	page,
	context
}) => {
	await context.route('https://format-fixture.invalid/format.js*', route => {
		if (route.request().resourceType() === 'fetch') return route.abort();
		return route.fulfill({
			contentType: 'text/javascript',
			body: `
			try { parent.localStorage.setItem('jsonp-escape', 'unsafe'); } catch (_) {}
			window.storyFormat({name:'Legacy JSONP',version:'1.0.0',source:'<html>{{STORY_DATA}}</html>',editorCode:{sha256:'forged'}});
		`
		});
	});
	await page.goto('http://127.0.0.1:5189');
	const properties = await page.evaluate(async () => {
		// Test the same loader used by Add and publishing against a cross-origin host.
		const modulePath = '/src/util/story-format/fetch-properties.ts';
		const {fetchStoryFormatProperties} = await import(
			/* @vite-ignore */ modulePath
		);
		return fetchStoryFormatProperties(
			'https://format-fixture.invalid/format.js'
		);
	});
	expect(properties.name).toBe('Legacy JSONP');
	expect(properties.editorCode).toBeUndefined();
	expect(
		await page.evaluate(() => localStorage.getItem('jsonp-escape'))
	).toBeNull();
});
