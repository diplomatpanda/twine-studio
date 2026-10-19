# Development progress

Status: active development; not release-ready. Baseline is Twine 2.12.1,
`4ebcce6a69c62b1c4b51bb76f2b7ac51dd84d9d2`, upstream development branch `develop`.

## Initial implementation

1. Distinct Twine Studio branding, Electron app identity/default folders, removal
   of upstream application update prompts. Upstream Git history and GPL retained.
2. Windows build post-step uses Node filesystem copy instead of incompatible
   shell quoting. Desktop unit mocks use native paths. Test server has a dedicated
   IPv4 address and cannot reuse an unrelated app.
3. Renderer JSON saves limited to `prefs.json` and `story-formats.json`; traversal
   and arbitrary names rejected. Targeted handlebars/shell-quote lock updates
   remove the two critical npm advisories (41 other advisories remain).
4. Plain-language Add choice form, explicit Harlowe 3/SugarCube 2 link generation,
   native destination creation, enhanced editor undo. The form now inserts a
   repeatable choice set as one update and one undo action. Plain textarea
   reflects controlled updates. New strings use localization with English fallback.
5. Verified bundled license notices added where authoritative evidence exists.
   Paperthin historical notice and full transitive inventory remain open.
6. Browser persistence has a separate `twine-studio-*` namespace. Legacy Twine
   keys are neither loaded nor changed; importing published HTML remains explicit.
7. Pending passage edits flush on reload, page hiding and editor unmount. This
   protects the final second of typing during ordinary browser navigation.
8. Desktop cleanup tolerates a missing Scratch folder on a fresh installation,
   while still reporting genuine filesystem failures.
9. Story logic form generates native yes/no or numeric assignments and
   conditional choices for Harlowe 3/SugarCube 2. It appends source without
   converting existing macros; authors explicitly initialize facts.
10. Production offline preview now finds installed formats in the service-worker
    cache despite JSONP's callback parameter. Offline edit/save/reload/preview/
    export passed after reproducing the original preview failure. The same
    production Harlowe journey now passes in Chromium, Firefox and WebKit. Small
    executable offline fixtures for SugarCube, Chapbook and Snowman also pass
    preview and export across those engines.
11. Native source, script and CSS round-trip fixtures exercise Harlowe, SugarCube,
    Chapbook and Snowman. Generated clue/relationship paths execute in Harlowe
    and SugarCube and distinguish hidden from unlocked choices.
12. A 240-passage HTML import now has search/rename/reference/edit/reload/export
    coverage. Enter with no Go To results no longer raises an exception.

## Baseline evidence

- Node 22.14.0/npm 10.9.2; `npm ci` succeeded.
- Web bundle and Electron TypeScript compiled before functionality changes.
- Upstream Windows postbuild failed despite a zero shell status; repaired.
- Upstream full unit run aborted on Windows path mock mismatches; repaired.
- Non-desktop baseline: 234 suites, 1,544 passed, 23 skipped, 38 TODO.
- Desktop after path repair: 16 suites, 180 passed, 4 TODO.
- Independent review covered fork identity/licenses, IPC security and choice UX.
- Browser audit created and published a three-passage original story. Harlowe
  pipe syntax was verified to work; an initial review claim to the contrary was
  rejected based on runtime evidence. Generated Harlowe uses arrows explicitly.

## Current verification

Full post-change unit suite, lint, web/Electron TypeScript builds, upstream browser
smoke and choice/export journeys pass. Basic-textarea insertion now records a
story undo entry and its browser undo/redo test passes. Focus return is verified.
Medium/large synthetic story audit completed. Fresh isolated desktop rebuild and
restart verification passed, with the fork's own Documents folders. Interrupted
typing passed a browser regression test that failed before the fix. Detailed
counts and limits are in release-readiness.md.

Choice-set acceptance covers recent typing, two automatically created destinations,
single-step undo in enhanced/basic editors, reload, HTML publication and both
playable endings. Harlowe 3 enhanced/basic and SugarCube 2 enhanced passed in
Chromium; enhanced Harlowe/SugarCube also passed Firefox and WebKit. The old
single-choice journeys still pass. At 375 px, the form was inspected; an open
dialog now stays above wrapped toolbar actions, and the top controls scroll
horizontally with a visible control so Undo remains reachable. Canceling the
choice form discards every draft row.

Browser saves now compare story and passage records with the versions loaded by
the tab before writing. A stale tab stops saving and offers a backup of its
in-memory work; separate stories can still be edited in two tabs. Page-specific
recovery journals prevent ordinary tabs from replacing one another's journal,
and the prior single-key journal remains recoverable. The two-tab journeys pass
Chromium, Firefox and WebKit. Truly simultaneous writes remain unproven.

New recovery journals carry the raw base value for each changed storage key.
Reload refuses to replay one over a different newer saved value and offers raw
recovery export instead. The stale-journal browser journey passes all three
engines. Browser commits now use an exclusive Web Lock and recheck loaded story
versions inside it. The held-lock same-passage journey passes Chromium, Firefox
and WebKit: one queued save commits, while the conflicting tab retains its
journal. A fresh tab waits for earlier lock holders and replays a valid closed
tab journal. Conflicting or ambiguous journals stop for raw export. Duplicated
tabs now stop saving when their inherited journal changes, preserving a stale
draft instead of applying it. The duplicated-tab conflict passes all three
browser engines. Full handoff after the original tab closes and hard failure
modes remain release work.

