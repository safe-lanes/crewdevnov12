export interface KpiComponent {
  componentUuid: string;
  code: string;
  label: string;
}
export interface KpiDefinition {
  kpiUuid: string;
  code: string;
  label: string;
  menuGroup: string;
  direction: "minimum" | "maximum";
  unit: "percentage" | "count" | "score" | "rate";
  calculationKey: string;
  calculationVersion: string;
  periodBasis: string;
  components: KpiComponent[];
}
export interface KpiTargetPanel {
  kpi: KpiDefinition;
  year: number;
  revision: number;
  values: Record<string, string | null>;
  lastChanged: { name: string; recordedAt: string } | null;
  canSetTargets: boolean;
}
/** Decimal strings preserve exact values and make format-only saves no-ops. */
export function normalizeKpiDecimal(value: string): string {
  if (!/^\d{1,15}(?:\.\d{1,6})?$/.test(value)) throw new Error("Enter a non-negative number with at most six decimal places.");
  const [integer, fraction = ""] = value.split(".");
  const head = integer.replace(/^0+(?=\d)/, "");
  const tail = fraction.replace(/0+$/, "");
  return tail ? `${head}.${tail}` : head;
}
