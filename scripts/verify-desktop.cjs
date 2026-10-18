const fs = require('node:fs');
const path = require('node:path');
const {_electron: electron} = require('playwright');
const verbose = process.env.VERIFY_DESKTOP_VERBOSE === '1';
const nativeWindowClose = process.argv.includes('--native-window-close');

const repoRoot = path.resolve(__dirname, '..');
const defaultIsolationRoot = path.join(
	repoRoot,
	'output',
	'playwright',
	'desktop-test'
);
const appName = require(path.join(repoRoot, 'package.json')).productName;
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

function parseIsolationRoot() {
	const optionIndex = process.argv.indexOf('--isolated-dir');
	if (optionIndex === -1) return defaultIsolationRoot;

	const value = process.argv[optionIndex + 1];
	if (!value || value.startsWith('--')) {
		throw new Error('--isolated-dir requires a directory path');
	}

	return path.resolve(value);
}

function createRunDirectory(root) {
	fs.mkdirSync(root, {recursive: true});
	const runDirectory = path.join(
		root,
		`run-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`
	);
	fs.mkdirSync(runDirectory);
	for (const directory of ['user-data', 'documents', 'temp']) {
		fs.mkdirSync(path.join(runDirectory, directory));
	}
	return runDirectory;
}

async function waitForFileToContain(filePath, expectedText) {
	const deadline = Date.now() + 10000;
	while (Date.now() < deadline) {
		if (
			fs.existsSync(filePath) &&
			fs.readFileSync(filePath, 'utf8').includes(expectedText)
		) {
			return;
		}
		await new Promise(resolve => setTimeout(resolve, 250));
	}
	throw new Error(
		`Story file did not contain ${JSON.stringify(expectedText)}: ${filePath}`
	);
}

function createBootstrap(runDirectory) {
	const bootstrapPath = path.join(runDirectory, 'bootstrap.cjs');
	const source = `
const {app} = require('electron');

app.setPath('userData', ${JSON.stringify(path.join(runDirectory, 'user-data'))});
app.setPath('documents', ${JSON.stringify(path.join(runDirectory, 'documents'))});
app.setPath('temp', ${JSON.stringify(path.join(runDirectory, 'temp'))});

require(${JSON.stringify(mainEntry)});
`;
	fs.writeFileSync(bootstrapPath, source, 'utf8');
	return bootstrapPath;
}

async function skipWelcome(window) {
	console.log('skip welcome: clicking Skip');
	await window.getByRole('button', {name: 'Skip', exact: true}).click();
	console.log('skip welcome: reloading');
	await window.reload();
	console.log('skip welcome: waiting for Story tab');
	await window.getByRole('tab', {name: 'Story'}).waitFor();
}

async function firstWindow(electronApp) {
	for (let attempt = 0; attempt < 30; attempt++) {
		const windows = electronApp.windows();
		if (windows.length > 0) {
			const window = windows[0];
			window.setDefaultTimeout(10000);
			if (verbose) {
				window.on('console', message =>
					console.log(`[renderer:${message.type()}] ${message.text()}`)
				);
				window.on('pageerror', error =>
					console.error(`[renderer:error] ${error.message}`)
				);
			}
			console.log(`window ready: ${window.url()}`);
			return window;
		}
		await new Promise(resolve => setTimeout(resolve, 500));
	}
	throw new Error(
		'Electron did not create a renderer window within 15 seconds'
	);
}

