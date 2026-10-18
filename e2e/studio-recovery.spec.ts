import {expect, test, Page} from '@playwright/test';
import {readFile} from 'fs/promises';

test('recovers passage creation and map movement from an interrupted save', async ({
	page
}) => {
	await createDraft(page);
	await failWrites(page, 'passage');
	await page.getByRole('button', {name: 'Add choice', exact: true}).click();
	await page.getByLabel('Choice text', {exact: true}).fill('Find shelter');
	await page.getByLabel('Destination passage', {exact: true}).fill('Shelter');
	await page.getByRole('button', {name: 'Insert choice', exact: true}).click();
	await page
		.getByRole('dialog', {name: 'Untitled Passage', exact: true})
		.getByRole('button', {name: 'Close', exact: true})
		.click();
	await expect(
		page.getByRole('button', {name: 'Shelter', exact: true})
	).toBeVisible();
	const card = page.getByRole('button', {
		name: 'Untitled Passage',
		exact: true
	});
	const before = (await card.boundingBox())!;
	await page.mouse.move(before.x + 40, before.y + 25);
	await page.mouse.down();
	await page.mouse.move(before.x + 190, before.y + 175, {steps: 5});
	await page.mouse.up();
	const position = () =>
		card.evaluate(node => {
			const container = node.closest('.passage-card') as HTMLElement;
			return {left: container.style.left, top: container.style.top};
		});
	await expect
		.poll(async () => (await card.boundingBox())!.x)
		.toBeGreaterThan(before.x + 100);
	const moved = await position();
	await expect(page.getByRole('alert')).toContainText('Recovered changes');
	await page.reload();
	await expect(
		page.getByRole('button', {name: 'Shelter', exact: true})
	).toBeVisible();
	await expect(card).toContainText('Find shelter');
	expect(await position()).toEqual(moved);
});

test('preserves final typing when the first save fails during reload', async ({
	page
}) => {
	await createDraft(page);
	await failWrites(page, 'journal');
	await page
		.getByLabel('Passage Text', {exact: true})
		.type('Do not lose this final sentence.');
	expect(
		await page.evaluate(() => JSON.stringify({...localStorage}))
	).not.toContain('Do not lose this final sentence.');
	expect(await page.evaluate(() => JSON.stringify({...sessionStorage})))
		.toContain('Do not lose this final sentence.');
	let warned = false;
	page.on('dialog', async dialog => {
		if (dialog.type() === 'beforeunload') {
			warned = true;
			await dialog.dismiss();
		}
	});
	await page.reload({timeout: 3000}).catch(() => undefined);
	if (warned) {
		await expect(page.getByRole('alert')).toContainText('Keep it open');
		await page.evaluate(() => (window as any).restoreStorage());
		await page.getByRole('button', {name: 'Retry saving'}).click();
		await page.reload();
	}
	await expect(
		page.getByRole('button', {name: 'Untitled Passage', exact: true})
	).toContainText('Do not lose this final sentence.');
});

async function createDraft(page: Page) {
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Recovery draft');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	await page
		.getByRole('button', {name: 'Untitled Passage', exact: true})
		.dblclick();
}

async function failWrites(page: Page, boundary: 'journal' | 'passage') {
	await page.evaluate(boundary => {
		const original = Storage.prototype.setItem;
		(window as any).restoreStorage = () => {
			Storage.prototype.setItem = original;
		};
		Storage.prototype.setItem = function (key, value) {
			if (
				(key.startsWith('twine-studio-pending-transaction') &&
					boundary === 'journal') ||
				(key.startsWith('twine-studio-passages-') && boundary === 'passage')
			) {
				throw new DOMException('Simulated full storage', 'QuotaExceededError');
			}
			original.call(this, key, value);
		};
	}, boundary);
}

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

test('a recovered editor draft cannot replace a newer saved passage', async ({page}, testInfo) => {
	await createDraft(page);
	await page.evaluate(() => {
		const key = Object.keys(localStorage)
			.find(candidate => candidate.startsWith('twine-studio-passages-'))!;
		const passage = JSON.parse(localStorage.getItem(key)!);
		sessionStorage.setItem(`twine-studio-editor-draft-${passage.id}`,
			JSON.stringify({version: 1, storyId: passage.story,
				passageId: passage.id, baseText: passage.text,
				text: 'Local recovered sentence.'}));
		localStorage.setItem(key, JSON.stringify({...passage,
			text: 'Other tab saved sentence.'}));
	});
	await page.reload();
	const warning = page.getByRole('alert')
		.filter({hasText: 'Recovered writing differs from the saved story'});
	await expect(warning).toBeVisible();
	await page.screenshot({path: testInfo.outputPath('recovered-draft-conflict.png')});
	await expect(page.getByRole('button', {name: 'Untitled Passage', exact: true}))
		.toContainText('Local recovered sentence.');
	expect(await page.evaluate(() => JSON.stringify({...localStorage})))
		.toContain('Other tab saved sentence.');
	const downloadPromise = page.waitForEvent('download');
	await warning.getByRole('button', {name: 'Export story backup'}).click();
	const backup = await readFile((await (await downloadPromise).path())!, 'utf8');
	expect(backup).toContain('Local recovered sentence.');
	await warning.getByRole('button',
		{name: 'Discard recovered draft and open saved version'}).click();
	await expect(page.getByRole('button', {name: 'Untitled Passage', exact: true}))
		.toContainText('Other tab saved sentence.');
	await expect(page.getByRole('alert')
		.filter({hasText: 'Recovered writing differs from the saved story'}))
		.toHaveCount(0);
});

