import { kpiLine, kpiStatus, type ComparisonPeriod } from "./kpiComparison";
import type { DashboardKpi } from "@shared/v2/admin/dashboardKpis";

interface KpiDisplayProps {
  kpi?: DashboardKpi;
  componentCode: string;
  actual: number | null;
  comparisonPeriod: ComparisonPeriod;
  filtered: boolean;
  unavailable?: boolean;
  testId: string;
}

export function KpiDisplay({
  kpi,
  componentCode,
  actual,
  comparisonPeriod,
  filtered,
  unavailable = false,
  testId,
}: KpiDisplayProps) {
  const target = kpi?.components.find((component) => component.code === componentCode)?.value;
  if (!kpi || target == null) return null;

  const status = kpiStatus(unavailable ? null : actual, target, kpi.direction, comparisonPeriod, filtered);
  const reference = comparisonPeriod === "reference";
  const lineTone = reference ? "text-slate-400" : "text-[#5DADE2]";

  return (
    <div className="mt-1 space-y-0.5 text-xs leading-4" data-testid={`kpi-${testId}`}>
      <div className={lineTone}>{kpiLine(kpi, target)}</div>
      {status.status && <div className="font-medium text-slate-700">{status.status}</div>}
    </div>
  );
}
