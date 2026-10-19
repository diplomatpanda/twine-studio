import {app, safeStorage} from 'electron';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'fs/promises';
import {tmpdir} from 'os';
import path from 'path';
import {
	aiCredentialStatus,
	clearAiKey,
	getAiKey,
	saveAiKey
} from '../ai-credentials';

jest.mock('electron');

describe('OpenCode Go credential storage', () => {
	let directory: string;
	let getPath: jest.SpyInstance;
	const priorEnvironmentKey = process.env.TWINE_STUDIO_OPENCODE_GO_KEY;

	beforeEach(async () => {
		directory = await mkdtemp(path.join(tmpdir(), 'twine-studio-credential-'));
		getPath = jest.spyOn(app, 'getPath').mockReturnValue(directory);
		delete process.env.TWINE_STUDIO_OPENCODE_GO_KEY;
		(safeStorage.isAsyncEncryptionAvailable as jest.Mock).mockResolvedValue(true);
		(safeStorage.getSelectedStorageBackend as jest.Mock).mockReturnValue('gnome_libsecret');
		(safeStorage.encryptStringAsync as jest.Mock).mockImplementation(async (key: string) =>
			Buffer.from(`encrypted:${Buffer.from(key).toString('base64')}`)
		);
		(safeStorage.decryptStringAsync as jest.Mock).mockImplementation(async (value: Buffer) => ({
			result: Buffer.from(value.toString().replace(/^encrypted:/, ''), 'base64').toString(),
			shouldReEncrypt: false
		}));
	});

	afterEach(async () => {
		getPath.mockRestore();
		await rm(directory, {recursive: true, force: true});
		if (priorEnvironmentKey === undefined) delete process.env.TWINE_STUDIO_OPENCODE_GO_KEY;
		else process.env.TWINE_STUDIO_OPENCODE_GO_KEY = priorEnvironmentKey;
	});

	it('encrypts a saved key and never returns it in status', async () => {
		await saveAiKey('  private-example-key  ');
		const disk = await readFile(path.join(directory, 'opencode-go-key.enc'));
		expect(disk.toString()).not.toContain('private-example-key');
		expect(await getAiKey()).toBe('private-example-key');
		expect(await aiCredentialStatus()).toEqual({source: 'saved', storageAvailable: true});
		await clearAiKey();
		expect(await getAiKey()).toBeUndefined();
	});

	it('keeps environment configuration separate from saved credentials', async () => {
		await saveAiKey('saved-example-key');
		process.env.TWINE_STUDIO_OPENCODE_GO_KEY = 'environment-example-key';
		expect(await getAiKey()).toBe('environment-example-key');
		expect(await aiCredentialStatus()).toEqual({source: 'environment', storageAvailable: true});
		await clearAiKey();
		expect(await getAiKey()).toBe('environment-example-key');
	});

	it('replaces a saved key without leaving a plaintext or temporary file', async () => {
		await saveAiKey('first-example-key');
		await saveAiKey('second-example-key');
		expect(await getAiKey()).toBe('second-example-key');
		expect(await readdir(directory)).toEqual(['opencode-go-key.enc']);
		const disk = await readFile(path.join(directory, 'opencode-go-key.enc'));
		expect(disk.toString()).not.toContain('second-example-key');
	});

	it('rejects invalid keys and corrupt ciphertext without revealing data', async () => {
		await expect(saveAiKey('bad key')).rejects.toThrow('without spaces');
		await writeFile(path.join(directory, 'opencode-go-key.enc'), Buffer.alloc(0));
		await expect(getAiKey()).rejects.toThrow('saved OpenCode Go key is invalid');
	});

	it('refuses storage when encryption is unavailable', async () => {
		(safeStorage.isAsyncEncryptionAvailable as jest.Mock).mockResolvedValue(false);
		await expect(saveAiKey('private-example-key')).rejects.toThrow('Secure credential storage');
		expect(await aiCredentialStatus()).toEqual({source: 'none', storageAvailable: false});
	});

	it('refuses the Linux basic_text fallback', async () => {
		const originalPlatform = process.platform;
		Object.defineProperty(process, 'platform', {value: 'linux'});
		(safeStorage.getSelectedStorageBackend as jest.Mock).mockReturnValue('basic_text');
		try {
			await expect(saveAiKey('private-example-key')).rejects.toThrow('Secure credential storage');
		} finally {
			Object.defineProperty(process, 'platform', {value: originalPlatform});
		}
	});
});
