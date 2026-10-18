/** Ordered, retryable work per resource. A failure retains that task and every
 * task after it, so later edits cannot silently bypass a failed rename/save.
 * flush() retries retained work; callers must handle a rejected attempt.
 */
export class PersistenceQueue {
	private queues = new Map<string, Array<() => Promise<void>>>();
	private running = new Map<string, Promise<void>>();

	enqueue(key: string, task: () => Promise<void>): Promise<void> {
		const queue = this.queues.get(key) ?? [];
		queue.push(task);
		this.queues.set(key, queue);
		return this.drain(key);
	}

	async flush(): Promise<void> {
		while (this.queues.size) {
			await Promise.all([...this.queues.keys()].map(key => this.drain(key)));
		}
	}

	private drain(key: string): Promise<void> {
		const existing = this.running.get(key);
		if (existing) return existing;
		// Start on a microtask so running is registered even if a task throws.
		const run = Promise.resolve().then(async () => {
			const queue = this.queues.get(key)!;
			while (queue.length) {
				await queue[0]();
				queue.shift();
			}
			this.queues.delete(key);
		});
		this.running.set(key, run);
		const cleanup = () => {
			if (this.running.get(key) === run) this.running.delete(key);
		};
		void run.then(cleanup, cleanup);
		return run;
	}
}
