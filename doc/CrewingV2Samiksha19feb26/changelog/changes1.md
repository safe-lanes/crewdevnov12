# Change Log – Recruitment Form Input Border Color Alignment

## 1. Frontend Code Changes
- **File Modified:** `client/src/modules/recruitment/RecruitmentApplicationForm_v2.tsx`
- Replaced `border-0` with `border border-input` on all row-based `Input` and `SelectTrigger` components across sections A1.3, A2, A3, A4, A5, and B7
- Original shape, height (`h-auto`), padding (`p-0`), shadow (`shadow-none`), and layout fully preserved
- Only the border visibility was changed to align with the standard `border-input` token used by other input fields in the form
- **Sections affected:**
  - A1.3 — Children table (4 Inputs + 1 SelectTrigger)
  - A2 — Documents (5 Inputs), Visas (5 Inputs)
  - A3 — Education (4 Inputs), Licenses (7 Inputs), Training Certificates (7 Inputs)
  - A4 — Sea Service (7 Inputs + 2 SelectTriggers + 1 readonly Input)
  - A5 — Additional Information (2 Inputs)
  - B7 — Training Needs (3 Inputs + 2 SelectTriggers)
- Total: 49 field instances updated

## 2. Backend Code Changes
- No backend changes required for this issue.

## 3. Database Level Changes
- No database changes required for this issue.

## Additional Notes
- The `border-input` CSS token is defined in the design system and matches the border color used by the standard `Input` and `SelectTrigger` components (`client/src/components/ui/input.tsx`, `client/src/components/ui/select.tsx`).
- Focus ring and hover behaviours are inherited from the base component styles and remain unchanged.
