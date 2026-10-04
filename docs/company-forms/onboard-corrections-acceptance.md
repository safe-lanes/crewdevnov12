# Crew List Company Form corrections

## Scope and eligibility diagnosis

Only retirement/replacement feedback, Crew List Forms position/count semantics,
and reciprocal labels are corrected. No crew-profile redesign, signing-policy
change, production authentication change, applied migration edit, occupied
position change or protected declaration mutation is permitted.

Implementation-time read confirmed:

- Form 802, `TEST ONLY ONBOARD HANDOVER`, remains archived at
  `2026-10-03T09:36:28.067Z`.
- Its retained version remains released with stage `on_board` and subject
  `crew_assignment`.
- Retained submission `fc16b1d1-711c-477c-981a-6531acc72002` remains voided
  without a replacement.
- Eligibility requires an unarchived/non-deleted dynamic form, matching
  subject/stage, a released/non-deleted version, and successful persisted
  lifecycle validation. Archival is the Handover exclusion cause, not a
  failed release or picker defect. It is not unarchived or rewritten.

## Behavior

An Office void always requires a reason and the existing server authorization.
For an archived on-board form, fresh submission-owned metadata opens explicit
confirmation containing exactly:

> This form has been retired. Voiding will not allow a replacement on this form.

Cancellation/dismissal performs no void request. The server locks the parent
form and checks the exact acknowledged archive timestamp before recording the
void, refusing a stale/missing acknowledgement without changing the submission.
Archived status does not give any additional actor rights.

A voided, retired on-board form with no replacement displays exactly:

> No replacement — form retired

A real replacement link takes priority even after archival. Active forms
without replacements are never labelled retired.

Both reciprocal labels describe the actual related form and its declaration
date, or explicitly labelled creation fallback. They use the **original's
saved voider**, not the subject seafarer or today's account identity. Any void
date is separately labelled. Missing historical identity is explicitly
unavailable. Targets remain exact submission UUIDs internally and load only
submission-owned pinned form/asset endpoints.

Submission metadata explicitly refetches on reciprocal navigation instead of
inheriting the global two-minute freshness period. This preserves pinned
content while refreshing retirement state and links added after replacement.
The regression test seeds a stale original in a globally infinite-fresh cache
and checks that the exact original endpoint supplies its new reciprocal link.
The Crew List popup also refreshes saved history and picker eligibility on
reopening, including when its embedded form was closed without a separate
renderer-back action. The regression test verifies completion and retirement
changes against a previously populated infinite-fresh cache.

## Verification and retained evidence

`scripts/verify-onboard-corrections.mjs prepare` uses normal authoring,
structure-save and release endpoints, with lifecycle validation unchanged.
It creates separate test-owned retirement and eligible-replacement definitions
on the already current retained Pumpman assignment. There are no SQL writes.
Preparation failures (parts queried without a version, System-field default
comments, and an intermediate projection mistake caught by the eligibility
preflight) are retained in `.local/verification/`; their draft/released
definitions are not removed to hide failures.

`scripts/verify-onboard-corrections.mjs closing` refuses a backend that started
before the final source commit. Its versioned reports record HEAD/commit time,
actual backend PID/start, browser start/end, separate actor identities, response
statuses, submission identities, links, count transitions, protected-record
hashes and real screenshots. The final result is in:

- `.local/verification/onboard-corrections-closing.json`
- `.local/verification/onboard-corrections-closing-<timestamp>.json`
- `.local/verification/onboard-corrections-protected-<timestamp>.json`
- `screenshots/onboard-corrections/<timestamp>-*.png`
- `.local/verification/onboard-corrections-fixtures.json` and versioned
  preparation manifests

The report's `passed` field is the authoritative outcome, not this document.
Any interrupted journey remains a failure report; it is not combined with
partial checks to claim one uninterrupted pass.

