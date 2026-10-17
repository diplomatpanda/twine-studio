import {test, expect} from '@playwright/test';
import {readFile} from 'fs/promises';

test('imports 240 passages, searches, renames references, edits and publishes', async ({
	page
}, testInfo) => {
	test.setTimeout(60000);
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	const passages = Array.from(
		{length: 240},
		(_, i) =>
			`<tw-passagedata pid="${i + 1}" name="P${String(i).padStart(3, '0')}" tags="" position="${(i % 20) * 140},${Math.floor(i / 20) * 140}" size="100,100">Passage ${i}.${i < 239 ? ` [[P${String(i + 1).padStart(3, '0')}]]` : ' The End.'}</tw-passagedata>`
	).join('');
	const html = `<tw-storydata name="Large import" startnode="1" creator="Fixture" creator-version="1" ifid="7F646750-70F3-4A57-B482-08A80FA4D266" format="Harlowe" format-version="3.3.9">${passages}</tw-storydata>`;
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('tab', {name: 'Library', exact: true}).click();
	await page.getByRole('button', {name: 'Import', exact: true}).click();
	await page
		.locator('input[type=file]')
		.setInputFiles({
			name: 'large.html',
			mimeType: 'text/html',
			buffer: Buffer.from(html)
		});
	await page
		.getByRole('button', {name: 'Large import', exact: true})
		.dblclick();
	await page.getByRole('button', {name: 'Go To', exact: true}).click();
	const finder = page.locator('.fuzzy-finder');
	await finder.getByRole('textbox').fill('qzxvjkqzxvjkqzxvjk');
	await expect(finder.locator('.no-results')).toBeVisible();
	await finder.getByRole('textbox').press('Enter');
	await finder.getByRole('textbox').press('ArrowUp');
	await finder.getByRole('textbox').press('Enter');
	await expect(finder.getByRole('textbox')).toBeVisible();
	expect(errors).toEqual([]);
	await finder.getByRole('textbox').fill('P120');
	await finder.getByRole('button', {name: /^P120/}).click();
	await page.getByRole('button', {name: 'Rename', exact: true}).click();
	await page
		.getByRole('textbox', {name: 'What should “P120” be renamed to?'})
		.fill('Crossroads');
	await page.getByRole('button', {name: 'OK', exact: true}).click();
	await expect(
		page.getByRole('button', {name: 'Crossroads', exact: true})
	).toBeVisible();
	await page.getByRole('button', {name: 'Crossroads', exact: true}).dblclick();
	const dialog = page.getByRole('dialog', {name: 'Crossroads', exact: true});
	await dialog.getByLabel('Passage Text', {exact: true}).press('Control+End');
	await dialog
		.getByLabel('Passage Text', {exact: true})
		.type('\nAn edited crossroads.');
	await dialog.getByRole('button', {name: 'Close', exact: true}).click();
	await expect(dialog).not.toBeVisible();
	await page.reload();
	await expect(
		page.getByRole('button', {name: 'Crossroads', exact: true})
	).toContainText('An edited crossroads.');
	await page.getByRole('tab', {name: 'Build', exact: true}).click();
	const downloadPromise = page.waitForEvent('download');
	await page
		.getByRole('button', {name: 'Publish to File', exact: true})
		.click();
	const download = await downloadPromise;
	const output = testInfo.outputPath('large-roundtrip.html');
	await download.saveAs(output);
	const saved = await readFile(output, 'utf8');
	const contents = await page.evaluate(saved => {
		const doc = new DOMParser().parseFromString(saved, 'text/html');
		return {
			count: doc.querySelectorAll('tw-passagedata').length,
			previous: doc.querySelector('tw-passagedata[name=P119]')?.textContent,
			renamed: doc.querySelector('tw-passagedata[name=Crossroads]')
				?.textContent,
			oldExists: Boolean(doc.querySelector('tw-passagedata[name=P120]'))
		};
	}, saved);
	expect(contents).toEqual({
		count: 240,
		previous: 'Passage 119. [[Crossroads]]',
		renamed: 'Passage 120. [[P121]]\nAn edited crossroads.',
		oldExists: false
	});
	expect(errors).toEqual([]);
});
