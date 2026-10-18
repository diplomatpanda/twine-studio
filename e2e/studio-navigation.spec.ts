import {test, expect} from '@playwright/test';

function largeStoryFixture() {
	const passages = Array.from({length: 240}, (_, index) => {
		const name = index === 239 ? 'A very long passage title that must remain usable at tablet width' : `P${String(index).padStart(3, '0')}`;
		const destination = index === 238 ? 'A very long passage title that must remain usable at tablet width' : `P${String(index + 1).padStart(3, '0')}`;
		const tags = index === 119 ? 'tag-special proof' : index % 2 === 0 ? 'even' : 'odd';
		return `<tw-passagedata pid="${index + 1}" name="${name}" tags="${tags}" position="${(index % 20) * 140},${Math.floor(index / 20) * 140}" size="100,100">Passage ${index}.${index < 239 ? ` [[${destination}]]` : ' The End.'}</tw-passagedata>`;
	}).join('');
	return `<tw-storydata name="Navigation fixture" startnode="1" creator="Fixture" creator-version="1" ifid="A4E8AA4C-8C5F-47B7-B4EE-99BAA1A44B44" format="Harlowe" format-version="3.3.9">${passages}</tw-storydata>`;
}

test('Go To lists, searches, selects and resets without breaking editing', async ({page}, testInfo) => {
	test.setTimeout(60000);
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.setViewportSize({width: 768, height: 1024});
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('tab', {name: 'Library', exact: true}).click();
	await page.getByRole('button', {name: 'Import', exact: true}).click();
	await page.locator('input[type=file]').setInputFiles({name: 'navigation.html', mimeType: 'text/html', buffer: Buffer.from(largeStoryFixture())});
	await page.getByRole('button', {name: 'Navigation fixture', exact: true}).dblclick();

	const map = page.locator('.passage-map');
	const before = await page.evaluate(() => performance.now());
	await page.getByRole('button', {name: 'Go To', exact: true}).click();
	const finder = page.locator('.fuzzy-finder');
	await expect(finder).toBeVisible();
	await expect(finder).toHaveClass(/pop-enter-done/);
	await expect(finder.locator('.fuzzy-finder-result')).toHaveCount(240);
	const input = finder.getByRole('textbox');
	const headings = await finder.locator('.fuzzy-finder-result .heading').allTextContents();
	expect(headings.slice(0, 2)).toEqual([...headings].sort((a, b) => a.localeCompare(b)).slice(0, 2));
	await input.press('ArrowUp');
	const selectedLast = finder.locator('.fuzzy-finder-result.selected');
	await expect(selectedLast).toContainText('P238');
	const resultsViewport = finder.locator('.results ol');
	const selectedBounds = await selectedLast.evaluate(element => {
		const rect = element.getBoundingClientRect();
		return {top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right};
	});
	const viewportBounds = await resultsViewport.evaluate(element => {
		const rect = element.getBoundingClientRect();
		return {top: rect.top, bottom: rect.bottom};
	});
	expect(selectedBounds.bottom).toBeLessThanOrEqual(viewportBounds.bottom);
	expect(selectedBounds.top).toBeGreaterThanOrEqual(viewportBounds.top);
	const allVisibleMs = await page.evaluate(start => performance.now() - start, before);
	await page.screenshot({path: testInfo.outputPath('go-to-all-768.png')});

	await expect(selectedLast).toContainText('P238');
	await input.press('Enter');
	await expect(finder).not.toBeVisible();
	await expect(page.getByRole('button', {name: 'P238', exact: true})).toHaveClass(/selected/);

	await page.setViewportSize({width: 375, height: 1024});
	await page.getByRole('button', {name: 'Go To', exact: true}).click();
	const narrowFinder = page.locator('.fuzzy-finder');
	await expect(narrowFinder).toHaveClass(/pop-enter-done/);
	await expect(narrowFinder.locator('.fuzzy-finder-result')).toHaveCount(240);
	const narrowRight = await narrowFinder.evaluate(element => element.getBoundingClientRect().right);
	expect(narrowRight).toBeLessThanOrEqual(375);
	await narrowFinder.getByRole('textbox').click();
	await page.screenshot({path: testInfo.outputPath('go-to-all-375.png')});
	await narrowFinder.getByRole('textbox').press('Escape');
	await expect(narrowFinder).not.toBeVisible();
	await page.setViewportSize({width: 768, height: 1024});

	await page.getByRole('button', {name: 'Go To', exact: true}).click();
	const reopened = page.locator('.fuzzy-finder');
	await expect(reopened.getByRole('textbox')).toHaveValue('');
	await expect(reopened.locator('.fuzzy-finder-result')).toHaveCount(240);
	const rapid = reopened.getByRole('textbox');
	await rapid.fill('tag-special');
	await rapid.fill('rapid-stale-query-that-will-close');
	await rapid.press('Escape');
	await expect(reopened).not.toBeVisible();
	await page.getByRole('button', {name: 'Go To', exact: true}).click();
	await expect(page.locator('.fuzzy-finder').getByRole('textbox')).toHaveValue('');
	await expect(page.locator('.fuzzy-finder').locator('.fuzzy-finder-result')).toHaveCount(240);

	const finderAfterReset = page.locator('.fuzzy-finder');
	const inputAfterReset = finderAfterReset.getByRole('textbox');
	await inputAfterReset.fill('tag-special');
	await expect(finderAfterReset.locator('.fuzzy-finder-result')).toHaveCount(1);
	await expect(finderAfterReset.getByRole('button', {name: /P119/})).toBeVisible();
	await inputAfterReset.fill('Passage 120');
	await expect(finderAfterReset.getByRole('button', {name: /P120/})).toBeVisible();
	await inputAfterReset.fill('A very long passage title that must remain usable at tablet width');
	await expect(finderAfterReset.locator('.fuzzy-finder-result .heading').filter({hasText: 'A very long passage title'})).toHaveCount(1);
	await inputAfterReset.press('Enter');
	await expect(finderAfterReset).not.toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);

	await page.getByRole('button', {name: 'A very long passage title that must remain usable at tablet width', exact: true}).dblclick();
	const editor = page.getByRole('dialog').last();
	await editor.getByLabel('Passage Text', {exact: true}).press('Control+End');
	await editor.getByLabel('Passage Text', {exact: true}).type('\nNavigation edit preserved.');
	await editor.getByLabel('Passage Text', {exact: true}).press('Escape');
	await expect(editor).not.toBeVisible();
	await page.getByRole('tab', {name: 'Build', exact: true}).click();
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', {name: 'Publish to File', exact: true}).click();
	const download = await downloadPromise;
	const output = testInfo.outputPath('navigation-roundtrip.html');
	await download.saveAs(output);
	const published = await (await import('fs/promises')).readFile(output, 'utf8');
	expect(published).toContain('Navigation edit preserved.');
	expect(published).toContain('A very long passage title that must remain usable at tablet width');
	expect(errors).toEqual([]);
	await testInfo.attach('go-to-timing.json', {body: JSON.stringify({allVisibleMs}, null, 2), contentType: 'application/json'});
});
