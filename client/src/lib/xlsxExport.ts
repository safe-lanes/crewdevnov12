import * as XLSX from "xlsx-js-style";

export interface SheetColumn {
  key: string;
  label: string;
  width?: number;
}

function cellValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

export function downloadXlsx(
  filename: string,
  columns: SheetColumn[],
  rows: Array<Record<string, unknown>>,
  sheetName: string = "Report",
): void {
  const header = columns.map((c) => c.label);
  const body = rows.map((row) => columns.map((c) => cellValue(row[c.key])));
  const aoa: Array<Array<string | number | boolean | null>> = [header, ...body];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const colWidths = columns.map((c, i) => {
    let max = c.label.length;
    for (const row of rows) {
      const v = row[c.key];
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = len;
    }
    return { wch: Math.min(Math.max(max + 2, 10), 50) };
  });
  (ws as XLSX.WorkSheet)["!cols"] = colWidths;

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    const cell = ws[addr];
    if (cell) {
      cell.s = { font: { bold: true } };
    }
  }

  const wb = XLSX.utils.book_new();
  const safeSheetName =
    (sheetName || "Report").replace(/[:\\/?*[\]]/g, "_").slice(0, 31).trim() ||
    "Report";
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

  const out = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out);
}

export interface XlsxSheet {
  sheetName: string;
  columns: SheetColumn[];
  rows: Array<Record<string, unknown>>;
  wrap?: boolean;
}

function buildSheet(
  columns: SheetColumn[],
  rows: Array<Record<string, unknown>>,
  wrap = false,
): XLSX.WorkSheet {
  const header = columns.map((c) => c.label);
  const body = rows.map((row) => columns.map((c) => cellValue(row[c.key])));
  const aoa: Array<Array<string | number | boolean | null>> = [header, ...body];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const colWidths = columns.map((c) => {
    if (typeof c.width === "number") return { wch: c.width };
    let max = c.label.length;
    for (const row of rows) {
      const v = row[c.key];
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = len;
    }
    return { wch: Math.min(Math.max(max + 2, 10), 60) };
  });
  (ws as XLSX.WorkSheet)["!cols"] = colWidths;

  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;
      const isHeader = r === 0;
      cell.s = {
        font: { bold: isHeader },
        alignment: {
          vertical: "top",
          wrapText: wrap,
          horizontal: "left",
        },
      };
    }
  }

  return ws;
}

function uniqueSheetName(name: string, used: Set<string>): string {
  const base =
    (name || "Sheet").replace(/[:\\/?*[\]]/g, "_").slice(0, 31).trim() || "Sheet";
  let candidate = base;
  let i = 1;
  while (used.has(candidate.toLowerCase())) {
    const suffix = `_${i++}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export function downloadXlsxMultiSheet(filename: string, sheets: XlsxSheet[]): void {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();

  const effectiveSheets = sheets.length
    ? sheets
    : [{ sheetName: "Report", columns: [], rows: [] }];

  for (const sheet of effectiveSheets) {
    const ws = buildSheet(sheet.columns, sheet.rows, sheet.wrap);
    XLSX.utils.book_append_sheet(wb, ws, uniqueSheetName(sheet.sheetName, used));
  }

  const out = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out);
}
