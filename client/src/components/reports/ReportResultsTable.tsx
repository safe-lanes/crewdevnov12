import { useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, rowsToCsv } from "@/lib/csvExport";
import { downloadXlsx } from "@/lib/xlsxExport";
import { downloadPdf } from "@/lib/pdfExport";
import type {
  ReportColumn,
  ReportColumnType,
  ReportResultRow,
  ReportSort,
} from "@shared/v2/reports/types";

export type { ReportColumn, ReportColumnType, ReportResultRow } from "@shared/v2/reports/types";

interface ReportResultsTableProps {
  title: string;
  columns: ReportColumn[];
  rows: ReportResultRow[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  sort: ReportSort | null;
  onSortChange: (sort: ReportSort | null) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  exportFilename?: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

const PLACEHOLDER_COLUMNS: ReportColumn[] = [
  { key: "__sk1", label: "—" },
  { key: "__sk2", label: "—" },
  { key: "__sk3", label: "—" },
  { key: "__sk4", label: "—" },
  { key: "__sk5", label: "—" },
];

function formatCell(value: unknown, type?: ReportColumnType): string {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "boolean") return value ? "Yes" : "No";
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
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sort,
  onSortChange,
  isLoading,
  isFetching,
  exportFilename,
}: ReportResultsTableProps): JSX.Element {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const handleSort = (key: string) => {
    if (!sort || sort.key !== key) {
      onSortChange({ key, direction: "asc" });
    } else if (sort.direction === "asc") {
      onSortChange({ key, direction: "desc" });
    } else {
      onSortChange(null);
    }
  };

  const exportColumns = columns.map((c) => ({ key: c.key, label: c.label }));
  const baseFilename = (exportFilename || title || "report")
    .toLowerCase()
    .replace(/\s+/g, "-");

  const handleExportCsv = () => {
    const csv = rowsToCsv(exportColumns, rows);
    downloadCsv(baseFilename, csv);
  };

  const handleExportXlsx = () => {
    downloadXlsx(baseFilename, exportColumns, rows, title || "Report");
  };

  const handleExportPdf = () => {
    downloadPdf(baseFilename, title || "Report", exportColumns, rows);
  };

  // When loading without known columns, show placeholder skeleton columns
  // so the table outline (header + rows) is always visible.
  const displayColumns =
    isLoading && columns.length === 0 ? PLACEHOLDER_COLUMNS : columns;
  const showHeaderInteractions = !isLoading && columns.length > 0;

  const skeletonRows = useMemo(
    () => Array.from({ length: Math.min(8, pageSize) }, (_, i) => i),
    [pageSize],
  );

  return (
    <div className="border border-gray-200 rounded bg-white" data-testid="report-results-table">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="text-sm text-gray-700" data-testid="text-report-result-summary">
          {isLoading ? (
            <span>Loading…</span>
          ) : total === 0 ? (
            <span>No results</span>
          ) : (
            <span>
              Showing <span className="font-medium">{start}</span>–
              <span className="font-medium">{end}</span> of{" "}
              <span className="font-medium">{total.toLocaleString()}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isLoading || rows.length === 0}
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
            disabled={isLoading || rows.length === 0}
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
            onClick={handleExportPdf}
            disabled={isLoading || rows.length === 0}
            className="h-8"
            data-testid="button-report-export-pdf"
          >
            <Download size={14} className="mr-1" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-testid="table-report-results">
          <thead className="bg-[#f4f8fb] text-gray-700">
            <tr>
              {displayColumns.map((col) => {
                const colSortable = col.sortable !== false;
                const headerClickable = showHeaderInteractions && colSortable;
                const isSorted = headerClickable && sort?.key === col.key;
                const Icon = !isSorted
                  ? ArrowUpDown
                  : sort?.direction === "asc"
                    ? ArrowUp
                    : ArrowDown;
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={`px-3 py-2 font-semibold border-b border-gray-200 select-none ${
                      headerClickable ? "cursor-pointer" : ""
                    } ${
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                          ? "text-center"
                          : "text-left"
                    }`}
                    onClick={
                      headerClickable ? () => handleSort(col.key) : undefined
                    }
                    data-testid={`th-report-${col.key}`}
                  >
                    {isLoading && columns.length === 0 ? (
                      <div className="h-4 bg-gray-200 rounded w-20 animate-pulse" />
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span>{col.label}</span>
                        {headerClickable && (
                          <Icon
                            size={12}
                            className={isSorted ? "text-[#16569e]" : "text-gray-400"}
                          />
                        )}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              skeletonRows.map((i) => (
                <tr key={`sk-${i}`} className="border-b border-gray-100">
                  {displayColumns.map((col) => (
                    <td key={col.key} className="px-3 py-2">
                      <div className="h-4 bg-gray-100 rounded w-3/4 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(1, displayColumns.length)}
                  className="px-3 py-12 text-center text-gray-500"
                  data-testid="text-report-empty"
                >
                  No data matches the selected filters.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-gray-100 ${
                    isFetching ? "opacity-60" : ""
                  } hover:bg-blue-50/30`}
                  data-testid={`row-report-${idx}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 ${
                        col.align === "right"
                          ? "text-right"
                          : col.align === "center"
                            ? "text-center"
                            : "text-left"
                      }`}
                      data-testid={`cell-report-${col.key}-${idx}`}
                    >
                      {formatCell(row[col.key], col.type)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
            disabled={!onPageSizeChange || isLoading}
            className="h-7 border border-gray-300 rounded px-1 text-xs bg-white"
            data-testid="select-report-page-size"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600" data-testid="text-report-page-indicator">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(page - 1)}
            data-testid="button-report-page-prev"
          >
            <ChevronLeft size={14} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            disabled={page >= totalPages || isLoading}
            onClick={() => onPageChange(page + 1)}
            data-testid="button-report-page-next"
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
