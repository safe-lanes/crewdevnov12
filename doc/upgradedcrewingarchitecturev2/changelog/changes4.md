# Change Log – Remove "Overdue in 1M" Dropdown Option

## 1. Frontend Code Changes
- Modified `client/src/modules/rotation/RotationModule_v2.tsx`
  - Removed `<SelectItem value="overdue1m">Overdue in 1M</SelectItem>` from the filter dropdown on the Crew Due/Overdue page
  - Remaining dropdown options: All, Due in 3M, Due in 2M, Due in 1M, Overdue
  - No changes to UI layout, alignment, or design

## 2. Backend Code Changes
- No backend changes
- The `overdue1m` filter case in `server/v2/rotation/services/dueCrewService.ts` (line 178) remains as benign unreachable code since the UI no longer sends this filter value

## 3. Database Level Changes
- No schema changes
- No new tables or columns
- No migrations required

## Additional Notes
- The change is limited to the removal of a single dropdown option
- No other validations or workflows are impacted
