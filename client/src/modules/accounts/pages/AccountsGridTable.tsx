import { useCallback, useState } from "react";
import type { GridApi, GridReadyEvent } from "ag-grid-community";
import AgGridTable, {
  type AgGridTableProps,
} from "@/components/AgGrid/AgGridTable";
import AgGridTableActions from "@/components/AgGrid/AgGridTableActions";

export default function AccountsGridTable({
  onGridReady,
  ...props
}: AgGridTableProps) {
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  const handleGridReady = useCallback(
    (event: GridReadyEvent) => {
      setGridApi(event.api);
      onGridReady?.(event);
    },
    [onGridReady],
  );

  return (
    <>
      <AgGridTable {...props} onGridReady={handleGridReady} />
      {gridApi && (
        <div
          className="bg-white border-t border-gray-200 px-4 py-3 flex justify-end items-center print:hidden"
          style={{ marginTop: "-1px" }}
        >
          <AgGridTableActions
            gridApi={gridApi}
            showExportButtons={false}
            showFilterButtons={true}
            showGroupButtons={false}
            showSelectionButtons={false}
          />
        </div>
      )}
    </>
  );
}
