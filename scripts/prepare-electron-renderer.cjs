// Node's filesystem API avoids shell-specific quoting and external zip tools.
// The standalone browser deliverable is dist/web; desktop uses the same files.
const {cpSync} = require('node:fs');
const {resolve} = require('node:path');

const root = resolve(__dirname, '..');
cpSync(resolve(root, 'dist/web'), resolve(root, 'electron-build/renderer'), {
	recursive: true
});
