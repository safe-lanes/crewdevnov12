# Change Log – Read-Only Fields for Database-Added Entries in A2.1 & A2.2

## 1. Frontend Code Changes

### A2.1 Travel & Identification Documents — Document Name Field
- **File Modified:** `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- **Function:** `renderA21TravelDocs()`
- **Change:** Added conditional rendering for the Document name column. If the entry has a `documentId` (indicating it was added via "Add from Database"), the Document field renders as a read-only `<span>` instead of an editable `<Input>`. Manually added entries (no `documentId`) retain the editable input.
- **Logic:**
  ```tsx
  {doc.documentId ? (
    <span className="text-[13px] text-gray-900">{doc.document}</span>
  ) : (
    <Input value={doc.document} onChange={...} />
  )}
  ```
- **Other fields** (Number, Issued, Expiry, Issuing Authority) remain editable regardless of entry source.

### A2.2 Visas — Issuing Country Field
- **File Modified:** `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- **Function:** `renderA22Visas()`
- **Change:** Added conditional rendering for the Issuing Country column. If the entry has a `countryId` (indicating it was added via "Add from Database"), the Issuing Country field renders as a read-only `<span>` instead of an editable `<Input>`. Manually added entries (no `countryId`) retain the editable input.
- **Logic:**
  ```tsx
  {visa.countryId ? (
    <span className="text-[13px] text-gray-900">{visa.issuingCountry}</span>
  ) : (
    <Input value={visa.issuingCountry} onChange={...} />
  )}
  ```
- **Other fields** (Serial No, Issued, Expiry, Visa Type) remain editable regardless of entry source.

### How Database vs Manual Entries Are Distinguished
- `addTravelDocsFromDatabase()` sets `documentId` on each entry from the master data list.
- `addVisasFromDatabase()` sets `countryId` on each entry from the master data list.
- `addDocument()` and `addVisa()` (manual add) do not set these properties.
- The conditional rendering checks for the presence of these properties to determine editability.

## 2. Backend Code Changes
- None. This is a frontend-only change.

## 3. Database Level Changes
- None. No schema or migration changes required.

## Additional Notes
- No deployment or environment changes required.
- This restriction prevents accidental modification of master-linked data while allowing users to complete all other fields normally.
