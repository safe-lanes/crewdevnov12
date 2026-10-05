# Sign-off Company Forms: audit and preflight

Date: 2026-10-04. Starting HEAD:
`222765daf6ab4d0c4c9cacc2819d0bb1fa16fbce`.

This records step 1 only, not delivery or certification. Implementation,
runtime fixture creation, permission/configuration changes and browser sign-off
journeys have not begun. The assignment explicitly requires stopping for
approval when additional grants or unrelated setup are needed.

## Requirements audit

| Requirements | Current behavior and work required |
| --- | --- |
| 1 | Lifecycle derives submission requirements from answerable points/signatures. Content, System and informational points remain answer-free. Preserve draft answer rejection. |
| 2 | Lifecycle repository freezes authoritative System values at the first successful section submission/signature. Renderer already shows the exact changed-record notice. Preserve first-event values, earlier signatures and declaration date semantics. |
| 3–6 | Company Representative is stored as `officer`. Signature repository loads authenticated master-user identity/designation. Existing signatures must not be backfilled. No need identified to rewrite any applied migration. |
| 7–10 | Stable assignment UUID, pinned version, one non-voided declaration per form/assignment and reciprocal void/replacement history already exist. Preserve cancelled/deleted assignment history while denying writes. |
| 11–12 | Adapter declares before-joining, on-board and at-sign-off entries. Planning On Board Status currently has no Company Forms selection. Ship stage authorization currently allows writes only at on-board. |
| 13 | G3 groups saved declarations across assignments. Its wrapper explicitly describes history-only behavior; deliberate signed-off office creation is missing. Preserve Part G placement, heading and navigation. |
| 14 | Crew List uses one Forms count column; count hook explicitly requests on-board stage. Popup filters on-board declarations and includes voided history in its labelled total. Sign-off forms must not alter these counts. |
| 15 | Repository selects released, unarchived subject/stage versions passing lifecycle validation. Create revalidates under subject/form locks. New entry points must use these endpoints, not Admin APIs. |
| 16–18 | Principal resolver supports only trusted-linked own-assignment seafarers; missing linkage fails closed. Office permission comes from persisted active Office role and explicit Crew Database grants. Ship membership resolves numeric master-user vessel IDs to active vessel UUIDs; JWT vessel claims are not a fallback. Definition and assets are independently authorized submission reads. Preserve adapter-neutral core. |
| 19–24 | Applicability/rules, trigger resolution, matched-value pins, unresolved/withdrawn state and automatic creation are deferred. Manual selection is not resolution. Do not change Planned-to-Confirmed transitions to create requirements or delete started declarations. |
| 25 | Normal sign-off locks planning then its exact linked assignment, validates incumbent crew/vessel/current state, updates assignment and archives planning. It does not read Company Forms or block on outstanding declarations. G3 lacks an explicit unfinished sign-off flag with exact-record navigation. Reports and mandatory Deployment Checklist work remain excluded. |
| 26 | Promotion resolution and first-in-rank questions remain deferred. Do not change other workflows. |
| 27 | Office Seafarer witnessing is currently restricted to before-joining; Ship section policy is restricted to on-board permitted stable role IDs and trusted membership. Extend at-sign-off routes from pinned signature configuration, including either permitted route for dual-configured sections. Do not waive either signature. |
| Late Vessel Management | Missing. Ordinary historical Ship edits must remain forbidden. Signature-only eligibility needs locked persisted proof of an aboard Seafarer signature before sign-off; cannot trust user signature dates, current occupant or client assertions. Deny witness/start/draft/comments/section-submit/remove/replace/void; reject occupied signature slots and race attempts. |
| Designer/release | Lifecycle validator currently rejects Vessel Management when its `onBoard` marker is false; loader sets that marker only for `on_board`. Extend deliberately for `at_sign_off`, preserve responsible-party/content-derived checks and stable active Ship-role validation. |
| Shared metadata | Renderer metadata is opt-in, default false; only profile explicitly enables it. Joining and Crew List wrappers do not. Make actual pinned version/readable stage/status follow the active declaration after reciprocal navigation in all four viewers. |
| Locks/capabilities | Starts, drafts, signatures, section submission and void use subject-first ordering. Sign-off holds assignment row; the late-signature policy must participate in compatible locking and revalidate all eligibility. Renderer currently derives read-only from general `canEdit`; late signing needs separate capability, not broad editing. |

