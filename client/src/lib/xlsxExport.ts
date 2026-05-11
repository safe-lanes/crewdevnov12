import * as XLSX from "xlsx-js-style";

export interface SheetColumn {
  key: string;
  label: string;
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
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  const out = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, out);
}
