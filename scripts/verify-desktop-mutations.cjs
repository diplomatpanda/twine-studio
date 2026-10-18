// Electron acceptance checks for mutations that must survive a native close.
// The scenarios use the rendered UI. They do not inject the Electron bridge;
// bridge injection is reserved for deterministic failure/delay tests elsewhere.
const fs = require('node:fs');
const path = require('node:path');
const {_electron: electron} = require('playwright');

const repoRoot = path.resolve(__dirname, '..');
const packageJson = require(path.join(repoRoot, 'package.json'));
const appName = packageJson.productName;
const electronExecutable = require('electron');
const mainEntry = path.join(
	repoRoot,
	'electron-build',
	'main',
	'src',
	'electron',
	'main-process',
	'index.js'
);
const defaultIsolationRoot = path.join(
	repoRoot,
	'output',
	'playwright',
	'desktop-mutations'
);

function parseIsolationRoot() {
	const optionIndex = process.argv.indexOf('--isolated-dir');
	if (optionIndex === -1) return defaultIsolationRoot;

	const value = process.argv[optionIndex + 1];
	if (!value || value.startsWith('--')) {
		throw new Error('--isolated-dir requires a directory path');
	}
	return path.resolve(value);
}

function parseScenario() {
	const optionIndex = process.argv.indexOf('--scenario');
	if (optionIndex === -1) return 'all';

	const value = process.argv[optionIndex + 1];
	if (!['all', 'rename', 'delete', 'settings'].includes(value)) {
		throw new Error('--scenario must be all, rename, delete, or settings');
	}
	return value;
}

