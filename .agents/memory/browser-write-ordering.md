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