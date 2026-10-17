# Your first branching story

Twine Studio is an independent fork of Twine, currently in development. You can
write and publish without an AI account or a cloud service.

1. In the story library, choose **New**, name your story, and choose **Create**.
2. Double-click the first passage (or select it and choose **Edit**). Write what
   your reader sees. Changes save automatically after a short pause or when you
   leave the text field. Keep exported backups of important work.
3. Choose **Add choice**. Enter the choice text and the destination passage name.
   Existing supported names appear as suggestions. A new name creates a passage.
4. Choose **Insert choice**. The choice appears at the end of your text. This
   helper currently supports Harlowe 3 and SugarCube 2. For advanced syntax or
   other formats, continue using the source editor.
5. Close the passage and open the destination to write its outcome. Repeat to
   add an alternative route. Use **Go To** to find a passage in a larger story.
6. Open **Build → Play** to play from the beginning. **Test From Here** starts at
   a selected passage; it does not reconstruct all earlier player decisions.
7. Use **Build → Publish to File** to save a playable HTML file. Open the exported
   file independently and test every intended ending. Use Library archive/export
   and the existing source export options for backups.

In the enhanced editor, use its Undo/Redo controls or normal editing shortcuts
to reverse a choice insertion. In the basic textarea editor, close the passage
and use the main **Undo Add choice** / **Redo Add choice** controls; the generated
destination is included in that operation. Native textarea Ctrl+Z is not the
undo mechanism for an inserted choice.

The helper accepts plain words, numbers and common punctuation. It excludes
special syntax instead of guessing how to escape it. Existing advanced passage
names and source are preserved; edit such links directly in the text.

Try importing `examples/the-last-signal.html` for a complete small story. Its two
routes lead to different endings. The original story text is dedicated to the
public domain under CC0; Harlowe's runtime retains its own license.

## Remembering clues and relationships

For Harlowe 3 and SugarCube 2, **Story logic** can remember a yes/no fact or a
number, then show a choice when that value matches. For example:

1. In your first passage, remember `clue` as **No** and `trust` as **Number → 0**.
2. In a discovery passage, remember `clue` as **Yes** and `trust` as **Number → 3**.
3. In a later passage, choose **Show a choice when**, use `clue` with **Yes**,
   and supply the choice text and destination. For a relationship threshold,
   use `trust`, **Number → 3**, and **At least**.

Insertions append to the source and run in order. Remembering a value runs every
time the reader visits that passage, so place initial values before choices.
Keep each fact's name and value type consistent. Use the enhanced editor's undo,
or the basic editor's main **Undo Add story logic** action. The helper does not
infer or rewrite existing variables or macros. It does not yet offer arithmetic
changes, a fact registry, or automatic initialization.

## Offline use and current limitations

The production browser app caches bundled resources after an online first load.
An automated Chromium check verifies offline reload, writing, saving, Harlowe
preview and HTML export. Development-server and user-added remote formats are
not covered by that offline guarantee. Clearing site data removes browser work
and the offline cache; keep exported backups.

AI proposals and broader workflow modernization are not yet available. The
inherited app has remaining dependency and preview-trust issues; see
release-readiness.md. Browser Studio uses its own storage namespace and desktop
Studio uses its own application identity and default story folders. Import
copies of existing stories explicitly; no automatic migration runs.
