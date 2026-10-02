# Company Form submission runtime verification

Verified on 2026-10-01. Entry screens, completion/signature creation, trusted
seafarer account linkage, and the applicability engine remain separate work.

## Trusted scope and authority

- Vessel membership comes from `master_users.vessel_ids` for the authenticated
  integer `master_users.id`. Complete positive numeric IDs resolve through active,
  nondeleted `master_vessels.id` records to `master_vessels.vessel_uuid`.
- The master-sync `users` mapping imports upstream `vesselIds`. The tracked
  parent-system mapping is established; configured live upstream identity,
  payload correctness, and freshness have not been independently verified.
  No freshness policy was invented. Missing, malformed, unresolved, or ambiguous
  scope fails closed, including the legacy noninteger-ID token-scope fallback.
- Authorized office roles use separate Crew Database view/create/edit grants.
  Forms authoring grants and vessel provisioning are not dependencies.
- The code's parent-data import is the Admin **Sync All** action:
  `POST /api/v2/masters/external/sync-all`, guarded by `Masters:edit`. The
  controller fetches the configured master-data endpoint with the authenticated
  tenant domain; the repository maps upstream `users.vesselIds` to the local
  membership column. No automatic/scheduled Sync All caller was found.
  **How quickly a parent vessel change reaches SAIL is unknown.** This code
  provides no verified maximum delay. The changed membership must arrive in a
  successful user-master sync before a subsequent Company Form request can use
  it. The five-minute master-data UI query cache is not a sync schedule and is
  not the Company Form authorization source.
- Production seafarer access remains denied until trusted account-to-crew
  linkage is supplied. An injected server resolver proves own/cross-crew policy.

## Retired route inventory

Before removal, no tracked HTTP caller of
`GET /api/v2/admin/forms/eligible-submissions` was found. Its definition chain
was the Admin router, `formsController.getEligibleCompanyForms`,
`formsService.getEligibleCompanyForms`, and form/version repository reads.
External consumers cannot be established from repository inspection.
The controller/service implementation is removed and the URL has an explicit
JSON 410 retirement response before dynamic form-ID routes.

