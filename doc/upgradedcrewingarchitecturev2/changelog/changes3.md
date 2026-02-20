# Change Log – A2 Travel & ID Documents: Date Validation & Expiry Sorting

## 1. Frontend Code Changes
- **File Modified:** `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- Added two new state variables `docDateErrors` and `visaDateErrors` (type `Record<string, string>`) to track per-row date validation errors for A2.1 Travel Documents and A2.2 Visas.
- Added `validateExpiryVsIssued(issued, expiry)` helper function that returns an error message when both dates are present and expiry is strictly earlier than issued date. Returns empty string when only one date is filled or dates are valid (same date is acceptable).
- Added `sortByExpiry<T>()` generic helper function that sorts items ascending by expiry date, placing items with no expiry date at the bottom.
- Updated `updateDocument()` to run date validation on `issued` or `expiry` field changes and update `docDateErrors` state accordingly. Validation errors are computed outside `setFormData` to avoid the anti-pattern of nested state updates.
- Updated `updateVisa()` with identical date validation logic, updating `visaDateErrors` state.
- Updated `removeDocument()` and `removeVisa()` to clean up corresponding error entries from `docDateErrors` / `visaDateErrors` when a row is removed.
- Added inline error message rendering below the Expiry date input in both A2.1 and A2.2 table rows, using existing `text-xs text-muted-foreground mt-1` styling consistent with other validation messages (email, spouse fields).
- Added save-level validation in `handleSaveAndContinue()`: iterates all documents and visas, validates expiry vs issued dates, sets error state, and blocks saving with a toast message if any invalid entries exist.
- Added automatic sorting by expiry date (ascending, no-expiry at bottom) in three places:
  - On data load from database (useEffect for `documentsData` and `visasData`)
  - After successful save in `handleSaveAndContinue()`
- Sorting does not occur during active editing to avoid disrupting user focus; rows re-sort after save.

## 2. Backend Code Changes
- No backend changes required. All validation and sorting is handled client-side.

## 3. Database Level Changes
- No database schema, migration, or index changes. Sorting is purely a frontend display concern.

## Additional Notes
- Validation only triggers when both Issued Date and Expiry Date are filled. If either is empty, no error is shown.
- Same Issued and Expiry dates are accepted as valid.
- Expired documents (expiry in the past) naturally appear at the top due to ascending sort order.
- Documents with no expiry date appear at the bottom of the list.
- No visual indicators (color coding, highlighting) are applied — only sorting order and inline validation messages.
- Scope is limited to A2.1 Travel & Identification Documents and A2.2 Visas sections only.
