# Change Log – B2/B3 Validation Error & Click-Outside Auto-Save

## 1. Frontend Code Changes

### Fix 1: Clear Validation Error When Editing B2/B3 Without Mandatory Fields
- **File modified:** `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`
- In `toggleEditSection`, added a pre-validation check before calling `ensureCrewExists()` for B2/B3 sections
- If First Name is empty, shows a descriptive toast: "Please fill in 'First Name' in Section B1 (General Particulars) before editing this section."
- Prevents the generic 500 server error ("Failed to create crew member") from appearing
- The validation runs before any API call is attempted

### Fix 2: Click-Outside Auto-Save for Sections B1, B2, B3
- **File modified:** `client/src/modules/crew-pool/CrewInfoForm_v2.tsx`
- Added `useRef` for each section container (`sectionB1Ref`, `sectionB2Ref`, `sectionB3Ref`)
- Attached refs to the outermost `<div>` of each section's render function
- Added a `useEffect` with a global `mousedown` event listener that:
  - Detects clicks outside any actively-editing section
  - Auto-saves that section's data to the backend via the appropriate mutations
  - Switches the section back to view mode
- Replaced the placeholder `handleAutoSave` function with `handleSectionAutoSave(sectionId)` that performs actual backend saves:
  - B1: Saves crew record, personal details, and vessel types
  - B2: Saves address data
  - B3: Saves family info, next of kin, and children
- Updated `toggleEditSection` to auto-save and close the previously editing section when switching between sections

## 2. Backend Code Changes
- No backend changes required.

## 3. Database Level Changes
- No database or schema changes required.

## Additional Notes
- The click-outside listener is only active when a section is in edit mode (performance optimization)
- Portal-rendered UI elements (Select dropdowns, date pickers, popovers) are excluded from click-outside detection via `isInsidePortal()` helper, preventing premature auto-save when interacting with Radix UI components
- For new crew members (no crewUuid yet), click-outside closes the section without saving
- All existing functionality (Edit button toggle, Save Draft, etc.) remains unchanged
