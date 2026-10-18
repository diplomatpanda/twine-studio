/**
 * A preview has an opaque origin and cannot use browser storage. Give story
 * runtimes isolated, temporary Storage objects instead. Keep this factory
 * self-contained: its JavaScript source runs inside the sandbox, without a
 * bridge to editor state or persistent storage.
 */
export function createPreviewStorage(): Storage {
	const values = new Map<string, string>();
	const api = {
		get length() {
			return values.size;
		},
		clear() {
			values.clear();
		},
		getItem(key: string) {
			return values.get(String(key)) ?? null;
		},
		key(index: number) {
			return [...values.keys()][Number(index) >>> 0] ?? null;
		},
		removeItem(key: string) {
			values.delete(String(key));
		},
		setItem(key: string, value: string) {
			values.set(String(key), String(value));
		}
	};
	return new Proxy(api, {
		get(target, key, receiver) {
			if (typeof key === 'string' && !Reflect.has(target, key)) {
				return values.get(key);
			}
			return Reflect.get(target, key, receiver);
		},
		set(_target, key, value) {
			if (typeof key !== 'string') return false;
			values.set(key, String(value));
			return true;
		},
		deleteProperty(_target, key) {
			if (typeof key === 'string') values.delete(key);
			return true;
		},
		has(target, key) {
			return (
				Reflect.has(target, key) ||
				(typeof key === 'string' && values.has(key))
			);
		},
		ownKeys() {
			return [...values.keys()];
		},
		getOwnPropertyDescriptor(_target, key) {
			if (typeof key === 'string' && values.has(key)) {
				return {
					configurable: true,
					enumerable: true,
					writable: true,
					value: values.get(key)
				};
			}
		}
	}) as Storage;
}

export function withPreviewStorage(html: string) {
	const factory = createPreviewStorage.toString();
	// This prefix executes before format/story scripts. The source is still
	// confined by the iframe sandbox; publishing never uses this wrapper.
	return `<!doctype html><script>Object.defineProperties(window,{
		localStorage:{value:(${factory})()},
		sessionStorage:{value:(${factory})()}
	});</script>${html}`;
}
