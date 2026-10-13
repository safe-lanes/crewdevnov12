# Isolated automated tests

## Configuration and commands

Add `TEST_DATABASE_URL` through Replit Secrets. It must reach a different database
from development and production. No connection text is stored in this document.
Missing configuration or unverifiable/protected SQL identity refuses startup.

- **Reset:** `npm run test:reset` drops and recreates only the identity-verified
  test database, applies all migrations and seeds synthetic data. Stop the test
  backend and all test workers first. Reset refuses active connections and uses
  the same protected-target checks as tests. It never resets development.
- **Full suite:** `npm test` starts and shuts down its own backend on port 5100.
- **Standalone backend:** `npm run test:backend`.
- **Browser suite:** `npm run test:e2e` starts a dedicated backend and will not
  reuse the main preview.
- Other Vitest modes (watch, unit, integration, coverage, UI) use the same
  configuration preflight.

`TEST_BACKEND_PORT` may select a different dedicated port, but never 5000.
Every new pg connection is verified before callers receive it. Tests inherit only
the verified target through the legacy application's `DATABASE_URL` interface;
this is an explicit assignment after verification, not a fallback to development.
Alternative PG, legacy DB and parent/master target variables are stripped.
The registered cluster/OID in `.local/test-database-identity.json` is also
checked, including in inherited workers. Only the guarded reset may replace
that registration after recreating the designated database. A different URL
cannot silently register a different database.

## Identity allowlist

Every run, including standalone `npm test`, must reach THE registered test
database: both its cluster system identifier and database OID must match
`.local/test-database-identity.json`. Every other target is refused, regardless
of its name or URL. Independently querying and refusing the development identity
remains a second layer. There is no production-absence attestation or expiry.
The guarded reset verifies the old registered identity before dropping anything,
then registers the newly created database's identity before migrations or tests.

## Synthetic data

The migration chain supplies rank definitions, menus and role templates.
The test seed supplies three synthetic vessel/nationality/type choices, synthetic
pool/agent/group choices and a synthetic author. Actor ID 24 is a compatibility
slot created from literals in the test database, **not** a copied real person.
Individual suites create their own crew, assignments and form definitions.
No development dump, real crew or sea-service history is copied.
Private schemas explicitly clone dependencies from this **test** database;
they never append `public` to their search path. Suites run serially because
fleet-wide automatic rules in one suite would otherwise match another suite's
temporary assignments. Normal file-specific teardown runs; a final scoped
archive of newly created definitions prevents pinned-history leftovers from
affecting later suites. Reset removes all test history.

## Reset evidence

`npm run test:reset` was run successfully during this build. It verified the
original test database OID `1032648`, refused protected targets by cluster/OID,
and recreated `sail_automated_tests` as OID `1047232` on cluster
`7586633721581772821`. All 259 migrations applied and synthetic seeding completed.
The command exited 0. The OID change is expected after recreation; subsequent
preflight probes the new identity rather than trusting the old OID.

Automated teardown executes normally in the isolated database and does not
append to the main-preview fixture register. Deliberate registered acceptance
fixtures in development are separate and must not be cleaned up by this command.

## Closing checks and main preview

The measured full-suite baseline and raw-SQL count comparison are recorded in
`docs/testing-isolation-evidence.md`. TypeScript currently reports 222
diagnostics; the full suite is not green. Do not describe its skipped legacy
cases as passing, and do not use the previous shared-database failure count as
a target.

After the final build commit, start the existing **Start application** workflow
(`npm run dev`) for the main preview on port 5000. Do not substitute the test
backend or reuse port 5100. Record the actual backend process start time and
compare it with `git log -1 --format='%H %cI'`; the process must start later.
Check startup logs and the public preview without changing authentication.

Keep generated backend logs, count snapshots and screenshots outside Git and
deployment. No further database reset is needed to start the main preview.

