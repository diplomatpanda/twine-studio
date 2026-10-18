import {save} from '../save';
import {fakeLoadedStoryFormat} from '../../../../../test-util';
import {storageKey} from '../../keys';
import {
	getStorageStatus,
	journalKey,
	retryStorageChanges
} from '../../transaction';
import {load} from '../load';

describe('story formats local storage save', () => {
	beforeEach(() => window.localStorage.clear());
	afterAll(() => window.localStorage.clear());

	it.each(['journal', 'record'])(
		'retains a revoked approval after a failed %s write and retry',
		async failure => {
			const format = fakeLoadedStoryFormat({
				editorCodeTrust: {
					url: 'https://example.com/format.js',
					sha256: 'approved-source'
				}
			});
			save([format]);
			const original = Storage.prototype.setItem;
			const failingWrite = jest
				.spyOn(Storage.prototype, 'setItem')
				.mockImplementation(function (this: Storage, key, value) {
					if (
						(failure === 'journal' && key === journalKey) ||
						(failure === 'record' && key.startsWith(storageKey('storyformats')))
					) {
						throw new Error('Simulated full storage');
					}
					return original.call(this, key, value);
				});
			expect(() => save([{...format, editorCodeTrust: undefined}])).toThrow(
				'Simulated full storage'
			);
			expect(getStorageStatus()).toEqual(
				expect.objectContaining({dirty: true, durable: failure === 'record'})
			);
			expect((await load())[0].editorCodeTrust).toBeUndefined();
			failingWrite.mockRestore();
			retryStorageChanges();
			expect(getStorageStatus().dirty).toBe(false);
			expect((await load())[0].editorCodeTrust).toBeUndefined();
		}
	);

	it('saves formats to local storage', () => {
		const formats = [fakeLoadedStoryFormat(), fakeLoadedStoryFormat()];

		save(formats);

		const ids = window.localStorage
			.getItem(storageKey('storyformats'))!
			.split(',');
		const format1 = JSON.parse(
			window.localStorage.getItem(storageKey('storyformats', ids[0]))!
		);
		const format2 = JSON.parse(
			window.localStorage.getItem(storageKey('storyformats', ids[1]))!
		);

		// This will change IDs on us--we can't do a simple compare.

		/* eslint-disable jest/no-conditional-expect */

		if (format1.name === formats[0].name) {
			expect(format1).toEqual(
				expect.objectContaining({
					name: formats[0].name,
					url: formats[0].url,
					userAdded: formats[0].userAdded,
					version: formats[0].version
				})
			);
			expect(format2).toEqual(
				expect.objectContaining({
					name: formats[1].name,
					url: formats[1].url,
					userAdded: formats[1].userAdded,
					version: formats[1].version
				})
			);
		} else if (format1.name === formats[1].name) {
			expect(format1).toEqual(
				expect.objectContaining({
					name: formats[1].name,
					url: formats[1].url,
					userAdded: formats[1].userAdded,
					version: formats[1].version
				})
			);
			expect(format2).toEqual(
				expect.objectContaining({
					name: formats[0].name,
					url: formats[0].url,
					userAdded: formats[0].userAdded,
					version: formats[0].version
				})
			);
		} else {
			throw new Error('First story format not present in window.localStorage.');
		}

		/* eslint-enable jest/no-conditional-expect */
		expect.assertions(2);
	});
});
