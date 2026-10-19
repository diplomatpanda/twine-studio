import {expect, test, Page} from '@playwright/test';
import {readFile} from 'fs/promises';

test('keeps a newer passage and exports an incompatible recovery journal', async ({page}) => {
	const passageKey = 'twine-studio-passages-shared';
	const journalKey = 'twine-studio-pending-transaction-stale-owner';
	await page.addInitScript(({passageKey, journalKey}) => {
		if (localStorage.getItem('twine-studio-stale-journal-fixture')) return;
		localStorage.setItem('twine-studio-stale-journal-fixture', 'seeded');
		const base = JSON.stringify({id: 'shared', story: 'story', text: 'Original'});
		const stale = JSON.stringify({id: 'shared', story: 'story', text: 'Interrupted draft'});
		const newer = JSON.stringify({id: 'shared', story: 'story', text: 'Another tab saved this'});
		localStorage.setItem(passageKey, newer);
		localStorage.setItem(journalKey, JSON.stringify({
			version: 2, changes: [[passageKey, stale]], bases: [[passageKey, base]]
		}));
		sessionStorage.setItem('twine-studio-journal-owner', 'stale-owner');
	}, {passageKey, journalKey});
	await page.goto('http://127.0.0.1:5189');
	const warning = page.getByRole('alert').filter({hasText: 'Your saved work could not be opened'});
	await expect(warning).toContainText('conflicts with newer browser data');
	const downloadPromise = page.waitForEvent('download');
	await warning.getByRole('button', {name: 'Export recovery data'}).click();
	const recovery = JSON.parse(await readFile((await (await downloadPromise).path())!, 'utf8'));
	expect(recovery.records[passageKey]).toContain('Another tab saved this');
	expect(recovery.records[journalKey]).toContain('Interrupted draft');
	expect(await page.evaluate(key => localStorage.getItem(key), passageKey))
		.toContain('Another tab saved this');
});

test('keeps newer records and exports an unverified legacy journal', async ({page}) => {
	const passageKey = 'twine-studio-passages-shared';
	const journalKey = 'twine-studio-pending-transaction';
	await page.addInitScript(({passageKey, journalKey}) => {
		if (localStorage.getItem('twine-studio-legacy-journal-fixture')) return;
		localStorage.setItem('twine-studio-legacy-journal-fixture', 'seeded');
		localStorage.setItem(passageKey, 'another tab saved this');
		localStorage.setItem(journalKey, JSON.stringify({
			version: 1, changes: [[passageKey, 'unverified legacy draft']]
		}));
	}, {passageKey, journalKey});
	await page.goto('http://127.0.0.1:5189');
	const warning = page.getByRole('alert').filter({hasText: 'Your saved work could not be opened'});
	await expect(warning).toContainText('legacy recovery journal cannot be verified');
	const downloadPromise = page.waitForEvent('download');
	await warning.getByRole('button', {name: 'Export recovery data'}).click();
	const recovery = JSON.parse(await readFile((await (await downloadPromise).path())!, 'utf8'));
	expect(recovery.records[passageKey]).toBe('another tab saved this');
	expect(recovery.records[journalKey]).toContain('unverified legacy draft');
	expect(await page.evaluate(key => localStorage.getItem(key), passageKey))
		.toBe('another tab saved this');
});

