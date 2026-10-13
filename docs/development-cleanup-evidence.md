# Development cleanup — preparation only

No development cleanup or repair is authorized until the dry run is approved.

## Step 0: registered test identity allowlist

The expiring production-absence check has been removed. Tests accept only the
registered cluster system identifier and database OID. The independent
development-identity refusal remains, including in reset. A different URL cannot
register a new identity. Reset verifies the old identity before dropping it and
registers the recreated database before migrations and seeding.

Evidence, 13 October 2026 UTC:

- Node guard tests: 6 passed.
- Standalone `npm test -- tests/unit/modules/crew-pool/crew-import.test.ts -t 'Date Parser'`:
  exit 0, two passed (one unrelated test excluded by the filter), before and after reset.
- The same command with its test target pointing at development: exit 1 before
  startup, with the protected-database refusal.
- `npm run test:reset`: exit 0. Cluster `7586633721581772821`, old OID
  `1089488`, newly registered OID `1144979`.
- Unfiltered standalone `npm test`: executed the suite, exit 1,
  **1,232 passed, 164 failed, 67 pending**. This exceeds the stated 163-failure
  ceiling by one; the full-suite gate is **not passed**.
- Company Forms: **85 suites, 512 passed, zero failed, zero skipped**.
- TypeScript: **222 diagnostics**, exit 1, within the stated ceiling.

### The two additional failures against the old 161 baseline

1. `tests/integration/api/promotions.test.ts:194`, “rejects Promotion Type
   changes after Part B has been submitted”: fixture creation expects 201 but
   receives 400. The approved review requires a released Promotion form-version
   pin; the isolated fixture supplies neither the pin nor the released form.
   The service resolves that pin in
   `server/v2/promotions/services/promotionReviewsService.ts`.
2. `tests/integration/api/reliever-unassign-assignment.test.ts:1337`,
   “rejects malformed and absent master IDs in SQL, canonicalizes case, and
   preserves legacy unrelated updates”: expects a pre-existing row with a
   hard-coded malformed vessel UUID. Its count is zero in the isolated database.

After reset a third failure appears at
`tests/integration/api/reliever-unassign-assignment.test.ts:1411`:
“returns 400 for invalid crew-pool API creates/updates and stores the master
casing”. It expects 201 for the original vessel 04 UUID, which is not one of
the synthetic master vessels seeded by reset. The server returns 400.
These unrelated fixture deficiencies have not been repaired or hidden.

Raw logs and reports remain outside Git in `/tmp/allowlist-*.log`,
`/tmp/cleanup-typescript.log`, and `.local/verification/company-forms-all-tests-*`.

## Step 1: full backup and restore proof

Completed at **2026-10-13 03:57:55 UTC** using
`node scripts/backup-development-for-cleanup.mjs`.

- Backup: `generated-artifacts/private-db-backups/development-2026-10-13T03-55-23-357Z.dump`.
- PostgreSQL custom archive, **51,102,425 bytes**, all application schemas.
- A repeatable-read exported snapshot was shared by the count queries and dump.
- Restored into a new scratch database with a distinct verified OID; compared
  **2,736 tables**, with **zero count differences**.
- Scratch database was dropped after verification.
- Directory permissions are 0700 and backup/report files are 0600.
- Backup and detailed proof are excluded from both Git and publishing.
  They contain personal data and must not be shared as downloadable assets.
- Development records were not changed. Restore used `--no-owner --no-acl`
  in scratch; the archive retains the original ownership/ACL information.

## Step 2: dry run — stopped, no deletion or repair

Recorded **2026-10-13 04:21:17 UTC**. The script opens a repeatable-read,
read-only transaction. It inventories all 252 public tables, traverses actual
foreign keys and exact identifiers (not rank/name matching), and records private
per-record content fingerprints for later kept-content verification.

| Category | Proposed removal | Keep | Review, not deleted |
|---|---:|---:|---:|
| Vessels | 1,233 | 9 | 1 |
| Seafarers, including five CHKMT | 1,677 | 127 | 0 |
| Assignments | 2,219 | 243 | 0 |
| Planning rows | 1,005 | 106 | 0 |
| Company Forms, including authored forms | 1,234 | 0 | 0 |
| Standard Forms | 35 | 6 | 0 |
| Versions, both kinds | 1,906 | 50 | 0 |
| Rank groups, including two Test Senior Officers groups | 37 | 48 | 0 |
| Company Form submissions | 1,235 | 0 | 0 |
| Requirements | 65,674 | 0 | 0 |
| Resolution runs | 3,548 | 0 | 0 |
| Requirement transitions | 67,016 | 0 | 0 |
| Signature attachment records | 829 | 19 | 0 |
| Roles | 842 | 52 | 0 |
| Parent-user/test-actor records | 1,118 | 24 | 0 |
| Legacy menu grants | 449 | 1,388 | 0 |
| Resource/action grants | 4,285 | 313 | 0 |
| Vessel types | 129 | 19 | 0 |
| Manning-agent list entries | 3 | 0 | 0 |
| Company sea-service rows | 190 | 473 | 0 |
| Crew document records | 0 | 314 | 0 |
| Retained test schemas | 224 | 0 | 0 |

