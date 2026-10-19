# Release readiness

**Not ready for release.** This is an initial verified foundation, not the complete
Twine Studio mission. No release has been published or deployed.

## Checks

Validated on Windows with Node 22.14.0/npm 10.9.2:

- The latest full Jest checkpoint passed **265 suites and 1,945 tests**, with 4
  skipped and 41 TODOs. It includes the page-exit and editor-draft recovery
  changes.
- Final desktop queue checks: **4 suites, 90 tests passed**, including rename
  tracking retry, app-preference ordering, late writes during shutdown, deletion/
  retry exclusion and restoration while deletion is still in progress.
- Final preview/Electron boundary checks: **6 suites, 35 tests passed**.
- Subsequent navigation changes: **57 affected tests passed**; final portal/focus
  checks passed 21 finder tests and five story-route tests. Two existing finder
  TODOs remain. This is targeted validation after the full unit checkpoint above.
- ESLint: no errors/warnings. TypeScript web and Electron main builds pass.
- Production web build and renderer copy both pass; no shell copy error remains.
- Chromium upstream smoke journeys: **6 passed**.
- Chromium suite: **28 passed**, covering the sample's two endings, immediate
  reload, native fact/condition journeys, four format round trips and previews,
  the 240-passage workflow, recovery, preview isolation, custom-format trust and
  mounted editor extension activation/revocation.
- Firefox and WebKit: **18 focused journeys passed** across format round trips,
  preview isolation, custom-format trust and editor toolbars. These use the repository's pinned
  Playwright browser builds; this is not a complete current-browser support audit.
- Subsequent navigation acceptance passes in Chromium, Firefox and WebKit:
  240-passage list, automatic keyboard scrolling, name/text/tag search, query
  reset, long-title selection, editing and publication. Real input clicks at
  375 px and stable 768 px screenshots pass. The existing Chromium large-story
  rename/reference/persistence journey also passes on this revision.
- Go To's standard-link path filter passes 54 affected unit tests and its 375 px
  import/search/select/reset journey in Chromium, Firefox and WebKit. The narrow
  screenshot was inspected. It follows ordinary `[[...]]` links; dynamic format
  navigation and special passages can affect actual playability.
- AI code-repair boundary checks: 48 Electron main/IPC tests and seven proposal/
  review component tests pass; the Chromium browser journey confirms opening the
  desktop-only panel preserves passage text through reload. Web/Electron builds
  and lint pass. No paid provider request or native end-to-end accept/undo was run.
- Native format acceptance passes with an isolated Windows profile: bundled
  Harlowe Styles/Bold insertion, local file-format installation, preview/export,
  exact-source editor approval and revocation retained across restart. Reproduce
  after building with `node scripts/verify-desktop-formats.cjs`.
- Choice/export journeys: **3 passed** (Harlowe enhanced/basic editors, SugarCube
  enhanced editor). Includes recent typing, explicit insertion, focus return,
  enhanced editor undo/redo, basic editor story undo/redo, reload, HTML publication
  and navigation to an ending on a separate origin serving only the export.
- Publish preflight identifies missing static internal destinations with their
  source passages. Focused unit tests cover the warning, cancel and explicit
  override. The delete-destination, override download, edit-source and
  publish-after-repair journey passes Chromium, Firefox and WebKit, including
  rapid reopen after the first download. Dynamic story-format navigation is not
  checked.
- Choice-set journeys: **3 Chromium and 4 Firefox/WebKit passes**. Each inserts
  two links and creates both destinations in one action, verifies undo, reload,
  HTML export and both endings in a standalone player. The original four
  Chromium single-choice/sample journeys still pass. At 375 px the form and
  toolbar were inspected and Undo was reached through the visible narrow-screen
  toolbar control.
- Medium/large audit: 40- and 240-passage synthetic stories loaded and searched at
  tablet viewport size. See ux-audit.md for single-run measurements and limits.
- Fresh isolated Windows Electron create/edit/restart smoke passed after rebuild;
  branding and fork-specific Documents paths were verified.