test('a fresh tab replays a journal left by a closed tab', async ({page, context}) => {
	const journalKey = 'twine-studio-pending-transaction-orphaned-owner';
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await page.getByRole('button', {name: 'New', exact: true}).click();
	await page.getByRole('textbox').fill('Recovered closed tab');
	await page.getByRole('button', {name: 'Create', exact: true}).click();
	await expect.poll(() => page.evaluate(() => Object.keys(localStorage)
		.some(key => key.startsWith('twine-studio-passages-')))).toBe(true);
	const passageKey = await page.evaluate(() => Object.keys(localStorage)
		.find(key => key.startsWith('twine-studio-passages-'))!);
	await expect.poll(() => page.evaluate(key => localStorage.getItem(key), passageKey))
		.not.toBeNull();
	await page.evaluate(({passageKey, journalKey}) => {
		const base = localStorage.getItem(passageKey)!;
		const intended = JSON.stringify({...JSON.parse(base), text: 'closed tab draft'});
		localStorage.setItem(journalKey, JSON.stringify({
			version: 2,
			changes: [[passageKey, intended]],
			bases: [[passageKey, base]]
		}));
	}, {passageKey, journalKey});
	await page.close();
	const fresh = await context.newPage();
	await fresh.goto('http://127.0.0.1:5189');
	await expect.poll(() => fresh.evaluate(key => localStorage.getItem(key), passageKey))
		.toContain('closed tab draft');
	expect(await fresh.evaluate(key => localStorage.getItem(key), journalKey)).toBeNull();
	await fresh.getByRole('button', {name: 'Recovered closed tab', exact: true}).dblclick();
	await expect(fresh.getByRole('button', {name: 'Untitled Passage', exact: true}))
		.toContainText('closed tab draft');
	await expect(fresh.getByRole('alert')
		.filter({hasText: 'Your saved work could not be opened'})).toHaveCount(0);
});

test('a fresh tab preserves a stale closed-tab journal for raw export', async ({page}) => {
	const passageKey = 'twine-studio-passages-orphaned';
	const journalKey = 'twine-studio-pending-transaction-orphaned-owner';
	await page.addInitScript(({passageKey, journalKey}) => {
		if (localStorage.getItem('twine-studio-stale-orphan-fixture')) return;
		localStorage.setItem('twine-studio-stale-orphan-fixture', 'seeded');
		localStorage.setItem(passageKey, 'newer saved record');
		localStorage.setItem(journalKey, JSON.stringify({
			version: 2,
			changes: [[passageKey, 'closed tab draft']],
			bases: [[passageKey, 'old saved record']]
		}));
	}, {passageKey, journalKey});
	await page.goto('http://127.0.0.1:5189');
	const warning = page.getByRole('alert')
		.filter({hasText: 'Your saved work could not be opened'});
	await expect(warning).toContainText('conflicts with newer browser data');
	const downloadPromise = page.waitForEvent('download');
	await warning.getByRole('button', {name: 'Export recovery data'}).click();
	const recovery = JSON.parse(await readFile((await (await downloadPromise).path())!, 'utf8'));
	expect(recovery.records[passageKey]).toBe('newer saved record');
	expect(recovery.records[journalKey]).toContain('closed tab draft');
});

test('blocked session storage preserves two conflicting drafts for raw export', async ({page}) => {
	const passageKey = 'twine-studio-passages-blocked';
	const journalA = 'twine-studio-pending-transaction-blocked-a';
	const journalB = 'twine-studio-pending-transaction-blocked-b';
	await page.addInitScript(({passageKey, journalA, journalB}) => {
		if (!localStorage.getItem('twine-studio-blocked-journal-fixture')) {
			localStorage.setItem('twine-studio-blocked-journal-fixture', 'seeded');
			for (const [key, draft] of [[journalA, 'first draft'], [journalB, 'second draft']])
				localStorage.setItem(key, JSON.stringify({
					version: 2,
					changes: [[passageKey, draft]],
					bases: [[passageKey, null]]
				}));
		}
		const blocked = sessionStorage;
		const originalGet = Storage.prototype.getItem;
		const originalSet = Storage.prototype.setItem;
		Storage.prototype.getItem = function (key) {
			if (this === blocked) throw new DOMException('Blocked', 'SecurityError');
			return originalGet.call(this, key);
		};
		Storage.prototype.setItem = function (key, value) {
			if (this === blocked) throw new DOMException('Blocked', 'SecurityError');
			return originalSet.call(this, key, value);
		};
	}, {passageKey, journalA, journalB});
	await page.goto('http://127.0.0.1:5189');
	const warning = page.getByRole('alert').filter({hasText: 'Your saved work could not be opened'});
	await expect(warning).toContainText('Conflicting recovery journals');
	const downloadPromise = page.waitForEvent('download');
	await warning.getByRole('button', {name: 'Export recovery data'}).click();
	const recovery = JSON.parse(await readFile((await (await downloadPromise).path())!, 'utf8'));
	expect(recovery.records[journalA]).toContain('first draft');
	expect(recovery.records[journalB]).toContain('second draft');
	expect(recovery.records[passageKey]).toBeUndefined();
});

