# Change 18 — Expiry Date Picker Restrictions & E/F Section Border Styling

## Date: 2026-02-26

### Summary
Replaced inline expiry-vs-issued error messages with HTML date picker `min` restrictions in both Crew Pool and Recruitment forms. Applied consistent border visibility styling to Sections E and F in Crew Pool.

---

### 1. Expiry Date Picker Restrictions (Crew Pool + Recruitment)

**Before:** When a user selected an Expiry Date earlier than the Issued Date, an inline error message appeared below the field, and save was blocked with a toast validation error.

**After:** The Expiry Date input's `min` attribute is set to the Issued Date value. The browser date picker disables all dates before the Issued Date, preventing invalid selection entirely.

**Removed (both forms):**
- `validateExpiryVsIssued` helper function
- State variables: `docDateErrors`, `visaDateErrors`, `licDateErrors`, `trainingDateErrors`
- Real-time validation blocks in `updateDocument`, `updateVisa`, `updateLicense`, `updateTrainingCourse`
- Save-time expiry-vs-issued validation loop, toast, and early return in `handleSaveDraft`
- 4 inline error JSX lines (`<p>` elements below each expiry input)
- `setXxxDateErrors` calls in remove handlers (Recruitment)

**Added (both forms):**
- `min={item.issued || undefined}` on all 4 expiry date inputs (documents, visas, licenses, training courses)

**Preserved:**
- Sea service date validation (`seaServiceDateErrors`) — unchanged in both forms
- All other validations (email, mobile, spouse DOB, name fields) — unchanged

**Files modified:**
- `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`
- `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`

---

### 2. Border Visibility — Sections E & F (Crew Pool)

**Before:** All editable inputs and select triggers in E1 (Current Company Sea Service), E2 (External Sea Service), F1 (Pre-Joining Medicals), and F2 (Doctor Visits) used `border-0 bg-transparent`, making field boundaries invisible.

**After:** Changed to `border border-[#EAEBEF] bg-transparent` for consistent border styling matching Sections C and D.

**Scope:**
- ~28 editable Input and SelectTrigger elements updated across E1, E2, F1, F2
- Medical expiry input (F1) with `getExpiryColorClass` dynamic styling also updated
- Skipped: read-only synced text display div (cursor-default, line ~4814) — remains `border-0`

**File modified:**
- `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`