Full per-table removal/keep/review counts, including dependent records, are in
`generated-artifacts/cleanup-dry-run-counts.csv`. Detailed identifiers, decisions,
conflicts and content hashes are private in
`generated-artifacts/private-db-backups/cleanup-dry-run.json`; do not commit them.

### Identification and preservation

- The nine original vessels are the parent records labelled vessel 02 through
  vessel 10. MV CHECKMATE is a removal candidate.
- The 127 established seafarers are the reviewed A-number cohort, IDs 44–170.
  All records belonging to them are protected, including recruitment sources.
  The remaining fixture cohort includes five CHKMT and synthetic EMP/REQ/TEST/CF,
  rule, signing and demo fixtures.
- The original Standard Forms are IDs 1, 2, 6, 8, 9 and 10. Their names are Crew
  Appraisal, Promotion Review, Rating Appraisal, Crew Debriefing, Crew Interview
  and Crew Briefing. The preserved versions include 42 released and eight drafts.
  No newly created `00` draft dated 13 October exists among these versions.
- Test role identification uses fixture labels, including CF lifecycle/boundary,
  Void Race, Forms race office, Stage-less form office and TEST ONLY cohorts.
  Related users and grants are identified by the role relationship. Email-less
  test actors after the original 24 parent users are included; the original
  parent users are protected even if their labels contain a test marker.
- Master-list candidates include VT_VW, Boundary/Render vessel types,
  Debriefing Acceptance types and identifier-valued labels.
- The 224 schemas are 78 `test_stage`, 21 `test_ac`, 37 `cf_dimensions`,
  37 `cf_lock`, 33 `cf_verified_history` and 18 `cf_crew_import`.
  Public, drizzle and system schemas are not proposed for removal.
- Subject/stage catalogues and the tenant rollout configuration are not
  operational form instances and are retained. Deleting all checks while
  retaining enforcement also needs an availability decision before execution:
  existing stages must not silently become unavailable for future manual forms.
- Real-subject Standard submissions are preserved: nine Briefing, two
  Debriefing, 14 Appraisal, 111 Promotion and one Interview. Preservation includes
  historical/draft records, not just completed submissions.

### Exceptions requiring direction before execution

1. **One vessel is not established as test data.** It is the historical
   `Import-744535d0-841a-11ed-aa7c-7003bca91a866` placeholder. Three assignments
   belonging to established seafarers reference it. It is held for review,
   not silently classified as disposable. Removing it while preserving those
   assignments unchanged would leave dangling references.
2. **Two protected rotation records reference a proposed planning removal:**
   one `rotation_entries_v2` row and one `rotation_archive_v2` row. They are
   retained. The proposed removal set cannot be executed unchanged while
   satisfying both reference integrity and kept-content preservation.

These are observable existing inconsistencies. Historical before-images proving
that tests caused a particular real-subject rank/status/assignment change are
not available here; current state alone is not proof of who changed it.
No such change has been repaired or reverted.

Raw SQL re-counted all **2,736 tables** against the backup snapshot before final
review: **zero differences**. The dry run itself has no development write path.
Deletion remains unauthorized, and these exceptions must be resolved before a
single-run executor can satisfy the requested final invariants.

## Approved step 3: pre-deletion gate

Approval retains the historical import vessel and the complete dependency closure
of kept records. No referring row is rewritten. The revised manifest records
each newly retained dependency separately. Explicit TEST ONLY checklist-override
audit entries are fixture records, not reasons to retain their deleted forms.
Subject/stage catalogues and rollout configuration remain unchanged.

The 161 → 164 full-suite increase consists of:

1. `promotions.test.ts`, “rejects Promotion Type changes after Part B has been
   submitted”: setup expects an approved review without furnishing the released
   Promotion form pin required by the service; it receives 400 instead of 201.
2. `reliever-unassign-assignment.test.ts`, “rejects malformed and absent master IDs
   in SQL, canonicalizes case, and preserves legacy unrelated updates”: expects
   malformed historical assignments to exist; the isolated database has none.
3. Same file, “returns 400 for invalid crew-pool API creates/updates and stores the
   master casing”: depended on original vessel 04, seeded only by a later test.
   It now owns a unique synthetic vessel and removes it through normal teardown.
   The success, refusal, persisted-value and casing assertions are unchanged.

Pre-deletion full-suite run on 13 October: **1,233 passed, 163 failed, 67 pending**.
Only the third defect above was fixed, as requested. The remaining baseline
failures are not claimed green.

## Step 3: executed, one committed maintenance transaction

