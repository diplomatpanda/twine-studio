import * as React from 'react';
import {useTranslation} from 'react-i18next';
import {DialogEditor} from '../../components/container/dialog-card';
import {CodeArea} from '../../components/control/code-area';
import {usePrefsContext} from '../../store/prefs';
import {Passage, Story} from '../../store/stories';
import {StoryFormat} from '../../store/story-formats';
import {useCodeMirrorPassageHints} from '../../store/use-codemirror-passage-hints';
import {useFormatCodeMirrorMode} from '../../store/use-format-codemirror-mode';
import {codeMirrorOptionsFromPrefs} from '../../util/codemirror-options';
import {ChoiceComposer} from '../../components/passage/choice-composer';

export interface PassageTextProps {
	disabled?: boolean;
	onChange: (value: string, undoDescription?: string) => void;
	onEditorChange: (value: CodeMirror.Editor) => void;
	passage: Passage;
	story: Story;
	storyFormat: StoryFormat;
	storyFormatExtensionsDisabled?: boolean;
}

export const PassageText: React.FC<PassageTextProps> = props => {
	const {
		disabled,
		onChange,
		onEditorChange,
		passage,
		story,
		storyFormat,
		storyFormatExtensionsDisabled
	} = props;
	const [localText, setLocalText] = React.useState(passage.text);
	const {prefs} = usePrefsContext();
	const autocompletePassageNames = useCodeMirrorPassageHints(story);
	const mode =
		useFormatCodeMirrorMode(storyFormat.name, storyFormat.version) ?? 'text';
	const codeAreaContainerRef = React.useRef<HTMLDivElement>(null);
	const editorRef = React.useRef<CodeMirror.Editor>();
	const {t} = useTranslation();

	// These are refs so that changing them doesn't trigger a rerender, and more
	// importantly, no React effects fire.

	const onChangeText = React.useRef<string>();
	const onChangeTimeout = React.useRef<number>();

	const commitPendingChange = React.useCallback(() => {
		onChangeTimeout.current = undefined;
		onChange(onChangeText.current!);
	}, [onChange]);

	const scheduleCommit = React.useCallback(() => {
		onChangeTimeout.current = window.setTimeout(commitPendingChange, 1000);
	}, [commitPendingChange]);

	const flushPendingChange = React.useCallback(() => {
		if (onChangeTimeout.current) {
			window.clearTimeout(onChangeTimeout.current);
			commitPendingChange();
		}
	}, [commitPendingChange]);

	// Keep the latest callback without flushing on every parent rerender. The
	// story reducer persists synchronously in the browser, before navigation.
	const flushPendingRef = React.useRef(flushPendingChange);
	flushPendingRef.current = flushPendingChange;

	React.useEffect(() => {
		const flush = () => flushPendingRef.current();
		const flushWhenHidden = () => {
			if (document.visibilityState === 'hidden') flush();
		};
		window.addEventListener('beforeunload', flush);
		window.addEventListener('pagehide', flush);
		document.addEventListener('visibilitychange', flushWhenHidden);
		return () => {
			window.removeEventListener('beforeunload', flush);
			window.removeEventListener('pagehide', flush);
			document.removeEventListener('visibilitychange', flushWhenHidden);
			flush();
		};
	}, []);

	// Effects to handle debouncing updates upward. The idea here is that the
	// component maintains a local state so that the CodeMirror instance always is
	// up-to-date with what the user has typed, but the global context may not be.
	// This is because updating global context causes re-rendering in the story
	// map, which can be time-intensive.

	React.useEffect(() => {
		// A change to passage text has occurred externally, e.g. through a find and
		// replace. We ignore this if a change is pending so that users don't see
		// things they've typed in disappear or be replaced.

		if (!onChangeTimeout.current && localText !== passage.text) {
			setLocalText(passage.text);
		}
	}, [localText, passage.text]);

	const handleLocalChangeText = React.useCallback(
		(text: string) => {
			// Set local state because the CodeMirror instance is controlled, and
			// updates there should be immediate.

			setLocalText(text);

			// If there was a pending update, cancel it.

			if (onChangeTimeout.current) {
				window.clearTimeout(onChangeTimeout.current);
			}

			// Save the text value in case we need to reset the timeout in the next
			// effect.

			onChangeText.current = text;
			scheduleCommit();
		},
		[onEditorChange, scheduleCommit]
	);

	// If the onChange prop changes while an onChange call is pending, reset the
	// timeout and point it to the correct callback.

	React.useEffect(() => {
		if (onChangeTimeout.current) {
			window.clearTimeout(onChangeTimeout.current);
			scheduleCommit();
		}
	}, [scheduleCommit]);

	const handleMount = React.useCallback(
		(editor: CodeMirror.Editor) => {
			editorRef.current = editor;
			onEditorChange(editor);

			// The potential combination of loading a mode and the dialog entrance
			// animation seems to mess up CodeMirror's cursor rendering. The delay below
			// is intended to run after the animation completes.

			window.setTimeout(() => {
				editor.focus();
				editor.refresh();
			}, 400);
		},
		[onEditorChange]
	);

	// Emulate the above behavior re: focus if we aren't using CodeMirror.

	React.useEffect(() => {
		if (!prefs.useCodeMirror && codeAreaContainerRef.current) {
			const area = codeAreaContainerRef.current.querySelector('textarea');

			if (!area) {
				return;
			}

			area.focus();
			area.setSelectionRange(area.value.length, area.value.length);
		}
	}, []);

	const options = React.useMemo(
		() => ({
			...codeMirrorOptionsFromPrefs(prefs),
			mode: storyFormatExtensionsDisabled ? 'text' : mode,
			lineWrapping: true,
			placeholder: t('dialogs.passageEdit.passageTextPlaceholder'),
			prefixTrigger: {
				callback: autocompletePassageNames,
				prefixes: ['[[', '->']
			},
			// This value prevents the area from being focused.
			readOnly: disabled ? 'nocursor' : false
		}),
		[
			autocompletePassageNames,
			disabled,
			mode,
			prefs,
			storyFormatExtensionsDisabled,
			t
		]
	);

	return (
		<>
			<ChoiceComposer
				disabled={disabled}
				formatName={storyFormat.name}
				formatVersion={storyFormat.version}
				id={passage.id}
				passageNames={story.passages.map(p => p.name)}
				onAdd={source => {
					const editor = prefs.useCodeMirror ? editorRef.current : undefined;
					const text = editor ? editor.getValue() : localText;
					const addition = `${text ? '\n\n' : ''}${source}`;
					if (editor) {
						editor.replaceRange(addition, editor.posFromIndex(text.length));
						editor.focus();
					} else {
						// A controlled textarea does not create a native undo entry for
						// programmatic value changes. Record this as one story action,
						// including any newly linked passage, in the main Undo toolbar.
						window.clearTimeout(onChangeTimeout.current);
						onChangeTimeout.current = undefined;
						setLocalText(text + addition);
						onChange(text + addition, t('studio.choice.undo'));
						codeAreaContainerRef.current?.querySelector('textarea')?.focus();
					}
				}}
			/>
			<DialogEditor ref={codeAreaContainerRef}>
				<CodeArea
					editorDidMount={handleMount}
					fontFamily={prefs.passageEditorFontFamily}
					fontScale={prefs.passageEditorFontScale}
					id={`passage-dialog-passage-text-code-area-${passage.id}`}
					label={t('dialogs.passageEdit.passageTextEditorLabel')}
					labelHidden
					onBlur={flushPendingChange}
					onChangeEditor={onEditorChange}
					onChangeText={handleLocalChangeText}
					options={options}
					useCodeMirror={prefs.useCodeMirror}
					value={localText}
				/>
			</DialogEditor>
		</>
	);
};
