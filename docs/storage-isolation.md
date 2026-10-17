# Browser storage isolation

The browser persistence layer uses the `twine-studio-*` namespace for its preference, story, passage, and story-format list keys and their per-record keys.

Legacy `twine-*` keys are deliberately left untouched and are not imported automatically. This prevents Twine Studio from rewriting data owned by an upstream or parallel Twine installation. Any future compatibility feature must be an explicit, user-triggered import with validation and quota/error handling.
