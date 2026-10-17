# Development progress

Status: active development; not release-ready. Baseline is Twine 2.12.1,
`4ebcce6a69c62b1c4b51bb76f2b7ac51dd84d9d2`, upstream development branch `develop`.

## Implemented in this invocation

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

Complete current checks and commit verified changes. Then resolve preview
isolation, abrupt-process/storage-failure recovery, native
format round trips, and remaining beginner workflow gaps before optional AI.
