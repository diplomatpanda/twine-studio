import {expect, test, Page} from '@playwright/test';
import {readFile} from 'fs/promises';

function savedPassages(page: Page) {
	return page.evaluate(() => Object.keys(localStorage)
		.filter(key => key.startsWith('twine-studio-passages-'))
		.map(key => localStorage.getItem(key))
		.join('\n'));
}

test('a stale editor tab preserves its draft without overwriting another tab', async ({page, context}, testInfo) => {
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Shared story');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	await page.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	const staleTab = await context.newPage();
	await staleTab.goto('http://127.0.0.1:5189');
	await staleTab.getByRole('button', {name: 'Shared story', exact: true}).dblclick();
	await staleTab.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	await staleTab.getByLabel('Passage Text', {exact: true}).type('Writer A saved sentence.');
	await staleTab.getByRole('button', {name: 'Close', exact: true}).click();
	await expect.poll(() => savedPassages(page)).toContain('Writer A saved sentence.');
	await page.getByLabel('Passage Text', {exact: true}).type('Writer B local draft.');
	const warning = page.getByRole('alert').filter({hasText: 'Another tab changed saved stories'});
	await expect(warning).toBeVisible();
	await page.getByLabel('Passage Text', {exact: true}).type(' Final unsaved tail.');
	await page.screenshot({path: testInfo.outputPath('conflict-warning.png')});
	await expect.poll(() => savedPassages(page))
		.toContain('Writer A saved sentence.');
	expect(await savedPassages(page))
		.not.toContain('Writer B local draft.');
	const downloadPromise = page.waitForEvent('download');
	await warning.getByRole('button', {name: 'Export story backup'}).click();
	const download = await downloadPromise;
	const backup = await readFile((await download.path())!, 'utf8');
	expect(backup).toContain('Writer B local draft.');
	expect(backup).toContain('Final unsaved tail.');
});

test('two tabs can save different stories', async ({page, context}) => {
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	for (const name of ['North', 'South']) {
		await page.getByRole('button', {name: 'New', exact: true}).click();
		await page.getByRole('textbox').fill(name);
		await page.getByRole('button', {name: 'Create', exact: true}).click();
		await page.getByRole('button', {name: 'Back', exact: true}).click();
	}
	const other = await context.newPage();
	await other.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'North', exact: true}).dblclick();
	await other.getByRole('button', {name: 'South', exact: true}).dblclick();
	await page.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	await other.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	await page.getByLabel('Passage Text', {exact: true}).type('North story text.');
	await page.getByRole('button', {name: 'Close', exact: true}).click();
	await other.getByLabel('Passage Text', {exact: true}).type('South story text.');
	await other.getByRole('button', {name: 'Close', exact: true}).click();
	await expect.poll(() => savedPassages(page)).toContain('North story text.');
	await expect.poll(() => savedPassages(page)).toContain('South story text.');
	await expect(page.getByRole('alert').filter({hasText: 'Another tab changed saved stories'}))
		.toHaveCount(0);
	await expect(other.getByRole('alert').filter({hasText: 'Another tab changed saved stories'}))
		.toHaveCount(0);
});

test('queued same-passage saves cannot both commit after a held browser lock', async ({page, context}) => {
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Lock test story');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	await expect.poll(() => savedPassages(page)).toContain('Untitled Passage');
	const second = await context.newPage();
	await second.goto('http://127.0.0.1:5189');
	await expect(second.getByRole('button', {name: 'Lock test story', exact: true}))
		.toBeVisible();
	const passageKey = await page.evaluate(() => Object.keys(localStorage)
		.find(key => key.startsWith('twine-studio-passages-'))!);
	await page.evaluate(() => {
		void navigator.locks.request('twine-studio-storage-commit', () =>
			new Promise<void>(resolve => {(window as any).releaseStorageLock = resolve;})
		);
	});
	await expect.poll(() => page.evaluate(() =>
		Boolean((window as any).releaseStorageLock))).toBe(true);
	const queuePassage = (target: Page, text: string) => target.evaluate(async ({key, text}) => {
		const modulePath = '/src/store/persistence/local-storage/transaction.ts';
		const {writeStorageItem} = await import(modulePath);
		const record = JSON.parse(localStorage.getItem(key)!);
		writeStorageItem(key, JSON.stringify({...record, text}));
	}, {key: passageKey, text});
	await queuePassage(page, 'First tab queued text.');
	await queuePassage(second, 'Second tab queued text.');
	await expect.poll(() => page.evaluate(() => Object.keys(localStorage)
		.filter(key => key.startsWith('twine-studio-pending-transaction-')).length))
		.toBe(2);
	expect(await savedPassages(page)).not.toContain('First tab queued text.');
	expect(await savedPassages(page)).not.toContain('Second tab queued text.');
	await page.evaluate(() => (window as any).releaseStorageLock());
	await expect.poll(() => savedPassages(page)).toContain('First tab queued text.');
	await expect(second.getByRole('alert').filter({hasText: 'Another tab changed saved stories'}))
		.toBeVisible();
	expect(await savedPassages(page)).not.toContain('Second tab queued text.');
});

test('a new tab waits for an active save before checking unknown journals', async ({page, context}) => {
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Active save story');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	await expect.poll(() => savedPassages(page)).toContain('Untitled Passage');
	const passageKey = await page.evaluate(() => Object.keys(localStorage)
		.find(key => key.startsWith('twine-studio-passages-'))!);
	await page.evaluate(() => {
		void navigator.locks.request('twine-studio-storage-commit', () =>
			new Promise<void>(resolve => {(window as any).releaseStorageLock = resolve;})
		);
	});
	await expect.poll(() => page.evaluate(() =>
		Boolean((window as any).releaseStorageLock))).toBe(true);
	await page.evaluate(async key => {
		const modulePath = '/src/store/persistence/local-storage/transaction.ts';
		const {writeStorageItem} = await import(modulePath);
		const passage = JSON.parse(localStorage.getItem(key)!);
		writeStorageItem(key, JSON.stringify({...passage, text: 'Saved after lock release.'}));
	}, passageKey);
	const second = await context.newPage();
	await second.goto('http://127.0.0.1:5189');
	await page.evaluate(() => (window as any).releaseStorageLock());
	await expect(second.getByRole('button', {name: 'Active save story', exact: true}))
		.toBeVisible();
	await expect(second.getByRole('alert').filter({hasText: 'Your saved work could not be opened'}))
		.toHaveCount(0);
	await expect.poll(() => savedPassages(second)).toContain('Saved after lock release.');
});
