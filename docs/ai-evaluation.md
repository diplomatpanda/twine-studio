# Optional AI provider evaluation

The desktop app has bounded, opt-in code editing for a selected Harlowe or SugarCube passage: repair existing story-format code, or propose one conditional choice to an existing passage. It is an experimental coding aid, not a prose-writing or autonomous story-editing service. The browser app shows that the action is desktop-only. No provider key is bundled, and the app makes no inference request without a user-provided key and a native confirmation for that request.

## OpenCode Go boundary

OpenCode currently describes Go as access for OpenCode and similar coding agents. The adapter uses the public `GET https://opencode.ai/inference/go/v1/models` list to confirm `deepseek-v4.1-flash`, then the model's OpenAI-compatible Chat Completions endpoint for a user-approved coding request. It sends a product-specific User-Agent and a stable `x-opencode-session` per request. Model availability and policies can change.

- Go documentation and current model privacy: https://dev.opencode.ai/v2/docs/console/go/
- Inference API: https://dev.opencode.ai/v2/docs/console/api/inference/
- Terms: https://opencode.ai/legal/terms-of-service

Set `TWINE_STUDIO_OPENCODE_GO_KEY` in the desktop process environment before launch to use your own key. The key stays in the Electron main process; it is never returned through the renderer bridge or saved in story, browser, or app-preference storage. Model discovery is unauthenticated. Each inference request is user initiated, limited to one active request, capped in size and time, and cancelable by its session. The app does not retry paid requests automatically.

The request contains the selected passage source, passage name and ID, story format and version, a fixed coding task, and a session ID. Conditional-choice requests also contain the author's instruction and up to 100 existing destination names and IDs, but no destination passage bodies. The UI presents the disclosure and current model privacy link before a consent checkbox; the native prompt defaults to Cancel. Authors should check the current privacy policy before sending source. Provider terms limit Go to coding-agent-like traffic and internal use; these actions deliberately exclude general fiction generation.

For repair, the model can return only a proposed single-passage text update. Strict parsing rejects unsupported fields, a changed passage ID, unchanged text, oversized output, and changes to passage links. For conditional choices, the model returns only a fact name, comparison, value, plain-text label, and existing destination ID. Twine Studio validates those parameters and generates the format-specific source locally. An accepted conditional choice appends one link; it cannot create or rename a passage. The editor shows complete before/after source and requires an explicit Accept. Accept applies one undoable edit only when the selected source, format, and conditional destination name still match; Reject or close leaves the story unchanged. Model output remains untrusted data, so authors should inspect syntax and story behavior after accepting it.

## Evidence and remaining limits

Mocked tests cover endpoint selection, headers, no-key behavior, native denial, one active request, session-scoped cancellation, invalid proposals, conditional source generation, existing destinations, and stale-source refusal. The web browser journey confirms opening the desktop-only panel preserves passage text through reload. A real paid inference round trip has **not** been run because no user key was supplied; model quality, cost, provider failures and native end-to-end review/undo still need live acceptance. The environment-variable setup is intentionally minimal credential handling, not a complete credential-management UI. This feature does not close the broader AI-modification journey or release acceptance.
