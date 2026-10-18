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
   native destination creation, enhanced editor undo. Plain textarea now reflects
   controlled updates. New UI strings use localization with English fallback.
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
    export passed after reproducing the original preview failure.
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

## Next priorities

Resolve preview isolation and format-extension trust, abrupt-process and full-disk
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
