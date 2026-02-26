# Change Log – Duplicate NOK Field Removal & First Name Only Mandatory

## 1. Frontend Code Changes

### Fix 1: Removed Duplicate "NOK: Relationship" Field (Crew Pool)
- **File modified:** `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`
- In Section B3 (Family and NOK), the "NOK: Relationship" field was appearing twice:
  - First instance (kept): In the row with NOK: First Name, Middle Name, Family Name
  - Second instance (removed): In the row with NOK: Telephone, Email, Address
- Removed the duplicate `<div>` block containing the second "NOK: Relationship" label, input, and read-only display
- The first instance remains fully functional for both edit and view modes

### Fix 2: Made Only First Name Mandatory (Crew Pool + Recruitment)
- **Files modified:**
  - `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`
  - `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- In `handleSaveDraft` (Crew Pool) and `handleSaveAndContinue` (Recruitment):
  - Removed `trimmedFamilyName` variable and its check from the required field validation
  - Changed condition from `if (!trimmedFirstName || !trimmedFamilyName)` to `if (!trimmedFirstName)`
  - Updated toast message from "First Name and Family Name are required." to "First Name is required."
- Family Name can now be left empty when saving in both forms

## 2. Backend Code Changes
- No backend changes required. Validation was frontend-only.

## 3. Database Level Changes
- No database or schema changes required.

## Additional Notes
- No deployment or environment changes needed.
- Existing crew records with Family Name values are unaffected.
