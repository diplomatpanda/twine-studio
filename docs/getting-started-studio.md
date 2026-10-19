# Your first branching story

Twine Studio is an independent fork of Twine, currently in development. You can
write and publish without an AI account or a cloud service.

For a small playable scaffold, choose **Start from an idea** in the Story tab.
Enter a title and one or two sentences, then choose **Branch and return**,
**Small mystery**, or **Conversation with outcomes**. Studio creates six linked
passages with two routes, a return point, and two endings. The opening includes
your idea; Story Knowledge keeps a private copy. Rewrite the short starter prose
and endings in the ordinary passage editor. This option currently supports
Harlowe 3 and SugarCube 2; **New** remains available for a blank story in any
format. Published HTML includes the passage text but excludes private Story
Knowledge notes.

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
7. Use **Build → Publish to File** to save a playable HTML file. If an ordinary
   passage link points to a missing destination, Studio lists its source and
   target. Choose **Edit** to repair the source, **Cancel** to stop, or **Publish
   anyway** if the missing destination is intentional. This check cannot follow
   story-format code or dynamic destinations. Open the exported file independently
   and test every intended ending. Use Library archive/export and the existing
   source export options for backups.

To make a fork in one step, choose **Add another choice** before inserting. Fill
each choice text and destination, then choose **Insert choices**. Studio adds all
links together and creates any new destination passages on the map. Remove a row
to leave it out. The whole set can be undone as one edit.

In the enhanced editor, use its Undo/Redo controls or normal editing shortcuts
to reverse a choice insertion. In the basic textarea editor, close the passage
and use the main **Undo Add choice** / **Redo Add choice** controls; the generated
destination is included in that operation. Native textarea Ctrl+Z is not the
undo mechanism for an inserted choice or choice set.
On a narrow screen, use **More toolbar controls** to reveal Undo and Redo.

If another tab changes saved story data before this tab saves, Studio pauses
the stale tab's saves. Use **Export story backup** in the warning, then reload
to see the saved version. Import the backup if you need text from the stale tab.

The helper accepts plain words, numbers and common punctuation. It excludes
special syntax instead of guessing how to escape it. Existing advanced passage
names and source are preserved; edit such links directly in the text.

Try importing `examples/the-last-signal.html` for a complete small story. Its two
routes lead to different endings. The original story text is dedicated to the
public domain under CC0; Harlowe's runtime retains its own license.

## Finding a passage

Choose **Go To** to browse all passage names in alphabetical order. Type part of
a name, passage text, or tag to find a match. Use the arrow keys and Enter, or
click a result, to select that passage and center it on the map. Choose **Edit**
to continue writing. Escape closes the list; reopening it starts with all passages.
For a larger story, check **Show passages with no link path from Start** to find
draft passages that no ordinary `[[...]]` link chain reaches. Select one to jump
to it and connect or remove it as you decide. The check counts conditional links
as possible paths and cannot follow dynamic format-specific navigation; special
story-format passages may appear in the list.

## Remembering clues and relationships

For Harlowe 3 and SugarCube 2, **Story logic** can remember a yes/no fact or a
number, change a number, and show a choice or short line of text when a condition
matches. For example:

1. In your first passage, remember `clue` as **No** and `trust` as **Number → 0**.
2. In a discovery passage, remember `clue` as **Yes** and choose **Change a number**
   for `trust` with **Amount to add → 3**. Use a negative amount to reduce trust.
3. In a later passage, choose **Show a choice when**, use `clue` with **Yes**,
   and supply the choice text and destination. For a relationship threshold,
   use `trust`, **Number → 3**, and **At least**.
4. To show one short line of dialogue only on the high-trust route, choose
   **Show text when** with `trust`, **Number → 3**, and **At least**.

Insertions append to the source and run in order. Remembering a value runs every
time the reader visits that passage, and a numeric change repeats on each
visit. Initialize a number before changing or checking it, then place conditions
after the changes they depend on.
Keep each fact's name and value type consistent. Use the enhanced editor's undo,
or the basic editor's main **Undo Add story logic** action. The helper does not
infer or rewrite existing variables or macros. It does not yet offer a fact
registry or automatic initialization. Longer or formatted dialogue stays in the
ordinary source editor.

## Previewing saved games

In the browser, **Play**, **Test** and **Proof** open an isolated preview.
Saved-game slots in that preview are temporary and reset when it reloads or closes.
Use **Publish to File** and open the resulting HTML to test persistent saved games.
Your authored story remains saved in the editor as usual. Desktop previews still
open published scratch HTML in your system browser.

## If saving needs attention

Keep the editor open and choose **Export story backup** in the warning panel.
This downloads your current writing even when browser storage is full. After
making space, choose **Retry saving**. To restore the backup in a clean browser
profile, choose **Library → Import** and select the downloaded HTML file.
The story backup preserves story source and metadata; it does not include editor
preferences or custom story-format installations.

If a save was interrupted after its recovery copy reached storage, Studio loads
those recovered changes on reopening. If the recovery data itself is unreadable,
use **Export recovery data** before clearing anything. That JSON file preserves
raw data for investigation; it is not a playable story or a normal import file.

Do not clear Studio's site data to make space before exporting your work.

## Custom format editor extensions

Custom formats can play and publish stories without access to the editor.
If you want a format's editing tools, open **Twine Studio → Story Formats → Trust
editor code**, then read the confirmation. Approved code can read/change your
stories and use desktop operations, so approve only a source you trust. A changed
format file needs approval again. Revoking approval requires a successful save
and restart to remove code already running. See [story-format-trust.md](story-format-trust.md)
for formats whose source cannot be verified and other compatibility limits.

## Offline use and current limitations

The production browser app caches bundled resources after an online first load.
Automated Chromium, Firefox and WebKit checks verify offline reload, writing,
saving, preview and HTML export for the four bundled formats. Development-server
and user-added remote formats are not covered by that offline guarantee.
Clearing site data removes browser work and the offline cache; keep exported
backups.

An optional desktop-only AI action can propose code repair for a selected
Harlowe or SugarCube passage; it requires your own OpenCode Go key, explicit
send confirmation and approval of the proposed edit. See
[AI boundary and limits](ai-evaluation.md). Broader AI story modification and
workflow modernization are not yet available. The
inherited app has remaining dependency and release-readiness work; see
release-readiness.md. Browser Studio uses its own storage namespace and desktop
Studio uses its own application identity and default story folders. Import
copies of existing stories explicitly; no automatic migration runs.
