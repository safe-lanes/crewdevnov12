# Change Log – A4.1 Sea Service: From/To Date Validation

## 1. Frontend Code Changes
- **File Modified:** `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- Added new state variable `seaServiceDateErrors` (type `Record<string, string>`) to track per-row date validation errors for A4.1 Sea Service.
- Updated `updateSeaService()` to validate From/To dates when either field changes. If both dates are present and "To" is strictly earlier than "From", an error is set; otherwise the error is cleared. Validation runs outside `setFormData` to avoid nested state update anti-patterns.
- Updated `removeSeaService()` to clean up corresponding error entries from `seaServiceDateErrors` when a row is removed.
- Added inline error message rendering below the "To" date input in the A4.1 table rows, using existing `text-xs text-muted-foreground mt-1` styling consistent with A2 and A3 sections.
- Extended save-level validation in `handleSaveAndContinue()` to iterate all sea service entries, check for reversed dates (To < From), and block saving if any invalid entries exist.
- Toast messages are now contextual: A2/A3 issues show "Expiry Date cannot be earlier than Issued Date", A4.1 issues show '"To" date cannot be earlier than "From" date in Sea Service'. Both can appear together if errors exist in multiple sections. Original A2/A3 toast wording is preserved — no cross-section impact.

## 2. Backend Code Changes
- No backend changes required. All validation is handled client-side.

## 3. Database Level Changes
- No database schema, migration, or index changes.

## Additional Notes
- Validation only triggers when both From and To dates are filled. If either is empty, no error is shown.
- Same From and To dates are accepted as valid (Period shows 0.0M).
- No sorting was added to sea service — only date validation.
- The existing Period calculation logic is unchanged. Period still shows blank for reversed dates since the calculation returns empty for negative values.
- Scope is limited to A4.1 Details of Sea Service only. No impact on other sections.
