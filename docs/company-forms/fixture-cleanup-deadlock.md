# Fixture-cleanup deadlock investigation

## Scope

The gate command is ordinary `npm test`. `vitest.config.ts` retains
`fileParallelism: false`, the existing hook/test limits, and its existing
reporters. This investigation does not change production PDF calculations,
archiving, permissions, schema, or development data.

The retention-band housekeeping was completed in `docs/admin-kpi-settings.md`
and `docs/dashboard-kpi-comparisons.md`: the inclusive band is **All Officers**.

## Historical failure

The retained closing log is
`generated-artifacts/retention-band-label/full-suite.log`. All four assertions
in `tests/integration/api/company-form-submission-void-races.test.ts` passed;
the suite failed in `afterAll`, calling `clearCompanyFormDocumentFixtures`.
PostgreSQL returned SQLSTATE `40P01`:

```text
Process 1943 waits for ShareRowExclusiveLock on relation 1474456 of database 1144979; blocked by process 1881.
Process 1881 waits for RowExclusiveLock on relation 1474483 of database 1144979; blocked by process 1943.
```

The test database identifies those relations as:

| Relation OID | Table |
| --- | --- |
| 1474456 | `frm_document_files` |
| 1474483 | `frm_document_preparation_events` |

The cleanup's failing statement was:

```sql
ALTER TABLE frm_document_files DISABLE TRIGGER USER;
```

It had already disabled/deleted/re-enabled preparation events **in the same
transaction**. Re-enabling a trigger does not release the table lock before
transaction end. The archive writer inserts a file before its preparation
event, the reverse order.

The original server stderr is unavailable; its retained client error does
not include process 1881's SQL text or the complete granted-lock inventory.
The writer statement is reconstructed from the archive code, not represented
as recovered historical server-log text.

## Direct PostgreSQL reproduction before the fix

`generated-artifacts/fixture-cleanup-deadlock/controlled-reproduction.json`
records the real original cleanup helper, zero-row writer inserts, live
`pg_stat_activity`, `pg_locks`, and the resulting PostgreSQL error. No fixture
rows were inserted or deleted; both transactions were rolled back and user
triggers were confirmed enabled.

| Transaction | Granted lock | Requested lock |
| --- | --- | --- |
| Cleanup, PID 2578 | `ShareRowExclusiveLock` on preparation events | `ShareRowExclusiveLock` on files |
| Writer reproduction, PID 2579 | `RowExclusiveLock` on files | `RowExclusiveLock` on preparation events |

The observed blocked SQL was:

```sql
-- Cleanup
ALTER TABLE frm_document_files DISABLE TRIGGER USER;
-- Writer reproduction: obtains the same relation lock, inserting zero rows
INSERT INTO frm_document_preparation_events
SELECT * FROM frm_document_preparation_events WHERE false;
```

PostgreSQL reported the same cycle:

```text
Process 2578 waits for ShareRowExclusiveLock on relation 1474456 of database 1144979; blocked by process 2579.
Process 2579 waits for RowExclusiveLock on relation 1474483 of database 1144979; blocked by process 2578.
```

This controlled reproduction is not a full-suite frequency measurement.

## Why a writer was active with serial test files

The race test deliberately overlaps Office void and Master writes, but awaits
the HTTP operations before successful completion. Its first two cases also
join both operations in `finally`. In the two status-transition cases,
the successful path awaits the void response before checking the outcome.
Those four successful test bodies are not detached PDF jobs.

The dedicated backend is different: `tests/global-setup.ts` starts one backend
for the **whole run**, not one per test file. `scripts/start-test-backend.ts`
imports `server/index.ts`, which previously unconditionally started
`startDocumentPreparationWorker` when listening. That worker schedules
`setInterval(() => { void tick(); }, 15000)`. A tick selects pending preparation
requests across fixtures; test completion and the `afterAll` cleanup did not
own or join that promise.

Thus **unowned backend background work could outlive the test that created its
request** and overlap another test's teardown. Serial Vitest files do not stop
an independent backend interval. The void-race test does not explicitly start
the PDF worker. The exact earlier request/test that process 1881 was processing
cannot be identified from the retained historical error.

