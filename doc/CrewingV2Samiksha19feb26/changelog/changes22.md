# Change 22: Fix "Add from Database" ID Matching and Editability

## Date: 2026-02-26

## Summary
Fixed inconsistencies in "Add from Database" functionality across both Crew Pool and Recruitment forms. Three issues addressed:
1. ID mismatch between selection dialogs and table display
2. Database-sourced fields not being non-editable
3. Manual rows needing full editability

## Changes

### Crew Pool Form (`CrewInfoForm_v2.tsx`)

#### Licenses (Section D2)
- Added `fromDatabase` flag to license entries
- Set `fromDatabase: true` when adding from License Selection Dialog
- Hydration from server sets `fromDatabase: true` when `licenseId` is present
- Made `certificateDocument`, `abbr`, `requirement` fields render as non-editable `<span>` when `fromDatabase` is true
- Other fields (certificateNo, issuingAuthority, issued, expiry) remain editable

#### Training Courses (Section D3)
- Fixed ID mapping: Changed `courseId` from `template.id` (DB primary key) to `template.companyId` (e.g., `SC001`) to match what the selection dialog displays
- Added `fromDatabase` flag to training course entries
- Set `fromDatabase: true` when adding from Training Course Selection Dialog
- Hydration from server sets `fromDatabase: true` when `courseId` is present
- Made `trainingCourse` (name), `abbr`, `requirement` fields render as non-editable `<span>` when `fromDatabase` is true

#### Documents (Section C1)
- Made `document` (name) field non-editable when `documentId` is set (indicating DB source)
- Other fields (number, dates, issuing authority) remain editable

#### Visas (Section C2)
- Made `issuingCountry` field non-editable when `countryId` is set (indicating DB source)
- Other fields (serialNo, dates, visa type) remain editable

### Recruitment Form (`RecruitmentApplicationForm_v2.tsx`)

#### Licenses (Section D2)
- Fixed ID mapping: Changed `licenseId` from generated `formattedId` (e.g., `LIC-001`) to `license.id` (the master template ID, e.g., `LIC001`) to match what the dialog displays

#### Training Courses (Section D3)
- Fixed ID mapping: Changed `courseId` from generated `formattedId` (e.g., `TRN-001`) to `course.companyId` (e.g., `SC001`) to match what the dialog displays
- Added fallback to `formattedId` if `companyId` is not available

#### Documents & Visas
- Already correctly implemented: document name non-editable when `documentId` set, visa country non-editable when `countryId` set

## Editability Rules
| Row Source | Name/Abbr/Requirement | Certificate No/Dates/Issuing Authority |
|---|---|---|
| "Add from Database" | Non-editable (read-only span) | Editable (input fields) |
| "Add" (manual) | Editable (input fields) | Editable (input fields) |

## Files Modified
- `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`
- `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
