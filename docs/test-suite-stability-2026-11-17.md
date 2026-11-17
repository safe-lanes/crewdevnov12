# Test-suite stability diagnosis — 17-Nov-2026

## Scope and conclusion

Diagnostic only. Five consecutive full `npm test` runs used unchanged commit
`b9729934efc576f9875680f5d0733c154ffba6bd` (17-Nov-2026 07:59:25 UTC).
No fixes, test changes, configuration changes, retries, database reset, or
timeout changes were made. Existing `fileParallelism: false` was retained.
Only this document is committed for this task.

**The five runs had the same 162 failing test identities, not merely the
same count. There were zero intermittently failing tests in this sample.**
These identities also match the previous task's closing run.

This establishes an observed stable set on this HEAD, not proof that the
suite can never vary. The two historically intermittent tests below remain
deferred; this task does not repair or suppress either.

## Five-run results

All times are UTC on 17-Nov-2026. Every run executed the entire existing
`npm test` command without command-line overrides and exited with status 1
because of the known failures.

| Run | Started | Finished | Passed | Failed | Pending / skipped | Total |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 1 | 11:15:47 | 11:25:24 | 2,392 | 162 | 67 | 2,621 |
| 2 | 11:25:24 | 11:34:27 | 2,392 | 162 | 67 | 2,621 |
| 3 | 11:34:28 | 11:43:28 | 2,392 | 162 | 67 | 2,621 |
| 4 | 11:43:28 | 11:52:36 | 2,392 | 162 | 67 | 2,621 |
| 5 | 11:52:37 | 12:01:31 | 2,392 | 162 | 67 | 2,621 |

Each run reported 232 test files: 211 passed and 21 failed.

### Comparison method

Compare each failed assertion using the pair
`(repository-relative test file, full hierarchical test name)`, not just
`numFailedTests`. The intersection and union of the five failing sets both
contain **162 identities**. Each set contains 162 assertions, with no
duplicate failed identities.

The SHA-256 of each sorted failing set is identical:

```text
75cbd79a8432018302fc4fbea4ef6f74fa8f510ea183e165fe888ac41767d37c
```

To reproduce that fingerprint: sort the file/name pairs lexicographically
in Python, serialize using
`json.dumps(pairs, ensure_ascii=False, separators=(',', ':')).encode()`,
then hash those UTF-8 bytes with SHA-256.

## Earlier runs two and three: exact additional failures

These are the earlier deadlock-investigation runs, not the five new runs.
The earlier four runs had respectively 162, 164, 163 and 162 failed tests.
Their shared failing set was the same 162 identities listed below; their
union contained 164.

| File and full test name | Earlier runs failed | New runs failed | Cause and evidence |
| --- | --- | --- | --- |
| `tests/integration/api/company-form-rule-editor.test.ts` — `Company Form rule editor read-only authoring APIs tests the promoted draft action through the screen and keyboard without saving` | 2 and 3 (2/4) | None (0/5) | External dependency / asset loading: `locator.click` timed out after 45,000 ms waiting for `tab-company-forms` at line 111. Captured browser evidence shows `net::ERR_CERT_VERIFIER_CHANGED` for the external preview's `select.tsx` and `net::ERR_FAILED` for `formatted-date-input.tsx`, leaving an empty document. |
| `tests/unit/native-dialog-inventory.test.ts` — `client native-dialog removal guard contains no native confirm, alert or prompt calls anywhere in the client` | 2 only (1/4) | None (0/5) | Other / lifecycle HTTP transport: `Error: socket hang up` at `Socket.socketOnEnd (node:_http_client:528:25)`. The error came from the lifecycle HTTP request, not an inventory assertion. Idle keep-alive socket reuse was suspected, but the retained stack does not prove the exact peer/socket event. |

Before the current measured HEAD, the prior task changed the browser test
to load assets from its dedicated test backend rather than the external
preview, and made lifecycle HTTP requests use fresh connections with
`agent: false`. No such changes were made during this diagnosis.
The historical transport explanation must not be represented as a fully
proven socket root cause.

**Disposition: both historically intermittent tests are deferred for a
later task, as requested.** Their passing five times here is not a guarantee
against recurrence.

Historical evidence:

- `generated-artifacts/fixture-cleanup-deadlock-closure/full-run-{1,2,3,4}.json`
  and the corresponding `.log` files.
- `.local/verification/form-rule-trial-promotion/isolated/failure.json`
  contains the captured browser asset failures.
