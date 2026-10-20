# PDF final-glance revision

Real-form generation remains disabled. Layout approval is still required.

## Step 1 — Joining dates

The signing-time header now records a planned joining date only from the exact
persisted reliever-assignment link in Planning. Multiple matches or no match
record no planned date; crew/vessel/name matching is not used.

Before-joining copies show that frozen planned date when present and otherwise
omit the date line. They never label a planned date as sign-on. On-board and
at-sign-off copies show sign-on only when its actual date is recorded. Rendering
does not consult current Planning or assignment data.

Previously stored PDFs and frozen headers remain unchanged. New registered sample
completions will be used for the final-glance samples.

## Step 2 — Designation provenance (read-only investigation)

- Company Representative: `master_users.designation`, trimmed and required.
  It is **not the Access Control role name**. The subject declares this source in
  `server/v2/company-forms/subjects/crewAssignmentSubject.ts` (the `officer`
  signatory's `designationSource`); the server reads it in
  `server/v2/company-forms/submissionLifecycleRepository.ts:469–472`.
- Office witness: the same authenticated actor's `master_users.designation`,
  frozen as `witnessRank` in `submissionLifecycleRepository.ts:527–528`.
- Vessel Management signer / vessel witness:
  `server/v2/company-forms/subjects/vesselSigningPolicy.ts:25–34` resolves
  `master_users.designation` against the company-rank master (rank identifier or
  a uniquely matching case-insensitive rank label) and records that rank label.
  This existing resolution has not been changed. Role names participate in
  authorization checks, not in the recorded designation value.
- Seafarer: the assignment's captured contract rank identifier is resolved and
  recorded; absent capture records `Not recorded`, never today's profile rank.
- The PDF reads only `signerRank` / `witnessRank` in its frozen signature records,
  not any of these live tables. Displaying the word “Designation” does not change
  where the value originated.

No designation, signature identity, or authorization logic changed in this step.
The parent master-data mapping also treats `designation` and `role` as separate
incoming fields (`server/v2/masters/repositories/mastersRepository.ts:218–220`);
it does not derive designation from the role name in that mapping.

## Step 3 — Disabled-period preparation queue

The server worker now has a rollout-ready branch which reads every tenant's
persisted pending preparation requests, rather than just sample registrations.
It processes ten per tick, eventually draining the backlog and handling new
requests by the same path. Active tenants are visited in their own database
context; one tenant or document failure does not stop the rest.

The branch is controlled only by the server's reviewed
`REAL_FORM_PDF_GENERATION_ENABLED` constant, which remains **false**. There is no
browser or environment-variable enablement switch. While false, the worker and
explicit preparation still permit only identity-checked registered samples.

Preparation uses the persisted frozen snapshot, verifies its checksum, and never
reads current crew/profile/Planning facts or recreates missing historical facts.
Pre-existing archives are returned unchanged. A voided form's original completed
snapshot can be archived without changing it; void-notice downloads remain the
later slice's scope. Preparation failures are recorded separately from completion
and expose the existing Fill in retry. An isolated-database regression exercises
a request made while disabled, disabled refusal, later enabled processing,
frozen-data preservation after a live profile edit, and repeat-run idempotency.

The main-preview tenant currently has **one pending preparation request without
a stored PDF**. It has not been processed. Older frozen records are not enriched
from today's data: fields absent at signing remain absent/“Not recorded”.

## Step 4 — Excel performance and final samples

The unchanged Excel-template test reproduced the timeout by itself before the
fix (30-second limit; 31.40 seconds for the three-test file). A CPU profile of
the production template path loaded **zero PDF/fontkit modules**. Fonts are
read by the renderer at generation time, not by this Excel path. Therefore the
saved 27.876-second versus 39.340-second historical measurements do not prove
that the PDF library caused the difference; their exact environmental difference
cannot be recovered from those logs.

The measured bottleneck was the workbook's repeated long attachment formulas:
300,000 cells repeating the complete sanitizing/counting expression. In the
instrumented pre-fix profile, total generation took 45.75 seconds, of which
41.54 seconds were in `writeBuffer`; CPU samples included 13.63 seconds in
garbage collection and 7.45 seconds joining XML strings, plus compression.
CPU profiling adds overhead, so these numbers are not substituted for test times.

The production fix uses XLSX shared formulas. Coverage remains 30,000 rows on
all ten attachment sheets; no row limit, validation, naming formula, style,
sheet protection or calculation behavior was removed. A new XLSX round-trip
regression checks the first and translated last-row formulas, protection and
the emitted full-recalculation setting. The original test and its 30-second
timeout are unchanged.

Separately, the archive no longer eagerly imports the renderer/fontkit: it loads
them only after a permitted preparation request passes frozen-evidence checks.
Logo upload validation's existing `pdf-lib` use is unchanged. This startup
improvement is not claimed as the proven cause of the Excel test's old timing.

Focused post-fix run: original Excel-template test **passed in 3,622 ms**.
Raw reports: `generated-artifacts/company-pdf-layout/excel-before-final-glance.json`,
`excel-after-final-glance.json`, `excel-profile-before.json`, and the CPU profiles.

### Final-glance sample pair

| Sample | Pages | Reference | Exact file SHA-256 |
|---|---:|---|---|
| With logo / before joining | 5 | CF-2026-000003 | `1c6bec2f579fc72a7c216f57013e578ee273dad612545b15cc765819da52b4f1` |
| Company-name fallback / on board | 5 | CF-2026-000004 | `7a00b0e095bbadc8eaa7242b839b502bed8acae0a611b875fd6e3dff2e20e7fc` |

Files: `generated-artifacts/company-pdf-layout/final-glance-sample-logo.pdf`
and `final-glance-sample-company-name.pdf`.

The logo sample reads **Planned joining date: 23-Oct-2026**, from its frozen
signing header, with no sign-on line. The on-board sample reads
**Sign-on date: 01-Oct-2026**, with no planned-date line. Both retain all three
signature types between them, witnessing, missing rank, long answers, frozen
crew facts, reference numbering and labelled fingerprints.

The new Planning fixture is numeric ID 3439, UUID
`a4120000-0000-4000-8000-000000000006`; all six sample records, including the four
retained originals, are registered in the manifest. No new crew, vessel or
assignment was created. No real-form archive has been generated.

### Closing gates

- Full suite: **1,271 passed, 162 failed, 67 pending, 1,500 total**.
  The required failure/pending ceilings are met. These are remaining baseline
  failures, not a fully green suite.
- Original Excel-template test in that full run: **passed in 6,721 ms**,
  against the unchanged 30,000 ms timeout.
- Company Forms: all **91 discovered files / 538 tests passed, zero skipped**.
  Every discovered file was matched against the full-suite result; none missing.
- TypeScript: **222 diagnostics**, within the approved ceiling.
- Raw result: `generated-artifacts/company-pdf-layout/final-glance-full-suite.json`.
  Discovered Company Forms gate:
  `generated-artifacts/company-pdf-layout/final-glance-company-forms-gate.json`.
- TypeScript log: `test-logs/pdf-final-glance-typescript.log`.

The final main-preview check is run after the final commit and workflow restart,
recording commit time, backend process start, authenticated Download/Print and
handover evidence in `generated-artifacts/company-pdf-layout/main-preview-evidence.json`.
