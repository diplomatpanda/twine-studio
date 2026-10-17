# Release readiness

**Not ready for release.** This is an initial verified foundation, not the complete
Twine Studio mission. No release has been published or deployed.

## Checks

Validated on Windows with Node 22.14.0/npm 10.9.2:

- Full Jest run: **252 suites passed**, **1,744 tests passed**, 23 skipped and 42
  TODOs. After the final basic-editor undo fix, all six affected suites passed
  again (64 tests, 3 TODOs); unchanged suites reuse the full-run evidence.
- After storage isolation, lifecycle saving and fresh-profile cleanup changes,
  all 13 affected suites passed (112 tests, 4 TODOs).
- ESLint: no errors/warnings. TypeScript web and Electron main builds pass.
- Production web build and renderer copy both pass; no shell copy error remains.
- Chromium upstream smoke journeys: **6 passed**.
- Current complete Chromium suite: **18 passed**, including the original
  sample's two endings, immediate-reload regression, two native fact/condition
  journeys, four format round trips and the 240-passage import/rename/export.
- Final affected unit checks: **6 suites, 73 tests passed**, 6 TODOs (fact/source,
  passage/choice and navigation groups). These supplement the earlier full run
  and persistence checks; they are not a new full-suite total.
- Choice/export journeys: **3 passed** (Harlowe enhanced/basic editors, SugarCube
  enhanced editor). Includes recent typing, explicit insertion, focus return,
  enhanced editor undo/redo, basic editor story undo/redo, reload, HTML publication
  and navigation to an ending on a separate origin serving only the export.
- Medium/large audit: 40- and 240-passage synthetic stories loaded and searched at
  tablet viewport size. See ux-audit.md for single-run measurements and limits.
- Fresh isolated Windows Electron create/edit/restart smoke passed after rebuild;
  branding and fork-specific Documents paths were verified.
- Immediate browser reload preserves a pending passage edit. Lifecycle flushes
  and namespace isolation have targeted unit coverage. Abrupt process termination
  and disk/quota failure recovery are not established by this evidence.
- New component has a passing automated axe check. This is not a full
  accessibility audit or human usability study.
- Production offline acceptance passed after an initial online load: cached
  app reload, story creation, edit/save/reload, native Harlowe preview and HTML
  export. Reproduce with `npm run build:web` then `node scripts/verify-offline.cjs`.
  This does not cover arbitrary remote formats or recovery after cache eviction.

## Release blockers and required follow-up

- Finish acceptance journeys A–J, including conditional mystery/relationships,
  advanced-format preservation, real offline operation and failure recovery.
- Resolve inherited preview-origin/renderer trust boundaries before credentials.
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
| I: recovery | Immediate browser reload and isolated desktop restart pass | Abrupt kills, quota/disk failure, graph interruption and restoration pending |
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
