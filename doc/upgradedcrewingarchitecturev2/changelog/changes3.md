# Change Log – Sign-On Conflict Detection for Crew Deployments

## 1. Frontend Code Changes
- Modified `client/src/modules/vessel/components/ReliefStatusEditDialog_v2.tsx`
  - Added `checkSignOnConflict` async function that calls the backend conflict-check API when Sign On Status is set to "In Transit" or "Signed On"
  - Added state variables: `showSignOnConflict`, `conflictVesselName`, `isCheckingConflict`
  - Integrated conflict check into the form submission flow — submission is blocked if a conflict is detected
  - API failures also block submission (fail-safe approach) with a toast notification asking user to retry
  - Added `AlertDialog` component to display the conflicting vessel name when a duplicate deployment is detected
  - Submit button shows loading state ("Checking...") while conflict validation is in progress

## 2. Backend Code Changes
- Modified `server/v2/vessel/services/vesselPlanningService.ts`
  - Added `checkSignOnConflict(crewUuid, vesselUuid)` method
  - Queries `crew_assignments` table for active assignments (`isCurrent = true`) on other vessels
  - Queries `vessel_planning_v2` table for active planning records (joining status "In Transit" or "Signed On", or crew status "primary") on other vessels
  - Excludes same-vessel assignments from conflict detection
  - Returns `{ hasConflict, conflictVesselName }` response
- Modified `server/v2/vessel/controllers/vesselPlanningController.ts`
  - Added `checkSignOnConflict` controller handler that extracts `crewUuid` from route params and `vesselUuid` from query string
  - Returns 400 if `vesselUuid` query parameter is missing
- Modified `server/v2/vessel/routes.ts`
  - Added route: `GET /api/v2/vessel/planning/check-sign-on-conflict/:crewUuid`

## 3. Database Level Changes
- No schema changes
- No new tables or columns
- No migrations required
- Queries existing tables: `crew_assignments`, `vessel_planning_v2`, `vessels`

## Additional Notes
- The conflict check uses a fail-safe approach: if the API call fails or returns a non-OK response, submission is blocked and the user is shown an error toast asking them to retry
- Same-vessel assignments are excluded from conflict detection (only deployments on other vessels trigger alerts)
- The feature only activates for "In Transit" and "Signed On" statuses; other statuses are not affected