- Browser recovery now covers simulated quota failure before journaling,
  backup export and import into a clean profile, partial-write journal recovery,
  unreadable-journal raw export, and failure during the final reload flush.
  The latter reproduced silent loss before the post-flush navigation guard.
  The recovery panel was inspected at a desktop viewport. Forced process
  termination, actual full-disk behavior and power failure remain unverified.
- The editor's synchronous page-exit write retained final typing in ten
  consecutive Firefox reloads inside the debounce interval; the same journey
  passed in Chromium and WebKit. A unit test verifies the direct write on
  `pagehide`. An edit-time session draft also restores final typing after the
  simulated Firefox full-storage reload when no unload warning appears.
  Recovered drafts that differ from saved passages stay available for backup
  without overwriting saved work; the conflict journey passes in all three
  browser engines. Orphaned drafts surface a raw recovery export instead of
  silently disappearing. Missing, malformed or orphaned indexed story/passage
  records now raise a raw-export warning and stop story saves, so the partial
  Library cannot silently replace their index. The warning/export journey passes
  in Chromium, Firefox and WebKit.
- New browser recovery journals record the original value of every changed key.
  On reload, a journal that would replace a different, newer saved value stops
  startup and offers a raw export. The stale-journal journey passes in Chromium,
  Firefox and WebKit. Legacy version-one journals lack base values, so Studio
  now clears them only when the target records already match. If they differ,
  startup preserves both versions and offers raw recovery export. The legacy
  conflict journey passes in Chromium, Firefox and WebKit. Live commits still
  need an atomic cross-tab lock.
- Two-tab browser journeys pass in Chromium, Firefox and WebKit: a stale edit
  cannot replace a newer saved passage, its latest draft can be exported while
  the editor remains open, and edits to different stories both save. Recovery
  journals use a distinct key per page load, and the immediately preceding
  journal remains readable after reload. Unit tests also verify recovery across
  two reloads before retry and preserve a duplicated tab's inherited journal if
  its owner writes a newer version during another tab's commit. A unit test
  verifies journal recovery when session storage is blocked. This is a
  sequential stale-write guard, not an atomic cross-tab transaction guarantee.
- Desktop shutdown awaits renderer publication, IPC delivery, pending debounce
  and active per-story disk writes. Three consecutive native-window close and
  restart runs retained final typing after resolving a reproduced asynchronous
  publication race. Shutdown failures leave the window open for retry.
- Desktop rename/delete requests now have correlated replies and preserve
  per-story operation order. Shutdown includes preference/format JSON writes and
  main-only app preferences. JSON files are replaced after a complete temporary
  write. Native rename/delete/immediate-close/reopen scenarios pass, as do theme
  and default-format changes. Installed format metadata is preserved; custom
  format installation during close is not covered by that native harness.
- New component has a passing automated axe check. This is not a full
  accessibility audit or human usability study.
- Browser Play/Test/Proof isolate authored HTML in a sandbox with temporary
  storage. Parent DOM/storage/bridge access and top navigation are denied;
  popups inherit restrictions, and user-initiated downloads pass. Preview saves
  reset on reload/close; published HTML retains its original persistence behavior.
  See preview-isolation.md for boundaries and custom-format limitations.
- Production offline acceptance passed in Chromium, Firefox and WebKit after an
  initial online load: cached app reload, story creation, edit/save/reload,
  native preview and HTML export for Harlowe, SugarCube, Chapbook and Snowman.
  Harlowe also exercises a linked ending; the other formats execute a small
  variable-expression fixture. Reproduce with `npm run build:web` then
  `node scripts/verify-offline.cjs <browser> <format>`. The verifier
  stops its server for Firefox and WebKit because Playwright's offline switch
  rejects their top-level reload before the service worker responds. This does
  not cover arbitrary remote formats, cache eviction, or a browser's own
  offline-mode UI.

## Release blockers and required follow-up

- Finish the remaining acceptance limits below, especially advanced existing
  projects, AI modification, cross-browser behavior and harder failure modes.
