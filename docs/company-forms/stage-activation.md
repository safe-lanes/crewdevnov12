# Tenant stage activation

Every tenant runs its own migrations through `runMigrationsForTenant` on its
connection's upgrade; the standalone database uses the same migration runner.
No shared or environment-wide switch controls Company Form enforcement.

The tenant-local stage rollout record begins with capture and enforcement off.
The go-live migration takes a short assignment/planning write barrier, records
empty non-retrospective checks for existing current/reached stages, then records
completion and enables enforcement in that same transaction. Ordinary lifecycle
operations may wait for this database upgrade barrier, but never for a form
decision, missing fact or retry. Failed migrations roll back the activation.
The next upgrade resumes safely; existing live events are not replaced.

Historic deployment and relief dates that were not captured are explicitly
unknown. Upgrade time is a recording/boundary time, not a fictitious historical
trigger date. No legacy check evaluates rules or creates requirements or forms.
The append-only `GO_LIVE_COMPLETED` audit shows tenant-local coverage.

New lifecycle operations capture their original facts inside the authoritative
operation transaction using an isolated savepoint. Evaluation occurs after the
operation commits. Failed/pending checks cannot undo the operation. Retrying
requires Company Forms Fill in and the assignment's normal scope, never Forms
authoring. A capture failure cannot reconstruct missing facts from changed data.

Defer relief requires Vessel edit authority and a written reason. Assignment-first
locking serializes it with form starts/signatures. It withdraws only unstarted
requirements, retains started/completed pins and ends the relief cycle. Replanning
starts a fresh check. Planned to Confirmed never starts another check.
