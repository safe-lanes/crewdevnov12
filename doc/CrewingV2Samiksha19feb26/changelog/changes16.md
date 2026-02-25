# Changes 16 — New Crew Form: Validation & Form-Reset Fixes

**Date:** 2026-02-25  
**Scope:** Frontend only — `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`  
**No backend or DB changes.**

---

## Fix 1 — Required-field validation for First Name and Family Name

**Problem:** The New Crew form's `handleSaveDraft` had no check for mandatory `firstName` / `familyName` fields. Clicking Save with a blank Family Name either silently created a record with an empty name or produced an unhelpful API error with no user-facing message.

**Fix:** Added a required-field guard at the very top of `handleSaveDraft`, before any sea service validation:

```ts
const trimmedFirstName = (formData.firstName || '').trim();
const trimmedFamilyName = (formData.familyName || '').trim();
if (!trimmedFirstName || !trimmedFamilyName) {
  toast({
    title: "Validation Error",
    description: "First Name and Family Name are required.",
    variant: "destructive",
  });
  return;
}
```

This mirrors the identical pattern already used in `RecruitmentApplicationForm_v2.tsx`.

---

## Fix 2 — Form fields disappearing after first Save on a new crew

**Problem:** After clicking Save on a new crew, previously entered values (nationality, date of birth, present rank, etc.) would partially disappear.

**Root cause (event sequence):**
1. `createCrewMutationV2.mutate()` succeeds → `onSuccess` fires.
2. `setCreatedCrewId(crewUuid)` correctly stores the new UUID.
3. `onCrewMemberChange(responseData)` was called → the parent component updated its `selectedCrewMember` state → the `crewMember` prop changed from `null` to `{ crewUuid: 'new-uuid' }`.
4. The form-data load effect's guard (`if (detailedCrewData && (crewMember?.crewUuid || crewMember?.id))`) became truthy.
5. The profile query fired for the new UUID and resolved with only the fields saved by the main create endpoint (firstName, familyName, gender, rank — not nationality, DOB, height, etc., which are saved via async chain mutations).
6. The effect fired and overwrote the form with this partial data, clearing all fields not yet persisted.

**Fix:** Removed the `onCrewMemberChange(responseData)` call from `createCrewMutation.onSuccess`. The `setCreatedCrewId(crewUuid)` call is sufficient:
- Subsequent saves fall into the existing update path via: `existingUuid = crewMember?.crewUuid || crewMember?.id || createdCrewId`
- The `crewMember` prop remains `null` for the duration of the new-crew session, so the form-data load effect is never re-triggered
- The form retains all user-entered values between saves
- Closing the dialog still works correctly (parent handles close separately)
