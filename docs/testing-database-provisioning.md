# Dedicated test database: provisioning evidence

## Step 1 — database created and configured

An empty database named `sail_automated_tests` was created on the existing
PostgreSQL server using `CREATE DATABASE sail_automated_tests`.
A separate direct connection to it succeeded. No development tables or records
were created, updated, removed, or restored.

Authoritative SQL identities observed during provisioning:

| Target | Database | Database OID | Cluster system identifier |
| --- | --- | --- | --- |
| Development (protected) | heliumdb | 16384 | 7586633721581772821 |
| Test | sail_automated_tests | 1032648 | 7586633721581772821 |

The test database had **zero public tables** on connection verification.
The platform's production query returned `PRODUCTION_DATABASE_ERROR` with the
explicit result that this project has no production database. That observation
is not a permanent exemption from checking production identity.

`TEST_DATABASE_URL` was supplied through Replit Secrets. A connection using that
secret returned `sail_automated_tests`, database OID `1032648`, and cluster system
identifier `7586633721581772821`. A separate development connection returned OID
`16384` on the same cluster. This verifies distinct database identities without
comparing connection text. No connection string or credential is recorded here.
This was the pre-migration identity. Subsequent guarded resets recreated the
test database; current identities and suite evidence are recorded in
`docs/testing-isolation-evidence.md`.

## Development pre-build counts

These counts include soft-deleted and archived rows. They are an initial
provisioning baseline, not the required immediately-before-suite evidence.

| Category | Public table / predicate | Count |
| --- | --- | ---: |
| Vessels | master_vessels | 1,243 |
| Crew | crew_members_v2 | 1,804 |
| Assignments | crew_assignments | 2,462 |
| Company Forms | adm_forms_v2, category = 'dynamic' | 1,234 |
| Standard Forms | adm_forms_v2, category <> 'dynamic' | 41 |
| Rank groups | adm_rank_groups_v2 | 85 |
| Requirements | frm_requirements | 65,674 |

Form classification uses category, not subject type: existing synthetic Company
Forms include nonstandard subject types. Empty legacy `vessels` and
`crew_members` tables are not the operational master tables.

## Approved reset and acceptance-fixture additions

The implementation must provide one documented reset command that checks the
actual target identity before dropping and recreating only the test database,
then applies migrations and synthetic seeds. A successful guarded reset run
must appear in the closing evidence. Implemented as `npm run test:reset`;
see `docs/testing-isolation.md` and the closing evidence.

Main-preview verification scripts must reuse registered fixtures. Any Company
Form they release in development must use conditional applicability restricted
to a registered fixture-only vessel, with that restriction in every alternative
condition set. Tooling must refuse unrestricted or real-crew-matching releases.
Enforced by the verification guard and fixture-vessel policy, imported by the
main-preview verification entry points. Legacy fixture-creation paths now
explicitly refuse rather than accumulate additional main-preview records.
There is no approved fixture-vessel allowlist entry yet; releases fail closed
until an existing registered fixture-only vessel is reviewed and allowlisted.
