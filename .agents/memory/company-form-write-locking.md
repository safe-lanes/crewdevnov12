---
name: Company Form write locking
description: Cross-path lock ordering required when voiding, starting, signing or saving Company Forms concurrently.
---

Company Form writes must use the same subject-first lock order, including
drafts, lifecycle writes, starts and voids. Extra form locks for archive-state
confirmation must not invert the subject/submission order used by other writes.
An unlocked pin may identify which subject to lock, but must be revalidated
under the submission lock before acting.

**Why:** A sequential browser pass missed an Office void/Master write deadlock.
Real database regression tests reproduced both signature and draft races as
PostgreSQL deadlocks and HTTP 500s. Each path's locks were individually sensible
but incompatible across paths.

Planning is also a concurrent writer of the subject assignment, even for
ordinary contract/relief-due edits without any Forms operation. Checking only
form or sign-off writers misses inversions in these operational paths.
Concurrent deployment can change an initially empty reliever link: preserving
slot-clear semantics requires rollback and a fresh subject-first transaction,
not locking a newly discovered assignment while holding Planning.

**How to apply:** When introducing a lock or lifecycle transition, compare its
order against all concurrent starts/saves/signatures/voids. Keep archive
acknowledgement protected by the form lock and test actual blocked transactions,
not only mocked lock calls or sequential requests.