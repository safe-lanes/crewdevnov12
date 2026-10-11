# Subject-owned applicability dimensions

This slice validates authored policy and exposes deciding data. It does not
create requirements, match rules, resolve applicability, gate operational
workflows, add a rule editor, or change Standard Forms.

## Public read-only interfaces

- `GET /api/v2/admin/forms/:id/rule-dimensions`: Forms View permission;
  subject declarations, operators, availability and current master choices.
- `GET /api/v2/company-form-submissions/subjects/crew_assignment/:ref/dimensions`:
  Company Forms View plus the existing exact-assignment and vessel scope.
  No capture or other write occurs during this read.
- Crew Database G3 assignment groups expose **Dimension check** on demand.

The core calls subject hooks, without crew/rank dimension branches. The
crew-assignment adapter declares vessel type, vessel, fleet group, additional
group, nationality, rank, manning agent, crew pool, first-ever company contract
and first-in-rank company contract. Owner and flag are **not yet available**.

## Master values and provenance

Categorical policy values are selected identifiers, not entered labels.
UUIDs remain UUIDs; agent/pool masters use their existing UUID primary keys
serialized as strings. No replacement identifier catalogue is created.
Legacy text must have exactly one authoritative master match. Blank, unmapped,
ambiguous or missing provenance is UNRESOLVED, never a default match.
Fleet/additional group values come from exact parent membership references.

New Deploy records the rank from its exact persisted reliever planning link in
the same transaction. Parent company-role references can map to the canonical
available-rank identity; suffixes are never parsed. Existing contexts use only
recorded planning links with a unique authoritative mapping. No present-rank,
latest-G1 or crew/vessel/state inference is used.

Sign-on captures company-history deciding data before E1 insertion. Prior
company service includes relief without a minimum duration. Current/future
service is not evidence of prior service. Unidentifiable same-day ordering,
unmapped historical ranks and malformed dates remain explicit uncertainties.
Already signed-on assignments without a reliable capture stay UNRESOLVED.
Captured rank/history are frozen; Planned reads may derive uncaptured history.

## Release and copying

Draft writes may retain incomplete conditions; release cannot. Each released
condition must use a declared, available dimension, a supported operator and
valid selected master identifiers (or a boolean for `is`). Labels are
server-derived, read-only response fields; write clients send authored fields
only, never `valueLabels` or a readiness flag.

Master reads are shared-locked during validation/release. A policy/subject
fingerprint and current PostgreSQL transaction ID bind the trusted proof.
Raw status updates without that same-transaction proof, and stale proofs, are
refused. Label snapshots and validation evidence freeze on release.

Released-to-draft copies retain explanation labels but receive independent
set/condition identifiers. Release revalidates current master eligibility.
Label refreshes do not count as authored applicability changes.

Automatic effective dates remain on-release by default, or a specific date
not earlier than release. No retrospective resolution or declaration is made.

## Retained evidence

All regression fixtures and their deciding context remain registered in
`docs/company-form-regression-fixtures.md`. The dimension-context test uses a
retained, isolated mirror schema with unchanged canonical parent-master IDs;
it is not a new master catalogue. API release tests retain their definitions,
versions, content, condition IDs and validation evidence, without submissions.
