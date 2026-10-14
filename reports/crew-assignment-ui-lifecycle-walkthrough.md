# Crew Assignment UI Lifecycle Walkthrough

## Result

**HALTED BEFORE CP1 — DEPLOY FAILED IN THE UI**

The amended task allowed the walkthrough to run with `AUTH_BYPASS=true`. The primary
rotation plan was created and proposed entirely through the application UI, but the
Deploy action returned an explicit 400 error:

```text
400: {"error":"Secondary crew already exists. The secondary must take over before deploying a new crew."}
```

The task required an immediate stop at any failed UI step. No workaround, direct API
call, SQL write, alternate position, or code change was used.

## Fixtures

### Occupied Case A position

- Vessel: `vessel 04`
- Vessel UUID: `744535d0-841a-11ed-aa7c-7003bca91a86`
- Rank: Chief Officer (`R002`)
- Incumbent: IVAN JURIC
- Incumbent crew UUID: `e3b617fc-bde9-4a95-a6af-9a26b40340d0`
- Incumbent plan UUID: `25293539-c121-496c-87b8-e3486621b358`

### Primary lifecycle crew

- Crew: Rahul Pal
- Crew UUID: `2e33607d-3b2b-422e-943e-d25e86037d5f`

### Reserved unassign-run crew

- Crew: Akash Bisht
- Crew UUID: `dd5b1145-4a99-42db-8fb2-077e828944a3`

Before the walkthrough, both test crew had zero assignment rows and zero planning
involvement. Each had eight historical sea-service rows.

## CP0 — Baseline

Full raw S1–S4 output, including all audit columns:

- Primary run: `reports/task-309/primary-rahul-pal-cp0.txt`
- Reserved unassign run: `reports/task-309/unassign-akash-bisht-cp0.txt`

### Primary plain-language state

- Rahul had zero `crew_assignments` rows.
- Rahul had zero relevant `vessel_planning_v2` rows.
- Rahul had eight historical `crew_sea_service` rows.
- Global counts were:
  - `crew_assignments`: 63
  - `vessel_planning_v2`: 81
  - `crew_sea_service`: 472

### Unassign-run plain-language state

- Akash had zero `crew_assignments` rows.
- Akash had zero relevant `vessel_planning_v2` rows.
- Akash had eight historical `crew_sea_service` rows.
- Global counts matched the primary CP0 snapshot.

## UI actions completed before the halt

1. Opened Rotation > Plan.
2. Opened New Rotation Plan V2.
3. Selected `vessel 04`.
4. Selected Chief Officer.
5. Selected Rahul Pal.
6. Set joining date to `24-Sep-2026`.
7. Set contract period to four months.
8. Applied Rahul to the draft.
9. Clicked Propose.
10. Observed the success message:

    ```text
    Rotation plan proposed for approval
    ```

11. Opened Rotation > Approval.
12. Selected only Rahul's pending proposal.
13. Clicked Deploy.
14. Observed the explicit 400 error and stopped.

## Proposed rotation rows retained

These rows were created by the UI and deliberately left in place:

| Table | UUID column | UUID | State |
|---|---|---|---|
| `rotation_drafts_v2` | `draft_uuid` | `04f87102-da3f-4e16-8be2-f669f0c878d9` | `plan_status=Proposed` |
| `rotation_entries_v2` | `entry_uuid` | `8e8af3ba-26bc-4fe4-987c-89fac05d5b63` | `proposal_status=Pending`, not deployed |
| `rotation_draft_vessels_v2` | `rv_uuid` | `c3ab8ad4-23b2-43d8-80c1-f7e24b2238fe` | vessel 04 selection |
| `rotation_draft_ranks_v2` | `rr_uuid` | `07b6680d-abc0-4a88-b75c-fefe63f9cb85` | Chief Officer selection |

Full raw output for these rows and the post-failure S1–S4 snapshot:

- `reports/task-309/primary-deploy-failure.txt`

No existing row was identified as modified by the failed Deploy action.

## Deploy failure snapshot

Immediately after the failed Deploy:

- Rahul still had zero `crew_assignments` rows.
- Rahul still had zero relevant `vessel_planning_v2` rows.
- Rahul's eight historical `crew_sea_service` rows remained.
- Global counts remained 63, 81, and 472 respectively.

The UI did not report success for Deploy. It returned the explicit secondary-conflict
error, so this was not a silent failure.

Screenshot:

- `screenshots/task-309-cp1-deploy-secondary-conflict.png`

## CP1 audit identity requirement

CP1 was not reached because Deploy failed before creating a `crew_assignments` row.
Therefore:

- New assignment `created_by_uuid`: **no value — no row was created**
- New assignment `updated_by_uuid`: **no value — no row was created**
- Did this run write the literal string `'unknown'` to either assignment audit column?
  **No. No assignment row was written at all.**

This halted run cannot determine whether the 49 historical `'unknown'` rows from
report #305 came from the same bypassed lifecycle path.

The four retained rotation proposal rows have blank audit identity fields under
`AUTH_BYPASS=true`. Audit identity values from this run are not representative of
production authentication behavior. Had the assignment lifecycle progressed, all
non-audit lifecycle observations would still have been valid.

## Remaining checkpoints

| Checkpoint | Status |
|---|---|
| CP0 baseline | Completed |
| CP1 after Deploy | Not reached — Deploy returned 400 |
| CP2 after popup save | Not started |
| CP3 after sign-on | Not started |
| CP4 after sign-off | Not started |
| Separate Deploy → Unassign run | Not started |

## Required conclusions

- **A. One assignment row survived from Deploy to sign-off:** NOT VERIFIED. Deploy
  failed before creating the first assignment row.
- **B. Assignment type followed Planned → OnBoard → sign-off:** NOT VERIFIED.
- **C. A company sea-service row was created and closed:** NOT VERIFIED.
- **D. Planning split into two rows for occupied-position Case A:** NOT VERIFIED.
- **E. A UI success left a row unchanged:** NO silent success was observed. Propose
  succeeded and persisted the proposal rows. Deploy explicitly failed with a 400
  error and left lifecycle tables unchanged.

## Data and repository constraints observed

- Lifecycle mutations were attempted only through browser UI clicks.
- Every SQL statement was read-only `SELECT`.
- No lifecycle API was called directly.
- No code, schema, migration, seed, configuration, or application dependency changed.
- No walkthrough row was deleted.
- The proposed rotation rows remain available for later inspection.

## Repository baseline

- Starting HEAD: `513bcf28fbc79c9bff3d7b236c9dc67f9838b129`
- Earlier halt-report commit: `352ab9c0e13030c1279fa3193211659047a093c2`

The final artifact commit and resulting HEAD are reported with task completion.