Build → Publish to File now checks ordinary internal links for missing passage
names and shows each source and target. Authors can edit a source, cancel or
explicitly publish anyway. The repair-to-publication journey passes Chromium,
Firefox and WebKit. Dynamic destinations and story-format code need playtesting.
The editor now writes pending text directly before page exit; ten consecutive
Firefox reloads inside the debounce interval passed, as did Chromium and WebKit.
An edit-time session draft now survives a Firefox reload even when a simulated
full-storage failure prevents the normal save and Firefox shows no unload warning.
The draft restores automatically only if the saved passage still matches its
starting text; otherwise the writer can export the recovered story without
overwriting the newer saved passage. Tab closure, blocked or exhausted session
storage, and truly simultaneous writes remain outside this evidence.
Indexed story and passage records that cannot be opened now raise a visible raw
recovery export and stop story saves; the malformed-story journey passes in all
three browser engines.

## Next priorities

Resolve format-extension trust, abrupt-process and full-disk
recovery, representative advanced-author projects, and remaining beginner
workflow gaps before optional AI. This invocation's bounded pass is not product
completion; use release-readiness.md for the acceptance gaps.

## Invocation ledger

The 15 bounded implementation/review iterations were: baseline and plan; fork
identity; Windows build/test portability; IPC/dependency hardening; choice form;
choice undo/native runtime review; licensing and provenance; browser namespace;
interrupted typing; fresh-profile cleanup; story facts/conditions; native format
round trips; production offline recovery; large-story navigation; final review,
verification and documentation. Each was scoped to authoring or release reliability.
The two verified local commits retain upstream history. No remote fork, push,
release, deployment or integration into another checkout was performed.

## Continued reliability pass

The next bounded pass added a browser write-ahead journal, persistent retry and
story-backup actions, and a non-destructive startup error screen with raw rescue
export. Native shutdown now coordinates renderer publication and main-process
saves. Tests cover rejected journal writes, partial record writes, continued
edits, invalid journals, failed-save retry and immediate close.

Two real edge cases were reproduced and fixed: browser navigation initially
checked unsaved state before flushing final typing, and desktop shutdown could
finish while an unloaded format was still preparing the story HTML. The browser
now checks after flushing; desktop waits for publication and an IPC barrier.

Current browser acceptance is 22 passing journeys plus a passage-creation/map-drag
recovery check. A run during active source
edits was invalidated by Vite hot reload; the stable-source rerun passed. Three
consecutive native close/restart checks passed after fixing the publication race.
The full unit checkpoint passed 256 suites and 1,803 tests. Final desktop queue
race fixes receive affected-suite checks after that checkpoint.
Those checks passed 50 tests across three suites.
The broader Twine Studio goal remains incomplete; see release-readiness.md for
the current scope and remaining acceptance work.

## Desktop mutation shutdown pass

Renderer persistence now orders rename, publication, deletion and restoration per
story. Rename/delete requests have individual replies, and failed operations keep
their dependent edits for retry. Main-process shutdown waits for those operations,
serialized preference/format JSON writes and desktop-only app preferences.
JSON writes replace the destination only after a complete temporary file exists.
The window stops accepting edits during shutdown and stays open with an error
message if saving fails.

Independent review caught stale bookkeeping after a successful rename followed
by a tracking failure, and a late app-preference write during cleanup. Both were
fixed with regression coverage. The review confirmed those findings resolved.
The full unit checkpoint passed 257 suites and 1,816 tests; final affected checks
passed 90 tests in four suites. All 23 Chromium journeys, lint, type checking and
web/Electron builds passed.

The native UI harness now closes and reopens immediately after story rename,
deletion, theme/default-format changes. All scenarios passed against the rebuilt
application. An initial rename test selected the passage rename control; inspecting
the exported story metadata identified the harness mistake, which was corrected
before accepting the result. Installed format metadata preservation is verified;
this is not a native test of adding a custom format during shutdown.

## Isolated browser preview pass

Browser Play, Test and Proof now render published HTML inside an opaque-origin
sandbox. Authored scripts cannot read editor DOM/storage, invoke a parent bridge
or navigate the parent tab. The sandbox also propagates to its popups. Temporary
local/session storage inside each frame keeps bundled formats working without
sharing the editor's storage. A visible notice explains that preview saves are
temporary; published HTML remains unchanged.

The first bare-sandbox experiment broke storage-dependent formats. The temporary
store fixed those observed failures; all four bundled current format fixtures now
pass both preview and independent publication checks. The full Chromium suite
passed 24 journeys, with the isolation journey extended and rerun to cover Test
and Proof as well. Downloads, sandboxed popups, parent-access denial, navigation
denial, temporary saves and reset on reload are exercised. Production offline
Harlowe preview/export passed after rebuilding. The notice/frame was visually
inspected.

