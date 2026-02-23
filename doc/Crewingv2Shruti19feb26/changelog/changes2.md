# Change Log – A3.2 License & DCE and A3.3 Training Courses: Date Validation & Expiry Sorting

## 1. Frontend Code Changes
- **File Modified:** `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- Added two new state variables `licDateErrors` and `trainingDateErrors` (type `Record<string, string>`) to track per-row date validation errors for A3.2 License & DCE and A3.3 Training Courses.
- Updated `updateLicense()` to run date validation on `issued` or `expiry` field changes and update `licDateErrors` state accordingly, using the shared `validateExpiryVsIssued()` helper. Validation errors are computed outside `setFormData` to avoid nested state update anti-patterns.
- Updated `updateTrainingCourse()` with identical date validation logic, updating `trainingDateErrors` state.
- Updated `removeLicense()` and `removeTrainingCourse()` to clean up corresponding error entries from `licDateErrors` / `trainingDateErrors` when a row is removed.
- Added inline error message rendering below the Expiry date input in both A3.2 and A3.3 table rows, using existing `text-xs text-muted-foreground mt-1` styling consistent with A2.1, A2.2, and other validation messages.
- Extended save-level validation in `handleSaveAndContinue()` to also iterate all licenses and training courses, validate expiry vs issued dates, set error state, and block saving if any invalid entries exist (combined with existing A2.1/A2.2 checks).
- Added automatic sorting by expiry date (ascending, no-expiry at bottom) for licenses and training courses in two places:
  - On data load from database (useEffect for `licensesData` and `trainingData`)
  - After successful save in `handleSaveAndContinue()`
- Sorting does not occur during active editing to avoid disrupting user focus; rows re-sort after save.
- Reuses existing shared helpers: `validateExpiryVsIssued()` and `sortByExpiry()` — no duplication.

## 2. Backend Code Changes
- No backend changes required. All validation and sorting is handled client-side.

## 3. Database Level Changes
- No database schema, migration, or index changes. Sorting is purely a frontend display concern.

## Additional Notes
- Behavior is an exact replication of the A2.1/A2.2 date validation and sorting implemented in changes1.md.
- Validation only triggers when both Issued Date and Expiry Date are filled. If either is empty, no error is shown.
- Same Issued and Expiry dates are accepted as valid.
- Expired items naturally appear at the top due to ascending sort order.
- Items with no expiry date appear at the bottom of the list.
- No visual indicators (color coding, highlighting) are applied — only sorting order and inline validation messages.
- Scope is limited to A3.2 License & DCE and A3.3 Training Courses sections only.
