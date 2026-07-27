/**
 * Vessel Portage category-major entry grids (task: category tabs rework).
 *
 * One grid per transaction-type tab (Overtime, Cash advances, Allotments,
 * Bond, Other deductions, configurable extras). Every crew member with
 * service in the period is pre-listed; the master types amounts directly
 * into cells, spreadsheet-style, on the shared AG Grid Enterprise wrapper.
 *
 * The grid itself is presentation-only: it renders rows built by the page,
 * reports cell edits upward (the page owns the dirty map and batch save)
 * and shows per-cell status dots (amber submitted / green accepted /
 * red rejected — click a rejected cell for the office comment).
 */
import { useMemo } from "react";
import type {
  CellClassParams,
  CellValueChangedEvent,
  ColDef,
  EditableCallbackParams,
  ICellRendererParams,
} from "ag-grid-community";
import AgGridTable from "@/components/AgGrid/AgGridTable";
import { formatMoney } from "../accountsFormat";

/** One entry cell: the saved transaction (if any) plus any unsaved edit. */
export interface EntryCell {
  txn?: any; // saved acc_monthly_transactions_v2 row
  value: string; // display/edit value ("" = no entry)
  dirty: boolean;
  /** per-cell hard lock (e.g. OT row without a resolved scale rate) */
  locked?: boolean;
}

export interface EntryRow {
  crewUuid: string;
  crewName: string;
  rank: string;
  engagementUuid: string;
  /** column id -> cell for editable entry columns */
  cells: Record<string, EntryCell>;
  /** column id -> display string for read-only info columns */
  info: Record<string, string>;
}

export interface EntryColumn {
  id: string;
  header: string;
  editable: boolean;
  /** read-only info column (rendered from row.info) */
  isInfo?: boolean;
  /** free-text column (remarks); default is numeric */
  isText?: boolean;
  width?: number;
}

const STATUS_DOT: Record<string, string> = {
  submitted: "#f59e0b",
  accepted: "#16a34a",
  rejected: "#dc2626",
};

function CellRenderer(props: ICellRendererParams) {
  const colId = props.colDef?.field ?? "";
  const row: EntryRow | undefined = props.data;
  if (!row) {
    // pinned totals row
    const v = props.value;
    return <span className="font-semibold">{v == null || v === "" ? "" : v}</span>;
  }
  const cell = row.cells[colId];
  if (!cell) {
    return <span>{row.info[colId] ?? ""}</span>;
  }
  const status = cell.txn?.status;
  const dot = status && STATUS_DOT[status];
  return (
    <span className="flex items-center gap-1.5">
      {dot && (
        <span
          className="inline-block h-2 w-2 rounded-full shrink-0"
          style={{ backgroundColor: dot }}
          title={
            status === "rejected" && cell.txn?.reviewComment
              ? `Rejected: ${cell.txn.reviewComment}`
              : status
          }
          data-testid={`dot-${status}-${row.crewUuid}-${colId}`}
        />
      )}
      <span className={cell.dirty ? "text-blue-700 font-medium" : ""}>
        {cell.value}
      </span>
    </span>
  );
}

export interface EntryGridProps {
  columns: EntryColumn[];
  rows: EntryRow[];
  /** whole-package edit gate (status window + lock + permission) */
  editable: boolean;
  onCellEdited: (crewUuid: string, columnId: string, value: string) => void;
  /** click on a rejected cell -> surface office comment */
  onRejectedCellClicked?: (txn: any) => void;
  testId?: string;
}

/** draft-only rule: accepted/rejected/submitted cells are vessel-read-only */
function cellEditable(
  params: EditableCallbackParams | CellClassParams,
  col: EntryColumn,
  gridEditable: boolean,
): boolean {
  if (!gridEditable || !col.editable) return false;
  const row: EntryRow | undefined = params.data;
  if (!row) return false; // pinned totals row
  const cell = row.cells[col.id];
  if (cell?.locked) return false;
  const status = cell?.txn?.status;
  return !status || status === "draft";
}

export default function EntryGrid({
  columns,
  rows,
  editable,
  onCellEdited,
  onRejectedCellClicked,
  testId,
}: EntryGridProps) {
  const columnDefs = useMemo<ColDef[]>(() => {
    const defs: ColDef[] = [
      {
        field: "crewName",
        headerName: "Crew",
        pinned: "left",
        editable: false,
        minWidth: 160,
        cellClass: "font-medium",
      },
      {
        field: "rank",
        headerName: "Rank",
        pinned: "left",
        editable: false,
        width: 110,
      },
    ];
    for (const col of columns) {
      defs.push({
        field: col.id,
        headerName: col.header,
        width: col.width ?? 130,
        type: col.isText ? undefined : "rightAligned",
        editable: (p: EditableCallbackParams) => cellEditable(p, col, editable),
        valueGetter: (p) => {
          const row: EntryRow | undefined = p.data;
          if (!row) return p.data?.[col.id] ?? ""; // totals row: plain values
          return row.cells[col.id]?.value ?? row.info[col.id] ?? "";
        },
        valueSetter: (p) => {
          const row: EntryRow | undefined = p.data;
          if (!row || !row.cells[col.id]) return false;
          const raw = String(p.newValue ?? "").trim();
          if (!col.isText && raw !== "" && Number.isNaN(Number(raw))) {
            return false; // amount cells accept numbers only
          }
          row.cells[col.id] = { ...row.cells[col.id], value: raw, dirty: true };
          return true;
        },
        cellRenderer: CellRenderer,
        cellClass: (p: CellClassParams) =>
          cellEditable(p, col, editable) ? "bg-blue-50/40" : "bg-slate-50/60",
      });
    }
    return defs;
  }, [columns, editable]);

  // Column totals row at the bottom of every grid (numeric columns only).
  const pinnedBottomRowData = useMemo(() => {
    const totals: Record<string, string> = { crewName: "Total", rank: "" };
    for (const col of columns) {
      if (col.isText) continue;
      let sum = 0;
      let any = false;
      for (const row of rows) {
        const v = row.cells[col.id]?.value ?? row.info[col.id] ?? "";
        const n = parseFloat(v);
        if (!Number.isNaN(n)) {
          sum += n;
          any = true;
        }
      }
      totals[col.id] = any ? formatMoney(sum.toFixed(2)) : "";
    }
    return [totals];
  }, [columns, rows]);

  const onCellValueChanged = (e: CellValueChangedEvent) => {
    const row: EntryRow | undefined = e.data;
    const colId = e.colDef.field ?? "";
    if (!row || !row.cells[colId]) return;
    onCellEdited(row.crewUuid, colId, row.cells[colId].value);
  };

  return (
    <div data-testid={testId}>
      <AgGridTable
        rowData={rows}
        columnDefs={columnDefs}
        autoHeight
        enableSideBar={false}
        enableStatusBar={false}
        enablePivoting={false}
        enableExport={false}
        gridOptions={{
          singleClickEdit: true,
          stopEditingWhenCellsLoseFocus: true,
          onCellValueChanged,
          pinnedBottomRowData,
          getRowId: (p) => p.data.crewUuid,
          suppressMovableColumns: true,
          onCellClicked: (e) => {
            const row: EntryRow | undefined = e.data;
            const colId = e.colDef.field ?? "";
            const txn = row?.cells[colId]?.txn;
            if (txn?.status === "rejected" && onRejectedCellClicked) {
              onRejectedCellClicked(txn);
            }
          },
          defaultColDef: {
            sortable: false,
            filter: false,
            resizable: true,
            suppressHeaderMenuButton: true,
          },
        }}
      />
    </div>
  );
}
