# Company Form submission service — agreed requirements

Related project task: #333 (Company Form Submissions).

## Answers and completion

1. Content points and System field points collect no answer. Completion must treat both as requiring no response, like `info_only`, and reject any answer submitted for them.

## System field values

2. Resolve System field values from their authoritative source and **freeze them on the submission when the form is completed**. Subject-specific fields come from the subject's record; shared fields come from their own source (for example, date of declaration belongs to the submission, not the crew assignment). A later promotion or vessel rename must not change a completed submission. The signed document must show what was true when it was signed.

## Signatures

3. Company Representative (officer) signatures must store the signer's designation, taken by the server from `master_users.designation` at the moment of signing, and frozen. This requires a **new migration** relaxing the constraint introduced in migration 0207 that forces `signer_rank` to `NULL`; do not edit the applied migration.
4. Do **not** backfill existing signatures from current designations. The signer may have held a different role when they signed.
5. Derive signer identity — user, name, and designation — on the server from the authenticated session. Never accept these values from the request body.
6. On Company Forms, display officer signatures as **Company Representative**. The stored `signature_type` remains `officer`.

## Crew assignment subject

7. Anchor a crew-assignment submission to `crew_assignments.assign_uuid`, verified in Task #309 to survive from Deploy through sign-off.
8. Allow one submission per form per assignment.
9. Retain signed submissions when an assignment is cancelled. They must remain readable, drop off any outstanding list, and never be deleted as a result of cancellation.
10. Pin the form version at submission creation. Never re-resolve the version for that submission.

## Open — settle before building

11. Decide where each kind of Company Form is opened. The reliever popup suits forms tied to a joining; other forms need another entry point.