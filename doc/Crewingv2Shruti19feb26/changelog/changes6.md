# Change Log – Part B Submit for Approval: Status Not Updating to "For Approval"

## 1. Frontend Code Changes
- **File Modified:** `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- **Root Cause:** The "Submit for Approval" button and individual B-section save buttons all called the same `handleSaveScreening()` function. The function had no way to distinguish between a regular section save (which should set status to "Screening") and the main submission (which should set status to "For Approval"). As a result, clicking "Submit for Approval" either kept the status as "Screening" or left it unchanged.
- **Fix:** Added a second parameter `isMainSubmit` (default `false`) to `handleSaveScreening()`.
- When `isMainSubmit` is `true`: the function calls `getStatusForSection('B', true)` which returns `'For Approval'`, and updates the candidate status accordingly.
- When `isMainSubmit` is `false` (default): existing behavior is preserved — status is set to "Screening" for candidates not already in a terminal state.
- Updated the "Submit for Approval" button's `onClick` to call `handleSaveScreening(false, true)` — passing `skipToasts=false` and `isMainSubmit=true`.
- All other callers of `handleSaveScreening` (individual B-section saves, auto-save from A5 flow) remain unchanged — they don't pass the second parameter, so `isMainSubmit` defaults to `false`.
- The existing `getStatusForSection('B', true)` logic that returns `'For Approval'` was already defined but never invoked — this fix connects it to the actual button action.

## 2. Backend Code Changes
- No backend changes required. The `updateCandidateMutation` already supports setting any status value.

## 3. Database Level Changes
- No database schema, migration, or index changes.

## Additional Notes
- No UI, layout, or alignment changes.
- No impact on other sections or validations.
- The fix preserves all existing status transition rules:
  - Draft → Applied (after Part A submission)
  - Applied → Screening (after any Part B section save)
  - Screening → For Approval (after "Submit for Approval" button — **this was broken, now fixed**)
  - For Approval → Recruited/Waitlisted/Rejected (after Part C decision)
- If a candidate already has a terminal status (Recruited/Waitlisted/Rejected), the `getStatusForSection` function returns that status, preventing unintended status regression.
