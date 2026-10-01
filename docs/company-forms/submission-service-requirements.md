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

## Subject stages, entry points, and access

11. Each subject type defines its own list of stages, which may be empty. A Company Form version carries one stage from its subject type's list, or none if that list is empty. The crew assignment subject defines: before joining, on board, at sign-off.
12. Entry points by stage: before joining — Vessel > Planning > reliever popup. On board — Vessel > Crew List. At sign-off — Vessel > Planning > On Board Status popup.
13. Home: the crew profile lists every Company Form submission for the seafarer across ALL assignments, including cancelled ones, grouped by assignment: one row per assignment, expandable to its forms.
14. The Crew List gets ONE Forms column showing a count, which opens the list. Never one column per form.
15. Until the applicability engine exists, a crew manager picks the form manually from released Company Forms matching the subject type and stage.
16. Seafarers will later complete forms themselves through a mobile app. The service must not assume an office user. Its API and permissions must support a seafarer acting on his own assignments only, enforced server-side. Mobile screens are out of scope.
17. The core submission service must reach subject-specific behaviour only through what each subject type declares: its stable identifier, its stages, its System fields, who may act on it, its entry points and home, and its signatories. Nothing in the core may assume the subject is a crew assignment.
18. The submission service exposes its own endpoints for reading the
    pinned form version a submission uses. Filling or viewing a
    submission must never depend on Admin endpoints. Read access is
    granted by the user's relationship to the subject — for a crew
    assignment, office crewing roles, users of that vessel, and later
    the seafarer himself — enforced server-side.
    A refused request must be reported as a permission problem, never
    as missing configuration.

## Release validation

A draft Company Form version may have no stage. Releasing a version whose subject type defines stages must be refused until a stage from that subject's list is selected. A subject type with no stages has no stage to select.

For the existing released crew-assignment version, the approved migration mapping is **Company Forms MARPOL Declaration**, version **01** (`3a0ded43-41a4-4460-a6b1-2cc59b0409ba`) → **before joining**. Existing draft versions need no stage mapping until release.