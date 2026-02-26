# Change Log – Rank Wise Violations Chart Month Filter Fix

## 1. Frontend Code Changes
- **File Modified:** `client/src/modules/rest-hours/components/RankWiseViolationsChart.tsx`
- **Logic Update:** Added `monthValue: queryParams.monthValue` to the `restHoursApiV2.crewRecords.getViolationsByRank()` API call (line 79-82)
- **Root Cause:** The `getViolationsByRank` call was only passing `vesselId` without the `monthValue` parameter, causing the backend to return violations from ALL months instead of the selected month
- **Impact:**
  - Chart now correctly displays violations only for the selected month
  - Only ranks with violations in the selected month are shown (e.g., no "2nd Officer" in January when there are no January violations)
  - Violation counts now match the Records view (e.g., Chief Officer in Vessel 3 for Feb shows correct count instead of inflated total of 15)
  - Switching months properly refreshes the chart with month-specific data

## 2. Backend Code Changes
- No backend changes required
- The controller (`server/v2/rest-hours/controllers/crewRecordsController.ts`) already extracts `monthValue` from `req.query` and passes it to the service
- The service (`server/v2/rest-hours/services/crewRecordsService.ts`) already passes `monthValue` to `crewRecordsRepository.findAll()`
- The API client (`client/src/modules/rest-hours/api/restHoursApiV2.ts`) already supports building the URL with `monthValue` query parameter

## 3. Database Level Changes
- No database changes required
- No schema updates
- No migrations needed

## Additional Notes
- Fix is scoped exclusively to the Rank Wise Violations section of the RH Dashboard - Office
- No impact on other dashboard sections (Periodic Analysis, Vessel Analysis, Rank Wise NCs, Vessel Status Overview)
- No UI layout, design, or alignment changes
- No impact on other workflows or modules
