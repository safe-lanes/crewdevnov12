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

## Steps 3–7 — confidential resource and verification
- Separate route prefix: `/api/v2/crew-internal/:crewUuid`.
- Comments/actions each provide list, detail, history, create, edit and reasoned
  removal. Actions additionally provide complete/reopen; the crew-scoped assignee
  endpoint returns only UUID, frozen-display name and designation.
- Every route resolves the persisted actor/role and rejects vessel classifications,
  including mistaken grants. Matching View is always required; mutations additionally
  require their own right, except raiser/assignee complete/reopen, which do not need Edit.
- Removed entries return only IDs/revision and removal metadata without Delete.
  History checks the locked current parent, so a concurrent removal cannot expose a
  previous snapshot. Cross-crew and second-tenant-schema reads are tested.
- The comment/action event insert and parent change share one transaction.
  Concurrent stale edits are refused. Database guards reject hard deletes,
  historical updates, changing recorded author/creation facts and changing removed entries.
- Both request loggers explicitly exclude Part H response bodies. Resource errors
  never log database statements or bodies, and responses are `Cache-Control: no-store`.
- Private UI cache keys include tenant, actor, role and effective grants; they are
  cleared on identity/authority changes, and removed content has no View-only control.

### Disclosure inventory and verification method
| Boundary | Verification |
| --- | --- |
| General crew detail/profile/list/enriched/details APIs | Real test-backend requests with confidential content present; marker absent |
| Profile Export PDF | Browser download parsed with `pdftotext`; crew name present, Part H wording absent |
| Crew Pool grid exports | Source guard verifies grid mapping never references Part H |
| Every Reports handler | Source guard verifies all report sources never reference Part H storage or module |
| Crew-list documents and other client PDF generators | Source guard over generator files; no Part H reference |
| Vessel, rotation, Company Form system fields/frozen records, Standard Briefing/Debriefing, Accounts | Separate-resource architecture plus source guard; no Part H join or module reference |
| Attachments, alerts, assistant | Source guard; no Part H storage/module reference |
| Development and production logs | Source guard on both loggers plus no logging calls in Part H modules |

Browser evidence uses only the dedicated test backend and its verified database.
It uses an ordinary synthetic office role with Crew Pool/Crew Database/Dashboard
View plus Part H rights, not universal permissions; the Access Control screenshot
uses the existing isolated synthetic administrator. The vessel actor deliberately
holds Part H grants and is still denied on all fifteen route/method combinations.
These are development test personas, not production parent sign-ins.
Test cleanup waits for browser/request completion, then temporarily disables only
Part H user triggers inside a disposable-database transaction, deletes only this
test's rows, reenables the triggers and removes the synthetic crew/users/grants.
This cleanup capability is not exposed through product code.

Source guards are not runtime end-to-end verification of every export or every
Report; those unexercised runtime paths are explicitly NOT VERIFIED end-to-end.
Their source-level exclusion and resource separation are verified.

The first permission-migration attempt was refused because a synthetic grant
identifier exceeded an existing varchar(36) constraint. The transaction rolled
back and 0274 was not recorded in either target. Its identifier generation was
corrected before successful application; no applied migration was edited.
