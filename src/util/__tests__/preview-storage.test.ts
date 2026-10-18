import {createPreviewStorage, withPreviewStorage} from '../preview-storage';

describe('preview storage', () => {
	it('keeps format save slots inside one temporary store', () => {
		const first = createPreviewStorage();
		const second = createPreviewStorage();
		first.setItem('slot', 'first ending');
		first.setItem('visits', 3 as unknown as string);
		expect(first.getItem('slot')).toBe('first ending');
		expect(first.getItem('visits')).toBe('3');
		expect(first.length).toBe(2);
		expect(first.key(0)).toBe('slot');
		expect(first.key(99)).toBeNull();
		expect(second.getItem('slot')).toBeNull();
		first.removeItem('slot');
		expect(first.getItem('slot')).toBeNull();
		first.clear();
		expect(first.length).toBe(0);
	});

	it('supports named properties and enumeration used by older formats', () => {
		const storage = createPreviewStorage();
		storage.slot = 'saved';
		expect(storage.getItem('slot')).toBe('saved');
		expect(Object.keys(storage)).toEqual(['slot']);
		expect('slot' in storage).toBe(true);
		delete storage.slot;
		expect(storage.slot).toBeUndefined();
		expect(storage.length).toBe(0);
	});

	it('places its self-contained bootstrap before authored scripts without changing them', () => {
		const html = '<html><script>window.authored = true;</script></html>';
		const wrapped = withPreviewStorage(html);
		expect(wrapped.endsWith(html)).toBe(true);
		expect(wrapped.indexOf('Object.defineProperties')).toBeLessThan(
			wrapped.indexOf('window.authored')
		);
	});
});
