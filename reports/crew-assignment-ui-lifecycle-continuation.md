# Crew Assignment UI Lifecycle Walkthrough — Completed Continuation

## Result

**VERIFIED THROUGH CP4 AND THE SEPARATE DEPLOY → UNASSIGN RUN**

All lifecycle mutations were performed through the browser UI. SQL was used only for
read-only observations. No code, configuration, schema, seed, or dependency changes
were made. All created rows were left in place.

The earlier halted Chief Officer attempt remains documented in
`reports/crew-assignment-ui-lifecycle-walkthrough.md`. This report covers the corrected
fixture and completed continuation.

## Fixture selection

The required query returned 20 occupied primary positions with no secondary and no
reliever. Its complete, unabridged output is preserved in:

- `reports/task-309/continuation-fixture-and-cp0.txt`

Chosen row:

| Field | Value |
|---|---|
| Vessel | `vessel 04` |
| Vessel UUID | `744535d0-841a-11ed-aa7c-7003bca91a86` |
| Rank | `2nd Officer` |
| Incumbent plan UUID | `f42844f3-1451-4650-856c-f44af484be57` |
| Incumbent crew UUID | `ace80e38-7e11-4ef1-8f36-8edd4b22db0e` |
| Crew status | `primary` |
| Sign-on date | `2026-03-01` |
| Reliever crew UUID | `NULL` |
| Takeover confirmation | `false` |

The primary lifecycle crew was ALEKSANDR NOVIKOV
(`f3011dfd-ed44-4020-b85f-b2d4216e62af`). CP0 confirmed zero assignment,
planning, and sea-service rows for him.

## Checkpoints

### CP0 — baseline

- Aleksandr had zero `crew_assignments` rows.
- Aleksandr had zero relevant `vessel_planning_v2` rows.
- Aleksandr had zero `crew_sea_service` rows.
- Global counts were 63 assignments, 81 planning rows, and 472 sea-service rows.

Raw output:

- `reports/task-309/continuation-primary-cp0.txt`

### CP1 — after Deploy

The UI successfully deployed the proposal.

- Assignment UUID: `28caf31d-d58c-4351-b706-25b341574aa0`
- `assignment_type=Planned`
- `is_current=false`
- `created_by_uuid=unknown`
- `updated_by_uuid=unknown`
- The incumbent plan held Aleksandr as its reliever.
- No sea-service row existed yet.

Under `AUTH_BYPASS=true`, these literal `unknown` audit values are not representative
of production authentication.

Evidence:

- `reports/task-309/continuation-primary-cp1.txt`
- `screenshots/task-309-continuation-cp1-deploy.png`

### CP2 — after reliever popup save

The UI reported `Relief status saved successfully`. The assignment row was unchanged:
same UUID, dates, type, current flag, timestamps, and audit columns. The planning row
was normalized and updated.

Evidence:

- `reports/task-309/continuation-primary-cp2.txt`
- `screenshots/task-309-continuation-cp2-popup-save.png`

### CP3 — after sign-on

The UI signed Aleksandr on using `23-Sep-2026` and Dubai
(`c6244ce5-6c65-11ec-a490-507b9da1cbd6`).

- The same assignment UUID became `OnBoard` and `is_current=true`.
- New secondary planning UUID:
  `3b397bcb-8fa3-43eb-b257-912eeab5fe4a`.
- New company sea-service UUID:
  `6024758f-fb6d-40be-a590-af681b993491`.
- The incumbent remained primary.
- Counts became 64 assignments, 82 planning rows, and 473 sea-service rows.

Evidence:

- `reports/task-309/continuation-primary-cp3.txt`
- `screenshots/task-309-continuation-cp3-sign-on.png`

### CP3a — after takeover

The normal on-board popup was used on Aleksandr's secondary row with takeover date
`23-Sep-2026` and Take Over Confirmation checked. The UI reported
`On board status saved successfully`.

Planning results:

- Incoming plan `3b397bcb-8fa3-43eb-b257-912eeab5fe4a` changed from
  `secondary` to `primary`, with takeover date `2026-09-23` and confirmation `true`.
- Incumbent plan `f42844f3-1451-4650-856c-f44af484be57` changed from
  `primary` to `secondary`, with handover date `2026-09-23`.

Assignment results:

- Aleksandr's assignment retained the same UUID, `is_current=true`,
  `assignment_type=OnBoard`, vessel, and lifecycle dates.
- Its `updated_at` changed from `2026-09-23T05:13:21.512Z` to
  `2026-09-23T05:14:51.950Z`. No other captured assignment column changed.
- The incumbent assignment
  `d9e31259-c6e0-4543-9d82-8dc7f7b6ef08` did not change.

Evidence:

- `reports/task-309/continuation-primary-cp3a.txt`
- `screenshots/task-309-continuation-cp3a-takeover.png`

### CP4 — after sign-off

The normal on-board popup signed Aleksandr off on `23-Sep-2026` at Dubai with reason
`Contract Completed`. The UI reported `On board status saved successfully`.

- The same assignment UUID survived and became `is_current=false`.
- It retained `assignment_type=OnBoard`.
- Its `sign_off_date` became `2026-09-23`; reason became `Contract Completed`.
- The incoming planning row became archived with `relief_status=Signed Off`.
- The same company sea-service row closed with `to_date=2026-09-23` and reason
  `Contract Completed`.
- The incumbent plan returned to `primary`.
- Counts remained 64 assignments, 82 planning rows, and 473 sea-service rows.

