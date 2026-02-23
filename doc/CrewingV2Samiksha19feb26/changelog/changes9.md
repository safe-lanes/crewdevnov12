# Change Log – Blank Row Validation & Mandatory Field Checks on Save

## 1. Frontend Code Changes

### File Modified
- `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`

### Two-Tier Blank Row Handling in `handleSaveAndContinue()`
Added validation logic before saving row-based sections (A2.1–A5, including attachments):

**Tier 1 — Completely blank rows (all fields empty, no attachments):**
- Silently removed from the form state on save (vanish from UI).
- Excluded from the save payload.
- Previously saved blank rows on the server are deleted via existing reconciliation logic.

**Tier 2 — Partially filled rows (any data or attachment present but mandatory field empty):**
- Save is blocked.
- A red "Validation Error" toast notification is shown with the section name, row number, and required field.
- Example: `Documents Row 2: 'Document Name' is required to save this row.`

### Mandatory (Primary) Fields per Section
| Section | Mandatory Field | Error Label |
|---------|----------------|-------------|
| A2.1 Travel Documents | `document` | Document Name |
| A2.2 Visas | `issuingCountry` | Issuing Country |
| A3.1 Education | `qualifications` | Qualifications |
| A3.2 License & DCE | `certificateDocument` | Certificate/Document |
| A3.3 Training Course | `trainingCourse` | Training/Course |
| A4/A5 Sea Service | `vesselName` | Vessel Name |
| B7 Training Needs | `training` | Training |

### Blank Detection Helpers
- Added `hasAttachments()` utility that checks for non-deleted attachments on a row.
- Added per-section `isBlank` helper functions (e.g., `isDocBlank`, `isVisaBlank`, etc.) that check ALL user-editable fields including attachments.
- A row is only considered blank if every field is empty AND there are no active attachments.

### B7 Training Needs in `handleSaveScreening()`
- Same two-tier logic applied: blank rows silently removed, partially filled rows without mandatory field trigger a validation toast.

### Toast Notification (replacing `alert()`)
- Validation errors now use the existing destructive toast pattern (`variant: "destructive"`, `title: "Validation Error"`) matching the UI style used for other validations (e.g., "First Name and Family Name are required.").
- Multiple errors are joined with newlines in the toast description.

## 2. Backend Code Changes
- None. This is a frontend-only change.

## 3. Database Level Changes
- None. No schema or migration changes required.

## Additional Notes
- No deployment or environment changes required.
- The validation runs before any save API calls are made — if validation fails, no data is sent to the server.
- Existing A1.3 Children blank-row filtering (which was already in place) remains unchanged.
- B7 does not have server-side delete reconciliation (no delete mutation exists), so previously saved B7 items are not deleted — only new blank B7 rows are prevented from being created.
