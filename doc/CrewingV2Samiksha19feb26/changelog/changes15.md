# Change Log – Crew Pool Grid Scroll Jump Fix

## 1. Frontend Code Changes
- **File modified**: `client/src/modules/crew-pool/CrewPoolModule_v2.tsx`
- Changed `bottomPadding` prop on `<AgGridTable>` from `{isPhone ? 10 : 20}` to `{isPhone ? 10 : 80}` (desktop value only)
- The `AgGridTable` component with `fillAvailableHeight={true}` computes its height as `viewportHeight - gridTop - bottomPadding`. The previous value of 20px did not reserve enough space for the footer bar (~48px), causing the total layout to overflow the viewport by ~28px and triggering a scroll jump when the footer became visible
- Setting `bottomPadding={80}` (matching the Appraisals tab) reserves sufficient space for the footer bar, keeping the total layout within the viewport and eliminating the scroll jump
- Phone behaviour unchanged (`isPhone ? 10` retained) as phones do not render the full footer bar

## 2. Backend Code Changes
- None

## 3. Database Level Changes
- None

## Additional Notes
- This fix aligns Crew Pool scroll behaviour with the Appraisals tab, which uses the same `bottomPadding={80}` value
- No functional, data, or API changes were made
