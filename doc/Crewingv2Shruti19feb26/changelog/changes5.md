# Change Log – A4.1 Sea Service: Period Shows 0.0M for Same Dates

## 1. Frontend Code Changes
- **File Modified:** `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- Fixed `calculatePeriod()` function: changed condition from `totalMonths > 0` to `totalMonths >= 0` so that when From and To dates are the same, the Period column displays `0.0M` instead of showing blank.
- Reversed dates (To before From) still return blank, which is correct since those cases are caught by the inline validation error added in changes4.md.

## 2. Backend Code Changes
- No backend changes required.

## 3. Database Level Changes
- No database schema, migration, or index changes.

## Additional Notes
- Single-line fix with no impact on any other section or calculation logic.
- The Period column now correctly handles all scenarios:
  - Same date → `0.0M`
  - Valid range (To after From) → calculated value (e.g., `3.5M`)
  - Reversed dates (To before From) → blank (validation error shown instead)
  - Missing date(s) → blank
