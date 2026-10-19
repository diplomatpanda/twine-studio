# Browser storage isolation

The browser persistence layer uses the `twine-studio-*` namespace for its preference, story, passage, and story-format list keys and their per-record keys.

Legacy `twine-*` keys are deliberately left untouched and are not imported automatically. This prevents Twine Studio from rewriting data owned by an upstream or parallel Twine installation. Any future compatibility feature must be an explicit, user-triggered import with validation and quota/error handling.

## Interrupted browser saves

Story, passage, preference and format writes are staged as a single change set.
Before existing records are changed, Studio writes that set to a page-specific
`twine-studio-pending-transaction-*` key. The prior single-key journal remains
readable for recovery. A version-one journal without original record values is
cleared only when its records already match; otherwise startup stops and offers
the raw rescue export, because replay could erase a newer tab's work. If the
journal cannot be written, the old records stay intact and the latest changes
remain in memory. Each journal is written before requesting an exclusive
browser Web Lock. The callback rechecks loaded story versions and journal bases
and rewrites the complete pending journal before changing records, so
cooperating tabs cannot both commit stale versions or apply an unjournaled edit.
If the lock request fails or Web Locks are unavailable, the records stay intact
and the journal remains available for retry or raw export. A lock request that
waits longer than 15 seconds stops with a retryable error. If a later record
write fails, loading overlays the durable journal onto the records, preventing
a partially written story or index from becoming the visible state.
The page keeps a session history of journal owners so a second reload before
retry can still recover the earlier durable journal. Cleanup removes an inherited
journal only when its bytes still match the version applied by that commit. A
duplicated tab also checks that an inherited journal has not changed since it
opened; if the original tab changes it, the duplicate stops saving and retains
its draft for backup.
When session storage is unavailable, recovery scans the page-specific journal
keys in local storage; a unit test verifies a durable interrupted save across
reload in that condition. This fallback is not cross-tab coordination.
When session history is available, a fresh tab waits for earlier lock holders,
then replays a valid abandoned journal under the lock before opening the Library.
If that journal conflicts with newer records, or multiple journals disagree,
startup stops and offers raw recovery export without changing their bytes.

A persistent recovery panel offers retry and an HTML archive of the current
stories. Continued edits merge into the pending change set. Browser navigation
tries to warn when the latest changes have not reached durable storage. Each
passage edit also checkpoints its latest text in this tab's session storage before
the debounced save. On reload, a draft is restored and saved only when the saved
passage still matches the draft's starting text. If it changed, Studio shows the
recovered draft for backup and blocks an overwrite. Firefox did not present an
unload warning in a simulated full-storage reload; the session draft preserved
that final text. A draft whose passage or story no longer loads raises a warning
with a raw recovery export containing its bytes. An invalid
journal stops loading and offers a raw JSON rescue export without deleting data.
If an indexed story or passage record is missing, malformed or orphaned, Studio
shows a recovery warning and offers the raw JSON export. Story writes stop so a
partial Library view cannot replace the saved index. The HTML story backup only
contains records that could be opened; the raw export retains the original
storage bytes for investigation and repair.

The journal requires extra browser storage while saving. Web Locks coordinate
Studio tabs using the same browser storage origin; they do not protect against
other same-origin scripts or replace external backups. Browser eviction,
cleared site data, forced process kills
before a typing flush, and hardware/power failures remain outside this guarantee.
Raw rescue JSON includes session drafts for recovery investigation; ordinary Library Import
accepts the HTML story backup, not that diagnostic JSON.
