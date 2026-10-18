import {builtins} from '../../store/story-formats/defaults';
import {
	StoryFormat,
	StoryFormatProperties
} from '../../store/story-formats/story-formats.types';
import {storyFormatUrl} from './fetch-properties';

export function isPackagedFormat(format: StoryFormat): boolean {
	return builtins().some(
		builtin =>
			builtin.name === format.name &&
			builtin.version === format.version &&
			storyFormatUrl(builtin.url) === storyFormatUrl(format.url)
	);
}

export function hasEditorCodeTrust(
	format: StoryFormat,
	properties: StoryFormatProperties
): boolean {
	const code = properties.editorCode;
	return (
		!!code &&
		code.url === storyFormatUrl(format.url) &&
		(isPackagedFormat(format) ||
			(!!code.sha256 &&
				format.editorCodeTrust?.url === code.url &&
				format.editorCodeTrust?.sha256 === code.sha256))
	);
}

let executionQueue: Promise<unknown> = Promise.resolve();

/** Execute only the exact source snapshot approved by the caller. */
export function executeEditorCode(
	source: string,
	canExecute?: () => boolean
): Promise<StoryFormatProperties> {
	const run = executionQueue.then(
		() => {
			if (canExecute && !canExecute()) {
				return Promise.reject(
					new Error('Approved editor code execution was superseded.')
				);
			}

			return new Promise<StoryFormatProperties>((resolve, reject) => {
				const target = window as unknown as {
					storyFormat?: (data: StoryFormatProperties) => void;
				};
				const previous = target.storyFormat;
				const script = document.createElement('script');
				let settled = false;
				const cleanup = () => {
					window.clearTimeout(timer);
					script.remove();
					target.storyFormat = previous;
				};
				const timer = window.setTimeout(() => {
					if (!settled) {
						settled = true;
						cleanup();
						reject(
							new Error('The approved editor code did not return a format.')
						);
					}
				}, 5000);
				target.storyFormat = data => {
					if (!settled) {
						settled = true;
						// Let the wrapper finish before restoring the global callback.
						Promise.resolve().then(() => {
							cleanup();
							resolve(data);
						});
					}
				};
				try {
					script.textContent = source;
					document.head.appendChild(script);
				} catch (error) {
					settled = true;
					cleanup();
					reject(error);
				}
			});
		}
	);
	executionQueue = run.catch(() => undefined);
	return run;
}
