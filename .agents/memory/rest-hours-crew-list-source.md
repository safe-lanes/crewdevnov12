---
name: Rest Hours crew list is assignment-driven
description: How the RH Records crew list/counts are derived and the "Signed On only" rule.
---

The Rest Hours "RH Records" crew list is built from `crew_assignments` (joined to
`crew_members_v2`), filtered by vessel + a sign-on/sign-off date overlap with the
selected month — NOT from saved `rh_crew_records_v2` rows alone. Saved records are
matched onto the resolved assignments; unmatched assignments become id=0 placeholders.

**"Signed On only" = `crew_assignments.assignment_type = 'OnBoard'`.** The planning
UI "Sign On Status" (Planned/Confirmed/In Transit/Signed On) is stored on
`vessel_planning_v2.joining_status`, but the assignment row's `assignment_type` only
flips to `"OnBoard"` at the sign-on transition (vesselPlanningService); Planned/
Confirmed/In Transit all remain `"Planned"`. Do NOT filter on `joining_status` (mostly blank).

**Why this matters:** there are several parallel crew-derivation/count spots that each
re-query `crew_assignments` with the same date-overlap pattern and must stay consistent:
- `crewRecordsService.getByFilters` (the table + PDF export) and `getAllBulk` (enrichment)
- `vesselRecordsService.getOnboardCrewCountsForMonths` (vessel-overview total crew / recording %)
- `dailyRecordsService.getOnboardCrewCount` (vessel-summary recording-% denominator)
- `masterDataController.getCrewCountByVessel` (`/api/v2/rest-hours/masters/crew-count-by-vessel` badge)
All of these were given the `assignment_type='OnBoard'` filter so counts match the list.

**How to apply:** any new crew list/count in rest-hours that reads `crew_assignments`
should add `eq(crewAssignments.assignmentType, "OnBoard")` to match the others, or it
will silently re-introduce planned crew.

**Known latent gaps (not yet filtered):** `getByFilters` orphan-retention branch keeps
saved records for crew not in the OnBoard resolved set, and `dailyRecordsService.getCrewAssignmentsForMonth`
(postSaveSync write path) is unfiltered. Both are no-ops on current data (0 planned-crew
saved records) but would leak planned crew if such records existed.
