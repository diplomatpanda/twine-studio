# Release readiness

**Not ready for release.** This is an initial verified foundation, not the complete
Twine Studio mission. No release has been published or deployed.

## Checks

Validated on Windows with Node 22.14.0/npm 10.9.2:

- The latest full Jest checkpoint passed **274 suites and 2,054 tests**, with 4
  skipped and 41 TODOs. It includes the browser lock, closed-tab journal
  recovery, duplicated-tab guard, story knowledge and attached-note search,
  the idea starter and filename-collision checks.
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
- Go To now searches notes attached to an individual passage. A Chromium browser
  journey created a private note, reloaded the story, found its passage by the
  note title, displayed the note preview, and selected that passage. Unit checks
  exclude story-wide and named-branch notes from passage matches. The refreshed
  browser bundle also removed a weak unrelated result for that query.
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
  Raw export on an early journal failure includes IndexedDB drafts; that startup
  path passes Chromium, Firefox and WebKit.
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
  conflict journey passes in Chromium, Firefox and WebKit.
- Two-tab browser journeys pass in Chromium, Firefox and WebKit: a stale edit
  cannot replace a newer saved passage, its latest draft can be exported while
  the editor remains open, and edits to different stories both save. Recovery
  journals use a distinct key per page load, and the immediately preceding
  journal remains readable after reload. Unit tests also verify recovery across
  two reloads before retry and preserve a duplicated tab's inherited journal if
  its owner writes a newer version during another tab's commit. A unit test
  verifies journal recovery when session storage is blocked. Browser commits
  now take an exclusive Web Lock and recheck story versions before record writes.
  A held-lock journey confirms that two queued same-passage saves cannot both
  commit, while the second journal remains intact, in all three engines. A
  closed-tab journal with no session history now replays under that lock when
  its bases still match. Conflicting or unverifiable journals stop startup and
  offer raw export. A fresh tab waits for an active tab's queued commit before
  classifying its journal. The two affected browser files pass **84 tests** across
  Chromium, Firefox and WebKit, including early-startup IndexedDB export,
  exact-draft recovery review, blocked reads and a newer-draft cleanup race.
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

- Story Knowledge now supports optional, author-entered characters, relationships,
  locations, world rules, plot threads, choices, timeline events, questions and
  endings. Entries carry an explicit status and story, passage or named-branch
  scope. Passage links follow a rename; deleted passage links remain visibly
  unresolved. Browser copies live in the story's local storage record. Desktop
  copies live in a validated JSON sidecar beside the story HTML and are included
  in story-directory backups. Published playable HTML and archive exports exclude
  this private context. Authors moving a desktop project must copy the sidecar
  with its HTML file; importing only playable HTML cannot restore the notes.
  Named branches are labels, not verified path-specific facts. Graph-aware
  continuity checks, conditional state reasoning and portable private project
  export remain future work.
- **Start from an idea** now creates a six-passage editable scaffold for Harlowe 3
  or SugarCube 2, with two early routes, a reconnection and two endings. A
  Chromium browser journey created the mystery starter, played one route, then
  published its HTML and played the other route from a separate local server.
  The export held six passages and excluded the private premise-note title.
  Starter prose is intentionally brief; it does not invent a protagonist or
  narrative conflict from the idea, and human beginner usefulness is untested.

- Finish the remaining acceptance limits below, especially advanced existing
  projects, AI modification, cross-browser behavior and harder failure modes.
- Browser authored previews and format metadata are isolated. Custom editor
  extensions require approval tied to URL and source hash; bundled application
  assets are trusted. Approved extensions still have renderer authority. Keep
  future provider credentials outside that renderer. See story-format-trust.md.
- Desktop normal-close mutation coverage now passes. Abrupt termination, real
  full disks, external concurrent file edits and power failure remain unverified.
- Browser commits are serialized by Web Locks in supported secure contexts.
  A duplicated-tab conflict journey now passes Chromium, Firefox and WebKit:
  a changed inherited journal blocks the duplicate's stale save and retains its
  draft. Full handoff after the original tab closes and recovery when Web Locks
  are unavailable still need stronger validation. Closed-tab journals are
  replayed only when their recorded bases are compatible; ambiguous journals
  require raw export.
  Firefox's normal reload-before-debounce journey passed ten focused repeats.
  A separate IndexedDB checkpoint now preserves a passage edit after simulated
  journal quota failure and actual tab close without `beforeunload`; the journey
  passes Chromium, Firefox and WebKit. Competing tab checkpoints remain distinct
  in raw recovery export and block later story writes; ordinary successful saves
  clear matching checkpoints. IndexedDB can also be denied, exhausted or
  interrupted before its asynchronous commit, so abrupt close at that boundary,
  real storage exhaustion and simultaneous saves still need stronger failure
  testing before release. Durable orphan or conflicting drafts now show their
  text and can be discarded one at a time after review; the delete compares the
  complete stored record, so a newer version remains untouched. A guided merge
  or restore of a selected conflicting draft is still pending.
  When session storage is blocked, startup now replays a single compatible
  abandoned journal under the Web Lock and stops for raw export if two journals
  contain different drafts of the same record. Without Web Locks, a pending
  journal can be exported but cannot be retried until the lock manager works.
