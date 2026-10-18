import {namespaceForFormat} from '../namespace';
import {fakePendingStoryFormat} from '../../../test-util';

describe('namespaceForFormat()', () => {
	it('encodes the format identity with a trailing separator', () => {
		const format = fakePendingStoryFormat({
			id: 'format-id',
			name: 'Foo Bar',
			version: '1.2.3'
		});

		expect(namespaceForFormat(format)).toBe(
			encodeURIComponent(JSON.stringify(['format-id', 'Foo Bar', '1.2.3'])) +
				':'
		);
	});

	it('keeps the namespace whitespace-free', () => {
		const format = fakePendingStoryFormat({name: '\ta b'});

		expect(/\s/.test(namespaceForFormat(format))).toBe(false);
	});

	it('returns the same value for another instance of the same format', () => {
		const format = fakePendingStoryFormat({
			id: 'format-id',
			name: 'Foo Bar',
			version: '1.2.3'
		});
		const format2 = {...format};

		expect(namespaceForFormat(format2)).toBe(namespaceForFormat(format));
	});

	it('distinguishes names that previously normalized to the same value', () => {
		const format = fakePendingStoryFormat({
			id: 'format-a',
			name: 'Foo Bar',
			version: '1.2.3'
		});
		const format2 = fakePendingStoryFormat({
			id: 'format-b',
			name: 'Foo-Bar',
			version: '1.2.3'
		});

		expect(namespaceForFormat(format)).not.toBe(namespaceForFormat(format2));
	});
});
