---
name: Snapshot-at-submit vs live admin flag
description: When a feature freezes an admin flag onto a record at submit time, legacy rows default false and never activate — OR with the live flag.
---

When a feature snapshots an admin/config flag onto a per-record column at a state
transition (e.g. promotion_reviews_v2.is_lock_form set when status→submitted),
remember that **rows created before the feature shipped have the column at its
default (false)**. Reading ONLY the snapshot means those legacy records never get
the behavior, even after the admin enables the flag.

**Rule:** compute the effective flag as `snapshot || liveFlag`, not snapshot-only.

**Why:** keeps the admin gate (both false → off), preserves the freeze (snapshot
true stays on even if admin later turns the live flag off), AND lets pre-existing
records activate once the admin flag is on. This was the root cause of the
Promotion Review form "section not locking after submit" bug — approved reviews
predating the feature had is_lock_form=false frozen.

**How to apply:** in the frontend lockState memo of
client/src/modules/promotions/PromotionReviewForm.tsx, isLockForm ORs the review
snapshot with promotionFormLockLive (the live /api/v2/admin/forms flag).
