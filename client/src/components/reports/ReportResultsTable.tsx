import { useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { Button } from "@/components/ui/button";
import { AgGridTable } from "@/components/AgGrid/AgGridTable";
import { downloadCsv, rowsToCsv } from "@/lib/csvExport";
import { downloadXlsx } from "@/lib/xlsxExport";
import { downloadPdf } from "@/lib/pdfExport";
import { formatDate } from "@/utils/format";
import type {
  ReportColumn,
  ReportColumnType,
  ReportResultRow,
} from "@shared/v2/reports/types";

export type { ReportColumn, ReportColumnType, ReportResultRow } from "@shared/v2/reports/types";

interface ReportResultsTableProps {
  title: string;
  columns: ReportColumn[];
  rows: ReportResultRow[];
  total: number;
  isLoading?: boolean;
  isFetching?: boolean;
  exportFilename?: string;
}

function formatCell(value: unknown, type?: ReportColumnType): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "boolean") return value ? "Yes" : "No";
  if (type === "date") {
    const formatted = formatDate(String(value));
    return formatted || String(value);
  }
  if (type === "number" && typeof value === "number") {
    return value.toLocaleString();
  }
  return String(value);
}

export function ReportResultsTable({
  title,
  columns,
  rows,
  total,
  isLoading,
  isFetching,
  exportFilename,
}: ReportResultsTableProps): JSX.Element {
  const gridApiRef = useRef<GridApi | null>(null);
  const [gridReady, setGridReady] = useState(false);
  const exportColumns = columns.map((c) => ({ key: c.key, label: c.label }));
  const baseFilename = (exportFilename || title || "report")
    .toLowerCase()
    .replace(/\s+/g, "-");

  const exportRows = useMemo(() => {
    const dateKeys = columns.filter((c) => c.type === "date").map((c) => c.key);
    if (dateKeys.length === 0) return rows;
    return rows.map((row) => {
      const copy = { ...row };
      for (const k of dateKeys) {
        const v = copy[k];
        if (typeof v === "string" && v) copy[k] = formatDate(v) || v;
      }
      return copy;
    });
  }, [columns, rows]);

  const handleExportCsv = () => {
    const csv = rowsToCsv(exportColumns, exportRows);
    downloadCsv(baseFilename, csv);
  };

  const handleExportXlsx = () => {
    downloadXlsx(baseFilename, exportColumns, exportRows, title || "Report");
  };

  const handleExportPdf = () => {
    downloadPdf(baseFilename, title || "Report", exportColumns, exportRows);
  };

  const columnDefs = useMemo<ColDef[]>(
    () =>
      columns.map((col) => {
        const def: ColDef = {
          field: col.key,
          headerName: col.label,
          sortable: col.sortable !== false,
          resizable: true,
          flex: 1,
          minWidth: 100,
          valueFormatter: (params) => formatCell(params.value, col.type),
        };
        if (col.type === "number") {
          def.filter = "agNumberColumnFilter";
        } else {
          def.filter = "agTextColumnFilter";
        }
        if (col.align === "right") {
          def.cellStyle = { textAlign: "right" };
          def.headerClass = "ag-right-aligned-header";
        } else if (col.align === "center") {
          def.cellStyle = { textAlign: "center" };
        }
        return def;
      }),
    [columns],
  );

  return (
    <div className="border border-gray-200 rounded bg-white flex flex-col h-full" data-testid="report-results-table">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-700" data-testid="text-report-result-summary">
          {isLoading ? (
            <span>Loading…</span>
          ) : total === 0 ? (
            <span>No results</span>
          ) : (
            <span>
              <span className="font-medium">{total.toLocaleString()}</span>{" "}
              {total === 1 ? "record" : "records"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={isLoading || columns.length === 0}
            className="h-8"
            data-testid="button-report-export-pdf"
          >
            <Download size={14} className="mr-1" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div
        className={`flex-1 min-h-0 overflow-hidden ${isFetching ? "opacity-60" : ""}`}
        data-testid="table-report-results"
      >
        <AgGridTable
          rowData={rows}
          columnDefs={columnDefs}
          loading={isLoading}
          pagination={true}
          paginationPageSize={50}
          enableStatusBar={false}
          enableSideBar={false}
          enablePivoting={false}
          height="100%"
          onGridReady={(event: GridReadyEvent) => {
            gridApiRef.current = event.api;
            setGridReady(true);
          }}
          gridOptions={{
            domLayout: "normal",
            overlayNoRowsTemplate:
              '<span class="text-gray-500">No data matches the selected filters.</span>',
            paginationPageSizeSelector: [25, 50, 100, 200],
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-3 py-2 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={isLoading || columns.length === 0}
          className="h-8"
          data-testid="button-report-export-csv"
        >
          <Download size={14} className="mr-1" />
          Export CSV
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExportXlsx}
          disabled={isLoading || columns.length === 0}
          className="h-8"
          data-testid="button-report-export-xlsx"
        >
          <Download size={14} className="mr-1" />
          Export Excel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => gridApiRef.current?.setFilterModel(null)}
          disabled={!gridReady}
          className="h-8"
          data-testid="button-report-clear-grid-filters"
        >
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