- Browser keys are namespaced and legacy data is untouched. Explicit import is
  required; this is not automatic migration or protection from same-origin scripts.
- 41 npm advisories remain after fixing the two critical entries; triage runtime
  exposure and upgrade safely. Do not interpret zero critical as secure overall.
- Complete Paperthin historical license notice and bundled/transitive attribution.
- Optional desktop AI code editing now has a main-process provider adapter, an
  isolated credential window and OS-backed encrypted key storage (with no Linux
  `basic_text` fallback), native send confirmation, validated repair proposals, locally generated conditional
  choices to existing passages, reviewed links that create one or two empty
  branch passages, and an opt-in, bounded Story Knowledge context preview with
  private notes excluded by default. The credential window's save/remove flow passed a Windows Electron
  smoke check with a fake key in isolated user data. A real paid round trip,
  native review/undo acceptance, macOS/Linux credential-window validation, and
  a broader AI story-modification journey remain pending. See ai-evaluation.md.
- Story logic has bounded yes/no/numeric assignments, signed numeric changes,
  conditional choices and short conditional text in Harlowe and SugarCube.
  Authors must initialize numeric facts before changing or checking them;
  broader logic, richer story planning, map improvements and polished first-run experience
  remain incomplete. New UI translations currently fall back to English.
- Cross-browser, complete keyboard/touch, long-session and failure-recovery
  evidence is incomplete.
- Human beginner usability and release acceptance have not been established.

## Requested journey status

| Journey | Current evidence | Remaining limit |
| --- | --- | --- |
| A: first story | Choice creation, writing, undo, publish and original two-route sample verified | Human beginner study pending |
| B: branching mystery | Clue discovery hides/unlocks choices in five-passage Harlowe/SugarCube fixtures | Broader author experience pending |
| C: AI modification | Desktop Harlowe/SugarCube code repair, conditional choices to existing passages, and one- or two-way forks with empty destinations; either or both routes of a two-way fork can be accepted; opt-in established Story Knowledge context is previewed and bounded; mock contract/review/undo tests and browser boundary pass | Live paid request, native accept/undo, passage drafting and broader multi-passage story edits pending |
| D: relationship state | Browser authoring and published playthrough pass in Chromium, Firefox and WebKit for Harlowe/SugarCube: initialize trust, add 3, show conditional dialogue and unlock a separate ending | Native journey, registry and continuity tools pending |
| E: large story | 240-passage HTML import, list/search by name/text/tag, keyboard selection, rename, incoming-link update, edit, reload and publish pass; a static link-path filter and navigation pass Chromium/Firefox/WebKit; attached-note search and selection pass Chromium | Irregular/long-text projects, dynamic navigation analysis and repeated performance runs pending |
| F: advanced project | Synthetic four-passage SugarCube fixture preserves StoryInit, custom macro, CSS, tags and passage sources through import/edit/export; published route works in Chromium, Firefox and WebKit | Representative existing third-party projects, external assets and older format versions still required |
| G: formats | Current Harlowe, SugarCube, Chapbook and Snowman round trips pass in Chromium/Firefox/WebKit; synthetic custom format publishes without editor authority | Historical/community wrappers and full language coverage pending |
| H: offline | Four bundled formats reload/edit/save/preview/export in Chromium, Firefox and WebKit; Harlowe linked ending passes | Remote formats, cache eviction and native offline-mode UI pending |
| I: recovery | Browser journal failure, partial writes, backup restoration, corrupt-journal export, guarded reload, passage creation/map drag recovery and native immediate close pass | Abrupt kills, real full disks and cross-browser behavior pending |
| J: publication | Original complete three-passage story plays both endings independently; broken static links surface source/target before export and repair-to-publish passes three browser engines. Publish preflight now also flags a missing start and statically unreachable passages, with an undoable start chooser and edit navigation; the unreachable warning was checked in a rebuilt browser. | Dynamic navigation and human review remain; no public release performed |

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
