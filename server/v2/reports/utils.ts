import type {
  ReportColumn,
  ReportHandlerContext,
  ReportResultRow,
} from "./types";

export function applySortAndPaginate(
  rows: ReportResultRow[],
  ctx: ReportHandlerContext,
  defaultSortKey?: string,
): { rows: ReportResultRow[]; total: number } {
  const total = rows.length;
  const sortKey = ctx.sort?.key ?? defaultSortKey ?? null;
  const sortDir = ctx.sort?.direction ?? "asc";

  let sorted = rows;
  if (sortKey) {
    sorted = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      const cmp = as.localeCompare(bs);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const start = (ctx.page - 1) * ctx.pageSize;
  const paged = sorted.slice(start, start + ctx.pageSize);
  return { rows: paged, total };
}

export function pickColumns<T extends ReportResultRow>(
  rows: T[],
  columns: ReportColumn[],
): ReportResultRow[] {
  const keys = columns.map((c) => c.key);
  return rows.map((row) => {
    const out: ReportResultRow = {};
    for (const k of keys) out[k] = row[k] ?? null;
    return out;
  });
}