function createRunDirectory(root, scenario) {
	const runDirectory = path.join(
		root,
		`${scenario}-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
	);
	for (const directory of ['user-data', 'documents', 'temp']) {
		fs.mkdirSync(path.join(runDirectory, directory), {recursive: true});
	}
	return runDirectory;
}

function createBootstrap(runDirectory) {
	const bootstrapPath = path.join(runDirectory, 'bootstrap.cjs');
	fs.writeFileSync(
		bootstrapPath,
		`const {app} = require('electron');
app.setPath('userData', ${JSON.stringify(path.join(runDirectory, 'user-data'))});
app.setPath('documents', ${JSON.stringify(path.join(runDirectory, 'documents'))});
app.setPath('temp', ${JSON.stringify(path.join(runDirectory, 'temp'))});
require(${JSON.stringify(mainEntry)});
`,
		'utf8'
	);
	return bootstrapPath;
}

function storyPath(runDirectory, name) {
	const safeName = name.replace(/[^\w. -]/g, '_');
	return path.join(
		runDirectory,
		'documents',
		appName,
		'Stories',
		`${safeName}.html`
	);
}

async function firstWindow(electronApp) {
	for (let attempt = 0; attempt < 30; attempt++) {
		const windows = electronApp.windows();
		if (windows.length > 0) {
			const window = windows[0];
			window.setDefaultTimeout(10000);
			return window;
		}
		await new Promise(resolve => setTimeout(resolve, 500));
	}
	throw new Error('Electron did not create a renderer window within 15 seconds');
}

async function waitForFile(filePath, predicate, description) {
	const deadline = Date.now() + 10000;
	while (Date.now() < deadline) {
		if (fs.existsSync(filePath)) {
			const contents = fs.readFileSync(filePath, 'utf8');
			if (predicate(contents)) return contents;
		}
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	throw new Error(`Timed out waiting for ${description}: ${filePath}`);
}

async function skipWelcome(window, expectWelcome = false) {
	const skip = window.getByRole('button', {name: 'Skip'});
	if (expectWelcome) {
		await skip.waitFor();
		console.log('skip welcome: clicking Skip');
		await skip.click();
		console.log('skip welcome: reloading');
		await window.reload();
	}
	console.log(`waiting for Story tab at ${window.url()}`);
	await window.getByRole('tab', {name: 'Story'}).waitFor();
}

async function createStory(window, name) {
	await window.getByRole('button', {name: 'New', exact: true}).click();
	await window
		.getByRole('textbox', {
			name: 'What should your story be named? You can change this later.'
		})
		.fill(name);
	await window.getByRole('button', {name: 'Create', exact: true}).click();
	await window.getByText(appName, {exact: true}).first().waitFor();
}

async function canvasClick(window, label) {
	await window.evaluate(buttonLabel => {
		const button = Array.from(
			document.querySelectorAll('button, [role="button"], [aria-label], [title]')
		).find(candidate =>
			[
				candidate.getAttribute('aria-label'),
				candidate.getAttribute('title'),
				candidate.textContent
			]
				.filter(Boolean)
				.some(value => value.replace(/\s+/g, ' ').trim() === buttonLabel)
		);
		if (!button) throw new Error(`${buttonLabel} button not found`);
		button.click();
	}, label);
	await new Promise(resolve => setTimeout(resolve, 250));
}

async function editPassage(window, text) {
	await canvasClick(window, 'Untitled Passage');
	await canvasClick(window, 'Edit');
	await window.getByLabel('Passage Text').fill(text);
	await window.getByText(text).waitFor();
}

async function waitForTitle(window, expectedTitle) {
	const deadline = Date.now() + 10000;
	while (Date.now() < deadline) {
		if ((await window.title()) === expectedTitle) return;
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	throw new Error(`Story title did not update to ${JSON.stringify(expectedTitle)}`);
}

async function renameSelectedStory(window, originalName, newName) {
	await window
		.getByRole('dialog')
		.last()
		.getByRole('button', {name: 'Close', exact: true})
		.click();
	await window.getByRole('tab', {name: 'Story', exact: true}).click();
	await window
		.getByLabel('Story', {exact: true})
		.getByRole('button', {name: 'Rename', exact: true})
		.click();
	const prompt = window.getByRole('dialog', {
		name: `What should “${originalName}” be renamed to?`
	});
	const textbox = prompt.getByRole('textbox');
	await textbox.fill(newName);
	await prompt.getByRole('button', {name: 'OK', exact: true}).click();
	await waitForTitle(window, newName);
}

async function deleteSelectedStory(window) {
	await window.getByRole('button', {name: 'Delete', exact: true}).click();
	await window.getByRole('button', {name: 'Delete', exact: true}).last().click();
}

async function selectAlternateStoryFormat(window) {
	await window.getByRole('button', {name: 'Story Formats', exact: true}).click();
	const dialog = window.getByRole('dialog', {name: 'Story Formats'});
	const useButtons = dialog.getByRole('button', {
		name: 'Use As Default Story Format',
		exact: true
	});
	await useButtons.first().waitFor();

	for (let index = 0; index < (await useButtons.count()); index++) {
		const button = useButtons.nth(index);
		if (!(await button.isEnabled())) continue;
		const item = button.locator(
			'xpath=ancestor::div[contains(@class, "story-format-item")]'
		);
		const heading = await item.locator('h3').innerText();
		await button.click();
		return heading;
	}

	throw new Error('No alternate installed story format was available to select');
}

async function nativeClose(electronApp) {
	console.log('closing through BrowserWindow.close()');
	const closed = electronApp.waitForEvent('close');
	await electronApp.evaluate(({BrowserWindow}) => {
		BrowserWindow.getAllWindows()[0]?.close();
	});
	await closed;
}

async function launch(runDirectory) {
	const bootstrapPath = createBootstrap(runDirectory);
	return electron.launch({
		args: [bootstrapPath],
		executablePath: electronExecutable,
		env: {...process.env, ELECTRON_ENABLE_LOGGING: '1'}
	});
}

async function renameScenario(root) {
	const runDirectory = createRunDirectory(root, 'rename');
	const originalName = 'Immediate rename source';
	const renamedName = 'Immediate rename target';
	const latestText = 'Rename latest text';
	let electronApp;
	try {
		console.log(`rename scenario: ${runDirectory}`);
		electronApp = await launch(runDirectory);
		let window = await firstWindow(electronApp);
		await skipWelcome(window, true);
		await createStory(window, originalName);
		const oldPath = storyPath(runDirectory, originalName);
		const newPath = storyPath(runDirectory, renamedName);
		await waitForFile(oldPath, () => true, 'initial story file');
		await editPassage(window, latestText);
		if (fs.existsSync(oldPath) && fs.readFileSync(oldPath, 'utf8').includes(latestText)) {
			throw new Error('Rename latest text was already written before immediate close');
		}
		await renameSelectedStory(window, originalName, renamedName);
		await nativeClose(electronApp);
		electronApp = undefined;

		electronApp = await launch(runDirectory);
		window = await firstWindow(electronApp);
		await skipWelcome(window);
		await waitForFile(newPath, contents => contents.includes(latestText), 'renamed latest text');
		if (fs.existsSync(oldPath)) throw new Error(`Old story filename still exists: ${oldPath}`);
		if ((await window.getByText(originalName, {exact: true}).count()) !== 0) {
			throw new Error('Old story name appeared after restart');
		}
		await window.getByText(renamedName, {exact: true}).first().waitFor();
		console.log('rename scenario passed: latest text and only new filename survived');
	} finally {
		if (electronApp) await electronApp.close().catch(() => {});
	}
}

async function deleteScenario(root) {
	const runDirectory = createRunDirectory(root, 'delete');
	const storyName = 'Immediate delete story';
	let electronApp;
	try {
		console.log(`delete scenario: ${runDirectory}`);
		electronApp = await launch(runDirectory);
		let window = await firstWindow(electronApp);
		await skipWelcome(window, true);
		await createStory(window, storyName);
		await window.getByRole('button', {name: 'Back', exact: true}).click();
		await window.getByRole('button', {name: storyName, exact: true}).click();
		const filePath = storyPath(runDirectory, storyName);
		await waitForFile(filePath, () => true, 'story file before delete');
		await deleteSelectedStory(window);
		await nativeClose(electronApp);
		electronApp = undefined;
		if (fs.existsSync(filePath)) throw new Error(`Deleted story file still exists: ${filePath}`);

		electronApp = await launch(runDirectory);
		window = await firstWindow(electronApp);
		await skipWelcome(window);
		if ((await window.getByText(storyName, {exact: true}).count()) !== 0) {
			throw new Error('Deleted story appeared after restart');
		}
		console.log('delete scenario passed: file and story were absent after restart');
	} finally {
		if (electronApp) await electronApp.close().catch(() => {});
	}
}

async function settingsScenario(root) {
	const runDirectory = createRunDirectory(root, 'settings');
	const prefsPath = path.join(runDirectory, 'user-data', 'prefs.json');
	const formatsPath = path.join(runDirectory, 'user-data', 'story-formats.json');
	let electronApp;
	try {
		console.log(`settings scenario: ${runDirectory}`);
		electronApp = await launch(runDirectory);
		let window = await firstWindow(electronApp);
		await skipWelcome(window, true);
		// Built-in format installation is repaired and persisted during startup;
		// there is no offline UI action that changes its metadata without adding a
		// remote format. Preserve and verify that installed metadata across close.
		await waitForFile(
			formatsPath,
			contents => contents.includes('Harlowe') && contents.includes('3.3.9'),
			'installed story format metadata'
		);
		await window.getByRole('tab', {name: appName, exact: true}).click();
		await window.getByRole('button', {name: 'Preferences', exact: true}).click();
		const preferences = window.getByRole('dialog', {name: 'Preferences'});
		await preferences.getByLabel('Theme').selectOption('dark');
		await preferences.getByRole('button', {name: 'Close', exact: true}).click();
		const selectedFormatHeading = await selectAlternateStoryFormat(window);
		await nativeClose(electronApp);
		electronApp = undefined;

		electronApp = await launch(runDirectory);
		window = await firstWindow(electronApp);
		await skipWelcome(window);
		await window.getByRole('tab', {name: appName, exact: true}).click();
		await window.getByRole('button', {name: 'Preferences', exact: true}).click();
		const reopenedPreferences = window.getByRole('dialog', {name: 'Preferences'});
		if (await reopenedPreferences.getByLabel('Theme').inputValue() !== 'dark') {
			throw new Error('Dark theme preference did not persist after immediate close');
		}
		const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
		if (prefs.appTheme !== 'dark') throw new Error('prefs.json did not persist appTheme=dark');
		const selectedFormatMatch = selectedFormatHeading.match(/^(.*) (\d+(?:\.\d+)+)$/);
		if (
			!selectedFormatMatch ||
			prefs.storyFormat.name !== selectedFormatMatch[1] ||
			prefs.storyFormat.version !== selectedFormatMatch[2]
		) {
			throw new Error(
				`prefs.json did not persist selected format ${JSON.stringify(selectedFormatHeading)}`
			);
		}
		const formats = JSON.parse(fs.readFileSync(formatsPath, 'utf8'));
		if (!formats.some(format => format.name === 'Harlowe' && format.version === '3.3.9')) {
			throw new Error('story-formats.json lost installed Harlowe metadata');
		}
		console.log('settings scenario passed: theme preference and installed format metadata survived restart');
	} finally {
		if (electronApp) await electronApp.close().catch(() => {});
	}
}

async function main() {
	const root = parseIsolationRoot();
	const scenario = parseScenario();
	fs.mkdirSync(root, {recursive: true});
	if (scenario === 'all' || scenario === 'rename') await renameScenario(root);
	if (scenario === 'all' || scenario === 'delete') await deleteScenario(root);
	if (scenario === 'all' || scenario === 'settings') await settingsScenario(root);
	console.log(`desktop mutation acceptance passed: ${scenario}`);
}

main().catch(error => {
	console.error(error.stack || error);
	process.exitCode = 1;
});