test('warns and exports original bytes when an indexed story cannot be opened', async ({page}) => {
	await page.addInitScript(() => {
		if (localStorage.getItem('twine-studio-corrupt-fixture')) return;
		localStorage.setItem('twine-studio-corrupt-fixture', 'seeded');
		localStorage.setItem('twine-studio-stories', 'broken-story');
		localStorage.setItem('twine-studio-stories-broken-story', '{broken');
	});
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	const warning = page.getByRole('alert')
		.filter({hasText: 'Some saved writing could not be opened'});
	await expect(warning).toBeVisible();
	const downloadPromise = page.waitForEvent('download');
	await warning.getByRole('button', {name: 'Export recovery data'}).click();
	const recovery = JSON.parse(await readFile(
		(await (await downloadPromise).path())!, 'utf8'));
	expect(recovery.records['twine-studio-stories-broken-story']).toBe('{broken');
	expect(await page.evaluate(() =>
		localStorage.getItem('twine-studio-stories'))).toBe('broken-story');
});

test('shows an indexed story whose ID is an object prototype property', async ({page}) => {
	await page.addInitScript(() => {
		if (localStorage.getItem('twine-studio-prototype-fixture')) return;
		localStorage.setItem('twine-studio-prototype-fixture', 'seeded');
		localStorage.setItem('twine-studio-stories', '__proto__');
		localStorage.setItem('twine-studio-stories-__proto__', JSON.stringify({
			id: '__proto__', name: 'Prototype Story', passages: [],
			startPassage: 'start', storyFormat: 'Harlowe',
			storyFormatVersion: '3.3.9'
		}));
		localStorage.setItem('twine-studio-passages', 'start');
		localStorage.setItem('twine-studio-passages-start', JSON.stringify({
			id: 'start', story: '__proto__', name: 'Start', text: 'Saved writing',
			top: 100, left: 100, width: 100, height: 100, tags: []
		}));
	});
	await page.goto('http://127.0.0.1:5189');
	await page.getByRole('button', {name: 'Skip', exact: true}).click();
	await expect(page.getByRole('button', {name: 'Prototype Story', exact: true}))
		.toBeVisible();
});

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

test('recovers a quota-failed passage draft after the tab closes', async ({page, context}) => {
	const sentence = 'Keep this sentence after closing the tab.';
	await createDraft(page);
	await failWrites(page, 'journal');
	await page.getByLabel('Passage Text', {exact: true}).fill(sentence);
	await expect.poll(() => page.evaluate(async expected => {
		const request = indexedDB.open('twine-studio-editor-drafts', 1);
		return new Promise<boolean>(resolve => {
			request.onerror = () => resolve(false);
			request.onsuccess = () => {
				const db = request.result;
				const transaction = db.transaction('drafts', 'readonly');
				const read = transaction.objectStore('drafts').getAll();
				read.onsuccess = () => resolve(read.result.some(draft => draft.text === expected));
				read.onerror = () => resolve(false);
				transaction.oncomplete = () => db.close();
			};
		});
	}, sentence)).toBe(true);
	expect(await page.evaluate(() => JSON.stringify({...localStorage}))).not.toContain(sentence);
	await page.close({runBeforeUnload: false});
	const fresh = await context.newPage();
	await fresh.goto('http://127.0.0.1:5189');
	await expect(fresh.getByRole('button', {name: 'Recovery draft', exact: true}))
		.toBeVisible();
	await fresh.getByRole('button', {name: 'Recovery draft', exact: true}).dblclick();
	await expect(fresh.getByRole('button', {name: 'Untitled Passage', exact: true}))
		.toContainText(sentence);
});

