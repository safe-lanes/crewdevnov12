# Changes 14 — Crew Pool Bottom Footer Bar (UI Consistency)

## Summary
Added the same bottom footer bar used in the Appraisals tab to the Crew Pool tab for UI consistency. The footer shows the row count on the left and action buttons (Export CSV, Export Excel, Clear Filters, Expand All, Collapse All) on the right.

---

## Frontend Changes

### `client/src/modules/crew-pool/CrewPoolModule_v2.tsx`

#### New import
```ts
import AgGridTableActions from '@/components/AgGrid/AgGridTableActions';
```

#### Footer bar added
In `renderFiltersAndTable`, the `AgGridTable` in the data-loaded else-branch is now wrapped in a `<>` fragment with the footer div appended directly below:

```jsx
<div className="bg-white border-t border-gray-200 px-4 py-3 flex justify-between items-center" style={{ marginTop: '-1px' }}>
  <div className="text-xs font-normal font-['Mulish',Helvetica] text-black">
    Rows: {crewData.length > 0 ? crewData.length : 0}
  </div>
  <div>
    <AgGridTableActions
      gridApi={gridApi}
      exportFilename="crew-pool"
      showExportButtons={true}
      showFilterButtons={true}
      showGroupButtons={true}
      showSelectionButtons={false}
    />
  </div>
</div>
```

---

## Behavior
- Footer only renders when data is loaded (not during loading or error states — same as Appraisals)
- Row count reflects `crewData.length` (total rows passed to the grid)
- Export CSV → downloads `crew-pool.csv`
- Export Excel → downloads `crew-pool.xlsx`
- Clear Filters → clears all AG Grid column filters
- Expand All / Collapse All → expand/collapse row groups (shows a toast if no groups are defined)
- No changes to existing Crew Pool data, filtering, grid columns, or any other logic