Run `d27e14ef-c21d-4547-a55f-e64614726584`, 13 October 2026,
**04:53:57–04:58:17 UTC**, executed at HEAD
`410580aa358a4a99e56aa66f1e4c6fb771fe5f32`.

The approved dependency closure retains the import vessel, planning ID 1112,
its incumbent fixture seafarer, incumbent assignment, captured rule context,
source sea-service row and creator user ID 99. The protected rotation entry
473 and archive 414 remain unchanged. Personal names and detailed dependency
keys are not published in this repository.

| Category | Before | Removed | After cleanup |
|---|---:|---:|---:|
| Vessels | 1,243 | 1,233 | 10 |
| Seafarers | 1,804 | 1,676 | 128 |
| Assignments | 2,462 | 2,218 | 244 |
| Planning | 1,111 | 980 | 131 |
| Forms, both kinds | 1,275 | 1,269 | 6 |
| Versions | 1,956 | 1,906 | 50 |
| Rank groups | 85 | 37 | 48 |
| Company submissions | 1,235 | 1,235 | 0 |
| Requirements | 65,674 | 65,674 | 0 |
| Requirement history | 67,016 | 67,016 | 0 |
| Roles | 894 | 842 | 52 |
| Parent users/test actors | 1,142 | 1,117 | 25 |
| Sea service | 663 | 189 | 474 |
| Test schemas | 224 | 224 | 0 |

Only the six original Standard Forms remain. The extra vessel, seafarer and
creator are approved retention exceptions, not claimed deletions.

### Integrity and stage reopening

- Exact PostgreSQL `row_to_json` SHA-256 fingerprints, including timestamp
  precision, match for every kept record. Checks run under exclusive table locks,
  after deletion and again after go-live. No kept row was repaired or rewritten.
- **Zero remaining references to removed row identities**: enforced database
  foreign keys stay enabled, supplemented by exact scalar/nested JSON identity
  checks. Public constraint definitions and original user-trigger states match.
- Immutable-history user triggers are suspended only within the locked
  maintenance transaction, then restored. The cyclic RESTRICT link between
  requirements and submissions is deleted in one SQL statement, not by
  weakening its foreign keys.
- Item 30 ran tenant-locally for all current, non-cancelled open assignments,
  also opening already-reached earlier stage entry points. **168 of 168 current
  stages are open**. There are **195 recorded empty completed checks**, no
  requirements, and enforcement remains enabled. Tenant go-live and cleanup
  completion are recorded in the stage audit.
- All 252 public tables have before, removed, after-cleanup and after-go-live
  counts in `generated-artifacts/cleanup-before-after-counts.csv`.
- Private execution details are in
  `generated-artifacts/private-db-backups/cleanup-execution-latest.json`.

Closing verification uses `scripts/verify-cleaned-forms-preview.mjs` against the
existing main preview and original parent Office account. It creates no fixtures
or grants and records the checked HEAD, backend start, rendered original forms
and empty Company Forms tab in the ignored generated-artifacts directory.

The browser verification passed using the original parent Office/Admin account.
Independent post-preview SQL rechecked **14,269 kept records**, with zero content
differences, all 252 public-table counts matching the execution, 195 COMPLETED
checks, zero requirements, no retained test schemas and enforcement enabled.

## Subsequent, separately approved historical-import-vessel cleanup

On 13 October 2026, a fresh backup was written outside Git under
`generated-artifacts/private-db-backups/`. A restore into a separate scratch
database matched counts in all **253 backed-up tables**; the scratch database
was dropped before the deletion. The backup is retained privately.

One recorded maintenance transaction removed only the previously retained
`Import-744535d0-841a-11ed-aa7c-7003bca91a866` vessel, its three
assignments (two already soft-deleted Planned and one Cancelled), the
Cancelled assignment's rule-context row, and 24 empty **Test Officer**
planning rows exclusively owned by the removed vessel. No seafarer row was
removed. The vessel 02 incumbent fixture, its assignment, planning row 1112,
rotation entry 473, archive 414 and the real reliever's records were excluded.

| Table | Before | Removed | After |
|---|---:|---:|---:|
| `master_vessels` | 10 | 1 | 9 |
| `crew_assignments` | 244 | 3 | 241 |
| `crew_assignment_rule_context` | 57 | 1 | 56 |
| `vessel_planning_v2` | 131 | 24 | 107 |

The transaction compared exact row-content fingerprints for **15,022 kept
records across all 252 public tables**. All matched. Declared foreign keys
and nested/free-text UUID references to removed records were checked, with
zero remaining. User triggers temporarily suspended for the frozen context
were restored; foreign-key constraints were never disabled. The final vessel
list is exactly vessel 02 through vessel 10.

The single committed run and per-table before/after fingerprints are recorded
privately in `generated-artifacts/private-db-backups/` as the
`import-vessel-execute-*.json` report. The original cleanup's counts above
remain historical measurements taken *before* this later, narrowly approved
removal; they are not the current vessel/assignment/planning counts.
