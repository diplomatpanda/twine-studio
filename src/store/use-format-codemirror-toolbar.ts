import CodeMirror from 'codemirror';
import * as React from 'react';
import {formatEditorExtensions, namespaceForFormat} from '../util/story-format';
import {formatEditorExtensionsDisabled, usePrefsContext} from './prefs';
import {
	formatWithNameAndVersion,
	loadFormatProperties,
	StoryFormatToolbarFactory,
	StoryFormatToolbarFactoryEnvironment,
	StoryFormatToolbarItem,
	useStoryFormatsContext
} from './story-formats';

interface CommandRegistryEntry {
	command: unknown;
	owners: Set<object>;
}

const commandRegistry = new Map<string, CommandRegistryEntry>();

/**
 * Manages working with a CodeMirror toolbar for a story format, which consists
 * of:
 *
 * - (optionally, but usually) a set of CodeMirror commands
 * - A function that returns an array of objects describing the toolbar, which
 *   uses those commands for functionality
 *
 * This loads the story format if it hasn't already been loaded, and installs
 * CodeMirror commands it provides. It returns the toolbar factory function if
 * everything succeeds. Otherwise, it will return undefined.
 */
export function useFormatCodeMirrorToolbar(
	formatName: string,
	formatVersion: string
) {
	const {dispatch, formats} = useStoryFormatsContext();
	const [toolbarFunc, setToolbarFunc] =
		React.useState<StoryFormatToolbarFactory>();
	const commandOwner = React.useRef<object>({}).current;
	const installedCommands = React.useRef<Set<string>>(new Set()).current;
	const format = formatWithNameAndVersion(formats, formatName, formatVersion);
	const loadedProperties =
		format.loadState === 'loaded' ? format.properties : undefined;
	const {prefs} = usePrefsContext();
	const extensionsDisabled = formatEditorExtensionsDisabled(
		prefs,
		formatName,
		formatVersion
	);

	function removeOwnedCommands() {
		for (const commandName of installedCommands) {
			const entry = commandRegistry.get(commandName);
			if (!entry) {
				continue;
			}

			entry.owners.delete(commandOwner);
			if (entry.owners.size === 0) {
				if ((CodeMirror.commands as any)[commandName] === entry.command) {
					delete (CodeMirror.commands as any)[commandName];
				}
				commandRegistry.delete(commandName);
			}
		}
		installedCommands.clear();
	}

	React.useEffect(() => {
		removeOwnedCommands();
		setToolbarFunc(undefined);

		if (extensionsDisabled) {
			return;
		} else if (format.loadState === 'unloaded') {
			dispatch(loadFormatProperties(format));
		} else if (format.loadState === 'loaded') {
			const namespace = namespaceForFormat(format);
			const editorExtensions = formatEditorExtensions(format);

			if (editorExtensions?.codeMirror?.commands) {
				for (const commandName in editorExtensions.codeMirror.commands) {
					const namespacedCommand = namespace + commandName;
					const command =
						editorExtensions.codeMirror.commands[commandName];
					const entry = commandRegistry.get(namespacedCommand);
					const existingCommand = (CodeMirror.commands as any)[namespacedCommand];

					if (entry) {
						if (existingCommand === entry.command) {
							entry.command = command;
							(CodeMirror.commands as any)[namespacedCommand] = command;
						}
						entry.owners.add(commandOwner);
						installedCommands.add(namespacedCommand);
					} else if (namespacedCommand in CodeMirror.commands) {
						console.warn(
							`CodeMirror already has a "${namespacedCommand}" command defined, skipping`
						);
					} else {
						// Using any here because the type is defined with factory
						// commands only.

						(CodeMirror.commands as any)[namespacedCommand] = command;
						commandRegistry.set(namespacedCommand, {
							command,
							owners: new Set([commandOwner])
						});
						installedCommands.add(namespacedCommand);
					}
				}
			}

			if (editorExtensions?.codeMirror?.toolbar) {
				setToolbarFunc(
					() =>
						(
							editor: CodeMirror.Editor,
							environment: StoryFormatToolbarFactoryEnvironment
						) => {
							// If somehow we lost our format's toolbar function, exit early.

							if (!editorExtensions?.codeMirror?.toolbar) {
								return [];
							}

							const items = editorExtensions.codeMirror.toolbar(
								editor,
								environment
							);

							// If we didn't get an array from the function, coerce it to an
							// empty one.

							if (!Array.isArray(items)) {
								return [];
							}

							// Namespace command properties and filter out any types that aren't
							// buttons or menus.

							return items.reduce((result, item) => {
								switch (item.type) {
									case 'button':
										return [
											...result,
											{...item, command: namespace + item.command}
										];

									case 'menu':
										if (Array.isArray(item.items)) {
											return [
												...result,
												{
													...item,
													items: item.items
														.filter(subitem =>
															['button', 'separator'].includes(subitem.type)
														)
														.map(subitem =>
															subitem.type === 'separator'
																? subitem
																: {
																		...subitem,
																		command: namespace + subitem.command
																  }
														)
												}
											];
										}
								}

								return result;
							}, [] as StoryFormatToolbarItem[]);
						}
				);
			}
		}

		return removeOwnedCommands;
	}, [
		dispatch,
		extensionsDisabled,
		format.id,
		format.name,
		format.version,
		format.loadState,
		loadedProperties
	]);

	return toolbarFunc;
}
