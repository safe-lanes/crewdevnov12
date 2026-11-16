import type { PeriodFilterValue } from "@/components/filters/PeriodFilter";
import type { DashboardKpi } from "@shared/v2/admin/dashboardKpis";

export interface KpiRange { from: string; to: string }
export type ComparisonPeriod = "reference" | "final" | "in-progress";
export const COMPANY_KPI_REFERENCE = "Company-wide target — shown for reference while filters are applied.";
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function validDate(d: Date | undefined): d is Date {
  return d instanceof Date && Number.isFinite(d.getTime());
}
export function dashboardRange(p: PeriodFilterValue): KpiRange | null {
  let from: Date, to: Date;
  if (p.mode === "date-range") {
    if (!validDate(p.dateFrom) || !validDate(p.dateTo)) return null;
    from = p.dateFrom; to = p.dateTo;
  } else {
    if (!Number.isInteger(p.year) || p.year! < 1900 || p.year! > 9999) return null;
    if (p.mode === "year") {
      from = new Date(p.year!, 0, 1); to = new Date(p.year!, 11, 31);
    } else if (p.mode === "year-quarter" && Number.isInteger(p.quarter) && p.quarter! >= 1 && p.quarter! <= 4) {
      from = new Date(p.year!, (p.quarter! - 1) * 3, 1); to = new Date(p.year!, p.quarter! * 3, 0);
    } else if (p.mode === "year-month" && Number.isInteger(p.month) && p.month! >= 1 && p.month! <= 12) {
      from = new Date(p.year!, p.month! - 1, 1); to = new Date(p.year!, p.month!, 0);
    } else return null;
  }
  return iso(from) <= iso(to) ? { from: iso(from), to: iso(to) } : null;
}
export function rollingRetentionRange(today: Date): KpiRange {
  const year = today.getFullYear() - 2, month = today.getMonth();
  const clamped = Math.min(today.getDate(), new Date(year, month + 1, 0).getDate());
  const start = new Date(year, month, clamped + 1);
  return { from: iso(start), to: iso(today) };
}
function wholeYears(range: KpiRange | null): number {
  if (!range || !range.from.endsWith("-01-01") || !range.to.endsWith("-12-31")) return 0;
  return Number(range.to.slice(0, 4)) - Number(range.from.slice(0, 4)) + 1;
}
export function kpiYearForRange(range: KpiRange | null): number | null {
  return range ? Number(range.to.slice(0, 4)) : null;
}
export function retentionComparisonPeriod(range: KpiRange | null, explicitlySelected: boolean): ComparisonPeriod {
  return range && (!explicitlySelected || wholeYears(range) === 2) ? "final" : "reference";
}
export function daComparisonPeriod(range: KpiRange | null, today: Date): ComparisonPeriod {
  if (wholeYears(range) !== 1) return "reference";
  const year = kpiYearForRange(range)!;
  return year < today.getFullYear() ? "final" : year === today.getFullYear() ? "in-progress" : "reference";
}
export function rangeLabel(range: KpiRange | null): string {
  if (!range) return "Period not available";
  const label = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return `${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]} ${y}`;
  };
  return `${label(range.from)} – ${label(range.to)}`;
}
// Compare decimal representations exactly, including exponent notation for actuals.
// No conversion of a saved numeric target to a floating-point Number.
function decimal(value: string): { value: bigint; scale: number } {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value);
  if (!match) throw Error("Invalid decimal");
  const fraction = match[3] ?? "";
  const scale = fraction.length - Number(match[4] ?? 0);
  const n = BigInt(`${match[1]}${match[2]}${fraction}`);
  return scale < 0 ? { value: n * 10n ** BigInt(-scale), scale: 0 } : { value: n, scale };
}
export function meetsKpi(actual: number, target: string, direction: DashboardKpi["direction"]): boolean {
  const a = decimal(String(actual)), b = decimal(target), scale = Math.max(a.scale, b.scale);
  const av = a.value * 10n ** BigInt(scale - a.scale), bv = b.value * 10n ** BigInt(scale - b.scale);
  return direction === "minimum" ? av >= bv : av <= bv;
}
export function kpiStatus(actual: number | null | undefined, target: string | null | undefined,
  direction: DashboardKpi["direction"] | undefined, period: ComparisonPeriod, filtered: boolean):
  { status: "Met" | "Missed" | "Within KPI so far" | null; tone: "neutral" | "met" | "missed" } {
  if (filtered || period === "reference" || actual == null || !Number.isFinite(actual) || target == null || !direction)
    return { status: null, tone: "neutral" };
  const met = meetsKpi(actual, target, direction);
  if (!met) return { status: "Missed", tone: "missed" };
  return period === "in-progress" ? { status: "Within KPI so far", tone: "neutral" } : { status: "Met", tone: "met" };
}
export function kpiLine(kpi: DashboardKpi, value: string): string {
  return `KPI: ${kpi.direction === "minimum" ? "At least" : "At most"} ${value}${kpi.unit === "percentage" ? "%" : ""}`;
}
