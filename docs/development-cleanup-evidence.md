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
