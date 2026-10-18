import {expect, test} from '@playwright/test';

test('web passage editing stays intact when the desktop AI action is opened', async ({page}) => {
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Offline repair boundary');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	await page.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	await page.getByLabel('Passage Text', {exact: true}).type('(if: $map)[The door opens.]');
	await page.getByRole('button', {name: 'Repair passage code with AI'}).click();
	await expect(page.getByText('AI code repair is currently available in the desktop app.')).toBeVisible();
	await expect(page.getByRole('button', {name: 'Propose repair'})).toHaveCount(0);
	await page.getByRole('button', {name: 'Close', exact: true}).last().click();
	await page.reload();
	await page.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	await expect(page.locator('.passage-edit-contents .CodeMirror-code')).toContainText(
		'(if: $map)[The door opens.]'
	);
});
