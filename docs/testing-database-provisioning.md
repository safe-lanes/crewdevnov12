# Dedicated test database: provisioning evidence

## Step 1 — database created; secret configuration pending

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

`TEST_DATABASE_URL` was absent. It must be supplied through Replit Secrets before
the remaining work proceeds. No connection string or credential is recorded here.
No migrations, seeds, or automated tests have been run in this task.

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
must appear in the closing evidence. The command is not implemented yet.

Main-preview verification scripts must reuse registered fixtures. Any Company
Form they release in development must use conditional applicability restricted
to a registered fixture-only vessel, with that restriction in every alternative
condition set. Tooling must refuse unrestricted or real-crew-matching releases.
These tooling changes are still pending; documenting the rule does not enforce it.