## Production assessment

**Cleanup uses test-only SQL, not product delete/update paths.**
The helper requires test mode and the independently registered test-database
identity before it disables immutable-evidence triggers.

**Could two real users performing the same ordinary product operations create
this particular cycle? No.** The cycle requires the cleanup-only table DDL.
Product archiving uses assignment-first/submission locks and file-before-event
inserts; it never disables these triggers. This assessment is about this
observed cycle, not proof that every conceivable product deadlock is absent.

## Fix

1. The shared fixture helper takes the file trigger/table lock before the
   preparation-event trigger/table lock, matching the archive insert order.
2. The **dedicated test backend only** no longer starts the periodic worker.
   Normal application startup still starts the same, unchanged worker.
3. A guarded test-only drain endpoint invokes the unchanged product queue.
   It awaits every selected batch to completion. Another caller joins any
   active drain rather than losing ownership of its work.
4. The global test `afterEach` awaits that drain. The document cleanup helper
   additionally awaits it **before** its savepoint or first trigger lock.
   The helper refuses a backend reporting periodic/unowned preparation mode,
   a failed drain, or a mismatched database/backend instance.

The drain endpoint exists only inside the existing verified test-backend
branch, never in the main preview or ordinary application. Its response is
checked against the registered identity and backend instance using Node HTTP,
not mockable browser fetch. Queue failures retain the product's recorded
failure outcome; they are not automatically retried. Subsequent queue batches
are new selections, not retries of already-failed requests.

No full-suite serialization, retry, increased timeout, product-worker
implementation change, or weakened database constraint was added.

## Regression coverage

- Actual PostgreSQL file locks prevent cleanup from obtaining an events
  trigger lock first. The writer can insert its preparation event and commit,
  after which cleanup completes. All writer inserts in this case select zero
  rows.
- A real completed fixture form is queued while its assignment is held by a
  separate transaction. Cleanup is started while PDF work is blocked. It must
  take no trigger locks until the holder releases, the PDF finishes, and the
  joined drain returns. Cleanup's transaction is rolled back to verify that
  the generated file exists.
- Overlapping drain callers receive the same unfinished promise and do not
  resolve before its batches finish.
- A drain error propagates without a retry.

The focused run passed all 18 tests across four files. Full-run measurements,
Company Forms results, TypeScript diagnostics, unchanged-development
fingerprints, final HEAD, and backend restart evidence are reported separately
at closure. Full-run evidence is under
`generated-artifacts/fixture-cleanup-deadlock-closure/`.

### First three full measurements

| Run | Passed | Failed | Pending | Deadlocks | Company Forms |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 2392 | 162 | 67 | 0 | 744 passed, 0 skipped |
| 2 | 2390 | 164 | 67 | 0 | 743 passed, 1 browser failure, 0 skipped |
| 3 | 2391 | 163 | 67 | 0 | 743 passed, 1 browser failure, 0 skipped |

These results are retained, not replaced by subsequent verification. Each run
used the unmodified `npm test` command and 105 Company Forms suites. The first
three runs therefore observed **0/3 deadlocks**, but runs 2 and 3 did not meet
all closing gates.

The browser failure's captured `failure.json` identifies
`net::ERR_CERT_VERIFIER_CHANGED` for the main preview's `select.tsx` module and
`net::ERR_FAILED` for `formatted-date-input.tsx`, leaving an empty document.
The test had isolated API calls but still loaded its UI modules through the
main preview's external HTTPS proxy. Its origin now uses `TEST_API_URL`, whose
backend also serves Vite. Assertions, selectors, calculation and timeout are
unchanged; neither a retry nor a production change was used.

Run 2 also had a teardown HTTP `socket hang up`. Both test lifecycle requests
now open a fresh connection (`agent: false`) rather than reusing the shared
HTTP agent's potentially expired idle socket. The retained stack does not
prove which peer/socket event caused that one failure; the change eliminates
shared idle-socket reuse rather than retrying or swallowing errors.
