import {app, safeStorage} from 'electron';
import {randomUUID} from 'crypto';
import {mkdir, readFile, rename, unlink, writeFile} from 'fs/promises';
import path from 'path';

const FILENAME = 'opencode-go-key.enc';
const MAX_KEY_LENGTH = 4096;
const MAX_CIPHERTEXT_BYTES = 16 * 1024;
const ENV_NAME = 'TWINE_STUDIO_OPENCODE_GO_KEY';

function credentialPath() {
	return path.join(app.getPath('userData'), FILENAME);
}

function environmentKey() {
	const value = process.env[ENV_NAME];
	return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export async function credentialStorageAvailable() {
	if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
	// Electron's basic_text fallback uses a hardcoded password, not an OS secret store.
	return process.platform !== 'linux' ||
		safeStorage.getSelectedStorageBackend() !== 'basic_text';
}

async function requireSecureStorage() {
	if (!(await credentialStorageAvailable())) {
		throw new Error('Secure credential storage is unavailable on this device.');
	}
}

async function savedKey() {
	let encrypted: Buffer;
	try {
		encrypted = await readFile(credentialPath());
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
		throw new Error('Could not read the saved OpenCode Go key.');
	}
	if (!encrypted.length || encrypted.length > MAX_CIPHERTEXT_BYTES) {
		throw new Error('The saved OpenCode Go key is invalid. Re-enter it.');
	}
	await requireSecureStorage();
	try {
		const {result} = await safeStorage.decryptStringAsync(encrypted);
		if (!result || result.length > MAX_KEY_LENGTH) throw new Error();
		return result;
	} catch {
		throw new Error('The saved OpenCode Go key could not be opened. Re-enter it.');
	}
}

export async function getAiKey() {
	return environmentKey() ?? savedKey();
}

export async function aiCredentialStatus() {
	const storageAvailable = await credentialStorageAvailable();
	if (environmentKey()) return {source: 'environment', storageAvailable};
	const key = await savedKey();
	return {source: key ? 'saved' : 'none', storageAvailable};
}

export async function saveAiKey(value: unknown) {
	if (typeof value !== 'string') throw new Error('Enter an OpenCode Go key.');
	const key = value.trim();
	if (!key || key.length > MAX_KEY_LENGTH || /\s/.test(key)) {
		throw new Error('Enter a valid OpenCode Go key without spaces.');
	}
	await requireSecureStorage();
	const encrypted = await safeStorage.encryptStringAsync(key);
	if (!encrypted.length || encrypted.length > MAX_CIPHERTEXT_BYTES) {
		throw new Error('Could not encrypt the OpenCode Go key.');
	}
	const destination = credentialPath();
	const temporary = `${destination}.${randomUUID()}.tmp`;
	await mkdir(path.dirname(destination), {recursive: true});
	try {
		await writeFile(temporary, encrypted, {flag: 'wx', mode: 0o600});
		await rename(temporary, destination);
	} catch {
		await unlink(temporary).catch(() => undefined);
		throw new Error('Could not save the OpenCode Go key.');
	}
}

export async function clearAiKey() {
	try {
		await unlink(credentialPath());
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
			throw new Error('Could not remove the saved OpenCode Go key.');
		}
	}
}
