# Changes 3 – Mobile Number Country Code Auto-Prefix

## Date
2026-02-23

## Summary
Added automatic country dialing code prefix to the Mobile number field in section A1.2 (Address & Contact Information), driven by the Country of Residence selection.

## Details

### New File
- **`client/src/modules/recruitment/countryDialingCodes.ts`** — Static mapping of all 240+ country names (as stored in master data) to their international dialing codes (e.g., `"INDIA" → "+91"`, `"UNITED STATES" → "+1"`). Exports three utility functions:
  - `getDialingCode(countryName)` — Returns the dialing code for a given country name.
  - `stripDialingCode(mobile)` — Removes any recognized dialing code prefix from a mobile number string, returning only the local digits.
  - `applyDialingCode(countryName, currentMobile)` — Strips any existing dialing code from the current mobile value and prepends the new country's code.

### Behavior
1. When the user selects a **Country of Residence** in section A1.2, the **Mobile** field value is automatically updated with the corresponding dialing code prefix (e.g., selecting "INDIA" sets the mobile field to "+91" or "+91 <existing digits>").
2. If the user **changes the country** after already entering a mobile number, the old country code is stripped and replaced with the new country's code. The user's local digits are preserved.
3. If the selected country has no mapping (unlikely given full coverage), the mobile value is left unchanged.
4. The mobile field remains a **single input field** — no visual split into prefix + number.
5. The full value (code + digits) is stored in `formData.mobile` for backend compatibility — no backend changes required.

### Files Changed
- `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx` — Imported `applyDialingCode` utility; updated the Country of Residence `<Select>` `onValueChange` handler to also update the mobile field via `setFormData`.
- `client/src/modules/recruitment/countryDialingCodes.ts` — New file (country-to-dialing-code mapping + utility functions).

### Scope
- Frontend only. No backend or database changes.
