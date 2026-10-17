import {expect, test} from '@playwright/test';

test('retains typing when reloaded inside the editor debounce interval', async ({
	page
}) => {
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Interrupted draft');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	await page
		.getByRole('button', {name: 'Untitled Passage', exact: true})
		.dblclick();
	await page
		.getByLabel('Passage Text', {exact: true})
		.type('Keep this last sentence.');
	// Confirm the normal debounce has not already saved the sentence. This
	// prevents a slow run from accidentally passing without the lifecycle save.
	expect(
		await page.evaluate(() => JSON.stringify({...localStorage}))
	).not.toContain('Keep this last sentence.');
	// No blur and no sleep: this must survive before the one-second save timer.
	await page.reload();
	await expect(
		page.getByRole('button', {name: 'Untitled Passage', exact: true})
	).toContainText('Keep this last sentence.');
});
