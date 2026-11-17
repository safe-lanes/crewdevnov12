# Part H implementation evidence

## Step 1 — preflight
Read-only preflight on 17-Nov-2026 found 130 crew, 26 master users, no
missing or duplicated user UUIDs, one active Crew Database menu, and no existing
Part H tables. No persisted company/tenant time-zone column or setting exists;
port time-zone mapping and a hard-coded rotation report zone are not tenant settings.
Overdue therefore uses UTC, with the due date valid through its entire UTC day.

The migration runner reads only four-digit SQL files in `migrations/`.
The new migration is prepared under `.local/pending-migrations/`, outside that
directory, until preflight succeeds. Existing migrations are immutable.
The new resource is additive and does not modify existing crew, form structure,
applicability, submission lifecycle or historical records.

Development data allowance: new schema objects and migration ledger entry, two
menu entries and new default-off permission rows only. Verification content and
enabled grants belong exclusively to the identity-verified test database.
Before/after fingerprints are stored under ignored `generated-artifacts/part-h/`.
The known failing-name baseline is `docs/test-suite-stability-2026-11-17.md`.

## Step 2 — storage
After preflight, migration 0273 was promoted to the runner's migration directory.
It adds four dedicated tables and retention/identity/history guards, with
restricting crew foreign keys. It does not touch existing crew or form rows.
The staged draft remains outside the runner as preparation evidence; only the
promoted SQL is executable by the runner.
