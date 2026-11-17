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

## Development write inventory
The repeatable-read, read-only fingerprints compare all 275 pre-existing public
tables. Exactly three changed; all other 272 match byte-derived row fingerprints.
| Table | Before | After | Allowed change |
| --- | ---: | ---: | --- |
| `adm_menumaster_ac` | 82 | 84 | Internal Comments and Internal Actions |
| `adm_roleaccess_ac` | 1,469 | 1,549 | 40 roles × two resources; every new grant is false |
| `schema_migrations` | 285 | 287 | 0273 and 0274 ledger entries |

The four new Part H tables each contain zero development rows. No verification
crew, assignments, vessels, comments, actions, users or enabled grants were added
to development. No other development content changed in the measured interval.
Raw counts and fingerprints are retained in ignored evidence, without row contents.
Filtering out the two new menu identifiers also reproduces the exact original
82-row menu fingerprint and 1,469-row permission fingerprint: no existing menu
or permission row was changed.

The current user master has no active/left-company field. The dropdown may
therefore include departed staff; only the parent can supply a trustworthy
lifecycle flag and its update semantics. There is no company/tenant time-zone
setting: overdue is evaluated against the current UTC calendar date, with the
whole due date available. Both limitations and the future legal-erasure question
are recorded in the production checklist.

The first permission-migration attempt was refused because a synthetic grant
identifier exceeded an existing varchar(36) constraint. The transaction rolled
back and 0274 was not recorded in either target. Its identifier generation was
corrected before successful application; no applied migration was edited.

## Commit record
| Step | HEAD after implementation |
| --- | --- |
| 1 — preflight and checklist | `0db48d2c8b5d6eac1988f2025021c37c7515cb56` |
| 2 — storage | `7e569af3b50587d13ca2e7ecf7812514bb46758a` |
| 3 — permissions and reads | `a0c04bf4ae5b7c0799cab1d04f16a8dc798eeea6` |
| 4 — comments | `9291aec9e06488bd81719666d0a12b98c680b3df` |
| 5 — actions | `0fe35e1fbffa6c0e7695866bb494449572856417` |
| 6 — profile screens | `46a8f8a1fb264554fd79e6428323a0a58b4dbf32` |
| 7 — isolation and disclosure checks | `c17bfdcf72afb6c08802a310cb25f3422eadcf8e` |
| 7 — additional stale-history guard and transition/route checks | `e9b8e41dd11a0c055f309ba36b622c0e4e4714bc` |

Step 8 is the closing evidence/documentation commit containing this document;
its resulting HEAD and the later backend start time are reported in chat.

## Gate provenance
The earlier full run started at 14:26:33 UTC while the additional privacy check
was still being completed. It is not the closing gate. It reported 2,410 passed,
163 failed and 67 skipped. Its failing set was the known 162 plus:

`tests/integration/company-form-combined-grid-browser.test.ts` —
`saves all three groups through the screen, then proves a real third-writer failure rolls everything back`.

That existing browser test timed out waiting for Access Control at line 99.
Its captured page was empty, with no page errors or API timings. It loads its
frontend through the external development preview rather than the dedicated
test origin. The exact cause of this blank load is NOT PROVEN. This test and
the two previously deferred unstable tests were not changed.
All 19 new Part H assertions passed in that run. A separate final full run is
required against the completed implementation, with the failing identities
compared to the committed stable inventory.

### Closing full run — completed implementation
- Command: unchanged `npm test`; existing `fileParallelism: false`.
- Implementation HEAD: `e9b8e41dd11a0c055f309ba36b622c0e4e4714bc`.
- 2,411 passed; 162 failed; 67 pending/skipped; 2,640 total.
- The 162 failed identities are exactly the known stable set, with no additions
  or omissions. Sorted failure-name fingerprint:
  `75cbd79a8432018302fc4fbea4ef6f74fa8f510ea183e165fe888ac41767d37c`.
- Company Forms: 432 assertions passed, zero failed, zero skipped, within this
  full run (case-insensitive `company.*form` test-file inventory).
- Part H: all 19 assertions passed, including the real delayed-history response
  across window closure/edit/reopening, concurrent complete/reopen revision
  conflicts, and all fifteen route/method combinations for vessel, wrong-crew
  and missing matching View. The second-tenant-schema test cannot read the first
  tenant's crew even when its actor/grant fixtures are copied.
- TypeScript: 222 diagnostics, with none in the new Part H modules.
- The existing Access Control browser test that failed in the earlier run
  passed in the closing full run; it remains unchanged. Its earlier blank-load
  failure is retained above, not hidden by the accepted closing result.

Evidence is outside Git in `generated-artifacts/part-h/`: `full-suite.json`,
`full-suite.log`, `full-suite-backend.log`, `typescript.log`, development
fingerprints, screenshots and the self-contained `browser-evidence.html`.
The earlier full-run reports are retained with the `first-` prefix.
The gallery covers Add/Edit/View/history, overdue/completed actions, removed
entries, narrow layout, the two permission rows and vessel refusal.

No production parent sign-in was exercised; test personas and verified isolated
database identities were used. That production/staging acceptance check remains
separate from the passing resource authorization tests.
