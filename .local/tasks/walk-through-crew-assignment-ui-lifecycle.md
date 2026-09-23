# Walk Through Assignment Lifecycle

## What & Why
Exercise the complete `crew_assignments` lifecycle through an authenticated browser session so the observed database changes come from real UI actions rather than direct API or SQL writes. The walkthrough must test the occupied-position sign-on branch from Deploy through sign-off, then separately test unassign after Deploy.

## Done looks like
- An authenticated UI session completes the primary walkthrough or stops immediately with a screenshot and exact error if authentication, permissions, or a UI step blocks progress
- The primary run uses an unassigned test seafarer and a currently occupied vessel position, with the crew UUID, vessel UUID, rank, and incumbent crew UUID recorded before any action
- Full read-only snapshots are captured at CP0 through CP4 using the supplied S1–S4 queries, with raw outputs and plain-language row summaries at every checkpoint
- The walkthrough records whether one assignment UUID survives Deploy, popup save, sign-on, and sign-off; whether assignment type and current state transition correctly; whether planning splits into primary and secondary rows; and whether company sea service opens and closes
- A second run with a different seafarer captures CP0, CP1, and the post-unassign snapshot and states whether the Deploy-created assignment remains
- Conclusions A–E are answered explicitly from observed UI behavior and database results, without substituting code-reading inferences
- Every SQL statement executed is read-only, and no lifecycle action is performed through direct API calls
- The report lists every row created or modified by the walkthrough, grouped by table and UUID, so each row can be identified later; these rows are left in place and are not deleted
- The report includes screenshots for any blocked or silently failing step, final Git status, and the committed report artifact’s HEAD hash

## Out of scope
- Code, schema, migration, seed, or configuration changes
- Direct `INSERT`, `UPDATE`, or `DELETE` statements
- Calling lifecycle APIs directly or simulating browser actions outside the application UI
- Repairing any inconsistent rows found during the walkthrough
- Continuing past a failed, permission-blocked, or silently ineffective UI checkpoint
- Production-database access

## Steps
1. **Verify browser access and choose fixtures** -- Confirm an authenticated browser session works, then use read-only inspection to choose a test seafarer and a currently occupied vessel position that will exercise the occupied-position sign-on branch. Stop as `NOT VERIFIED` if authenticated UI access is unavailable.
2. **Run the primary UI lifecycle** -- Capture CP0, create and approve a Rotation plan, deploy it, save the reliever popup as Planned, sign the reliever on, and sign the same seafarer off through the normal UI. After every action, capture the complete S1–S4 raw snapshot before proceeding.
3. **Run the unassign scenario** -- With a different seafarer, capture baseline and post-Deploy snapshots, use the popup’s unassign control, and capture the resulting assignment, planning, sea-service, and denominator state.
4. **Deliver the evidence report** -- Present every checkpoint in order with raw SQL output first, plain-language state summaries second, explicit conclusions A–E, screenshots for any halt point, and final repository verification. Commit only the report artifacts and report the resulting HEAD.

## Relevant files
- `attached_assets/Pasted-TASK-LIFECYCLE-WALKTHROUGH-crew-assignments-via-the-UI-_1790131430744.txt`
- `reports/crew-assignments-data-integrity-audit.md`
- `client/src/modules/rotation/ApprovalTable_v2.tsx:319-376,627-754`
- `client/src/modules/vessel/components/ReliefStatusEditDialog_v2.tsx:141-297,390-397,531-864`
- `client/src/modules/vessel/api/vesselApiV2.ts:246-268`
- `server/v2/vessel/services/vesselPlanningService.ts:1243-1555`