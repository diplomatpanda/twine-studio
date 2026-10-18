import {PersistenceQueue} from '../persistence-queue';

describe('PersistenceQueue', () => {
	it('runs each resource in order and waits for work added while draining', async () => {
		const queue = new PersistenceQueue();
		const order: string[] = [];
		let release!: () => void;
		const first = queue.enqueue('story', async () => {
			order.push('first');
			await new Promise<void>(resolve => (release = resolve));
		});
		await Promise.resolve();
		const second = queue.enqueue('story', async () => {
			order.push('second');
		});
		await queue.enqueue('other-story', async () => {
			order.push('other');
		});
		expect(order).toEqual(['first', 'other']);
		const flushed = queue.flush();
		release();
		await Promise.all([first, second, flushed]);
		expect(order).toEqual(['first', 'other', 'second']);
		await queue.enqueue('story', async () => {
			order.push('third');
		});
		expect(order.at(-1)).toBe('third');
	});

	it('retains failed and dependent operations for retry in original order', async () => {
		const queue = new PersistenceQueue();
		const rename = jest
			.fn()
			.mockRejectedValueOnce(new Error('disk unavailable'))
			.mockResolvedValue(undefined);
		const save = jest.fn().mockResolvedValue(undefined);
		const first = queue.enqueue('story', rename);
		const second = queue.enqueue('story', save);
		await expect(first).rejects.toThrow('disk unavailable');
		await expect(second).rejects.toThrow('disk unavailable');
		expect(save).not.toHaveBeenCalled();
		await queue.flush();
		expect(rename).toHaveBeenCalledTimes(2);
		expect(save).toHaveBeenCalledTimes(1);
		await queue.flush();
		expect(save).toHaveBeenCalledTimes(1);
	});
});
