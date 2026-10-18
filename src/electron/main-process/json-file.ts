// Manages reading and writing JSON files to the application data folder. This
// listens to the `save-json` IPC event.

import {app} from 'electron';
import {readJson, readJsonSync, rename, writeJson} from 'fs-extra';
import {join} from 'path';
import {randomUUID} from 'crypto';

/**
 * Returns a promise resolving to the contents of a JSON file in the app data
 * folder. The promise rejects if there are any problems reading the file,
 * including if the file does not exist.
 */
export function loadJsonFile(filename: string) {
	return readJson(join(app.getPath('userData'), filename));
}

/**
 * Reads a JSON file in the app data folder synchronously.
 */
export function loadJsonFileSync(filename: string) {
	return readJsonSync(join(app.getPath('userData'), filename));
}

/**
 * Saves an object to JSON in the app data folder. Returns a promise when done.
 */
export async function saveJsonFile(filename: string, data: any) {
	const destination = join(app.getPath('userData'), filename);
	// Callers serialize writes per filename. A failed write leaves the previous
	// settings intact; rename replaces it only after the complete JSON is ready.
	const temporary = `${destination}.${randomUUID()}.tmp`;
	await writeJson(temporary, data);
	await rename(temporary, destination);
}
