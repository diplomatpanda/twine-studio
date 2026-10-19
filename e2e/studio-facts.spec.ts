import {expect, test, type Page} from '@playwright/test';
import {createServer} from 'http';
import {readFile} from 'fs/promises';

type Scenario = {
	format: 'Harlowe' | 'SugarCube';
	version: string;
	conditionalSelector: string;
	passageSelector: string;
};

const scenarios: Scenario[] = [
	{
		format: 'Harlowe',
		version: '3.3.9',
		conditionalSelector: 'tw-link',
		passageSelector: 'tw-passage'
	},
	{
		format: 'SugarCube',
		version: '2.37.3',
		conditionalSelector: 'a.link-internal',
		passageSelector: '.passage'
	}
];

async function openPassage(page: Page, name: string) {
	const card = page.getByRole('button', {name, exact: true});
	await card.click();
	await card.dblclick();
	await page.getByRole('dialog', {name, exact: true}).waitFor();
}

async function fillPassage(page: Page, name: string, text: string) {
	await openPassage(page, name);
	const dialog = page.getByRole('dialog', {name, exact: true});
	await dialog.getByLabel('Passage Text', {exact: true}).fill(text);
	await dialog.getByRole('button', {name: 'Close', exact: true}).click();
	await expect(dialog).not.toBeVisible();
}

async function closeCurrentPassage(page: Page) {
	const dialog = page.getByRole('dialog').last();
	await dialog.getByRole('button', {name: 'Close', exact: true}).click();
	await expect(dialog).not.toBeVisible();
}

async function insertChoice(page: Page, label: string, destination: string) {
	const dialog = page.getByRole('dialog').last();
	await dialog.getByRole('button', {name: 'Add choice', exact: true}).click();
	const form = dialog.getByRole('form', {name: 'Add choice', exact: true});
	await form.getByLabel('Choice text', {exact: true}).fill(label);
	await form.getByLabel('Destination passage', {exact: true}).fill(destination);
	await form.getByRole('button', {name: 'Insert choice', exact: true}).click();
	await expect(dialog.getByLabel('Passage Text', {exact: true})).toBeFocused();
}

async function insertFact(
	page: Page,
	name: string,
	value: 'yes' | 'no' | 'number',
	options?: {
		number?: string;
		action?: 'remember' | 'change' | 'condition' | 'dialogue';
		operator?: 'eq' | 'gte' | 'lte';
		label?: string;
		destination?: string;
		screenshotPath?: string;
	}
) {
	const dialog = page.getByRole('dialog').last();
	await dialog.getByRole('button', {name: 'Story logic', exact: true}).click();
	const form = dialog.getByRole('form', {name: 'Story logic', exact: true});
	const selectField = (label: 'Action' | 'Value' | 'Comparison') =>
		form.locator('select').nth({Action: 0, Value: 1, Comparison: 2}[label]);
	await form.getByLabel('Fact name', {exact: true}).fill(name);
	if (options?.screenshotPath) {
		await page.screenshot({path: options.screenshotPath});
	}
	if (options?.action) {
		await selectField('Action').selectOption(options.action);
	}
	if (options?.action === 'change') {
		await form.getByLabel('Amount to add (negative to subtract)', {exact: true})
			.fill(options?.number ?? '0');
	} else {
		await selectField('Value').selectOption(value);
		if (value === 'number') {
			await form.getByLabel('Number', {exact: true}).fill(options?.number ?? '0');
		}
	}
	if (options?.operator) {
		await selectField('Comparison').selectOption(options.operator);
	}
	if (options?.label !== undefined) {
		await form.getByLabel(options.action === 'dialogue' ? 'Text to show' : 'Choice text', {exact: true})
			.fill(options.label);
	}
	if (options?.destination !== undefined) {
		await form
			.getByLabel('Destination passage', {exact: true})
			.fill(options.destination);
	}
	await form
		.getByRole('button', {name: 'Insert story logic', exact: true})
		.click();
	await expect(dialog.getByLabel('Passage Text', {exact: true})).toBeFocused();
}

async function playerLink(page: Page, scenario: Scenario, label: string) {
	return page
		.locator(scenario.conditionalSelector)
		.filter({hasText: label})
		.first();
}

async function assertNoErrors(page: Page) {
	await expect(page.locator('tw-error')).toHaveCount(0);
	await expect(page.locator('.error')).toHaveCount(0);
}

