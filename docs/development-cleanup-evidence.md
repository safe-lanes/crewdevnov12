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