Evidence:

- `reports/task-309/continuation-primary-cp4.txt`
- `screenshots/task-309-continuation-cp4-sign-off.png`

## Separate Deploy → Unassign run

JOKO HIDAYAT (`91bc2291-7d55-4b3f-b535-f0a4f678adef`) was selected as a different
eligible 2nd Officer. CP0 confirmed zero assignment and planning rows.

Deploy created assignment `cc173268-2d72-4434-8549-4daab7e29fb9` with:

- `assignment_type=Planned`
- `is_current=false`
- `created_by_uuid=unknown`
- `updated_by_uuid=unknown`

The reliever popup's `Unassign from vessel` checkbox and confirmation dialog were used.
The UI reported:

```text
Reliever Unassigned
The reliever has been removed from this vessel assignment.
```

After unassign:

- Joko disappeared from the vessel planning row.
- There were zero relevant planning rows for Joko.
- Assignment `cc173268-2d72-4434-8549-4daab7e29fb9` remained present and completely
  unchanged as `Planned`, `is_current=false`.
- No sea-service row was created.
- Counts remained 65 assignments, 82 planning rows, and 473 sea-service rows.

Evidence:

- `reports/task-309/continuation-unassign-cp0.txt`
- `reports/task-309/continuation-unassign-cp1.txt`
- `reports/task-309/continuation-unassign-final.txt`
- `screenshots/task-309-continuation-unassign-cp1-deploy.png`
- `screenshots/task-309-continuation-unassign.png`

## Required conclusions

- **A. One assignment row survived from Deploy to sign-off: YES.**
  `28caf31d-d58c-4351-b706-25b341574aa0` was used throughout.
- **B. Assignment type followed Planned → OnBoard → sign-off: YES, with nuance.**
  It changed from `Planned` to `OnBoard` at sign-on. Sign-off set
  `is_current=false`, `sign_off_date`, and reason, while the type remained `OnBoard`.
- **C. A company sea-service row was created and closed: YES.**
  `6024758f-fb6d-40be-a590-af681b993491` opened at sign-on and closed at sign-off.
- **D. Planning split into two rows for occupied-position Case A: YES.**
  Sign-on kept incumbent plan `f42844f3-1451-4650-856c-f44af484be57` and created
  incoming plan `3b397bcb-8fa3-43eb-b257-912eeab5fe4a`.
- **E. A UI success left a row unchanged: YES.**
  CP2 success left Aleksandr's assignment unchanged. Separately, successful Unassign
  removed Joko from planning but left his Deploy-created assignment unchanged.
- **F. Did takeover touch `crew_assignments` at all? YES.**
  Aleksandr's assignment `updated_at` advanced; no other captured assignment column
  changed. It still had the correct `is_current=true` and `assignment_type=OnBoard`.
  The incumbent assignment did not change.

## Created and modified row UUID inventory

### Primary lifecycle

| Table | UUID | Effect |
|---|---|---|
| `rotation_drafts_v2` | `209fbeb4-5a93-45f3-96af-9e0db42ba8fe` | Created |
| `rotation_entries_v2` | `76cbec50-eca1-4ede-8bd6-8be0c5af1e86` | Created; deployed |
| `rotation_draft_vessels_v2` | `3042ffe6-c5ea-41ce-b0a8-3ae316f5b2a6` | Created |
| `rotation_draft_ranks_v2` | `27ec4b7e-20b8-43bf-b61c-c1069f6251d3` | Created |
| `crew_assignments` | `28caf31d-d58c-4351-b706-25b341574aa0` | Created; updated at sign-on, takeover, sign-off |
| `vessel_planning_v2` | `f42844f3-1451-4650-856c-f44af484be57` | Existing incumbent row modified |
| `vessel_planning_v2` | `3b397bcb-8fa3-43eb-b257-912eeab5fe4a` | Created; promoted; archived at sign-off |
| `crew_sea_service` | `6024758f-fb6d-40be-a590-af681b993491` | Created and closed |
| `crew_members_v2` | `f3011dfd-ed44-4020-b85f-b2d4216e62af` | Existing crew row updated at sign-on |

The incumbent assignment `d9e31259-c6e0-4543-9d82-8dc7f7b6ef08` was observed at
every checkpoint but did not change.

### Separate unassign run

| Table | UUID | Effect |
|---|---|---|
| `rotation_drafts_v2` | `2dd5371d-f33e-49a3-9946-1372bb6a567e` | Created |
| `rotation_entries_v2` | `49ca6f49-f9a3-48c7-992f-38157f5b9f86` | Created; deployed |
| `rotation_draft_vessels_v2` | `a37b33aa-b7f4-4a0b-bdaa-8103b63fb6a0` | Created |
| `rotation_draft_ranks_v2` | `a61eade8-b6fa-42ee-9b43-347570e9658f` | Created |
| `crew_assignments` | `cc173268-2d72-4434-8549-4daab7e29fb9` | Created; retained unchanged after unassign |
| `vessel_planning_v2` | `f42844f3-1451-4650-856c-f44af484be57` | Existing row modified by Deploy and Unassign |

No unassign-run planning or sea-service row was created for Joko.

## Constraints observed

- Browser UI was the only mutation path.
- Every SQL statement was read-only.
- No lifecycle API was called directly.
- No code, configuration, schema, migration, seed, or dependency changed.
- No walkthrough row was deleted.
- All created rows remain available for inspection.
