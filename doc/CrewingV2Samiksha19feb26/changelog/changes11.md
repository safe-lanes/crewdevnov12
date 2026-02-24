# Change Log – E1/E2 Sea Service Date Edit Persistence Fix (Crew Pool)

## 1. Frontend Code Changes

### File Modified
- `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`

### Issue
When editing the From Date or To Date of an existing sea service row in E1 (Company) or E2 (External) and clicking Save, the "Saved successfully" message appeared but the dates reverted to their previous values on refresh.

### Root Cause
In the save payload construction for both E1 and E2, the `fromDate` and `toDate` fields were built using:
```
fromDate: sea.fromDate || sea.from || ''
toDate: sea.toDate || sea.to || ''
```
When the user edits dates via the UI, the `updateCurrentCompanySeaService` / `updateExternalSeaService` functions update `service.from` and `service.to`. However, previously saved rows loaded from the database also carry `sea.fromDate` and `sea.toDate` with the **original database values**. Since the payload preferred `sea.fromDate` over `sea.from`, the old dates were always sent to the API, overriding the user's edits.

### Fix
Swapped the field priority so the user-edited values take precedence:
```
fromDate: sea.from || sea.fromDate || ''
toDate: sea.to || sea.toDate || ''
```
This ensures:
- If the user edited the date (`sea.from` / `sea.to` is set), the edited value is sent.
- If the user didn't edit the date, it falls back to the database value (`sea.fromDate` / `sea.toDate`).

Applied to both:
- **E1 Company Sea Service** save payload (line ~5833)
- **E2 External Sea Service** save payload (line ~5890)

## 2. Backend Code Changes
- None. All changes are frontend-only.

## 3. Database Level Changes
- None. No schema or migration changes required.

## Additional Notes
- No deployment or environment changes required.
- The `from` and `to` fields in the save payload already had the correct priority (`sea.from || sea.fromDate`) — only the `fromDate` and `toDate` fields needed the swap.
- This fix applies to all rows (both manually added and database-loaded) and ensures any date edit is correctly persisted.
