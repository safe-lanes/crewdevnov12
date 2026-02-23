# Change Log – Read-Only Fields for Database-Added Entries in A3.2 & A3.3

## 1. Frontend Code Changes

### Type Definition Updates
- **File Modified:** `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- Added `fromDatabase?: boolean` to the type definitions for both `licenses` and `trainingCourses` arrays in the `FormData` interface.
- This flag is frontend-only and is not persisted to the backend.

### A3.2 License & DCE — Database-Added Entry Detection
- **Function:** `addLicensesFromDatabase()`
- **Change:** Added `fromDatabase: true` to each new license entry created from the database selection dialog.
- **API Data Mapping:** In the `useEffect` that maps `licensesData` from the API, added heuristic detection: `fromDatabase: !!(lic.abbr || lic.requirement)`. Since `abbr` and `requirement` are only populated from master data templates (manual entries start blank), this reliably identifies database-sourced entries on reload.

### A3.2 License & DCE — Read-Only Rendering
- **Function:** `renderA32LicenseDCE()`
- **Fields made read-only when `fromDatabase` is true:**
  - `certificateDocument` (Certificate/Document name)
  - `abbr` (Abbreviation)
  - `requirement` (STCW Requirement)
- These fields render as `<span>` elements instead of `<Input>` components.
- **Fields that remain editable regardless of source:**
  - `certificateNo` (Certificate Number)
  - `issuingAuthority` (Issuing Authority)
  - `issued` (Issue Date)
  - `expiry` (Expiry Date)
  - Attachments and delete actions

### A3.3 Training Course — Database-Added Entry Detection
- **Function:** `addTrainingCoursesFromDatabase()`
- **Change:** Added `fromDatabase: true` to each new training course entry created from the database selection dialog.
- **API Data Mapping:** In the `useEffect` that maps `trainingData` from the API, added heuristic detection: `fromDatabase: !!(course.abbr || course.requirement)`.

### A3.3 Training Course — Read-Only Rendering
- **Function:** `renderA33TrainingCourse()`
- **Fields made read-only when `fromDatabase` is true:**
  - `trainingCourse` (Training/Course name)
  - `abbr` (Abbreviation)
  - `requirement` (Requirement)
- These fields render as `<span>` elements instead of `<Input>` components.
- **Fields that remain editable regardless of source:**
  - `certificateNo` (Certificate Number)
  - `issuingAuthority` (Issuing Authority)
  - `issued` (Issue Date)
  - `expiry` (Expiry Date)
  - Attachments and delete actions

### Manual Add Behavior
- `addLicense()` and `addTrainingCourse()` (manual add via "ADD" button) do **not** set `fromDatabase`, so all fields remain fully editable for manually added entries.

### Known Limitation
- The `fromDatabase` flag is not persisted to the backend (no backend/schema changes). On data reload, a heuristic (`abbr` or `requirement` non-empty) is used to detect database-sourced entries. In the rare edge case where a user manually types values into abbr/requirement for a manual entry, it would be treated as read-only after reload. This is acceptable given the constraint of no backend modifications.

## 2. Backend Code Changes
- None. This is a frontend-only change.

## 3. Database Level Changes
- None. No schema or migration changes required.

## Additional Notes
- No deployment or environment changes required.
- This change follows the same pattern established in A2.1 (Travel Documents) and A2.2 (Visas) for read-only enforcement of database-sourced fields.
- The `fromDatabase` flag approach was chosen because A3.2/A3.3 entries do not have a dedicated master data reference ID (unlike `documentId` in A2.1 and `countryId` in A2.2).