for (const scenario of scenarios) {
	test(`story facts route through published ${scenario.format}`, async ({
		page,
		context
	}, testInfo) => {
		test.setTimeout(60000);
		await page.addInitScript(scenario => {
			const prefs = {
				welcomeSeen: true,
				useCodeMirror: true,
				storyFormat: {name: scenario.format, version: scenario.version}
			};
			localStorage.setItem('twine-studio-prefs', Object.keys(prefs).join(','));
			for (const [name, value] of Object.entries(prefs)) {
				localStorage.setItem(
					`twine-studio-prefs-${name}`,
					JSON.stringify({name, value})
				);
			}
		}, scenario);
		await page.goto('http://127.0.0.1:5189');
		await page.getByRole('button', {name: 'New', exact: true}).click();
		await page.getByRole('textbox').fill(`Fact route ${scenario.format}`);
		await page.getByRole('button', {name: 'Create', exact: true}).click();

		await openPassage(page, 'Untitled Passage');
		await page
			.getByRole('dialog')
			.last()
			.getByLabel('Passage Text', {exact: true})
			.fill('The entrance.');
		await insertFact(page, 'clue', 'no', {
			screenshotPath: testInfo.outputPath('story-logic-form.png')
		});
		await insertFact(page, 'trust', 'number', {number: '0'});
		await insertChoice(page, 'Search', 'Library');
		await insertChoice(page, 'Leave', 'Gate');
		await closeCurrentPassage(page);

		await expect(
			page.getByRole('button', {name: 'Library', exact: true})
		).toBeVisible();
		await expect(
			page.getByRole('button', {name: 'Gate', exact: true})
		).toBeVisible();

		await openPassage(page, 'Library');
		await insertFact(page, 'clue', 'yes');
		await insertFact(page, 'trust', 'number', {action: 'change', number: '3'});
		await insertChoice(page, 'Continue', 'Gate');
		await closeCurrentPassage(page);

		await openPassage(page, 'Gate');
		await page
			.getByRole('dialog', {name: 'Gate', exact: true})
			.getByLabel('Passage Text', {exact: true})
			.fill('Gate');
		await insertFact(page, 'clue', 'yes', {
			action: 'condition',
			label: 'Solved',
			destination: 'Solved'
		});
		await insertFact(page, 'trust', 'number', {
			action: 'condition',
			number: '3',
			operator: 'gte',
			label: 'Helped',
			destination: 'Helped'
		});
		await insertFact(page, 'trust', 'number', {
			action: 'dialogue',
			number: '3',
			operator: 'gte',
			label: 'Maya trusts you.'
		});
		await closeCurrentPassage(page);

		await fillPassage(page, 'Solved', 'Solved ending.');
		await fillPassage(page, 'Helped', 'Helped ending.');

		await page.getByRole('tab', {name: 'Build', exact: true}).click();
		const downloadPromise = page.waitForEvent('download');
		await page
			.getByRole('button', {name: 'Publish to File', exact: true})
			.click();
		const download = await downloadPromise;
		const htmlPath = testInfo.outputPath('published-facts.html');
		await download.saveAs(htmlPath);
		const html = await readFile(htmlPath, 'utf8');
		expect(html).toContain('Solved ending.');
		expect(html).toContain('Helped ending.');

		const server = createServer((_request, response) => {
			response.setHeader('Content-Type', 'text/html; charset=utf-8');
			response.end(html);
		});
		await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
		const address = server.address() as {port: number};
		try {
			const noClue = await context.newPage();
			await noClue.goto(`http://127.0.0.1:${address.port}`);
			await (await playerLink(noClue, scenario, 'Leave')).click();
			await expect(noClue.locator(scenario.passageSelector)).toContainText(
				'Gate'
			);
			await expect(await playerLink(noClue, scenario, 'Solved')).toHaveCount(0);
			await expect(await playerLink(noClue, scenario, 'Helped')).toHaveCount(0);
			await expect(noClue.locator(scenario.passageSelector)).not.toContainText('Maya trusts you.');
			await assertNoErrors(noClue);
			await noClue.close();

			const clueRoute = async (ending: string) => {
				const player = await context.newPage();
				await player.goto(`http://127.0.0.1:${address.port}`);
				await (await playerLink(player, scenario, 'Search')).click();
				await (await playerLink(player, scenario, 'Continue')).click();
				await expect(
					await playerLink(player, scenario, 'Solved')
				).toBeVisible();
				await expect(
					await playerLink(player, scenario, 'Helped')
				).toBeVisible();
				await expect(player.locator(scenario.passageSelector)).toContainText('Maya trusts you.');
				await (await playerLink(player, scenario, ending)).click();
				await expect(player.locator(scenario.passageSelector)).toContainText(
					`${ending} ending.`
				);
				await assertNoErrors(player);
				await player.close();
			};

			await clueRoute('Solved');
			await clueRoute('Helped');
		} finally {
			await new Promise<void>(resolve => server.close(() => resolve()));
		}
	});
}
