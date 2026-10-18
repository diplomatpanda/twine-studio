// Native story-format compatibility and editor-code trust check.
// Build the Electron renderer/main entry points first. This script creates a
// disposable profile and fixture under --isolated-dir (or ../../work).
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium, _electron: electron} = require('playwright');

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
const defaultRoot = path.resolve(repoRoot, '..', '..', 'work', 'desktop-formats');

function option(name, fallback) {
	const index = process.argv.indexOf(name);
	if (index === -1) return fallback;
	const value = process.argv[index + 1];
	if (!value || value.startsWith('--')) throw new Error(`${name} requires a path`);
	return path.resolve(value);
}

function makeRun(root) {
	const run = path.join(root, `run-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
	for (const name of ['user-data', 'documents', 'temp', 'fixture'])
		fs.mkdirSync(path.join(run, name), {recursive: true});
	return run;
}

function bootstrap(run) {
	const file = path.join(run, 'bootstrap.cjs');
	const openPathLog = path.join(run, 'open-path.txt');
	const publishedPath = path.join(run, 'temp', 'native-published.html');
	fs.writeFileSync(file, `const {app, shell} = require('electron');
const fs = require('node:fs');
app.setPath('userData', ${JSON.stringify(path.join(run, 'user-data'))});
app.setPath('documents', ${JSON.stringify(path.join(run, 'documents'))});
app.setPath('temp', ${JSON.stringify(path.join(run, 'temp'))});
app.setPath('downloads', ${JSON.stringify(path.join(run, 'temp'))});
const prefsPath = ${JSON.stringify(path.join(run, 'user-data', 'prefs.json'))};
if (!fs.existsSync(prefsPath)) fs.writeFileSync(prefsPath, JSON.stringify({welcomeSeen: true}), 'utf8');
shell.openPath = async target => { fs.writeFileSync(${JSON.stringify(openPathLog)}, target, 'utf8'); return ''; };
app.on('web-contents-created', (_event, contents) => contents.session.on('will-download', (_event, item) => item.setSavePath(${JSON.stringify(publishedPath)})));
require(${JSON.stringify(mainEntry)});
`, 'utf8');
	return {file, openPathLog, publishedPath};
}

function fixture(run) {
	const template = `<!doctype html><html><head><meta charset="utf-8"><title>Native Fixture</title></head><body><h1>Native Fixture</h1>{{STORY_DATA}}<main id="story"></main><script>
const data = document.querySelector('tw-storydata');
const first = data && data.querySelector('tw-passagedata');
if (first) document.querySelector('#story').textContent = first.textContent;
</script></body></html>`;
	const source = `(() => {
  try { parent.localStorage.setItem('native-format-parent', 'unsafe'); } catch (_) {}
  try { localStorage.setItem('native-format-frame', 'unsafe'); } catch (_) {}
  window.storyFormat(${JSON.stringify({
		name: 'Native Fixture',
		version: '1.0.0',
		author: "<strong>Safe author</strong><img src=x onerror=\"localStorage.setItem('native-format-xss','unsafe')\">",
	description: 'Native local-file fixture',
	source: template,
	hydrate: 'this.hydrated = true; localStorage.setItem("native-format-hydrate", "ran");',
	})});
})();`;
	const file = path.join(run, 'fixture', 'native-format.js');
	fs.writeFileSync(file, source, 'utf8');
	return file;
}

async function firstWindow(app) {
	for (let i = 0; i < 40; i++) {
		if (app.windows().length) {
			const window = app.windows()[0];
			window.setDefaultTimeout(15000);
			return window;
		}
		await new Promise(resolve => setTimeout(resolve, 500));
	}
	throw new Error('Electron did not create a renderer window within 20 seconds');
}

async function launch(run) {
	const boot = bootstrap(run);
	return electron.launch({
		args: [boot.file],
		executablePath: electronExecutable,
		env: {...process.env, ELECTRON_ENABLE_LOGGING: '1'}
	});
}

async function skipWelcome(window) {
	const skip = window.getByRole('button', {name: 'Skip', exact: true});
	if (await skip.count()) {
		await skip.click({force: true});
		await window.waitForTimeout(500);
	}
	try {
		await window.getByRole('button', {name: 'New', exact: true}).waitFor();
	} catch (error) {
		console.error('renderer body:', await window.locator('body').innerText().catch(() => '<unreadable>'));
		throw error;
	}
}

async function openFormats(window) {
	const appTab = window.getByRole('tab', {name: 'Twine Studio', exact: true});
	if (await appTab.count()) await appTab.click();
	try {
		await window.getByRole('button', {name: 'Story Formats', exact: true}).click();
	} catch (error) {
		console.error('open formats body:', await window.locator('body').innerText().catch(() => '<unreadable>'));
		throw error;
	}
	return window.getByRole('dialog', {name: 'Story Formats'});
}

function formatItem(dialog, heading) {
	return dialog.locator('.story-format-item').filter({hasText: heading});
}

async function closeDialog(window) {
	await window.getByRole('dialog').last().getByRole('button', {name: 'Close', exact: true}).click();
}

async function createStory(window, name) {
	const back = window.getByRole('button', {name: 'Back', exact: true});
	if (await back.count()) {
		await back.click();
		await window.getByRole('button', {name: 'New', exact: true}).waitFor();
	}
	await window.getByRole('button', {name: 'New', exact: true}).click();
	try { await window.getByRole('textbox', {name: 'What should your story be named? You can change this later.'}).fill(name); } catch (error) {
		console.error('new story body:', await window.locator('body').innerText().catch(() => '<unreadable>'));
		throw error;
	}
	await window.getByRole('button', {name: 'Create', exact: true}).click();
	await window.getByRole('button', {name: 'Untitled Passage', exact: true}).waitFor();
}

async function editFirstPassage(window, text) {
	await window.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
	const dialog = window.getByRole('dialog').last();
	await dialog.getByLabel('Passage Text', {exact: true}).fill(text);
	await dialog.getByRole('button', {name: 'Close', exact: true}).click();
}

async function expectCodeMirrorText(dialog, expected) {
	const text = await dialog.locator('.CodeMirror-code').innerText();
	if (!text.includes(expected)) throw new Error(`CodeMirror did not contain ${expected}: ${text}`);
}

async function markers(window) {
	return window.evaluate(() => [
		'native-format-parent',
		'native-format-frame',
		'native-format-hydrate',
		'native-format-xss'
	].map(key => localStorage.getItem(key)));
}

async function nativeClose(app) {
	const closed = app.waitForEvent('close');
	await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0]?.close());
	await closed;
}

async function main() {
	const run = makeRun(option('--isolated-dir', defaultRoot));
	const formatFile = fixture(run);
	let app;
	try {
		console.log(`isolated run: ${run}`);
		const boot = bootstrap(run);
		app = await electron.launch({args: [boot.file], executablePath: electronExecutable, env: {...process.env, ELECTRON_ENABLE_LOGGING: '1'}});
		let window = await firstWindow(app);
		await skipWelcome(window);
		await createStory(window, 'Bundled format check');

		// Bundled format loading and editor extension path: Harlowe must be loaded,
		// and opening its passage editor must expose CodeMirror/format toolbar UI.
		let dialog = await openFormats(window);
		const harlowe = formatItem(dialog, 'Harlowe 3.3.9');
		try { await harlowe.waitFor(); } catch (error) {
			console.error('formats dialog:', await dialog.innerText().catch(() => '<unreadable>'));
			throw error;
		}
		await closeDialog(window);
		await window.getByRole('button', {name: 'Untitled Passage', exact: true}).dblclick();
		const bundledEditor = window.getByRole('dialog').last();
		await bundledEditor.locator('.CodeMirror').waitFor();
		const bundledToolbar = bundledEditor.locator('.story-format-toolbar');
		await bundledToolbar.waitFor();
		await bundledToolbar.getByRole('button', {name: 'Styles', exact: true}).click();
		await bundledEditor.getByRole('button', {name: /Bold/}).click();
		await expectCodeMirrorText(bundledEditor, "''Bold Text''");
		await bundledEditor.getByRole('button', {name: 'Close', exact: true}).click();

		// Add a local file format. No format code may reach the parent until trust.
		dialog = await openFormats(window);
		await dialog.getByRole('button', {name: 'Add', exact: true}).click();
		await window.locator('.add-format-button input').fill(pathToFileURL(formatFile).href);
		await window.locator('.add-format-button form').getByRole('button', {name: 'Add', exact: true}).click();
		const custom = formatItem(dialog, 'Native Fixture 1.0.0');
		await custom.waitFor();
		await custom.getByText('Safe author').waitFor();
		if (await custom.locator('img').count()) throw new Error('Format metadata rendered an unsafe image');
		if (JSON.stringify(await markers(window)).includes('unsafe')) throw new Error('Local format executed before trust');

		await custom.getByRole('button', {name: 'Use As Default Story Format', exact: true}).click();
		await closeDialog(window);
		await createStory(window, 'Native format story');
		await editFirstPassage(window, 'Native file story content.');
		await window.getByRole('tab', {name: 'Build', exact: true}).click();
		await window.getByRole('button', {name: 'Play', exact: true}).click();
		const openDeadline = Date.now() + 10000;
		while (!fs.existsSync(boot.openPathLog) && Date.now() < openDeadline) await new Promise(resolve => setTimeout(resolve, 100));
		if (!fs.existsSync(boot.openPathLog)) throw new Error('Native Play did not call shell.openPath');
		const scratchPath = fs.readFileSync(boot.openPathLog, 'utf8');
		const played = fs.readFileSync(scratchPath, 'utf8');
		if (!played.includes('Native Fixture') || !played.includes('Native file story content.')) throw new Error('Native Play scratch HTML was incomplete');
		const browser = await chromium.launch();
		try {
			const preview = await browser.newPage();
			await preview.goto(pathToFileURL(scratchPath).href);
			await preview.locator('h1').waitFor();
			if ((await preview.locator('#story').innerText()) !== 'Native file story content.') throw new Error('Native scratch fixture did not execute in a browser');
		} finally {
			await browser.close();
		}
		await window.getByRole('button', {name: 'Publish to File', exact: true}).click();
		const publishDeadline = Date.now() + 10000;
		while (!fs.existsSync(boot.publishedPath) && Date.now() < publishDeadline) await new Promise(resolve => setTimeout(resolve, 100));
		if (!fs.existsSync(boot.publishedPath) || !fs.readFileSync(boot.publishedPath, 'utf8').includes('Native file story content.')) throw new Error('Native publication omitted passage content');

		// Exact source hash approval executes editor code and hydrate in the parent.
		await openFormats(window);
		const trustedItem = formatItem(window.getByRole('dialog', {name: 'Story Formats'}), 'Native Fixture 1.0.0');
		await trustedItem.getByRole('button', {name: 'Trust editor code', exact: true}).click();
		await trustedItem.locator('.confirm-button .card').getByRole('button', {name: 'Trust editor code', exact: true}).click();
		await trustedItem.getByRole('button', {name: 'Revoke editor code trust', exact: true}).waitFor();
		const afterTrust = await markers(window);
		if (afterTrust[0] !== 'unsafe' || afterTrust[1] !== 'unsafe' || afterTrust[2] !== 'ran' || afterTrust[3] !== null) throw new Error(`Unexpected trusted markers: ${JSON.stringify(afterTrust)}`);
		await window.evaluate(() => ['native-format-parent', 'native-format-frame', 'native-format-hydrate', 'native-format-xss'].forEach(key => localStorage.removeItem(key)));
		await closeDialog(window);
		await nativeClose(app);
		app = undefined;

		// Trust persists across a native close/reopen and executes the same snapshot.
		app = await launch(run);
		window = await firstWindow(app);
		await skipWelcome(window);
		await openFormats(window);
		const reopened = formatItem(window.getByRole('dialog', {name: 'Story Formats'}), 'Native Fixture 1.0.0');
		await reopened.getByRole('button', {name: 'Revoke editor code trust', exact: true}).waitFor();
		// Trust metadata survives native close/reopen. Depending on load timing,
		// opening the list may also reload the trusted extensions.
		const afterReopen = await markers(window);
		const expectedReopen = JSON.stringify(afterReopen);
		if (expectedReopen !== JSON.stringify([null, null, null, null]) && expectedReopen !== JSON.stringify(['unsafe', 'unsafe', 'ran', null])) throw new Error(`Unexpected editor execution while reopening formats: ${expectedReopen}`);

		await window.evaluate(() => ['native-format-parent', 'native-format-frame', 'native-format-hydrate', 'native-format-xss'].forEach(key => localStorage.removeItem(key)));
		await reopened.getByRole('button', {name: 'Revoke editor code trust', exact: true}).click();
		await reopened.locator('.confirm-button .card').getByRole('button', {name: 'Revoke trust', exact: true}).click();
		await reopened.getByRole('button', {name: 'Trust editor code', exact: true}).waitFor();
		// Existing trusted extensions may have already run before revocation. Clear
		// those markers before the close/reopen check, which tests the durable boundary.
		await window.evaluate(() => ['native-format-parent', 'native-format-frame', 'native-format-hydrate', 'native-format-xss'].forEach(key => localStorage.removeItem(key)));
		await closeDialog(window);
		await nativeClose(app);
		app = undefined;

		app = await launch(run);
		window = await firstWindow(app);
		await skipWelcome(window);
		await openFormats(window);
		const revoked = formatItem(window.getByRole('dialog', {name: 'Story Formats'}), 'Native Fixture 1.0.0');
		await revoked.getByRole('button', {name: 'Trust editor code', exact: true}).waitFor();
		if (JSON.stringify(await markers(window)).includes('unsafe') || JSON.stringify(await markers(window)).includes('ran')) throw new Error('Revoked trust returned after reopen');
		console.log(JSON.stringify({bundledHarlowe: true, nativeFileLoad: true, nativePreview: true, nativePublish: true, exactTrust: true, revokePersists: true, run}));
	} finally {
		if (app) await app.close();
	}
}

main().catch(error => {
	console.error(error.stack || error);
	process.exitCode = 1;
});
