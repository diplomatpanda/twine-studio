# Release readiness

**Not ready for release.** This is an initial verified foundation, not the complete
Twine Studio mission. No release has been published or deployed.

## Checks

Validated on Windows with Node 22.14.0/npm 10.9.2:

- Full Jest checkpoint: **256 suites passed**, **1,803 tests passed**, 23 skipped
  and 42 TODOs. This includes browser recovery, startup failure, passage lifecycle
  and desktop publication/close coverage. Final IPC race fixes are checked again
  with the affected suites; unchanged suites reuse this full-run evidence.
- Final desktop queue checks: **3 suites, 50 tests passed**, including obsolete
  failed-save retry, a third flush after retry, deletion/retry exclusion and
  restoration while deletion is still in progress.
- ESLint: no errors/warnings. TypeScript web and Electron main builds pass.
- Production web build and renderer copy both pass; no shell copy error remains.
- Chromium upstream smoke journeys: **6 passed**.
- Chromium suite: **22 passed**, covering the sample's two endings, immediate
  reload, two native fact/condition journeys, four format round trips, the
  240-passage workflow and recovery. A separate passage-creation/map-drag recovery
  journey passed on the same browser source, for **23 verified journeys**.
- Choice/export journeys: **3 passed** (Harlowe enhanced/basic editors, SugarCube
  enhanced editor). Includes recent typing, explicit insertion, focus return,
  enhanced editor undo/redo, basic editor story undo/redo, reload, HTML publication
  and navigation to an ending on a separate origin serving only the export.
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
- Desktop shutdown awaits renderer publication, IPC delivery, pending debounce
  and active per-story disk writes. Three consecutive native-window close and
  restart runs retained final typing after resolving a reproduced asynchronous
  publication race. Shutdown failures leave the window open for retry.
- New component has a passing automated axe check. This is not a full
  accessibility audit or human usability study.
- Production offline acceptance passed after an initial online load: cached
  app reload, story creation, edit/save/reload, native Harlowe preview and HTML
  export. Reproduce with `npm run build:web` then `node scripts/verify-offline.cjs`.
  This does not cover arbitrary remote formats or recovery after cache eviction.

## Release blockers and required follow-up

- Finish the remaining acceptance limits below, especially advanced existing
  projects, AI modification, cross-browser behavior and harder failure modes.
- Resolve inherited preview-origin/renderer trust boundaries before credentials.
- Desktop shutdown waits for story HTML saves, but concurrent rename, deletion
  and preference/format JSON operations are not yet part of that barrier. Their
  immediate-close behavior remains a release blocker; do not infer it from the
  verified typing/close journey.
- Browser keys are namespaced and legacy data is untouched. Explicit import is
  required; this is not automatic migration or protection from same-origin scripts.
- 41 npm advisories remain after fixing the two critical entries; triage runtime
  exposure and upgrade safely. Do not interpret zero critical as secure overall.
- Complete Paperthin historical license notice and bundled/transitive attribution.
- AI implementation, safe proposal review and credential management are pending;
  current provider constraints are documented in ai-evaluation.md.
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
| C: AI modification | Provider constraints researched | Integration, proposal review and credential isolation unimplemented |
| D: relationship state | Numeric trust threshold unlocks a separate ending in both supported adapters | Arithmetic, registry and continuity tools pending |
| E: large story | 240-passage HTML import, search, rename, incoming-link update, edit, reload and publish pass | Irregular/long-text projects and repeated performance runs pending |
| F: advanced project | Synthetic native source, script and CSS preserved through edit/export | Representative existing custom-macro projects still required |
| G: formats | Bundled current Harlowe, SugarCube, Chapbook and Snowman fixtures execute after round trip | Older/custom formats and full language coverage pending |
| H: offline | Production Chromium reload/edit/save/Harlowe preview/export pass | Other formats, cache eviction and cross-browser coverage pending |
| I: recovery | Browser journal failure, partial writes, backup restoration, corrupt-journal export, guarded reload, passage creation/map drag recovery and native immediate close pass | Abrupt kills, real full disks and cross-browser behavior pending |
| J: publication | Original complete three-passage story plays both endings independently | No public release performed |

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
