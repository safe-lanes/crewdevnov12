---
name: Verified assignment provenance
description: Why planning-to-assignment UUID links must come from a proven operation, not a plausible database match
---

Normal sign-on, sign-off, import, and edit operations must use the exact persisted
assignment UUID; they must never recover a missing link by looking up crew,
vessel, and state. For legacy rows, prefer explicit administrator-reviewed
reconciliation over a plausible match.

**Why:** Older records can contain multiple voyages, cancelled histories, and
incomplete vessel identities. Even an apparently unique current row can belong
to the wrong voyage. The user explicitly ruled out inventing links for known
unlinked relievers. On September 30, 2026, the user separately directed an
automated, exact-one backfill for the 24 existing onboard incumbents to keep
release sign-off operational. This is a bounded exception for incumbent
historical data, not permission for runtime fallback or reliever inference.

**How to apply:** For imports, deployments, handovers, and departures, carry an
assignment UUID from the operation that created it under the same transaction.
Keep sign-on/sign-off fail-closed. Treat system-audited, exclusive incumbent
backfills as automated decisions, never as administrator review of documents;
ambiguous matches and relievers still need explicit review. Do not repeat the
one-time backfill on future unknown populations without fresh authorization.