- `docs/company-forms/fixture-cleanup-deadlock.md` records the prior work.

## Unstable failing set in the five new runs

**None: 0 tests failed in only some of the five runs.**
Accordingly, there is no new unstable-test cause classification to assign.
The historical two-test table above records their individual frequencies
and likely/proven causes separately.

## Suite-level failures and the 67 pending tests

The assertion count is not the entire failure surface. Every new run also
reported the following suite/hook failures:

| File | Failure | Consequence |
| --- | --- | --- |
| `tests/integration/api/contract-detail.test.ts` | Setup insert rejected with `Invalid assignment vessel UUID: expected canonical UUID`; insert helper line 72, setup call line 225; PostgreSQL `22023`, `guard_crew_assignment_vessel_uuid()` line 14. | 15 tests skipped because setup failed. |
| `tests/integration/api/vessel-initiated-workflow.test.ts` | Setup insert violates `crew_assignments.assignment_type` NOT NULL; insert helper line 126, setup call line 289; PostgreSQL `23502`. | 17 tests skipped because setup failed. |
| `tests/integration/api/wage-engine.test.ts` | Setup insert rejected with `Invalid assignment vessel UUID: expected canonical UUID`; insert helper line 136, setup call line 413; PostgreSQL `22023`, `guard_crew_assignment_vessel_uuid()` line 14. | 35 tests skipped because setup failed. |
| `tests/integration/api/reliever-unassign-assignment.test.ts` | Cleanup at line 295 deletes an assignment still referenced by `crew_assignment_rule_context`; PostgreSQL `23503`, constraint `crew_assignment_rule_context_assign_uuid_fkey`. | Additional suite teardown failure; this file also contains two of the 162 failed assertions below. |

Thus all 67 reported pending/skipped tests are in the three setup-blocked
suites (15 + 17 + 35). They are not 67 intentionally disabled tests.
The four suite/hook errors are not four additional failed assertions.
The logs report them separately from the 162 failed tests. None was fixed.

## Is the current numerical gate trustworthy?

**Are the 162 a fixed known set, or just a number the suite lands near?**
On this unchanged HEAD, the evidence supports a specific, reproducible set
of 162 failures: all five runs failed the same tests. The earlier variation
was exactly two additional historical harness failures, not unobserved
replacement of baseline failures. Their recurrence rate on the measured
HEAD was 0/5 each.

However, this is an observed failure inventory, not an assessment that each
failure is harmless or an approved permanent exemption. Five runs cannot
prove absence of less frequent instability.

**Could a few new regressions go unnoticed under the count-only gate? Yes.**
If all existing 162 failures remain and an additional test fails, the count
would exceed 162 and the gate would catch it. But if an old failure starts
passing while a different test regresses, the total may stay at or below
162. Reduced execution or newly skipped tests could also conceal coverage
loss. Suite/hook errors must be checked independently.

### Recommendation only — not implemented

1. Record a reviewed baseline by file and full test name, not an allowed
   failure count alone. Give parameterized cases unique identifiers or a
   disambiguating occurrence index where names repeat; do not silently
   collapse duplicate names.
2. Reject every failure outside the approved baseline regardless of the
   total. A newly passing baseline test must not provide allowance for a
   different failure.
3. Baseline suite/setup/teardown errors separately and reject new ones.
   Compare skipped identities, discovered tests and executed tests, not
   just their totals; reject missing coverage and unexpected skips.
4. Remove a failure from the baseline only through explicit review when
   fixed, so its later recurrence is detected. Tie the baseline to a
   reviewed commit and retain machine-readable reports.
5. Treat any future intermittent failure as a visible failure rather than
   hiding it with retries or increasing the numeric ceiling. Investigate
   the two deferred tests separately when that work is authorized.

## Stable failing set by name

**162 tests across 18 files. Every entry below failed in 5/5 new runs.**
Each heading supplies the file half of the identity; each bullet is the
exact `fullName` half from the JSON report.

### `tests/integration/api/crew-members.test.ts` — 3

- Crew Members API Integration POST /api/crew-members should create new crew member
- Crew Members API Integration POST /api/crew-members should return 400 for missing required fields
- Crew Members API Integration POST /api/crew-members should validate email format when provided

### `tests/integration/api/ctm-carry-forward.test.ts` — 6

