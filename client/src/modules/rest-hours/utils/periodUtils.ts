// Shared helpers for multi-month period handling in dashboard drilldown dialogs.

/**
 * Enumerate all months (YYYY-MM) covered by a date range (YYYY-MM-DD inclusive).
 */
export function enumerateMonths(dateFrom: string, dateTo: string): string[] {
  const [fy, fm] = dateFrom.split('-').map(Number);
  const [ty, tm] = dateTo.split('-').map(Number);
  const months: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}