## Starting baselines

Commands executed against unchanged starting source:

- `npm run check`: exit 2, **226 TypeScript diagnostics**.
- `npm test -- --no-file-parallelism --reporter=json --outputFile=/tmp/task358-baseline/full-tests.json`:
  exit 1; **1,231 tests: 1,003 passed, 161 failed, 67 pending**.
  JSON reports 406 suite groups, 307 passed and 99 failed; 22 test-result
  files are non-passing. These group counts must not be presented as file counts.
- `node scripts/verify-company-forms-tests.mjs`: exit 0;
  **46 inventoried test files, 333 tests passed, zero skipped**, finished
  2026-10-04T08:12:41.640Z.

Raw results are retained under `.local/verification/task358-preflight/`.
The discovered Company Forms inventory and gate result are additionally retained
in `.local/verification/company-forms-all-tests-2026-10-04T08-11-25-104Z.*`.
Committed summary evidence is adjacent to this document.

Important limitation: the two initial Vitest commands ran concurrently; each
command serialized its files, but they still shared the development database.
These are observed starting results, not an independently isolated final gate.
Final verification must run full-suite and Company Forms gates sequentially.
Neither inherited failures nor the passing subset constitutes completion.
Final TypeScript comparison must use read-only starting-HEAD sources, not replace
watched live files.

## Read-only runtime and database preflight

Only existing development test actors were used for GET requests. No production
authentication claim is made.

- Retained limited Office actor 99: persisted Office role; effective Crew Pool
  View and Crew Database View/Create/Edit are true; Forms permissions all false.
  Company Forms crew-home read returned 200; `/api/v2/admin/forms` returned 403.
- Retained Master actor 100: persisted active Ship role identifier
  `73fa5c3c-0d65-486d-a493-e82eebaaa11e`, designation Master, numeric vessel
  membership `1`; vessel 1 resolves to active, nondeleted UUID
  `743feb08-841a-11ed-aa7c-7003bca91a86`.
  Exact-assignment Company Forms list returned 200.
- Both actors' effective permissions were read from the supported
  `/api/v2/admin/access-control/my-permissions` endpoint: 200.
  The Master has Crew Database View but **Crew Pool View is false**.
  The application's profile route is protected by Crew Pool View.
  Forms authoring is denied for both runtime actors.
- An initial guessed permissions URL returned 404; this is retained as a
  preflight probe failure, not interpreted as application authorization evidence.
- Retained negative actors include wrong-vessel, wrong-role and unprovisioned
  actors. They must be rechecked after implementation, not assumed valid from
  old manifests. One earlier retained second-Master manifest is stale: its
  persisted actor is now Vessel User/Chief Engineer. Persisted data is authoritative.

### Positions and exact links

Latest revision **R2** of the retained test vessel has actual configured
positions Master (R001), Chief Engineer (R005) and Pumpman (R017).
All three have active planning occupants.

Existing exact links were inspected, not changed:

- Master planning `d4fdf99b-490e-45f5-bb2e-28bc6255077c` →
  incumbent assignment `2a355da2-523e-4e65-841e-6e2ae9e9cce9`.
- Pumpman planning `accc9d51-ea2a-4a8c-8371-91902e377d5c` →
  incumbent assignment `10df4ffb-db61-46a9-ac7a-cc5e290b7376`.
- Chief Engineer planning `6421164a-6af2-4d9d-9f72-27006f414878` →
  incumbent assignment `405df2a0-1b28-40db-b9e3-1cc1a6be077b`.
