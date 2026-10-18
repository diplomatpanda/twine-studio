import {test, expect, Page} from '@playwright/test';

async function openFormats(page: Page) {
	await page.getByRole('tab', {name: 'Twine Studio', exact: true}).click({force: true});
	await page.getByRole('button', {name: 'Story Formats', exact: true}).click({force: true});
}

async function openPassage(page: Page) {
	await page.getByRole('tab', {name: 'Passage', exact: true}).click();
	await page.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	const stack = page.locator('.passage-edit-stack').last();
	await expect(stack).toBeVisible();
	return stack.getByRole('dialog').last();
}

async function closeFormats(page: Page) {
	await page
		.getByRole('dialog', {name: 'Story Formats'})
		.getByRole('button', {name: 'Close', exact: true})
		.click();
}

test('bundled Harlowe toolbar inserts markup', async ({page}, testInfo) => {
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Harlowe toolbar');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	const editor = await openPassage(page);
	const toolbar = editor.locator('.story-format-toolbar');
	await expect(toolbar).toBeVisible();
	await expect(toolbar.getByRole('button').first()).toBeVisible();
	await toolbar.getByRole('button', {name: 'Styles', exact: true}).click();
	await editor.getByRole('button', {name: /Bold/}).click();
	await expect(editor.locator('.CodeMirror-code')).toContainText("''Bold Text''");
	await page.screenshot({path: testInfo.outputPath('harlowe-toolbar.png')});
});

test('custom direct toolbar appears only after trust and disappears on revoke', async ({
	page,
	context
}) => {
	await context.route('**/toolbar-fixture.js*', route =>
		route.fulfill({
			contentType: 'text/javascript',
			body: `window.storyFormat({
				name: 'Toolbar Fixture', version: '1.0.0',
				source: '<!doctype html><html><body>{{STORY_DATA}}</body></html>',
				editorCode: undefined,
				editorExtensions: {twine: {'2.12.1': {codeMirror: {
					commands: {insertFixture: function(editor) { editor.replaceSelection('[[Toolbar fixture]]'); }},
					toolbar: function() { return [{type: 'button', command: 'insertFixture', label: 'Insert fixture', icon: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='}]; }
				}}}}
			});`
		})
	);
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await openFormats(page);
	await page.getByRole('button', {name: 'Add', exact: true}).click();
	await page.locator('.add-format-button input').fill('http://127.0.0.1:5189/toolbar-fixture.js');
	await page.locator('.add-format-button form').getByRole('button', {name: 'Add', exact: true}).click();
	const item = page.locator('.story-format-item').filter({hasText: 'Toolbar Fixture 1.0.0'});
	await expect(item.getByRole('button', {name: 'Trust editor code', exact: true})).toBeVisible();
	await item.getByRole('button', {name: 'Use As Default Story Format', exact: true}).click();
	await closeFormats(page);
	await page.getByRole('tab', {name: 'Story', exact: true}).click();
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Toolbar trust');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	let editor = await openPassage(page);
	await expect(editor.locator('.story-format-toolbar button')).toHaveCount(0);
	await openFormats(page);
	await item.getByRole('button', {name: 'Trust editor code', exact: true}).click();
	await item.locator('.confirm-button .card').getByRole('button', {name: 'Trust editor code', exact: true}).click();
	await expect(item.getByRole('button', {name: 'Revoke editor code trust', exact: true})).toBeVisible();
	await closeFormats(page);
	// The passage editor remains mounted while the format dialog is opened and closed.
	await expect(editor.locator('.story-format-toolbar button', {hasText: 'Insert fixture'})).toBeVisible();
	await editor.locator('.story-format-toolbar').getByRole('button', {name: 'Insert fixture', exact: true}).click();
	await expect(editor.locator('.CodeMirror-code')).toContainText('[[Toolbar fixture]]');
	await openFormats(page);
	await item.getByRole('button', {name: 'Revoke editor code trust', exact: true}).click();
	await item.locator('.confirm-button .card').getByRole('button', {name: 'Revoke trust', exact: true}).click();
	await expect(item.getByRole('button', {name: 'Trust editor code', exact: true})).toBeVisible();
	await closeFormats(page);
	await expect(editor.locator('.story-format-toolbar button')).toHaveCount(0);
});
