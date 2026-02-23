# Changes 3 – Mobile Number Country Code Auto-Prefix, Locked Prefix & Digit Validation

## Date
2026-02-23

## Summary
Added automatic country dialing code prefix to the Mobile number field in section A1.2 (Address & Contact Information), driven by the Country of Residence selection. The prefix is locked (non-editable/non-deletable), and save is blocked if the digit count doesn't match the country's required range.

## Details

### New File
- **`client/src/modules/recruitment/countryDialingCodes.ts`** — Static mapping of all 240+ country names (as stored in master data) to their international dialing codes (e.g., `"INDIA" → "+91"`, `"UNITED STATES" → "+1"`). Also includes min-max digit length rules for 100+ countries (default 7–15 for unmapped countries). Exports:
  - `getDialingCode(countryName)` — Returns the dialing code for a given country name.
  - `getDigitRange(countryName)` — Returns `{ min, max }` digit length for a country.
  - `stripDialingCode(mobile)` — Removes any recognized dialing code prefix from a mobile number string.
  - `applyDialingCode(countryName, currentMobile)` — Strips any existing dialing code and prepends the new country's code.
  - `validateMobileNumber(countryName, mobile)` — Validates that the mobile starts with the correct country code and the remaining digits are within the allowed min-max range. Returns an error message string or null.

### Behavior
1. **Auto-prefix:** When the user selects a Country of Residence in section A1.2, the Mobile field value is automatically updated with the corresponding dialing code prefix.
2. **Auto-swap on country change:** If the user changes the country after entering a mobile number, the old country code is stripped and replaced with the new one. Local digits are preserved.
3. **Locked prefix:** The country code portion of the mobile field cannot be deleted or edited by the user. Any keystroke that would alter the prefix is rejected. The only way to change the code is by changing the Country of Residence selection.
4. **Digit length validation (on blur + on save):** The number of digits after the country code is validated against country-specific min-max rules (e.g., India requires exactly 10 digits). If invalid, an inline error message is shown below the field, and save is blocked with a toast notification.
5. **Save blocked if invalid:** The save action checks both that the country code matches the selected country and that the digit count falls within the allowed range.
6. **Single input field:** The mobile field remains a single input — no visual split.
7. **Frontend only:** Full value (code + digits) stored in `formData.mobile` for backend compatibility. No backend or database changes.

### Files Changed
- `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx` — Added `mobileError` state; imported `getDialingCode` and `validateMobileNumber`; updated mobile input `onChange` to lock prefix and `onBlur` for live validation; added mobile validation in `handleSaveAndContinue` to block save on invalid input.
- `client/src/modules/recruitment/countryDialingCodes.ts` — Added `countryDigitLengths` mapping, `getDigitRange()`, and `validateMobileNumber()` functions.

### Scope
- Frontend only. No backend or database changes.
