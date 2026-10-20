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