The focused unit checks passed 35 tests across six suites, including route
publication options, temporary storage, accessibility and Electron URL handling.
Lint and web/main builds pass. The rebuilt native typing and mutation harnesses
passed again with the main-frame-only preload bridge. Electron external links
now accept only HTTP, HTTPS and mailto schemes.

Independent review found no direct parent/editor escape in this preview boundary.
The separate format-loader boundary is addressed by the trust pass below.
Temporary storage
does not emulate native quotas, storage events, cookies, IndexedDB or every
custom-format persistence feature. See preview-isolation.md.

## Story-format trust pass

Format installation and loading now evaluate the JSONP wrapper in a script-only
opaque sandbox and copy typed publishing metadata. DOMPurify removes unsafe author
and description markup. CORS-readable format files retain an exact source snapshot;
legacy JSONP hosts can still supply publishing templates without editor authority.
The unused parent-context JSONP dependency was removed.

Custom editor code requires explicit confirmation bound to its canonical URL and
SHA-256. That exact snapshot supplies direct function extensions and hydration.
Changed files require renewed approval; the UI explains disabled/unverifiable
extensions and permits revocation, including after approved code fails to load.
Bundled application assets remain trusted by exact URL, name and version.

The Add dialog no longer downloads again on submission. Independent review checked
the source/nonce boundary, metadata handling and trust persistence. A suspected
silent-revocation failure was ruled out after reviewing the existing recovery and
close guards; targeted journal-write/record-write failures now verify revocation
survives retry. Forced termination after a reported disk failure remains a limit.

Editor extensions now negotiate against the inherited Twine 2.12.1 API instead
of Studio's product version, restoring Harlowe's formatting tools. Mounted editors
refresh toolbar, mode and reference functions when trust or preferences change.
Commands remain installed while another editor uses them, and distinct format
identities prevent custom-name collisions. Pending loads check current approval
and existence before executing code or restoring controls after revoke/delete.

Three accidental focused-test declarations were removed. All 28 Chromium journeys
passed. Four-format preservation/publication, preview isolation, custom consent
and live toolbar changes passed 18 additional Firefox/WebKit journeys using the
pinned Playwright browsers. Production offline Harlowe preview/export and builds
pass. Native desktop checks cover actual Harlowe Bold insertion, local file-format
loading, preview/export and trust/revocation across restart. See release-readiness.md
for unit totals and story-format-trust.md for explicit compatibility limits.

This completes another security prerequisite, not the overall product mission.
Broader AI story modification, credential-management UI, story planning,
workflow polish and remaining acceptance evidence still require implementation.

## Passage list and navigation

Go To now opens a name-sorted list of every passage, with tags or a short text
preview. Searching includes names, text and tags. Clearing the query restores the
full list; closing and reopening starts fresh. Results update synchronously so
Enter cannot select a stale debounced query. Selecting a result retains the
existing map centering, selection and Edit workflow without changing story data.

Arrow keys wrap through results and scroll the selected row into view. Enter
selects, Escape closes, and focus returns to the opening control unless the
author has intentionally moved it elsewhere. Composition input is preserved and
the selected heading is announced through a polite status region. Existing
translated prompts remain available. Component accessibility checks pass; a
complete screen-reader study remains outstanding.

A real pointer check at 375 px reproduced toolbar buttons covering the search
field. Rendering the finder outside the fixed map's stacking context resolved
that failure; narrow layouts also stack the label above the input. Navigation
uses the same story context and does not introduce a separate data model.

The affected unit checkpoint passed 57 tests. After the portal and focus-test
corrections, the two finder suites passed 21 tests and the story route passed
five; two existing finder TODOs remain. The final production build, renderer
copy, full source lint and production offline writing/preview/export check pass.

Navigation acceptance passes in Chromium, Firefox and WebKit with 240 imported
passages, tag/text/name searches, keyboard scrolling, empty-query selection,
reset, long titles, editing and publication. The existing Chromium large-story
rename/reference/persistence journey also passes. Stable 768 px and 375 px
screenshots were inspected; the narrow textbox is clicked without forcing the
pointer. See ux-audit.md for the fixture and evidence limits.

Go To also filters passages with no path from Start through ordinary `[[...]]`
links. It resets on close, works with search and selection, and explains that
dynamic links and format-specific passages need author review. The filter passed
54 affected unit tests plus a 375 px import/search/select/reset journey in
Chromium, Firefox and WebKit; the Chromium screenshot was inspected.

## Optional desktop AI code repair

The first OpenCode Go action is restricted to a selected Harlowe or SugarCube
passage containing code. The Electron main process holds the user-provided key,
discovers the model without sending it, and requires a default-cancel native
confirmation for each paid request. The renderer receives only the proposed
edit. Exact-source and link checks prevent stale or expanded edits; accepting
the full before/after review dispatches one undoable passage update.

Mocked main/IPC checks pass 48 tests, proposal and panel checks pass seven,
and a Chromium browser journey confirms that opening the desktop-only panel
does not disturb recently typed passage text through reload. Builds and lint
pass. A real paid request, native end-to-end accept/undo, and broader author
experience remain unverified. See ai-evaluation.md and release-readiness.md.
