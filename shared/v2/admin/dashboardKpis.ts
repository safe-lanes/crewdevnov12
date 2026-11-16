import type { KpiDefinition } from "./kpiTargets";

/** Read-only projection: no audit, grant, revision or editing information. */
export interface DashboardKpi {
  code: string;
  direction: KpiDefinition["direction"];
  unit: KpiDefinition["unit"];
  components: { code: string; value: string | null }[];
}
export interface DashboardKpis {
  year: number;
  scope: "company";
  kpis: DashboardKpi[];
}