async function clickCanvasControl(window, label) {
	// Passage cards are canvas controls whose React handlers can remain pending
	// while the editor route updates. Scheduling this renderer-side click keeps
	// Playwright from waiting on that transient actionability state.
	await window.evaluate(buttonLabel => {
		const button = Array.from(
			document.querySelectorAll(
				'button, [role="button"], [aria-label], [title]'
			)
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
		setTimeout(() => button.click(), 0);
	}, label);
	await new Promise(resolve => setTimeout(resolve, 250));
}

async function doubleClickCanvasControl(window, label) {
	// Story cards use the same canvas interaction and open on double-click.
	await window.evaluate(buttonLabel => {
		const button = Array.from(
			document.querySelectorAll(
				'button, [role="button"], [aria-label], [title]'
			)
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
		setTimeout(
			() => button.dispatchEvent(new MouseEvent('dblclick', {bubbles: true})),
			0
		);
	}, label);
	await new Promise(resolve => setTimeout(resolve, 500));
}

async function createStory(window, name) {
	await skipWelcome(window);
	console.log('create story: opening New');
	await window.getByRole('button', {name: 'New', exact: true}).click();
	console.log('create story: filling name');
	await window
		.getByRole('textbox', {
			name: 'What should your story be named? You can change this later.'
		})
		.fill(name);
	console.log('create story: submitting');
	await window.getByRole('button', {name: 'Create', exact: true}).click();
	console.log('create story: story editor is visible');
}

async function editPassage(window, text) {
	console.log('edit passage: selecting Untitled Passage');
	await clickCanvasControl(window, 'Untitled Passage');
	console.log('edit passage: clicking Edit');
	await clickCanvasControl(window, 'Edit');
	console.log('edit passage: filling text');
	await window.getByLabel('Passage Text').fill(text);
	console.log('edit passage: waiting for text');
	await window.getByText(text).waitFor();
}

async function closeElectronApp(electronApp) {
	if (!nativeWindowClose) {
		await electronApp.close();
		return;
	}

	console.log('closing through BrowserWindow.close()');
	const appClosed = electronApp.waitForEvent('close');
	await electronApp.evaluate(({BrowserWindow}) => {
		BrowserWindow.getAllWindows()[0]?.close();
	});
	await appClosed;
}

async function main() {
	const runDirectory = createRunDirectory(parseIsolationRoot());
	const bootstrapPath = createBootstrap(runDirectory);
	const storyName = 'Desktop smoke story';
	const passageText = 'Retained after restart';
	let electronApp;
	let screenshotPath;

	try {
		console.log(`isolated run: ${runDirectory}`);
		electronApp = await electron.launch({
			args: [bootstrapPath],
			executablePath: electronExecutable,
			env: {...process.env, ELECTRON_ENABLE_LOGGING: '1'}
		});
		if (verbose) {
			electronApp
				.process()
				.stdout?.on('data', data =>
					console.log(`[main] ${data.toString().trimEnd()}`)
				);
			electronApp
				.process()
				.stderr?.on('data', data =>
					console.error(`[main:error] ${data.toString().trimEnd()}`)
				);
		}

		let window = await firstWindow(electronApp);
		await window.getByRole('button', {name: 'Skip'}).waitFor();
		await createStory(window, storyName);
		await window.getByText(appName, {exact: true}).first().waitFor();
		console.log(`app identity: ${appName}`);
		await editPassage(window, passageText);
		const storyFile = path.join(
			runDirectory,
			'documents',
			appName,
			'Stories',
			`${storyName}.html`
		);
		const legacyTwineDirectory = path.join(runDirectory, 'documents', 'Twine');
		if (appName !== 'Twine' && fs.existsSync(legacyTwineDirectory)) {
			throw new Error(
				`Unexpected legacy Twine directory created at ${legacyTwineDirectory}`
			);
		}
		if (
			fs.existsSync(storyFile) &&
			fs.readFileSync(storyFile, 'utf8').includes(passageText)
		) {
			throw new Error(
				'Latest passage text was already written before the immediate-close check'
			);
		}

		console.log('closing immediately after editor change');
		await closeElectronApp(electronApp);
		electronApp = undefined;

		electronApp = await electron.launch({
			args: [bootstrapPath],
			executablePath: electronExecutable,
			env: {...process.env, ELECTRON_ENABLE_LOGGING: '1'}
		});
		if (verbose) {
			electronApp
				.process()
				.stdout?.on('data', data =>
					console.log(`[main] ${data.toString().trimEnd()}`)
				);
			electronApp
				.process()
				.stderr?.on('data', data =>
					console.error(`[main:error] ${data.toString().trimEnd()}`)
				);
		}
		window = await firstWindow(electronApp);
		console.log('restart: opening saved story');
		await waitForFileToContain(storyFile, passageText);
		await doubleClickCanvasControl(window, storyName);
		await clickCanvasControl(window, 'Untitled Passage');
		await clickCanvasControl(window, 'Edit');
		const passageEditor = window.locator('.CodeMirror').last();
		await passageEditor.waitFor();
		const retainedText = await passageEditor.innerText();
		if (!retainedText.includes(passageText)) {
			throw new Error(
				`Passage text did not persist: expected ${JSON.stringify(
					passageText
				)}, got ${JSON.stringify(retainedText)}`
			);
		}
		screenshotPath = path.join(runDirectory, 'after-restart.png');
		await window.screenshot({path: screenshotPath});

		console.log(`retained story: ${storyName}`);
		console.log(`retained passage text: ${passageText}`);
		console.log(`screenshot: ${screenshotPath}`);
	} finally {
		if (electronApp) {
			await electronApp.close().catch(error => {
				console.error(`failed to close Electron: ${error.message}`);
			});
		}
	}
}

main().catch(error => {
	console.error(error.stack || error);
	process.exitCode = 1;
});