- CTM carry-forward: most-recent prior month Case 1: adjacent prior month carries opening balance and sets provenance
- CTM carry-forward: most-recent prior month Case 1: editing the opening balance is rejected (guard applies)
- CTM carry-forward: most-recent prior month Case 2: editing the opening balance is also rejected for non-adjacent carry
- CTM carry-forward: most-recent prior month Case 2: two-month gap — balance carries from 2026-03, not 0.00
- CTM carry-forward: most-recent prior month Case 3: no prior records — opening is 0.00 and provenance is null
- CTM carry-forward: most-recent prior month Case 3: opening balance is editable when no prior exists

### `tests/integration/api/drug-alcohol.test.ts` — 13

- Drug & Alcohol Testing API Integration DELETE /api/drug-alcohol-tests/:id should delete test record
- Drug & Alcohol Testing API Integration GET /api/drug-alcohol-tests should filter by result
- Drug & Alcohol Testing API Integration GET /api/drug-alcohol-tests should filter by test type
- Drug & Alcohol Testing API Integration GET /api/drug-alcohol-tests should filter by vessel
- Drug & Alcohol Testing API Integration GET /api/drug-alcohol-tests should list all drug alcohol test records
- Drug & Alcohol Testing API Integration GET /api/drug-alcohol-tests/vessel/:vesselId should get tests for specific vessel
- Drug & Alcohol Testing API Integration GET /api/drug-alcohol-tests/vessel/:vesselId should return empty array for vessel with no tests
- Drug & Alcohol Testing API Integration POST /api/drug-alcohol-tests should accept post-incident test type
- Drug & Alcohol Testing API Integration POST /api/drug-alcohol-tests should accept pre-employment test type
- Drug & Alcohol Testing API Integration POST /api/drug-alcohol-tests should create new drug alcohol test record
- Drug & Alcohol Testing API Integration POST /api/drug-alcohol-tests should return 400 for missing required fields
- Drug & Alcohol Testing API Integration PUT /api/drug-alcohol-tests/:id should update notes
- Drug & Alcohol Testing API Integration PUT /api/drug-alcohol-tests/:id should update test result

### `tests/integration/api/forms.test.ts` — 9

- Appraisal Forms API Integration GET /api/appraisals should return a list of appraisal forms
- Appraisal Forms API Integration GET /api/appraisals should support date range filtering
- Appraisal Forms API Integration GET /api/appraisals should support filtering by appraisal type
- Appraisal Forms API Integration GET /api/appraisals should support filtering by crew member
- Appraisal Forms API Integration GET /api/appraisals should support filtering by status
- Appraisal Forms API Integration GET /api/appraisals should support filtering by vessel
- Appraisal Forms API Integration POST /api/appraisals should create new appraisal form
- Appraisal Forms API Integration POST /api/appraisals should return 400 for missing required fields
- Appraisal Forms API Integration POST /api/appraisals should validate appraisal type

### `tests/integration/api/obsolete-crew-assignment-paths.test.ts` — 2

- canonical Crew Pool assignment paths rejects obsolete types through generic creation and updates
- canonical Crew Pool assignment paths still lists and signs off an OnBoard assignment without changing its type

### `tests/integration/api/portage-auto-lock.test.ts` — 1

- Portage auto-lock on final approval locked-month correction path: no unlock endpoint; refusal points to adjustment run

### `tests/integration/api/promotions.test.ts` — 11

- Promotions API Integration DELETE /api/promotion-hierarchies/:id should delete hierarchy
- Promotions API Integration GET /api/promotion-hierarchies should list all promotion hierarchies
- Promotions API Integration GET /api/promotion-hierarchies should return hierarchy with groupName
- Promotions API Integration GET /api/promotions should filter by status
- Promotions API Integration GET /api/promotions should list all promotions
- Promotions API Integration GET /api/promotions/crew/:crewMemberId should get promotions for specific crew member
- Promotions API Integration PATCH /api/promotion-hierarchies/:id should update hierarchy
- Promotions API Integration POST /api/promotion-hierarchies should accept hierarchy with array rank path
- Promotions API Integration POST /api/promotion-hierarchies should create new promotion hierarchy
- Promotions API Integration POST /api/promotion-hierarchies should return 400 for missing required fields
- Promotions API Integration Task 493 selected Position safeguards rejects Promotion Type changes after Part B has been submitted

### `tests/integration/api/recruitment.test.ts` — 13

