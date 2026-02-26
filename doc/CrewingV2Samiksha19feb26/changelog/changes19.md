# Change 19 — New Crew Form: Blank Initial State

## Date: 2026-02-26

### Summary
The Crew Pool "New Crew" form now loads in a completely blank state. No fields are pre-filled and no automatic blank rows are displayed. Rows only appear when the user explicitly clicks "Add".

---

### Changes

**1. Removed default blank rows from all table sections**

Both the initial `formData` state and the "new crew" reset logic (`useEffect` when `isOpen && !crewMember`) now initialize all array sections as empty arrays `[]`:

| Section | Before | After |
|---|---|---|
| Documents (C1) | 1 blank row | Empty `[]` |
| Visas (C2) | 1 blank row | Empty `[]` |
| Education (C3) | 1 blank row | Empty `[]` |
| Licenses/Certificates (D1) | 1 blank row | Empty `[]` |
| Training Courses (D2) | 1 blank row | Empty `[]` |
| Current Company Sea Service (E1) | 1 blank row (initial state) | Empty `[]` |
| External Sea Service (E2) | 1 blank row (initial state) | Empty `[]` |
| Pre-Joining Medicals (F1) | Already `[]` | No change |
| Doctor Visits (F2) | Already `[]` | No change |
| Children (B1) | Already `[]` | No change |

**2. Gender field default changed to unselected**

- Changed `gender: 'Male'` to `gender: ''` in three locations: initial state, new-crew reset, and existing crew data hydration fallback
- The Gender select already has `placeholder="Select gender"` which now displays correctly when no value is selected
- Existing crew records with a saved gender value continue to load normally; records without a gender value now show the placeholder instead of defaulting to "Male"

**File modified:**
- `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`
