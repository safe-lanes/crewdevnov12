# Isolated test database — closing evidence

## Actual SQL identities

| Target | Database | OID | Cluster system identifier |
| --- | --- | --- | --- |
| Protected development | heliumdb | 16384 | 7586633721581772821 |
| Dedicated test, after guarded resets | sail_automated_tests | 1089488 | 7586633721581772821 |

Identity was read from `current_database()`, `pg_catalog.pg_database.oid` and
`pg_catalog.pg_control_system().system_identifier`, not URL text. The test
database was independently registered; inherited workers must match that
registration too.

The platform again explicitly reported no managed production database during
closing verification. Absence is not a permanent exemption: see the fail-closed
production-status rule in `docs/testing-isolation.md`.

## Reset and negative checks

`npm run test:reset` successfully dropped/recreated the designated database,
applied all **259 migrations**, and seeded synthetic masters/author. It was run
more than once while validating setup; the latest successful reset registered
OID `1089488`. No development dump, real seafarer or service history was copied.

Seven standalone guard/policy tests passed with zero skips. Additionally:

- An actual connection using the development target was refused by its SQL
  identity before callers received the client.
- `SET search_path TO private_fixture,public` was refused.
- Unrestricted verification releases and OR sets lacking fixture-only vessel
  restrictions were refused by the release policy.
- Missing test configuration has no development fallback.

## Full suite

Closing command: `npm test`, dedicated backend on **5100**; main-preview workflow
was not running during these automated tests.

- Start: **2026-10-13 03:13:48 UTC**.
- Duration: **230.46 seconds**.
- Files: **150**, with **127 passed / 23 failed**.
- Tests: **1,463**, with **1,233 passed / 163 failed / 67 skipped**.
- Exit code: **1**. This is not a green full-suite result.
- The repository's Company Forms discovery covered **85/85 suites**:
  **512 passed, 0 failed, 0 skipped**, no missing suites.

The preceding complete run measured 1,234 passed / 162 failed / 67 skipped.
The closing run additionally failed the legacy crew-import styled Excel
template test. Both results are retained in local logs; no assertion was
changed to force either result to the old 161-failure baseline.

Remaining non-Company-Forms failures include obsolete API routes, invalid legacy
fixture identifiers, permission-fixture gaps, stale validation imports/contracts
and cleanup dependencies. The 67 skipped cases belong to contract-detail (15),
vessel-initiated workflow (17) and wage-engine (35) suites whose setup fails.
These are reported as uncovered cases, not passing tests.

TypeScript: `npm run check` exits **2**, with **222 diagnostics**, within the
requested ceiling but not a clean compile.

## Development count proof — raw SQL

Immediately-before snapshot: **2026-10-13 03:13:46.480 UTC**.
Immediately-after snapshot: **2026-10-13 03:17:40.445 UTC**.

`scripts/development-counts.mjs` used a read-only repeatable-read transaction,
verified the protected development identity, enumerated operational tables in
every schema, and ran actual `SELECT count(*)` queries. Classification of forms
uses category, not subject type. Archived/soft-deleted rows are included.

| Public category | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Vessels | 1,243 | 1,243 | 0 |
| Crew | 1,804 | 1,804 | 0 |
| Assignments | 2,462 | 2,462 | 0 |
| Company Forms | 1,234 | 1,234 | 0 |
| Standard Forms | 41 | 41 | 0 |
| Rank groups | 85 | 85 | 0 |
| Requirements | 65,674 | 65,674 | 0 |

Across **all 479 schema/category entries**, the delta list was empty.
No development cleanup was performed and no main-preview acceptance fixture
was created.

Reproduce:

```sh
node scripts/development-counts.mjs test-logs/development-before-suite.json
npm test
node scripts/development-counts.mjs test-logs/development-after-suite.json
```

Local full reports are in `test-results/`, backend/count evidence in
`test-logs/`; generated evidence is excluded from Git and deployment. This
document records the measured result without copying test dumps or credentials.