- Older Chief Officer planning `d2d7b8ef-f3a6-4dd1-8e85-ab5b2fc1f713` →
  reliever assignment `7b7347f1-9ebd-4593-aa24-ac369374ccf4`.
  Chief Officer is not an actual configured position in latest R2;
  do not repurpose this row to claim a valid new journey.

No occupied slot may be cleared or existing signed records reset for testing.
Existing onboard versions also cannot simply be relabelled at-sign-off; new
test-owned versions must pass revised release checks.

## Approval checkpoint

Required browser scenarios need multiple dedicated synthetic assignments in
genuinely configured positions. The retained test vessel has no vacant actual
position. A profile-based Master historical journey also needs navigation
permission beyond its current grants.

Request approval for **isolated development test setup**: a dedicated test-owned
vessel with configured vacant positions, synthetic seafarers, and isolated
test-only Ship roles/users with operational grants and trusted membership.
If profile-based historical access is used, grant those test roles Crew Pool View
only alongside the needed subject reads; never grant Forms authoring to runtime
actors. Use a distinct authorized setup actor for released definitions.

Do not alter existing Master-role grants, production authentication, occupied
positions, existing released definitions or protected acceptance declarations.
Alternatively, use existing genuinely vacant configured positions identified by
the user and a Vessel historical viewer requiring no new Crew Pool grants.

**Status:** paused at step-1 preflight; steps 2–6 remain unimplemented and
uncertified. No completion callback should be called.

## Subsequent approved setup limits and vacant-position search

The user rejected a synthetic vessel. Approved synthetic crew must be deployed
through normal flows into existing configured ranks with **no Planning row at
all**, so deployment inserts new rows rather than replacing occupants. Do not
clear slots or alter vessel/rank configuration; stop if no such rank exists.
Synthetic runtime roles/users may receive only journey-specific operational
grants, never Forms authoring. Sync All may remove them. Retain all records and
register every fixture UUID in `docs/company-form-regression-fixtures.md`.

Read-only search on 2026-10-04 examined 11 existing vessels and found genuinely
vacant configured ranks. Vessel 03 (master ID 2,
`7440571a-841a-11ed-aa7c-7003bca91a86`) has actual configured Master R001, Chief
Officer R002, 2nd Officer R003, Chief Engineer R005 and 2nd Engineer R006 ranks
with no Planning rows. Recheck immediately before deployment and record the
specific vessel/rank actually used. Raw search is retained as
`.local/verification/task358-preflight/vacant-ranks.json`.

The earlier paused status is historical. Implementation steps 2–5 have now been
committed; this document still does not certify closing browser evidence.

## Step 6 preparation and gates

On 2026-10-04, approved test-only users and stable roles were retained with
journey-specific operational grants and no runtime Forms authoring grants.
Normal Rotation deployment and normal sign-on inserted new rows in existing
vessel 03 at Master R001, Chief Officer R002, 2nd Officer R003, Chief Engineer
R005 and 2nd Engineer R006. The reliever metadata case uses its configured,
previously row-free 4th Engineer R008 position and remains Planned. Every rank
was rechecked against the actual vessel revision and **all** Planning rows before
deployment; no vessel was created, no occupied position was cleared, and no
existing planning row was replaced.

The setup actor created and released five test-owned versions through normal
Forms APIs. Setup interruptions and requests are retained under
`.local/verification/signoff/`; no records were reset or removed. The initial
existing-record hashes remained unchanged after preparation. The successful
navigation preflight is `preflight-2026-10-04T09-12-32-078Z/report.json`: actual
permitted Master Planning/G3 and limited Office G3 navigation passed before any
synthetic sign-off. Setup user 1 separately demonstrated Crew Database
View/Create/Edit/Delete; this is not a runtime Forms authoring grant.

Final full and Company Forms gates ran sequentially:

