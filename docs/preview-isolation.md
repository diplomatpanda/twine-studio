# Preview boundary

Browser Play, Test and Proof render published story HTML in a sandboxed srcdoc
iframe. Scripts, forms, modals, popups and downloads are permitted. Same-origin
access, parent navigation and popup escape are not. The editor does not listen
for preview messages or expose a storage bridge. The old document-replacement
utility has been removed.

This follows the browser sandbox model described by [MDN](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe).
Keep `allow-same-origin` and `allow-popups-to-escape-sandbox` absent. Adding
same-origin access would let authored scripts reach editor data.

## Temporary saves

An opaque frame cannot use the editor origin's browser storage. A self-contained
bootstrap creates separate in-memory localStorage and sessionStorage substitutes
before story scripts run. They support item methods, key enumeration and common
named-property access. Their lifetime is one frame load; reload and close discard
them. The preview notice states this limitation. Publishing does not add the
bootstrap or modify the format source.

The substitutes do not implement native Storage identity, storage events,
persistent quotas, cookies or IndexedDB. Custom formats using those features may
need testing through published HTML. Existing editor/browser saves are neither
read nor removed by the preview. Native desktop previews still launch scratch
HTML in the system browser, using that browser's normal file-origin behavior.

## Separate trust boundaries

Story-format loading and editor extensions still execute in the editor context.
This change confines authored preview HTML; it does not make untrusted installed
format code safe or establish credential isolation. Those remain release work.
The sandbox also permits network requests from stories; it is not an offline or
network-access policy.

Electron explicitly disables Node integration in renderer/subframes and enables
context isolation/sandboxing. Preload exposes its bridge only in the main frame.
Editor navigation/popups can open HTTP, HTTPS and mailto links externally; other
schemes and malformed URLs are rejected. This is separate from the deliberate
scratch-file launch path used to play exported stories.

## Evidence

- Current Harlowe, SugarCube, Chapbook and Snowman fixtures render their native
  source and edited prose in the isolated player and as independent exports.
- The browser isolation test checks parent DOM/storage/bridge denial, blocked
  top navigation, inherited popup restrictions, downloads, temporary saves,
  reload reset, and Play/Test/Proof routes.
- Production offline Harlowe preview and export pass.
- Targeted units cover temporary storage, iframe restrictions, accessibility,
  route publication options and Electron external URL filtering.
- Native typing and rename/delete/settings close/reopen checks pass with the
  guarded preload.

This is bounded automated evidence, not a complete browser-security audit or
proof of compatibility with every historical/custom format.
