# Change Log – Mobile Number Prefix-Lock Bug Fixes

## 1. Frontend Code Changes

### Fix 1: Ghost Digit Reinsertion on Backspace (normalizeMobileInput)
- **File Modified:** `client/src/modules/recruitment/countryDialingCodes.ts`
- **Function:** `normalizeMobileInput()`
- **Issue:** When the user deleted all digits after the country code and pressed backspace again, digits from the country code itself (e.g., "9" and "1" from "+91") were re-extracted and reinserted into the field as local digits, creating a loop of ghost digit reinsertion.
- **Root Cause:** The function used `extractLocalDigits()` which internally called `stripDialingCode()`. When the input was partially deleted (e.g., "+9"), `stripDialingCode` failed to match any code, returned the raw input, and `.replace(/\D/g, '')` extracted "9" as a local digit — which was then reconstructed as "+91 9".
- **Fix:** Added a short-circuit guard: when `rawInput.length <= code.length`, return just the country code without attempting digit extraction. Also replaced the `extractLocalDigits()` call with direct slicing after the code position (`rawInput.slice(code.length)`) to avoid re-parsing the code portion.

### Fix 2: Blocked Digit Entry After Code-Only State
- **File Modified:** `client/src/modules/recruitment/countryDialingCodes.ts`
- **Function:** `normalizeMobileInput()`
- **Issue:** After Fix 1, the guard condition `rawInput.length <= code.length + 1` was too aggressive — it blocked the first digit typed after the country code. For example, with code "+91" (3 chars), typing a digit produced "+914" (4 chars), which equaled `code.length + 1` = 4, triggering the guard and discarding the digit.
- **Fix:** Changed the guard from `rawInput.length <= code.length + 1` to `rawInput.length <= code.length`. This ensures only actual deletion into the prefix is blocked, while new digit entry (input growing beyond code length) proceeds normally.

### Final normalizeMobileInput Logic
```typescript
export function normalizeMobileInput(countryName: string, rawInput: string): string {
  const code = getDialingCode(countryName);
  if (!code) return rawInput;
  if (rawInput.length <= code.length) {
    return code;
  }
  const afterCode = rawInput.startsWith(code)
    ? rawInput.slice(code.length).replace(/^[\s-]+/, '')
    : rawInput.slice(code.length);
  const localDigits = afterCode.replace(/\D/g, '');
  return localDigits ? `${code} ${localDigits}` : code;
}
```

### Behavior After Fix
- **Typing digits:** `+91` → type "1" → `+91 1` → type "2" → `+91 12` (works normally)
- **Backspace:** `+91 12` → backspace → `+91 1` → backspace → `+91` → backspace → nothing happens, code stays locked
- **No ghost digits:** Deleting all local digits and pressing backspace does not reinsert any digits from the code

## 2. Backend Code Changes
- None. This was a frontend-only fix.

## 3. Database Level Changes
- None. No schema or migration changes required.

## Additional Notes
- No deployment or environment changes required.
- The fix preserves all existing functionality: auto-prefix on country selection, country-specific digit validation, and save-time validation.