test('keeps competing durable drafts separate for recovery export', async ({page}) => {
	await createDraft(page);
	const passageKey = await page.evaluate(() => Object.keys(localStorage)
		.find(key => key.startsWith('twine-studio-passages-'))!);
	await page.evaluate(async key => {
		const passage = JSON.parse(localStorage.getItem(key)!);
		const request = indexedDB.open('twine-studio-editor-drafts', 1);
		await new Promise<void>((resolve, reject) => {
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const db = request.result;
				const transaction = db.transaction('drafts', 'readwrite');
				for (const [owner, text] of [['first-tab', 'First tab draft'],
					['second-tab', 'Second tab draft']])
					transaction.objectStore('drafts').put({
						id: `${owner}:${passage.id}`,
						owner,
						version: 1,
						storyId: passage.story,
						passageId: passage.id,
						baseText: passage.text,
						text
					});
				transaction.oncomplete = () => {db.close(); resolve();};
				transaction.onerror = () => reject(transaction.error);
			};
		});
	}, passageKey);
	await page.reload();
	const warning = page.getByRole('alert').filter({hasText: 'Several recovered drafts need review'});
	await expect(warning).toBeVisible();
	const downloadPromise = page.waitForEvent('download');
	await warning.getByRole('button', {name: 'Export recovery data'}).click();
	const recovery = JSON.parse(await readFile((await (await downloadPromise).path())!, 'utf8'));
	expect(Object.values(recovery.durableDrafts).map((draft: any) => draft.text))
		.toEqual(expect.arrayContaining(['First tab draft', 'Second tab draft']));
	expect(await page.evaluate(key => localStorage.getItem(key), passageKey))
		.not.toContain('First tab draft');
	expect(await page.evaluate(key => localStorage.getItem(key), passageKey))
		.not.toContain('Second tab draft');
	await page.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	await page.getByLabel('Passage Text', {exact: true}).fill('Another edit after recovery');
	await expect(warning).toBeVisible();
	expect(await page.evaluate(key => localStorage.getItem(key), passageKey))
		.not.toContain('Another edit after recovery');
});

test('clears an emergency draft after an ordinary successful save', async ({page}) => {
	await createDraft(page);
	await page.getByLabel('Passage Text', {exact: true}).type('Saved normally.');
	await expect.poll(() => page.evaluate(() => JSON.stringify({...localStorage})))
		.toContain('Saved normally.');
	await expect.poll(() => page.evaluate(async () => {
		const request = indexedDB.open('twine-studio-editor-drafts', 1);
		return new Promise<number>(resolve => {
			request.onerror = () => resolve(-1);
			request.onsuccess = () => {
				const db = request.result;
				const transaction = db.transaction('drafts', 'readonly');
				const count = transaction.objectStore('drafts').count();
				count.onsuccess = () => resolve(count.result);
				count.onerror = () => resolve(-1);
				transaction.oncomplete = () => db.close();
			};
		});
	})).toBe(0);
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
		localStorage.setItem('twine-studio-passages', '');
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

test('startup failure export includes IndexedDB drafts', async ({page}) => {
	await page.goto('http://127.0.0.1:5189');
	await page.evaluate(async () => {
		const request = indexedDB.open('twine-studio-editor-drafts', 1);
		await new Promise<void>((resolve, reject) => {
			request.onupgradeneeded = () =>
				request.result.createObjectStore('drafts', {keyPath: 'id'});
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const db = request.result;
				const transaction = db.transaction('drafts', 'readwrite');
				transaction.objectStore('drafts').put({
					id: 'closed-page:lost-passage', owner: 'closed-page', version: 1,
					storyId: 'lost-story', passageId: 'lost-passage',
					baseText: 'Earlier text', text: 'Writing from the closed page'
				});
				transaction.oncomplete = () => {db.close(); resolve();};
				transaction.onerror = () => reject(transaction.error);
			};
		});
		localStorage.setItem('twine-studio-pending-transaction', '{broken journal');
	});
	await page.reload();
	await expect(page.getByRole('heading', {name: 'Your saved work could not be opened'}))
		.toBeVisible();
	const downloadPromise = page.waitForEvent('download');
	await page.getByRole('button', {name: 'Export recovery data'}).click();
	const recovery = JSON.parse(await readFile((await (await downloadPromise).path())!, 'utf8'));
	expect(recovery.durableDrafts['closed-page:lost-passage'].text)
		.toBe('Writing from the closed page');
});
