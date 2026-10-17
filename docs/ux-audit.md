# Twine Studio UX audit

Date: 2026-10-17. This is a bounded smoke benchmark of the development web UI
using isolated Playwright Chromium contexts with a `768x1024` viewport.

## Method

Each run used a fresh isolated browser context and a generated localStorage
fixture. The fixture contained one story using Harlowe 3.3.9 and either 40 or
240 generated passages, including one uniquely named target (`Passage 38`). No
real user data or external files were imported. Timings use `performance.now()`
from navigation through the first visible library/story/map state or control
result. The benchmark script was kept outside the repository under `work/`.

| Fixture | Library visible | Map visible | Go To search result | Result selection | Build/publish menu |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 40 passages | 597 ms | 829 ms | 28 ms | 337 ms | 56 ms |
| 240 passages | 576 ms | 1,169 ms | 34 ms | 400 ms | 62 ms |

Values are single-run observations on the local development server, not
statistical performance claims. The larger fixture added about 340 ms to map
visibility and 63 ms to result selection in this run.

## Observations

The story library clearly exposed the story name and passage count. Opening the
story exposed an actual `Go To` button; activating it opened a fuzzy finder with
an input and selectable result. Search and selection worked at both sizes.
The top-level `Build` control opened a menu containing publish/file actions, so
the publish path was reachable without attempting a real file write. The map
also exposed `Test From Here`, `Start Story Here`, display-density controls,
Undo/Redo, Select All, and Deselect All.

At this viewport, keyboard smoke checks passed: Tab moved focus to a focusable
control and Escape dismissed the transient menu/dialog state. This was a basic
focusability check, not a complete keyboard traversal or accessibility audit.

## Strengths and barriers

The main strengths were visible story scale, a direct Go To affordance, fuzzy
search with a clear result, and a reachable Build menu. The 240-passage map
remained usable in the smoke run, though it took longer to become visible than
the 40-passage map.

The main barriers observed in scope were that the benchmark required a
double-click on the story card to enter the map, and the map presents many
passage cards at once on a 768 px-wide viewport. The run did not establish
whether all map content is reachable without pointer interaction, nor whether
the publish flow succeeds through an OS save dialog.

## Scope limits

This was one run per fixture on a development server with synthetic, regular
grid positions. It did not test Electron, filesystem persistence, import/export
of real HTML, story-format execution, long passage text, browser variation,
screen readers, touch input, zoom levels, or repeated-run variance. No app code
was changed for this audit.

## Subsequent acceptance check

`e2e/studio-large-story.spec.ts` now imports a real HTML fixture containing 240
passages through the library UI, searches for a passage, renames it, edits it,
reloads and publishes. Assertions verify all 240 passages survive and an incoming
link is updated to the new name. This is a functional check, not an updated
timing benchmark. The earlier measurements predate the storage namespace change.

The check reproduced an exception on Enter with no search results. Keyboard
selection now ignores an absent result and resets selection when the query
changes. The regression exercises Enter/ArrowUp on an empty result set and checks
that no browser error occurs. Complete screen-reader/touch acceptance remains open.