- Full: **1,248 tests, 1,019 passed, 162 failed, 67 pending**. See
  `.local/verification/task358-step6-full-tests.json` and `.log`. All starting
  failure names remain; there is one additional observed failure in the
  unrelated Crew Import Excel-template test (`STACK_TRACE_ERROR`). Do not call
  this full suite green or describe every final failure as inherited.
- Inventoried Company Forms/shared-consumer area: **49 files, 350 tests passed,
  zero skipped, missing or empty suites**. Gate:
  `.local/verification/company-forms-all-tests-2026-10-04T09-28-28-989Z.json`.
- Successful read-only starting-HEAD TypeScript comparison: **226 baseline /
  226 current, zero introduced diagnostics**, retained as
  `.local/verification/signoff-typescript-comparison.json`. No included
  client/server/shared TypeScript source changed after this comparison. A later
  redundant comparison while the test gates competed for resources timed out;
  tests and JavaScript drivers are outside this compiler's roots.

The final driver preserves exact contracts, actual browser requests/actors and
screenshots, persisted freeze/signature rows, protected comparisons and real
concurrent requests. The application/test/driver checkpoint must be committed
before the managed main backend is started for closing. This preparation
record does not claim that closing has passed.

## Planned-date correction and rerun

Retained failed browser attempts revealed that the Planning date is a proposed
date, not the actual assignment sign-off. The at-sign-off client verification
and locked request-context check now retain exact row/crew/vessel matching,
deletion/archive checks and authoritative assignment-state checks without
mistaking the proposed Planning date for actual sign-off. Actual signed-off
assignments still cannot use that popup. Regression tests cover both cases.

The corrected gates passed **49 files / 352 tests, zero skipped/missing/empty**,
with the result at
`.local/verification/company-forms-all-tests-2026-10-04T09-54-21-207Z.json`.
The renewed read-only compiler comparison is **226 baseline / 226 current,
zero introduced**. The renewed full suite is **1,250 total, 1,021 passed,
162 failed, 67 pending**; see `task358-correction-full-tests.json` and `.log`
under `.local/verification/`. Full-suite failures are not waived or hidden.

All failed closing attempts remain under `.local/verification/signoff/close-*`.
Previously captured completed signatures are read, never reset or re-signed.
The final corrected source/test/driver checkpoint must again precede the
managed main backend start before closing can be certified.

## Closing remains uncertified

The attempt `close-2026-10-04T10-03-16-774Z` ran against
`d6d9cc8c92f114f6b7c7a81e5e8bd5ceb069a12c`, with managed backend PID 14987
started at 10:03:01Z, after that commit. It read the retained completed aboard
declaration and confirmed its pinned metadata without re-signing it.

It then stopped in the normal sign-off popup before any sign-off request:
the driver's conditional selector used “Sign Off Reason” while the rendered
required label is “Reason.” The screenshot, DOM, request/actor traces and
failure are retained. The selector is corrected, but another closing run has
not been certified. No completion callback should be called.

Remaining closing coverage includes persisted unblocked sign-off, limited
Office post-sign-off G3 creation/completion, unfinished G3 flags, both witnessing
routes, positive and refused late signatures/writes, concurrent signature and
sign-off races, four real viewers, reciprocal metadata and protected comparisons.
The next run must start the managed main backend later than its committed
source/test/driver HEAD and preserve that HEAD/PID for the entire run.

## Final closing result

The earlier uncertified statuses above are historical. Closing now passed
against `78efe042d61a2678dbd37c1ba2d8be8c9045dad5`, with managed backend
PID 17770 started at 2026-10-04T10:30:52Z after that source/test/driver commit.
HEAD and PID remained stable. See [the closing report](sign-off-closing.md)
for actual retained positives, final replays/refusals, six step HEADs, four
viewer screenshots, protected comparisons and honest full-suite/TypeScript
baseline limitations. Completed records were never reset or re-signed.