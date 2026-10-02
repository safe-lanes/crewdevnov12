---
name: Browser write ordering
description: Why atomic server writes do not guarantee that the latest browser edit wins
---

Database row locks protect atomic updates, but do not preserve the causal order
of independently dispatched browser edits. Editable forms need ordered client
writes or server-enforced monotonic revisions, separately from transaction locks.

**Why:** network timing can let an older edit obtain the lock after a newer edit
and overwrite it. An older success notification can also hide a newer failure.
Lossless value encoding alone does not prevent this data loss.

**How to apply:** when an editor saves during typing, test delayed and failed
requests as well as sequential round trips. Include explicit clearing and
comment-only edits; a blank display is not proof that a persisted value cleared.

Whole-form refetches after a section action must reconcile local draft overlays
rather than replace every section's answers and comments.

**Why:** another section may have failed or delayed saves. Even a successful PUT
is not a read barrier: an earlier GET can arrive afterward with older values.
Clearing an overlay merely because a save succeeded can lose edits or persist
the older values again on retry.

**How to apply:** track answer and comment revisions independently, acknowledge
only the revision actually sent, and retain editable overlays until a fetched
server value confirms them. Test an action in one section while another has
pending/failed saves, old acknowledgements, stale GET responses, and explicit
clears. Reset scope on real submission navigation; server-submitted sections
and terminal declarations must display persisted history, not abandoned
uncommitted drafts.