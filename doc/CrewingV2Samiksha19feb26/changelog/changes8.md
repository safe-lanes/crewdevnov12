# Change Log – Input Border Color Alignment in Row-Based Sections

## 1. Frontend Code Changes
- **File Modified:** `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- Updated 49 input fields across all row-based/table sections to have visible borders consistent with the rest of the form.
- **Change:** Replaced `border-0 shadow-none` with `border border-[#EAEBEF] shadow-none` on all `<Input>` and `<SelectTrigger>` elements within table rows.
- **Sections affected:**
  - A1.3 Children
  - A2.1 Travel Documents
  - A2.2 Visas
  - A3.1 Education
  - A3.2 License & DCE
  - A3.3 Training Course
  - A4 / A5 Sea Service
  - B7
- The border color `#EAEBEF` matches the standard border color used by section containers and other input fields throughout the form.
- Focus and hover states are handled by the base shadcn `Input` component — restoring the border makes these states visible and consistent.
- No changes to field shape, size, padding, height, logic, validations, or data bindings.

## 2. Backend Code Changes
- None. This is a frontend-only UI change.

## 3. Database Level Changes
- None. No schema or migration changes required.

## Additional Notes
- No deployment or environment changes required.
- This is a visual consistency fix only — all existing functionality remains unchanged.