- Recruitment API Integration DELETE /api/recruitment-candidates/:id should delete candidate
- Recruitment API Integration GET /api/recruitment-candidates should filter by rank
- Recruitment API Integration GET /api/recruitment-candidates should filter by status
- Recruitment API Integration GET /api/recruitment-candidates should list all recruitment candidates
- Recruitment API Integration GET /api/recruitment-candidates should search by name
- Recruitment API Integration GET /api/recruitment-candidates/:id should get candidate by id
- Recruitment API Integration GET /api/recruitment-candidates/next-file-number should get next file number
- Recruitment API Integration PATCH /api/recruitment-candidates/:id should allow partial updates
- Recruitment API Integration PATCH /api/recruitment-candidates/:id should update candidate status
- Recruitment API Integration PATCH /api/recruitment-candidates/:id/soft-delete should soft delete candidate
- Recruitment API Integration POST /api/recruitment-candidates should accept candidate with all required fields
- Recruitment API Integration POST /api/recruitment-candidates should create new recruitment candidate
- Recruitment API Integration POST /api/recruitment-candidates should return 400 for missing required fields

### `tests/integration/api/reliever-unassign-assignment.test.ts` — 2

- assignment vessel UUID guard rejects malformed and absent master IDs in SQL, canonicalizes case, and preserves legacy unrelated updates
- reliever assignment cancellation on planning unassign enforces supported assignment types and NOT NULL in the database

### `tests/integration/api/rest-hours.test.ts` — 12

- Rest Hours API Integration GET /api/rest-hours-crew-records should return crew rest hour records
- Rest Hours API Integration GET /api/rest-hours-crew-records should support filtering by crew member
- Rest Hours API Integration GET /api/rest-hours-crew-records should support filtering by vessel
- Rest Hours API Integration GET /api/rest-hours-ncs-by-rank should return NCs grouped by rank
- Rest Hours API Integration GET /api/rest-hours-ncs-by-rank should support vessel filter
- Rest Hours API Integration GET /api/rest-hours-vessel-records should return vessel rest hour records
- Rest Hours API Integration GET /api/rest-hours-vessel-records should support date range filtering
- Rest Hours API Integration GET /api/rest-hours-vessel-records should support filtering by vessel
- Rest Hours API Integration GET /api/rest-hours-violations-by-rank should return violations grouped by rank
- Rest Hours API Integration GET /api/rest-hours-violations-by-rank should support vessel filter
- Rest Hours API Integration POST /api/rest-hours-vessel-records should create new vessel rest hour record
- Rest Hours API Integration POST /api/rest-hours-vessel-records should handle missing required fields

### `tests/integration/api/rotation.test.ts` — 9

- Rotation API Integration DELETE /api/rotation-plans/:id should delete rotation plan
- Rotation API Integration GET /api/rotation-plans should list all rotation plans
- Rotation API Integration GET /api/rotation-plans should return plans with correct structure
- Rotation API Integration GET /api/rotation/due-crew should list crew due for rotation
- Rotation API Integration GET /api/rotation/proposals should list all rotation proposals
- Rotation API Integration PATCH /api/rotation-plans/:id should update rotation plan
- Rotation API Integration POST /api/rotation-plans should accept plan with assignments
- Rotation API Integration POST /api/rotation-plans should create new rotation plan
- Rotation API Integration POST /api/rotation-plans should return 400 for missing required fields

### `tests/integration/api/ship-reference-reads.test.ts` — 2

