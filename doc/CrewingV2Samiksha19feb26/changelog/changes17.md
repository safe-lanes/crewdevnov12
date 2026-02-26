# Changes 17 — Crew Pool Validation Parity with Recruitment + UI Fixes

**Date:** 2026-02-26

## Summary
Ported all matching validation rules from the Recruitment form to the Crew Pool New Crew form. Also fixed field border visibility, Education column order, and issued date max=today in both forms.

---

## Crew Pool — Validation Rules Added

### Save-time validations (handleSaveDraft)
1. **DOB not future + min age 18** — if dateOfBirth is set, blocks save if future or under 18
2. **Mobile format (country-aware)** — validates against `countryDialingCodes` using `validateMobileNumber`; sets `mobileError` inline
3. **Email format** — validates email and NOK email via `validateEmail` helper; sets `emailError` / `nokEmailError` inline
4. **Spouse required when Married** — if maritalStatus is "Married", requires spouseFirstName, spouseFamilyName, spouseDateOfBirth; checks spouse DOB not future; sets `spouseValidationError` inline
5. **Expiry < Issued** — loops docs/visas/licenses/training, validates via `validateExpiryVsIssued`; sets per-row error state; blocks save if any errors
6. **Sea service To < From** — for manual E1 rows (no seaUuid) and all E2 rows, validates "To" date ≥ "From" date; sets `seaServiceDateErrors`
7. **Row mandatory fields** — non-blank docs require `document`, visas require `issuingCountry`, education requires `qualifications`, licenses require `certificateDocument`, training requires `trainingCourse`
8. **Blank row cleanup** — fully empty rows removed before save (docs/visas/edu/lic/training)

### Real-time inline validation (update handlers)
- `updateDocument` — expiry-vs-issued inline error on date change → `docDateErrors`
- `updateVisa` — same → `visaDateErrors`
- `updateLicense` — same → `licDateErrors`
- `updateTrainingCourse` — same → `trainingDateErrors`

### Inline error UI (JSX)
- Error text below expiry fields in Documents, Visas, Licenses, Training sections
- Error text below "To" date in E1 and E2 sea service sections
- "Required" indicators below spouse fields when married and missing
- Error text below Mobile, Email, and NOK Email inputs
- Clear-on-type behavior for mobile, email, nokEmail, spouse fields

---

## UI Fixes

### Border styling (Crew Pool)
- Replaced `border-0 shadow-none` with `border border-[#EAEBEF] shadow-none` for all row-section inputs in Documents, Visas, Education, Licenses, and Training Course sections
- Updated Children table inputs from `border-0 bg-transparent` to `border border-[#EAEBEF] bg-transparent`
- Preserved `getExpiryColorClass` on expiry inputs and existing SelectTrigger styling

### Education column reorder (Crew Pool)
- Reordered to match Recruitment: Qualifications → Subjects/Field → School/College/University → Date of Completion → Actions

### Issued date max=today
- **Crew Pool**: Added `max={todayStr}` to issued date inputs in Documents, Visas, Licenses, Training Courses
- **Recruitment**: Added `todayStr` useMemo + `max={todayStr}` to issued date inputs in Documents, Visas, Licenses, Training Courses
- Also added `max={todayStr}` to spouse DOB input in Crew Pool

---

## Files Modified
- `client/src/modules/crew-pool/CrewInfoForm_v2.tsx` — validation logic, inline errors, border styling, column reorder, issued date max
- `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx` — todayStr memo, issued date max

## No backend changes. No database schema changes.
