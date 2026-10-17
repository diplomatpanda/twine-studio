const STORAGE_NAMESPACE = 'twine-studio';

export function storageKey(collection: string, id?: string) {
	return id === undefined
		? `${STORAGE_NAMESPACE}-${collection}`
		: `${STORAGE_NAMESPACE}-${collection}-${id}`;
}