- Ship allotments read (own vessel only) GET /allotments?status=active returns own-vessel allotments and none from other vessels
- Ship wage-scale detail read (own vessel's scales only) GET /wage-scales/:uuid → 200 with lines for a scale referenced on own vessel

### `tests/integration/api/vessel-portage-category-grids.test.ts` — 9

- Vessel Portage category-major grids allotments are additive (standing + extra) standing 800.00 + extra 500.00 ⇒ TWO ledger lines totalling 1,300.00
- Vessel Portage category-major grids batch partial failure applies ops before the failure and reports both applied and failed
- Vessel Portage category-major grids configurable extra tabs accepts a valid slot, round-trips it, and the bound element accepts vessel entries
- Vessel Portage category-major grids dated cash advance batch delete removes the CTM line too
- Vessel Portage category-major grids dated cash advance batch update syncs the CTM line amount and date
- Vessel Portage category-major grids dated cash advance stores txn_date and auto-creates the linked CTM line
- Vessel Portage category-major grids locking locked month refuses batch creates with 409 and reports the failed op
- Vessel Portage category-major grids overtime batch round-trip creates an OT qty entry through the batch endpoint
- Vessel Portage category-major grids overtime batch round-trip updates and then deletes the entry in single batch calls

### `tests/integration/api/vessel-portage.test.ts` — 16

- Vessel submission package & CTM cash account (Prompt 06) CTM cash account math carries opening 5,000.00 from the prior month and locks it
- Vessel submission package & CTM cash account (Prompt 06) CTM cash account math computes closing 13,825.00 server-side
- Vessel submission package & CTM cash account (Prompt 06) CTM cash account math deleting the 300.00 draft advance ⇒ closing 14,125.00, line removed
- Vessel submission package & CTM cash account (Prompt 06) CTM cash account math refuses direct edits to an advance-linked CTM line
- Vessel submission package & CTM cash account (Prompt 06) advance dual-record linkage accept does not duplicate; reject removes the CTM line
- Vessel submission package & CTM cash account (Prompt 06) advance dual-record linkage creates exactly one CTM line per vessel advance
- Vessel submission package & CTM cash account (Prompt 06) allows a vessel transaction on an allowed fixed-amount category (bond)
- Vessel submission package & CTM cash account (Prompt 06) rejects a vessel transaction on a non-vessel category element with 400
- Vessel submission package & CTM cash account (Prompt 06) rejects a vessel transaction on a scale_lookup element with 400
- Vessel submission package & CTM cash account (Prompt 06) vessel-month lifecycle lock ⇒ vessel edits and creates are refused; CTM locked
- Vessel submission package & CTM cash account (Prompt 06) vessel-month lifecycle office rejects one (comment persisted) and accepts two
- Vessel submission package & CTM cash account (Prompt 06) vessel-month lifecycle reconciled CTM → return ⇒ CTM reopens and vessel can edit it
- Vessel submission package & CTM cash account (Prompt 06) vessel-month lifecycle return → re-open rejected → vessel edits → resubmit → accept
- Vessel submission package & CTM cash account (Prompt 06) vessel-month lifecycle submit flips drafts to submitted and the portage to submitted
- Vessel submission package & CTM cash account (Prompt 06) vessel-month lifecycle the run includes ONLY the accepted transactions
- Vessel submission package & CTM cash account (Prompt 06) vessel-month lifecycle vessel creates 3 draft transactions (origin/status forced)

### `tests/unit/modules/crew-pool/crew-pool-validation.test.ts` — 2

- Crew Pool Schema Validation Invalid Crew Member Data should reject missing presentVessel
- Crew Pool Schema Validation Invalid Crew Member Data should reject missing vesselType

### `tests/unit/modules/drugs-alcohol/drug-alcohol-testing.test.ts` — 19

- Drug & Alcohol Testing Schema Validation Data Integrity should handle VSL-XXX format vessel IDs
- Drug & Alcohol Testing Schema Validation Data Integrity should preserve all fields after parsing
- Drug & Alcohol Testing Schema Validation Invalid Test Records should reject missing testType
- Drug & Alcohol Testing Schema Validation Invalid Test Records should reject missing vesselId
- Drug & Alcohol Testing Schema Validation Invalid Test Records should reject null testType
- Drug & Alcohol Testing Schema Validation Invalid Test Records should reject null vesselId
- Drug & Alcohol Testing Schema Validation Invalid Test Records should reject numeric vesselId
- Drug & Alcohol Testing Schema Validation Test History should validate test history format
- Drug & Alcohol Testing Schema Validation Testing Equipment should accept equipment not applicable flag
- Drug & Alcohol Testing Schema Validation Testing Equipment should accept testing equipment JSON
- Drug & Alcohol Testing Schema Validation Valid Test Records should accept dateTimeTestCompleted
- Drug & Alcohol Testing Schema Validation Valid Test Records should accept optional alcoholDrugType
- Drug & Alcohol Testing Schema Validation Valid Test Records should accept placeLocation
- Drug & Alcohol Testing Schema Validation Valid Test Records should accept planned test information
- Drug & Alcohol Testing Schema Validation Valid Test Records should validate complete test record
- Drug & Alcohol Testing Schema Validation Valid Test Records should validate monthly test
- Drug & Alcohol Testing Schema Validation Valid Test Records should validate others test type
- Drug & Alcohol Testing Schema Validation Valid Test Records should validate periodic test
- Drug & Alcohol Testing Schema Validation Valid Test Records should validate post-incident test

### `tests/unit/modules/recruitment/recruitment-validation.test.ts` — 25

- Recruitment Candidate Schema Validation Business Logic Validation should categorize candidates by rank category
- Recruitment Candidate Schema Validation Business Logic Validation should validate age calculation from dob
- Recruitment Candidate Schema Validation Business Logic Validation should validate nationality for visa requirements
- Recruitment Candidate Schema Validation Business Logic Validation should validate rank requirements mapping
- Recruitment Candidate Schema Validation Data Integrity should handle special characters in names
- Recruitment Candidate Schema Validation Data Integrity should handle unicode characters in names
- Recruitment Candidate Schema Validation Data Integrity should preserve all fields after parsing
- Recruitment Candidate Schema Validation Field Type Validation should reject array for string field
- Recruitment Candidate Schema Validation Field Type Validation should reject numeric familyName
- Recruitment Candidate Schema Validation Field Type Validation should reject numeric firstName
- Recruitment Candidate Schema Validation Field Type Validation should reject object for string field
- Recruitment Candidate Schema Validation Invalid Data - Missing Required Fields should reject missing dob
- Recruitment Candidate Schema Validation Invalid Data - Missing Required Fields should reject missing familyName
- Recruitment Candidate Schema Validation Invalid Data - Missing Required Fields should reject missing firstName
- Recruitment Candidate Schema Validation Invalid Data - Missing Required Fields should reject missing nationality
- Recruitment Candidate Schema Validation Invalid Data - Missing Required Fields should reject missing presentRank
- Recruitment Candidate Schema Validation Invalid Data - Missing Required Fields should reject missing rankAppliedFor
- Recruitment Candidate Schema Validation Invalid Data - Missing Required Fields should reject missing vesselType
- Recruitment Candidate Schema Validation Invalid Data - Missing Required Fields should reject null values for required fields
- Recruitment Candidate Schema Validation Valid Data should accept fileNo as optional
- Recruitment Candidate Schema Validation Valid Data should accept string id
- Recruitment Candidate Schema Validation Valid Data should accept various vessel types
- Recruitment Candidate Schema Validation Valid Data should validate candidate with minimal required fields
- Recruitment Candidate Schema Validation Valid Data should validate candidate with optional fields
- Recruitment Candidate Schema Validation Valid Data should validate complete candidate data

### `tests/unit/modules/vessel/vessel-management.test.ts` — 8

- Vessel Management Schema Validation Data Integrity should preserve draft data after parsing
- Vessel Management Schema Validation Vessel Draft - Invalid Data should reject missing draftData
- Vessel Management Schema Validation Vessel Draft - Invalid Data should reject missing vesselId
- Vessel Management Schema Validation Vessel Draft - Invalid Data should reject null draftData
- Vessel Management Schema Validation Vessel Draft - Invalid Data should reject null vesselId
- Vessel Management Schema Validation Vessel Draft - Valid Data should accept complex draft data
- Vessel Management Schema Validation Vessel Draft - Valid Data should validate complete vessel draft
- Vessel Management Schema Validation Vessel Draft - Valid Data should validate draft with revision R2

## Development-data and repository evidence

The existing evidence script uses a repeatable-read, read-only transaction
against development. It compares every public table's row count and
content fingerprint, plus columns and constraints:

```sh
DASHBOARD_KPI_EVIDENCE_DIR=generated-artifacts/test-suite-stability \
  node scripts/dashboard-kpi-development-evidence.mjs --before
# Five full npm test runs, without code changes.
DASHBOARD_KPI_EVIDENCE_DIR=generated-artifacts/test-suite-stability \
  node scripts/dashboard-kpi-development-evidence.mjs
```

The baseline was captured at 11:15:35 UTC and the after-check at
12:01:34 UTC on 17-Nov-2026. **All 275 public tables' counts and content
fingerprints, columns, and constraints were unchanged.** Development-data
writes: none observed; before/after verification passed. Test writes used
the existing independently identity-verified test database and dedicated
test backend, not the main preview.

HEAD remained the measured commit and tracked/untracked Git status remained
clean through all five runs. The only subsequent repository change is this
report. No code, settings, test logic, or development schema was changed.

Raw evidence is retained outside Git:

- `generated-artifacts/test-suite-stability/run-{1,2,3,4,5}.json` — full
  assertion identities, statuses and failure messages.
- Corresponding `.log`, `.backend.log`, `.started`, `.exit` and
  `.summary.json` files — command output, backend output and timing/counts.
- `generated-artifacts/test-suite-stability/development-before.json`
  and `development-after.json` — read-only comparison evidence.

The raw reports are not committed. The complete stable identity inventory
and intermittent-failure frequencies are included in this document so the
diagnostic result does not depend on ignored artifacts being retained.