The closing browser creates both new submissions normally in Crew List.
The retirement definition is archived through its normal author endpoint
**after** visible creation. Office cancellation and confirmation are visible.
The eligible form's original is visibly voided and replaced by Office. A
separate trusted Master browser witnesses the explicitly present Seafarer,
signs Vessel Management and submits the required section. Completion is
observed in the saved-history UI, with no separate completion button.
Both reciprocal links are clicked before and after freezing and their exact
targets/pinned versions verified. Existing Handover and all other starting
records remain protected; no assignments are reset.

## Automated baseline

Focused renderer, popup/cache, server retirement/count/label, vessel-policy and
before-joining tests pass (six suites, 69 tests). TypeScript baseline comparison using a read-only
compiler host found 226 existing diagnostics and no new diagnostics.

The initial selected-suite acceptance missed two failing existing tests.
Read-only HEAD comparison reproduced them, but that did not excuse their
failure: both belong to this feature's closing coverage.

- `company-form-submission-lifecycle-contracts.test.ts` expects the retired
  no-vessel-witness declaration instead of the delivered trusted on-board
  witness rule.
- `company-form-submission-boundary.test.ts` expects 204 for a Ship draft
  write refused with 403 by the delivered stage/section policy.

## Reopened regression closure

The lifecycle contract now proves both stage directions through the actual
adapter policies: a permitted Ship-role actor with persisted identity/rank and
trusted vessel membership may witness Seafarer signing on a current on-board
assignment; the same actor/assignment/section is refused on `before_joining`,
before any identity lookup. Office witnessing and linked-Seafarer methods
remain asserted.

The original boundary setup wrote the before-joining version's `BOUNDARY`
section ("Boundary section"), with `responsible_mode=role` and the synthetic
`CF Boundary Ship …` role as responsible party. Its 403 was correct:
responsibility does not confer Ship write access to before-joining forms.
The isolated fixture now uses `on_board`, current `OnBoard` assignments,
the matching responsible role **and** `vessel_signature_role_uuids`, plus a
saved actor name/designation resolved through an existing rank ID. No
application permission code is relaxed. All three boundary cases must execute.

Every closing run now invokes `scripts/verify-company-forms-tests.mjs`.
It discovers the entire Company Forms/submission area by test names and
imports, including shared authoring/renderer/structure consumers and direct
authoring API and option-set migration checks. A Promotions browser test that
only mocks the standard-form picker is not a Company Forms test. The gate
serializes database suites, retains the complete discovered inventory, raw
Vitest JSON and logs, and fails on missing, empty, failed or skipped suites,
or any skipped/todo test. A previously selected passing subset cannot satisfy it.

The full inventory exposed additional stale fixture assumptions, now corrected:
rank display labels versus persisted IDs; on-board starts on a planned
assignment; Ship edits expected on before-joining forms; global draft totals
instead of isolated transactional fixture totals; old date/related-label and
authoring response contracts; and parts lacking their version-owned link.
Migration files and application authorization are unchanged.

Latest full-area results are recorded in
`.local/verification/company-forms-all-tests.json`, with timestamped inventories,
results and logs retained for every attempt. The closing browser report embeds
the successful gate report for the same committed HEAD.

## Concurrent lifecycle writes

Completion review caught a subject/submission lock inversion between void and
signature/draft writes. All writes now acquire the subject first, then
form/version locks when needed, then submission and section locks. The unlocked
pin lookup supplies only the lock target: lifecycle and draft writes re-read and
validate the pin and current state after the submission lock. Voiding still
checks the acknowledged archive timestamp under the form lock.

`company-form-submission-void-races.test.ts` uses a real held PostgreSQL
submission row to queue a permitted Master save/signature before an Office
void. It waits for actual blocking sessions, releases the row and checks both
successful responses and persisted original signing/voiding identities.
A read-only old-source run reproduced PostgreSQL `40P01` and HTTP 500 for both
operations; the unchanged test passes with the consistent order. The failed
baseline is retained in
`.local/verification/company-form-void-races-baseline.log`.

After this correction, the discovered full-area inventory contains **44 test
files and 323 tests**, all executed and passing with zero skipped tests.