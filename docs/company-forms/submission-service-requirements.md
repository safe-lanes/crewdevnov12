# Company Form submission service — agreed requirements

Related project task: #333 (Company Form Submissions).

## Answers and completion

1. Content points and System field points collect no answer. Completion must treat both as requiring no response, like `info_only`, and reject any answer submitted for them.

## System field values

2. Resolve ALL System field values from their authoritative sources and **freeze them on the submission at the FIRST successful section submission or signature, whichever happens first**, not at completion. Subject-specific fields come from the subject's record; shared fields come from their own authoritative submission context (for example, date of declaration belongs to the submission, not a crew assignment). After freezing, these values never change; completion freezes nothing further. If the live source record later differs from the frozen values, do not refresh them and do not invalidate signatures. Show a visible notice on the form: **"The record has changed since signing began. This declaration shows the values at the time of first signature."** The crew manager decides whether to continue or explicitly cancel and restart. Retain the earlier declaration's frozen values and signatures rather than rewriting what was signed.

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
17. The core submission service must reach subject-specific behaviour only through what each subject type declares: its stable identifier, its stages, its System fields, who may act on it, its entry points and entry lists, its home, and its signatories. Nothing in the core may assume the subject is a crew assignment. Entry-list declarations are neutral metadata; the Crew List UI remains a separate concern, and the Crew List requirement above is unchanged.
18. The submission service exposes its own endpoints for reading the
    pinned form version a submission uses. Filling or viewing a
    submission must never depend on Admin endpoints. Read access is
    granted by the user's relationship to the subject — for a crew
    assignment, office crewing roles, users of that vessel, and later
    the seafarer himself — enforced server-side.
    A refused request must be reported as a permission problem, never
    as missing configuration.

## Trusted vessel-scope prerequisite

Ship-user Company Form access resolves membership from
`master_users.vessel_ids`, keyed by the authenticated numeric
`master_users.id`, then resolves those numeric IDs to active
`master_vessels.vessel_uuid` records. The repository describes this field as
parent-system data synchronized through the external master-data API, but
does not verify the deployed upstream host, current payload correctness, or
sync freshness. Deployments must verify that provisioning before enabling
vessel-user access; no freshness interval is inferred here. Until there is a
complete, valid, server-resolved vessel scope, vessel access is denied. JWT
vessel claims are not an authorization fallback. Office Company Form
permissions use the resolved active Office role's explicit Crew Database
view/create/edit grant and do not depend on vessel-scope provisioning.

## Release validation

A draft Company Form version may have no stage. Releasing a version whose subject type defines stages must be refused until a stage from that subject's list is selected. A subject type with no stages has no stage to select.

For the existing released crew-assignment version, the approved migration mapping is **Company Forms MARPOL Declaration**, version **01** (`3a0ded43-41a4-4460-a6b1-2cc59b0409ba`) → **before joining**. Existing draft versions need no stage mapping until release.