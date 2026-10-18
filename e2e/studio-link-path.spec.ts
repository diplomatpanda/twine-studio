import {expect, test} from '@playwright/test';

const fixture = `<tw-storydata name="Link path fixture" startnode="1" creator="Fixture" creator-version="1" ifid="B83CC46A-4E9B-4F43-B57D-8865AFA4089A" format="Harlowe" format-version="3.3.9">
<tw-passagedata pid="1" name="Start" tags="" position="0,0" size="100,100">[[Door]]</tw-passagedata>
<tw-passagedata pid="2" name="Door" tags="" position="140,0" size="100,100">[[Ending]]</tw-passagedata>
<tw-passagedata pid="3" name="Ending" tags="" position="280,0" size="100,100">The end.</tw-passagedata>
<tw-passagedata pid="4" name="Loose" tags="" position="0,140" size="100,100">An optional idea.</tw-passagedata>
</tw-storydata>`;

test('Go To can find a passage with no standard-link path from Start', async ({page}, testInfo) => {
	await page.setViewportSize({width: 375, height: 812});
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('tab', {name: 'Library', exact: true}).click();
	await page.getByRole('button', {name: 'Import', exact: true}).click();
	await page.locator('input[type=file]').setInputFiles({
		name: 'link-path.html', mimeType: 'text/html', buffer: Buffer.from(fixture)
	});
	await page.getByRole('button', {name: 'Link path fixture', exact: true}).dblclick();
	await page.getByRole('button', {name: 'Go To', exact: true}).click();
	const finder = page.locator('.fuzzy-finder');
	await expect(finder.locator('.fuzzy-finder-result')).toHaveCount(4);
	await finder.getByRole('checkbox', {name: 'Show passages with no link path from Start'}).check();
	await expect(finder.locator('.fuzzy-finder-result .heading')).toHaveText('Loose');
	await expect(finder.getByText(/Checks \[\[\.\.\.\]\] links only/)).toBeVisible();
	await page.screenshot({path: testInfo.outputPath('link-path-375.png')});
	await finder.getByRole('textbox').fill('zzzz-no-passage-matches-this');
	await expect(finder.locator('.fuzzy-finder-result')).toHaveCount(0);
	await finder.getByRole('textbox').fill('');
	await finder.getByRole('button', {name: /Loose/}).click();
	await expect(finder).not.toBeVisible();
	await expect(page.getByRole('button', {name: 'Loose', exact: true})).toHaveClass(/selected/);
	await page.getByRole('button', {name: 'Go To', exact: true}).click();
	await expect(finder.getByRole('checkbox', {name: 'Show passages with no link path from Start'})).not.toBeChecked();
	await expect(finder.locator('.fuzzy-finder-result')).toHaveCount(4);
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});
