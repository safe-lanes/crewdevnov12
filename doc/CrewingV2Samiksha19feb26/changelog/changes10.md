# Change Log – E1/E2 Sea Service Mandatory Field Validation & To Date Fix (Crew Pool)

## 1. Frontend Code Changes

### File Modified
- `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`

### Mandatory Field Validation for Manually Added E1/E2 Rows
Added validation in `handleSaveDraft()` for manually added sea service rows (those without a `seaUuid`). When saving, the following 5 fields are checked:

| Section | Mandatory Fields |
|---------|-----------------|
| E1 Company Sea Service | Vessel Name, Vessel Type, Rank, From Date, To Date |
| E2 External Sea Service | Vessel Name, Vessel Type, Rank, From Date, To Date |

- Validation applies **only to manually added rows** (identified by absence of `seaUuid`).
- Database-loaded rows (those with `seaUuid`) are not subject to this validation.
- If any mandatory fields are missing, a red "Validation Error" toast is shown listing the section, row number, and specific missing fields.
- Example message: `E1 Company Sea Service Row 1: 'Vessel Name', 'Rank' required to save this row.`

### Save-Blocking Fix
- Moved the validation to the **very top** of `handleSaveDraft()`, before any mutations are dispatched.
- Previously, validation was placed after the main crew member save mutation (`updateCrewMutation.mutate()`), which meant the "Saved successfully" message would appear even when validation failed.
- Now, the `return` on validation failure exits the function before any data is sent to the server.

### To Date Auto-Population Fix for Manual Rows
- In E1 Company Sea Service, the "To Date" column had logic that treated any row with an empty `to` field as an "active contract" and displayed today's date in blue (read-only).
- This incorrectly applied to manually added rows, which start with all fields blank.
- **Fix:** Added `isManualRow` check (`!(service as any).seaUuid`) — the "active contract" display behavior now only applies to database-loaded rows.
- Manually added rows show a normal, empty, editable date input for "To Date".
- The same fix was applied to the **period calculation** column, so manually added rows don't auto-calculate period from "From Date to today".

## 2. Backend Code Changes
- None. All changes are frontend-only.

## 3. Database Level Changes
- None. No schema or migration changes required.

## Additional Notes
- No deployment or environment changes required.
- The timeline graph (Dashboard section A) continues to work without any changes — it reads from the database and is unaffected by these frontend validations.
- All fields in manually added rows remain fully editable (including From & To dates).
