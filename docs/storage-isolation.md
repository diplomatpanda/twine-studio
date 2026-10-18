# Browser storage isolation

The browser persistence layer uses the `twine-studio-*` namespace for its preference, story, passage, and story-format list keys and their per-record keys.

Legacy `twine-*` keys are deliberately left untouched and are not imported automatically. This prevents Twine Studio from rewriting data owned by an upstream or parallel Twine installation. Any future compatibility feature must be an explicit, user-triggered import with validation and quota/error handling.

## Interrupted browser saves

Story, passage, preference and format writes are staged as a single change set.
Before existing records are changed, Studio writes that set to a page-specific
`twine-studio-pending-transaction-*` key. The prior single-key journal remains
readable for recovery. If the journal cannot be written, the old
records stay intact and the latest changes remain in memory. If a later record
write fails, loading overlays the durable journal onto the records, preventing
a partially written story or index from becoming the visible state.
The page keeps a session history of journal owners so a second reload before
retry can still recover the earlier durable journal. Cleanup removes an inherited
journal only when its bytes still match the version applied by that commit.

A persistent recovery panel offers retry and an HTML archive of the current
stories. Continued edits merge into the pending change set. Browser navigation
tries to warn when the latest changes have not reached durable storage. Firefox
did not present that warning in a simulated full-storage reload, so navigation
warnings alone are not a recovery guarantee. An invalid
journal stops loading and offers a raw JSON rescue export without deleting data.

The journal requires extra browser storage while saving. This is not an atomic
multi-tab transaction protocol or a substitute for
external backups. Browser eviction, cleared site data, forced process kills
before a typing flush, and hardware/power failures remain outside this guarantee.
Raw rescue JSON is intended for recovery investigation; ordinary Library Import
accepts the HTML story backup, not that diagnostic JSON.
