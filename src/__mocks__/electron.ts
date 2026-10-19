export const app = {
	disableHardwareAcceleration: jest.fn(),
	getName() {
		return `mock-electron-app-name`;
	},
	getPath(name: string) {
		return `mock-electron-app-path-${name}`;
	},
	on: jest.fn(),
	quit: jest.fn(),
	relaunch: jest.fn()
};

export class BrowserWindow {
	static instances: BrowserWindow[] = [];

	public readonly options: any;
	public readonly webContents: any;

	public readonly on = jest.fn();
	public readonly once = jest.fn();
	public readonly setEnabled = jest.fn();
	public readonly focus = jest.fn();
	public readonly show = jest.fn();
	public readonly close = jest.fn();

	constructor(options: any = {}) {
		BrowserWindow.instances.push(this);
		this.options = options;
		this.webContents = {
			executeJavaScript: jest.fn().mockResolvedValue(undefined),
			on: jest.fn(),
			setWindowOpenHandler: jest.fn()
		};
	}

	loadURL = jest.fn().mockResolvedValue(undefined);

	static getFocusedWindow = jest.fn();
	static fromWebContents = jest.fn();
}

export const dialog = {
	showErrorBox: jest.fn(),
	showOpenDialog: jest.fn().mockResolvedValue({canceled: true}),
	showMessageBox: jest.fn().mockResolvedValue({response: 0})
};

export const ipcMain = {
	handle: jest.fn(),
	on: jest.fn()
};

export const safeStorage = {
	isAsyncEncryptionAvailable: jest.fn().mockResolvedValue(true),
	getSelectedStorageBackend: jest.fn().mockReturnValue('gnome_libsecret'),
	encryptStringAsync: jest.fn(async (value: string) => Buffer.from(`encrypted:${Buffer.from(value).toString('base64')}`)),
	decryptStringAsync: jest.fn(async (value: Buffer) => ({
		result: Buffer.from(value.toString().replace(/^encrypted:/, ''), 'base64').toString(),
		shouldReEncrypt: false
	}))
};

export const screen = {
	getPrimaryDisplay() {
		return {workAreaSize: {height: 480, width: 640}};
	}
};

export const shell = {
	openExternal: jest.fn(),
	openPath: jest.fn(),
	trashItem: jest.fn()
};

export const Menu = {
	buildFromTemplate: (template: any) => template,
	setApplicationMenu: jest.fn()
};
