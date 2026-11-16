import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import type { DashboardKpis } from "../../../../shared/v2/admin/dashboardKpis";
import { normalizeKpiDecimal } from "../../../../shared/v2/admin/kpiTargets";

/** Caller must pass the Dashboard View guard; getDb uses the resolved tenant. */
export async function readDashboardKpis(year: number, tx: any = getDb()): Promise<DashboardKpis> {
  const rows = (await tx.execute(sql`SELECT k.code,k.direction,k.unit,c.code AS component,v.target_value::text AS value
    FROM kpi_definitions k JOIN kpi_components c ON c.kpi_uuid=k.kpi_uuid
    LEFT JOIN kpi_target_years y ON y.kpi_uuid=k.kpi_uuid AND y.year=${year} AND y.scope='company'
    LEFT JOIN kpi_target_values v ON v.target_year_uuid=y.target_year_uuid AND v.component_uuid=c.component_uuid
    WHERE k.active AND k.code IN ('retention','alcohol_violations','drug_violations')
    ORDER BY k.sort_order,k.code,c.sort_order,c.code`)).rows;
  const kpis: DashboardKpis["kpis"] = [];
  for (const row of rows) {
    let kpi = kpis.find(k => k.code === row.code);
    if (!kpi) {
      kpi = { code: row.code, direction: row.direction, unit: row.unit, components: [] };
      kpis.push(kpi);
    }
    kpi.components.push({ code: row.component, value: row.value == null ? null : normalizeKpiDecimal(row.value) });
  }
  return { year, scope: "company", kpis };
}