- Browser authored previews and format metadata are isolated. Custom editor
  extensions require approval tied to URL and source hash; bundled application
  assets are trusted. Approved extensions still have renderer authority. Keep
  future provider credentials outside that renderer. See story-format-trust.md.
- Desktop normal-close mutation coverage now passes. Abrupt termination, real
  full disks, external concurrent file edits and power failure remain unverified.
- Simultaneous browser writes still lack an atomic cross-tab lock. Duplicated-tab
  journal cleanup is version-checked, but full concurrent editing and journal
  handoff still need stronger validation.
  Firefox's normal reload-before-debounce journey passed ten focused repeats.
  Session drafts cover the observed missing unload warning, but tab closure,
  blocked or exhausted session storage, and concurrent saves still need
  stronger failure testing before release.
- Browser keys are namespaced and legacy data is untouched. Explicit import is
  required; this is not automatic migration or protection from same-origin scripts.
- 41 npm advisories remain after fixing the two critical entries; triage runtime
  exposure and upgrade safely. Do not interpret zero critical as secure overall.
- Complete Paperthin historical license notice and bundled/transitive attribution.
- Optional desktop AI code repair now has a main-process provider adapter, native
  send confirmation and validated, reviewable single-passage proposals. A real
  paid round trip, native review/undo acceptance, credential-management UI and
  broader AI story-modification journey remain pending. See ai-evaluation.md.
- Story logic has bounded yes/no/numeric assignments and conditional choices;
  broader logic, story planning, map improvements and polished first-run experience
  remain incomplete. New UI translations currently fall back to English.
- Cross-browser, complete keyboard/touch, long-session and failure-recovery
  evidence is incomplete.
- Human beginner usability and release acceptance have not been established.

## Requested journey status

| Journey | Current evidence | Remaining limit |
| --- | --- | --- |
| A: first story | Choice creation, writing, undo, publish and original two-route sample verified | Human beginner study pending |
| B: branching mystery | Clue discovery hides/unlocks choices in five-passage Harlowe/SugarCube fixtures | Broader author experience pending |
| C: AI modification | Desktop Harlowe/SugarCube code-repair adapter, mock contract/review tests and browser boundary pass | Live paid request, native accept/undo and broader story-modification experience pending |
| D: relationship state | Numeric trust threshold unlocks a separate ending in both supported adapters | Arithmetic, registry and continuity tools pending |
| E: large story | 240-passage HTML import, list/search by name/text/tag, keyboard selection, rename, incoming-link update, edit, reload and publish pass; a static link-path filter and navigation pass Chromium/Firefox/WebKit | Irregular/long-text projects, dynamic navigation analysis and repeated performance runs pending |
| F: advanced project | Synthetic native source, script and CSS preserved through edit/export | Representative existing custom-macro projects still required |
| G: formats | Current Harlowe, SugarCube, Chapbook and Snowman round trips pass in Chromium/Firefox/WebKit; synthetic custom format publishes without editor authority | Historical/community wrappers and full language coverage pending |
| H: offline | Four bundled formats reload/edit/save/preview/export in Chromium, Firefox and WebKit; Harlowe linked ending passes | Remote formats, cache eviction and native offline-mode UI pending |
| I: recovery | Browser journal failure, partial writes, backup restoration, corrupt-journal export, guarded reload, passage creation/map drag recovery and native immediate close pass | Abrupt kills, real full disks and cross-browser behavior pending |
| J: publication | Original complete three-passage story plays both endings independently; missing static links surface source/target before export, and repair-to-publish passes three browser engines | Dynamic navigation and human review remain; no public release performed |

Independent review found no source-injection path in the bounded helper inputs.
Submit-focus concerns were checked against the parent insertion handler and live
browser focus assertions, which pass. Required-field feedback and overall
first-run usability still need a broader design/accessibility review. Automated
axe checks are limited to individual new components.

## Distribution

Keep GPL source and notices available with any future distributed application.
Story formats carry separate licenses. Use the fork's own name and application
identity; do not suggest upstream endorsement. Review release artifacts and
corresponding source before any public release.