A historical recheck at `f049c762` (immediately before #354) confirmed the same
empty HTTP-caller inventory, including constructed-path/hook searches in client
source. There were no screen callers to migrate. The old route/controller/service
definitions are not HTTP callers. The replacement is
`GET /api/v2/company-form-submissions/subjects/:subjectType/:subjectRef/eligible-forms`.
Current repository screens do not request the retired URL. This cannot establish
whether clients outside this repository used it.

The shared `ConfiguredFormRenderer.tsx` is byte-identical before #354 and at
`4b2f366e`. The task introduced a separate Company Submission wrapper, not a
change to the shared Standard Form renderer.

## Coverage

- All eligible, subject list/count, grouped home, create, detail, pinned-form,
  asset, and draft-edit routes authenticate and enforce subject/action policy.
- A no-Admin application reads complete pinned rendering data with no Forms
  grant. Rendering and filling request only submission-owned URLs.
- Accessible navigation exposes every pinned part in both view and edit modes;
  later-part saves target that part's section. Scalar answers are decoded by
  pinned question type without JSON coercion. Real-database save/reload/save
  coverage preserves boolean-, quoted-, array-, object-, and number-looking text,
  together with correctly typed checkbox and multi-select answers.
- Draft saves are ordered per submission/section, with synchronous local
  snapshots and stale-result protection. Controlled-network and real-database
  renderer tests verify latest-edit persistence, queue recovery, Save Draft
  flush, cleared date/number values, and comments on unanswered optional points.
- Older pins remain readable after newer releases, archive, cancellation, and
  completion. Cancelled history is retained but is not outstanding/editable.
- Foreign sections/questions/options/assets, orphan shared rows, locked or
  completed writes, nonanswerable point writes, and identity/pin overrides fail.
- Concurrent starts create exactly one parent/link. Blocked archive/cancellation
  races refuse starts after the authoritative state changes; blocked draft
  writes observe completed parents and submitted sections.
- A persisted stage-less test adapter exercises eligible reads, creation,
  list/count/home, detail/definition, and edits without crew/vessel/assignment
  records. Unregistered subjects cannot inherit crew behavior.
- Standard Form versioning, authoring, structure, and persistence regressions
  pass without Standard workflow changes.

## Commands and results

The final combined regression command passed **13 suites / 96 tests**:

```sh
npx vitest run --fileParallelism=false \
  tests/unit/company-form-subject-contracts.test.ts \
  tests/unit/company-form-draft-section-policy.test.ts \
  tests/unit/company-form-render-contract.test.tsx \
  tests/unit/role-resolution-and-permission.test.ts \
  tests/integration/api/company-form-submission-starts.test.ts \
  tests/integration/api/company-form-submission-boundary.test.ts \
  tests/integration/api/company-form-submission-races.test.ts \
  tests/integration/api/company-form-submission-answer-roundtrip.test.ts \
  tests/integration/company-form-stage-less-runtime.test.ts \
  tests/integration/company-form-stage-persistence.test.ts \
  tests/integration/api/company-form-versions.test.ts \
  tests/integration/form-structure-service.test.ts \
  tests/integration/api/form-part-edit.test.ts
```

The existing persistence acceptance check counts six tenant-wide draft versions.
A parallel combined run observed other suites' temporary drafts and failed that
baseline count; the serial run above passed. New tests use owned fixture IDs and
clean up their own data. The final combined run includes the metadata-neutrality,
multi-part navigation, lossless answer-decoding, ordered saves, clear-input,
and comment-only persistence corrections.

`npx tsc --noEmit` remains non-green with **226 pre-existing errors** across 394
output lines. No new diagnostics occur in the changed Company Form, principal,
renderer, or test files. Earlier checkpoint reports calling all 394 lines
“diagnostics” overstated the error count.

The application workflow restarted successfully, applied no new migrations, and
the existing application preview rendered without a blocking browser error.

## Requested Standard Form browser baselines

On 2026-10-01, the existing briefing submission
`8fc3f82c-6eff-43ee-882b-806845b6b793` and debriefing submission
`bdaa8ecd-586d-4658-b0db-b44952cfe09f` were opened through Crew Pool in a
real browser. Both their Basic Information and configurable Points parts
rendered, including existing responses, submitted sections, and signatures.
The screenshots capture the Points parts:

- `screenshots/task354-briefing-baseline.png`
- `screenshots/task354-debriefing-baseline.png`

Relevant reads returned HTTP 200. Neither journey requested the retired eligible
URL or received HTTP 410. No records were created or mutated during this check.
At the time of these browser baselines, runtime code remained identical to
implementation commit `4b2f366e`; the approval-audit changes only updated
documentation and screenshot evidence. Later client corrections are recorded below.

## Exact-revision independent review — 2026-10-01

The fresh completion-review request did not launch a review: the completion
action returned that a prior rejected review prevented further review runs,
despite `request_fresh_code_review: true`. Its task-status result is not a
review approval.

Two independent read-only reviews then examined `f049c762..4b2f366e`.
Neither changed runtime code or submitted records.

- **Server: APPROVE.** No blocking authorization, subject isolation, version
  pinning, asset ownership, or locking defect found. The reviewer independently
  ran subject/principal and section-policy suites: **21/21 passed**.
- **Client: REJECT.** The reviewer independently ran the renderer suite:
  **14/14 passed**, but found two P2 defects not covered by those assertions:
  1. `companySubmissionContract.ts:549–559` does not supply `onSubmitSection`.
     The shared renderer still shows Submit in editable live sections
     (`ConfiguredFormRenderer.tsx:975,1029–1035`), so confirming it is a no-op.
     Hide or disable this unsupported action; section submission remains outside
     this task rather than adding a completion endpoint.
  2. `companySubmissionContract.ts:344,554` declares `onAnswerChange` optional,
     but its absence locks the renderer even when the server returns
     `canEdit: true`. The wrapper already handles persistence internally.
     Server editability should control the default, or any intentional view-only
     override must be explicit rather than inferred from a notification callback.

The existing 13-suite/96-test integration regression pass was prior recorded
evidence, not reproduced in full by these reviewers. The exact revision is
**not approved**. Task #354 was reopened and its completion-ledger row
withdrawn until the client findings are addressed and reviewed.

## Client review corrections — 2026-10-01

- Company Form section Submit is hidden when no `onSubmitSection` handler is
  supplied. Save Draft remains available. No completion or signing endpoint was
  added; those actions remain the completion/signing task. The existing Standard
  Form Submit behavior is unchanged.
- The Company wrapper's lock now derives only from the server's `canEdit`.
  Optional answer callbacks notify consumers; they do not grant or remove editing
  permission. Internal persistence works without such a callback.
- Three mounted-renderer regressions cover hidden Submit with Save Draft still
  present, authorized callback-free editing with a real PUT request, and server-
  denied read-only rendering even when a callback is supplied. The first two
  tests failed on the previous runtime before the corrections were applied.
- The same serial regression command above, plus
  `tests/unit/configured-form-renderer.test.tsx`, passed **14 suites / 136 tests**.
  This includes all original Company boundary, race, pinning, history, and
  Standard Form regression suites, plus shared-renderer compatibility.
- `npx tsc --noEmit` still reports **226 pre-existing errors**. None occur in
  either changed client component or either renderer test file.

### Same-reviewer result

The same independent client reviewer returned **APPROVE** for committed
implementation `281f5640ca450d653d1260223e26915a605991ec`. No blocking
findings remained. The reviewer confirmed hidden unsupported Company Submit,
server-controlled editability, callback-free persistence, denied read-only
rendering, and unchanged Standard Form Submit availability.

The reviewer independently ran Company renderer and shared renderer unit suites:
**54/54 tests passed**. It also verified `git diff --check` and a clean worktree.
Non-fatal duplicate React key warnings in the existing shared-renderer
point-numbering test did not fail the tests. The reviewer did not independently
rerun database integration suites; the **14-suite/136-test** run above is the
implementation verification, not its independently reproduced evidence.

The application restarted successfully with no new migrations, and the preview
rendered without a blocking error. This independent approval satisfies the
user's requested client-review condition; it is not an official completion-
review verdict. The old `4b2f366e` rejection remains historical evidence and is
not retroactively approved. Task #354's completion row is restored with the
approved implementation hash, not this documentation/ledger commit.

## Company completion and signing verification — 2026-10-02

### Approved lifecycle superseding the original completion draft

- No section-level required flag and no existing definition changes. A pinned
  section needs submission when it contains an answerable point or a configured
  signature. Content, System, and `info_only` points are answer-free.
  Informational sections need no submission; applicability uses the existing
  vessel-type restrictions.
- Release and start validation refuse definitions with no submission-requiring
  sections or missing/invalid responsibility. Invalid existing releases are
  excluded from eligibility without retrospectively changing their release
  state. All seven pre-existing Company versions remain unchanged.
- The last applicable submission-requiring section's Submit completes the parent
  in the same guarded transaction. There is no separate completion endpoint or
  Complete control.
- ALL pinned System points freeze at the first successful Submit or signature,
  including informational and unvisited sections. The declaration date uses
  that first-event submission context, never an assignment or completion date.
  Later changes, signature replacement/removal, completion, and reload do not
  refresh the snapshot. Recorded null is distinct from missing historical data;
  historical signed records without a snapshot never backfill today's sources.
- Source comparisons are separate from declaration rendering. The exact
  changed-record notice does not invalidate signatures or prevent continuation.
  Comparison failures are reported separately; a proven difference remains
  visible even when another comparison fails.
- Authorized office crewing users may explicitly void in-progress or completed
  declarations with a mandatory reason and trusted server identity/time.
  Completion timestamps and signed/frozen history are retained. Re-creation
  selects the current eligible release, creates a separate parent, and records
  reciprocal links. Middle nodes display both required history labels.
- Company Representative identity/name/designation and each signing timestamp
  come from trusted records. Office-witnessed seafarer signatures use the
  subject-declared represented identity/rank plus the trusted witness identity.
  Vessel read access does not grant witness authority. Authenticated seafarer
  signing remains fail-closed in production pending trusted account linkage.

The Briefing comparison and the read-only seven-version audit are recorded in
`submission-service-requirements.md`. Briefing, Interview, Debriefing, and
Standard Form workflow implementations were not changed.

### Migration evidence

- `0228_company_form_officer_designation.sql` was already applied at
  `2026-10-01 03:58:57.806343`. Its officer constraint accepts a trusted nonblank
  designation or legacy null; historical records were not backfilled.
- Forward migration `0229_company_form_submission_signing_and_voiding.sql` was
  applied by the existing development migration runner at
  `2026-10-02 04:39:36.889635`. Neither applied migration 0207 nor 0228 was edited.
- Restart subsequently reported 236 migrations skipped and none newly applied.
  New persistence covers snapshot boundaries/point values, void audit,
  reciprocal replacement links, immutable history, and one non-voided
  form/subject submission, including soft-deleted non-voided rows.

### Automated verification

The serial verification set contains **28 suites / 244 tests**, all verified
passing after correcting the test fixtures identified below.

The set includes:

- Company subject contracts, responsibility policy, release/lifecycle policy,
  strict action payloads, trusted-principal boundaries, and stage-less adapters.
- Real PostgreSQL/Supertest draft/start/list/count/history, signature assets,
  signing, section submission, automatic completion, and void/re-create tests.
- Both first-event orderings and concurrent Submit/signature events; complete
  snapshots across unvisited informational points; required answers, comments,
  and signatures; forged payload and foreign reference rejection; post-submit,
  completed, cancelled-subject, and voided mutation rejection.
- Signing-time designation changes, office-witnessed represented identity/rank,
  signature replacement and removal followed by re-signing, stable snapshots,
  changed-source notices, partial comparison failures, recorded nulls, and
  unavailable legacy snapshots.
- Injected file-write and first-snapshot resolver failures: no signing boundary,
  snapshot, signature, state, or answer changes after rollback; successful file
  writes are cleaned up when their database transaction fails. A failed
  replacement leaves the existing visible signature and asset intact.
- Completed and in-progress voids, reason/identity/time audit, retained signed
  history, normal current-version replacement selection, reciprocal links,
  concurrent completion, and immutable declarations after reload.
- **64 mounted-renderer tests** across the Company wrapper and shared renderer:
  queued answer/comment persistence before Submit, explicit clearing,
  comment-only saves, pending/duplicate-click protection, permission metadata,
  real signing/removal callbacks, server-confirmed locks/refetch, actionable
  failures, both replacement-link directions, and Standard Form compatibility.
- Briefing, Interview, Debriefing, role/permission, form-part, and structure
  compatibility checks, including the real Debriefing signature acceptance flow.

Execution evidence:

1. The full serial 28-suite run verified 24 suites immediately. Four suites
   exposed fixture issues: new release validation legitimately rejected old
   answer-free-only release fixtures; Debriefing's fixture lacked its existing
   version-owned part FK; an API assertion assumed multiple signature rows
   despite the shared unconditional unique slot; and interrupted fixture
   cleanup left extra drafts affecting the historical six-draft assertion.
2. Those fixtures were corrected without changing production definitions or
   weakening lifecycle rules. The version-line teardown now removes owned
   option sets/options and continues cleaning other fixtures after an error.
   Only identified fixtures created during this implementation were removed.
3. The four affected suites were rerun serially and passed **25/25 tests**:
   `company-form-signing-and-completion.test.ts`,
   `company-form-stage-persistence.test.ts`,
   `form-structure-service.test.ts`, and
   `debriefing-submission.acceptance.test.ts`.
   The version-line suite also passed separately with its repaired cleanup,
   and the original six-draft baseline remained intact.
4. Explicit asset/snapshot failure-injection coverage was added to the neutral
   stage-less fixture and passed **6/6 tests**. It checks both failures before
   the first event and a failed replacement after signing has begun. No runtime
   implementation changes were needed. A final TypeScript run still reports
   the unchanged 226-error baseline and no Company/renderer diagnostics.

### Completion-review corrections

The initial completion review rejected implementation
`56f16bf626737afac7868e3c79ed4fc08820302a`: a section action's full-form refetch
could replace another section's unsaved edits with older persisted values.
The initial completion ledger row was withdrawn rather than retaining an
unverified completion.

The corrected Company wrapper reconciles independent answer, answer-comment,
and section-comment revisions. It acknowledges only the revisions actually
sent, and retains local draft overlays until a fetched server value confirms
them. An acknowledgement alone cannot clear an overlay against a stale GET.
Old saves cannot update another submission's acknowledgements or errors.
Server-confirmed submitted/not-applicable sections and completed/voided parents
render only persisted responses; abandoned drafts are not presented as signed
or voided history.

Mounted regressions verify a delayed section B autosave, newer edits and
explicit clears, successful section A signing/refetch, an older acknowledgement,
and a stale GET delivered after the newer saves succeed. An explicit retry
persists B's newest values without reverting them. Additional tests verify
persisted-only rendering after void and after another section becomes submitted,
including late failed saves.

The review also identified that configured signature flags were not enforced
on the signing endpoint. The service now rejects foreign or unconfigured
signature types before writing a file, and the locked repository repeats the
configuration check before attachment insertion or first-event freezing.
Both crew-assignment and neutral-subject API regressions reject officer and
seafarer signing on informational sections, and officer signing on an
answer-only section, with clear configuration errors, zero file writes, and
unchanged snapshots/states/signatures.

After these corrections, a consolidated serial run passed **28 suites /
243 tests**, and TypeScript again reported **226 existing diagnostics** with
none in changed Company/renderer code. The final additional submitted-section
reconciliation regression brings the verified set to **244 tests**; both
renderer suites pass **64/64** on that final code. No applied migration or
existing production definition was changed during the corrections.

`npx tsc --noEmit` reports **226 pre-existing errors**, the same count as the
pre-change baseline. There are no diagnostics in the changed implementation
files and no new Company/renderer diagnostics. This is not a globally clean
TypeScript build; the unrelated existing errors remain.

### Running application check and limits

The existing `Start application` workflow was restarted once after the runtime
and client changes. It is serving on port 5000; database initialization and the
migration runner succeeded. The preview screenshot renders the existing
application normally with no blocking browser error. Existing AG Grid warnings
and the already configured development-only authentication-bypass warning were
not introduced by this implementation.

Company signing interactions were verified using mounted UI tests and real
authorized API tests, not a signed-in visual browser walkthrough. No temporary
authentication bypass or public form-testing route was added. Entry/home
screens, mobile screens, trusted production seafarer linkage, and vessel
provisioning repairs remain outside this task.