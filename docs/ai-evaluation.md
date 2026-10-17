# Optional AI provider evaluation

This note records the current evidence for a future, explicitly opt-in structured development assistance feature. It does not implement AI requests or select a provider.

## OpenCode Go

OpenCode's current documentation describes Go as access for OpenCode and other coding agents that produce similar requests. Clients should send a product-specific User-Agent and a stable `x-opencode-session` header per conversation. Traffic is monitored for abuse.

- Go documentation: https://dev.opencode.ai/v2/docs/console/go
- Inference API: https://dev.opencode.ai/v2/docs/console/api/inference/
- API overview and service-account permissions: https://dev.opencode.ai/v2/docs/console/api/
- Terms of Use: https://opencode.ai/legal/terms-of-service

Current Go endpoints are family-specific under `https://opencode.ai/inference/go/` (OpenAI Responses, OpenAI-compatible Chat Completions, Anthropic Messages, and Gemini). The live model list is available at `GET https://opencode.ai/inference/go/v1/models`; the model lineup and endpoint mapping can change.

Paid inference requires a bearer token. A distributed desktop application must not embed a shared provider key. Any future implementation should require a user-supplied credential, keep it local or server-side with appropriate secret storage, and make requests user initiated and bounded to coding or development assistance.

OpenCode's terms require internal use and prohibit automated output extraction, bulk-account or limit circumvention, background processes while not logged in, scraping, and unreasonable load. They do not define “typical coding agent traffic” precisely, so compatibility and legal review remain open questions for a Twine Studio fork.

Privacy varies by model: the Go documentation lists different retention and training policies, including models with 0-day retention and models whose prompts or completions may be used for training. A future UI must disclose the selected model's policy before sending source or project data.

## Future scope

Before implementation, define the user-facing task boundary, credential lifecycle, prompt and project-data minimization, model discovery and fallback behavior, request cancellation, rate and cost limits, error handling, and an explicit review of OpenCode's current terms and any third-party model policies. Keep the provider behind a narrow adapter so the feature remains optional and replaceable.
