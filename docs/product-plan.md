# Twine Studio product plan

Create an approachable, offline-capable Twine fork. Writing, choices, play and
publishing stay central. Preserve source editing, native story formats, story
identity, scripts, styles, tags, positions, import/export and desktop support.
This is an independent fork, not an official Twine release.

## Current delivery sequence

1. Establish upstream provenance, license inventory, reproducible Windows/web
   builds, isolated desktop storage and meaningful baseline tests.
2. Audit first-story, medium/large-story, keyboard and tablet workflows.
3. Add a discoverable plain-language choice helper using existing editing,
   passage creation and undo infrastructure. Verify actual native runtimes.
4. Resolve data safety and preview-origin boundaries before adding credentials.
5. Improve navigation and writing based on measured audit findings. Add explicit
   format adapters for simple state/conditions and small editable templates.
6. Implement optional OpenCode Go development assistance only within documented
   provider usage. Validate structured proposals, revisions and author approval.
7. Exercise all acceptance journeys, cross-format round trips, offline recovery,
   large stories, desktop restart, and independent HTML publication.
8. Finish coherent visual polish, accessibility, docs and release assessment.

## Scope rules

- At most 15 bounded implementation/review iterations per invocation.
- Changes must improve a real authoring or reliability workflow.
- No framework rewrite, mandatory cloud backend, or silent format conversion.
- Never silently overwrite a story with AI output. No prose requests through Go
  without positive provider authorization. No credential in browser persistence.
- Do not publish releases, deploy, or merge protected branches automatically.
- Automated browser success is not evidence of human usability.

## First choice helper acceptance

User need: create a meaningful labelled connection without knowing brackets.
Upstream requires typing syntax; its automatic destination creation already works.
Studio adds a compact form with label and existing/new destination, appending to
the current passage while preserving pending typing. Supported generated source
is Harlowe 3 and SugarCube 2 only. Advanced syntax stays editable as source.
Check native runtime navigation, destination creation, cancel, invalid labels,
enhanced editor undo, plain textarea updates, persistence and independent export.

## Passage navigation acceptance

User need: find and continue a passage in a crowded story without remembering its
title or position. Go To now doubles as a flat passage list. Browse all names,
search names/text/tags, select with keyboard or pointer, and continue through the
existing Edit action. Keep results usable at tablet widths, clear stale queries
on reopening, and preserve passage content, selection behavior and export data.
This does not add a chapter hierarchy or reinterpret format-specific source.
The optional filter now shows passages with no path from Start through ordinary
`[[...]]` links; it explicitly excludes dynamic format-specific navigation.