test('an orphaned editor draft remains available in raw recovery', async ({page}) => {
	await createDraft(page);
	await page.evaluate(() => {
		const key = Object.keys(localStorage)
			.find(candidate => candidate.startsWith('twine-studio-passages-'))!;
		const passage = JSON.parse(localStorage.getItem(key)!);
		sessionStorage.setItem(`twine-studio-editor-draft-${passage.id}`,
			JSON.stringify({version: 1, storyId: passage.story,
				passageId: passage.id, baseText: passage.text,
				text: 'Writing from a deleted passage.'}));
		localStorage.removeItem(key);
	});
	await page.reload();
	const warning = page.getByRole('alert')
		.filter({hasText: 'Recovered writing has no saved passage'});
	await expect(warning).toBeVisible();
	const downloadPromise = page.waitForEvent('download');
	await warning.getByRole('button', {name: 'Export recovery data'}).click();
	const recovery = await readFile((await (await downloadPromise).path())!, 'utf8');
	expect(recovery).toContain('Writing from a deleted passage.');
	await warning.getByRole('button', {name: 'Discard orphaned drafts'}).click();
	await expect(warning).toHaveCount(0);
});

test('failed save keeps latest writing available for backup, retry and reload', async ({
	page,
	browser
}) => {
	await createDraft(page);
	await failWrites(page, 'journal');
	await page
		.getByLabel('Passage Text', {exact: true})
		.type('Rescue this new writing.');
	await page.getByRole('button', {name: 'Add choice', exact: true}).click();
	const status = page
		.getByRole('alert')
		.filter({hasText: 'Saving needs attention'});
	await expect(status).toContainText('Keep it open');
	await page.screenshot({
		path: 'output/playwright/recovery/storage-warning.png'
	});
	expect(
		await page.evaluate(() => JSON.stringify({...localStorage}))
	).not.toContain('Rescue this new writing.');
	const downloaded = page.waitForEvent('download');
	await status.getByRole('button', {name: 'Export story backup'}).click();
	const download = await downloaded;
	const backup = await readFile((await download.path())!, 'utf8');
	expect(backup).toContain('Rescue this new writing.');
	// Restore the rescue archive into a separate clean editor profile.
	const restored = await browser.newContext();
	try {
		const other = await restored.newPage();
		await other.goto('http://127.0.0.1:5189');
		await other.getByRole('button', {name: 'Skip', exact: true}).click();
		await other.getByRole('tab', {name: 'Library', exact: true}).click();
		await other.getByRole('button', {name: 'Import', exact: true}).click();
		await other.locator('input[type=file]').setInputFiles({
			name: 'rescue.html',
			mimeType: 'text/html',
			buffer: Buffer.from(backup)
		});
		await other
			.getByRole('button', {name: 'Recovery draft', exact: true})
			.dblclick();
		await expect(
			other.getByRole('button', {name: 'Untitled Passage', exact: true})
		).toContainText('Rescue this new writing.');
	} finally {
		await restored.close();
	}
	await page.evaluate(() => (window as any).restoreStorage());
	await status.getByRole('button', {name: 'Retry saving'}).click();
	await expect(status).toHaveCount(0);
	await page.reload();
	await expect(
		page.getByRole('button', {name: 'Untitled Passage', exact: true})
	).toContainText('Rescue this new writing.');
});

test('reload recovers a durable journal after a partial record write', async ({
	page
}) => {
	await createDraft(page);
	await failWrites(page, 'passage');
	await page
		.getByLabel('Passage Text', {exact: true})
		.type('Recover the interrupted save.');
	await page.getByRole('button', {name: 'Add choice', exact: true}).click();
	await expect(page.getByRole('alert')).toContainText('Recovered changes');
	expect(
		await page.evaluate(() => Object.keys(localStorage)
			.filter(key => key.startsWith('twine-studio-pending-transaction'))
			.map(key => localStorage.getItem(key)).join('\n'))
	).toContain('Recover the interrupted save.');
	await page.reload();
	await expect(
		page.getByRole('button', {name: 'Untitled Passage', exact: true})
	).toContainText('Recover the interrupted save.');
	// Startup preference repair can finish recovery automatically.
	await expect
		.poll(() =>
			page.evaluate(() => Object.keys(localStorage)
				.filter(key => key.startsWith('twine-studio-pending-transaction')).length)
		)
		.toBe(0);
});

test('unreadable recovery journal offers raw export without deleting saved bytes', async ({
	page
}) => {
	await page.addInitScript(() => {
		localStorage.setItem('twine-studio-pending-transaction', '{broken journal');
		localStorage.setItem(
			'twine-studio-stories-precious',
			'precious existing bytes'
		);
	});
	await page.goto('http://127.0.0.1:5189');
	await expect(
		page.getByRole('heading', {name: 'Your saved work could not be opened'})
	).toBeVisible();
	const downloaded = page.waitForEvent('download');
	await page.getByRole('button', {name: 'Export recovery data'}).click();
	const download = await downloaded;
	const rescue = JSON.parse(await readFile((await download.path())!, 'utf8'));
	expect(rescue.records['twine-studio-stories-precious']).toBe(
		'precious existing bytes'
	);
	expect(rescue.records['twine-studio-pending-transaction']).toBe(
		'{broken journal'
	);
	expect(
		await page.evaluate(() =>
			localStorage.getItem('twine-studio-stories-precious')
		)
	).toBe('precious existing bytes');
});
