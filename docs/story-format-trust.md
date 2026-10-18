# Story formats and editor code

Adding a format reads its metadata and publishing template in an isolated frame.
Its JavaScript cannot read the editor's stories, browser storage or desktop bridge.
Author and description HTML allow basic formatting and HTTP(S)/mailto links;
scripts, embedded documents, event handlers and style attributes are removed.

Custom formats can publish and preview stories without editor-code approval.
To enable their editor extensions, open **Twine Studio → Story Formats → Trust
editor code**. The confirmation explains the authority being granted: approved
code runs in the editor and can read/change stories and use desktop operations.
Only approve code from a source you trust. This is not a restricted extension API.

Approval covers the canonical format URL and SHA-256 of the exact UTF-8-decoded
source snapshot. The same retained snapshot executes after approval; there is no
second download between confirmation and execution. A changed URL or source hash
disables extensions until approved again. Name/version changes require adding the
updated format separately. Bundled formats are trusted application assets; this
requires their exact packaged URL, name and version, not a claimed built-in flag.

Editor extensions match the inherited Twine 2.12.1 API, independently of Studio's
release number. Toolbars, syntax modes and reference parsers update when approval
or extension preferences change. This removes their active editor controls;
restarting remains necessary to remove arbitrary code side effects.
Commands use distinct format identities and remain available while another
passage editor uses the same format. Revocation and deletion cancel pending
extension execution; delayed loads cannot restore the old controls.

**Revoke editor code trust** discards the saved approval and reloads metadata in
isolation. Save successfully and restart Twine Studio to remove code that already
ran. Revocation cannot undo earlier code effects or stop timers installed by that
code in the current session. Failed persistence uses the same retry/recovery and
close guards as other application settings; forcing the application to terminate
after a reported save failure can leave old settings on disk.

## Compatibility and implementation limits

- The loader accepts HTTP(S), and local file URLs in the native desktop app.
- A CORS-readable source snapshot and a secure-context SHA-256 implementation are
  required for custom editor-code approval. Older JSONP-only hosts still work for
  publishing through a sandboxed script request, but cannot enable extensions.
- Approval preserves direct function-valued extensions and serialized `hydrate`
  extensions. Both execute only after consent. A failed approved script remains
  approved and can be retried on a subsequent load.
- The metadata wrapper must work without editor DOM/storage/bridge access.
  Wrappers that require those privileges merely to return their metadata will
  report a loading error. Inline snapshot execution does not retain the original
  script element's URL or support every custom wrapper's relative-resource trick.
- Format source is capped at 16 MiB of decoded text. Network requests are not
  prohibited by the sandbox. This is an editor-data boundary, not a network policy.
- This boundary does not make approved extensions safe for provider secrets.
  Future credentials must stay outside the editor renderer with narrowly scoped,
  user-initiated request controls.

The sandbox grants only `allow-scripts`, checks message source and a per-request
nonce, and copies a fixed set of typed metadata fields. Callback-provided trust
or source-snapshot fields are ignored. Sandboxes are removed after success,
failure or timeout. See `e2e/studio-format-trust.spec.ts` for browser regressions
and `scripts/verify-desktop-formats.cjs` for the native acceptance harness.
