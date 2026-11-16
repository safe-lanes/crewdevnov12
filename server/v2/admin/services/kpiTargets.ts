import type { Request } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { resolveRequestRole } from "../../auth/roleResolutionService";
import { AccessControlError, appendAudit, authenticatedActor } from "./accessControlManagement";
import { normalizeKpiDecimal, type KpiDefinition, type KpiTargetPanel } from "../../../../shared/v2/admin/kpiTargets";

/** Reads use the KPIs menu. Writes additionally require the independent action. */
export async function kpiTargetAuthority(req: Request, tx: any = getDb(), lock = false): Promise<boolean> {
  const resolved = await resolveRequestRole(req, tx);
  if (!resolved.ok) return false;
  const result = await tx.execute(sql`SELECT g.allowed FROM adm_resource_action_grants g
    JOIN adm_rolemaster_ac r ON r.ruid=g.role_id
    WHERE g.role_id=${resolved.role.roleId} AND g.resource='kpi_targets' AND g.action='set'
      AND r.is_active AND NOT r.is_deleted ${lock ? sql`FOR SHARE OF g,r` : sql``}`);
  return result.rows[0]?.allowed === true;
}
async function requireKpiRead(req: Request, tx: any) {
  const resolved = await resolveRequestRole(req, tx);
  if (!resolved.ok) throw new AccessControlError("You do not have permission to view KPI settings.");
  const result = await tx.execute(sql`SELECT a.id FROM adm_roleaccess_ac a
    JOIN adm_menumaster_ac m ON m.muid=a.menu_id
    WHERE a.role_id=${resolved.role.roleId} AND lower(btrim(m.name))='kpis'
      AND m.is_active AND NOT m.is_deleted AND NOT a.is_deleted AND a.canview
    FOR SHARE OF a,m`);
  if (result.rows.length !== 1) throw new AccessControlError("You do not have permission to view KPI settings.");
}
export async function readKpiCatalogue(tx: any = getDb()): Promise<KpiDefinition[]> {
  const rows = (await tx.execute(sql`SELECT kpi_uuid AS "kpiUuid",code,label,menu_group AS "menuGroup",
    direction,unit,calculation_key AS "calculationKey",calculation_version AS "calculationVersion",
    period_basis AS "periodBasis" FROM kpi_definitions WHERE active ORDER BY sort_order,code`)).rows;
  const components = (await tx.execute(sql`SELECT kpi_uuid AS "kpiUuid",component_uuid AS "componentUuid",
    code,label FROM kpi_components ORDER BY sort_order,code`)).rows;
  return rows.map((row: any) => ({ ...row, components: components.filter((c: any) => c.kpiUuid === row.kpiUuid)
    .map(({ kpiUuid: _kpiUuid, ...c }: any) => c) }));
}
export function kpiYear(raw: string): number {
  if (!/^\d{4}$/.test(raw) || Number(raw) < 1900) throw new AccessControlError("Choose a year from 1900 to 9999.", 400);
  return Number(raw);
}
export async function readKpiTargets(req: Request, code: string, year: number, tx: any = getDb()): Promise<KpiTargetPanel> {
  const kpi = (await readKpiCatalogue(tx)).find(k => k.code === code);
  if (!kpi) throw new AccessControlError("This KPI could not be found. Refresh the list.", 404);
  const header = (await tx.execute(sql`SELECT target_year_uuid,revision FROM kpi_target_years
    WHERE kpi_uuid=${kpi.kpiUuid}::uuid AND year=${year} AND scope='company'`)).rows[0];
  const values: Record<string, string | null> = Object.fromEntries(kpi.components.map(c => [c.componentUuid, null]));
  if (header) for (const row of (await tx.execute(sql`SELECT component_uuid,target_value::text FROM kpi_target_values
    WHERE target_year_uuid=${header.target_year_uuid}::uuid`)).rows) values[row.component_uuid] = normalizeKpiDecimal(row.target_value);
  // Narrow projection only. Never expose actor identifiers or unrelated audit entries.
  const last = (await tx.execute(sql`SELECT actor_display_name AS name,recorded_at AS "recordedAt"
    FROM adm_access_control_audit WHERE event='kpi_target_changed' AND resource='kpi_targets'
      AND details->>'kpiUuid'=${kpi.kpiUuid} AND details->>'year'=${String(year)}
      AND details->>'scope'='company' ORDER BY recorded_at DESC,id DESC LIMIT 1`)).rows[0];
  return { kpi, year, revision: header?.revision ?? 0, values, lastChanged: last ?? null,
    canSetTargets: await kpiTargetAuthority(req, tx) };
}
const payloadSchema = z.object({
  revision: z.number().int().nonnegative(),
  values: z.record(z.string().uuid(), z.string().max(32).nullable()).refine(v => Object.keys(v).length > 0),
}).strict();
export async function saveKpiTargets(req: Request) {
  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) throw new AccessControlError("Supply target values and revision only. Identity and dates are recorded by the server.", 400);
  const year = kpiYear(req.params.year);
  return getDb().transaction(async (tx: any) => {
    await requireKpiRead(req, tx);
    if (!await kpiTargetAuthority(req, tx, true))
      throw new AccessControlError("You do not have permission to set KPI targets.");
    const kpi = (await readKpiCatalogue(tx)).find(k => k.code === req.params.code);
    if (!kpi) throw new AccessControlError("This KPI could not be found. Refresh the list.", 404);
    const values: Record<string, string | null> = {};
    for (const [component, raw] of Object.entries(parsed.data.values)) {
      if (!kpi.components.some(c => c.componentUuid === component))
        throw new AccessControlError("A target component does not belong to this KPI. Refresh and retry.", 400);
      let value: string | null = null;
      try { value = raw === null ? null : normalizeKpiDecimal(raw); }
      catch { throw new AccessControlError("Enter a non-negative target with at most six decimal places, or clear the field.", 400); }
      if (value !== null && ((kpi.unit === "percentage" && Number(value) > 100) || (kpi.unit === "count" && value.includes("."))))
        throw new AccessControlError(kpi.unit === "percentage" ? "Enter a percentage from 0 to 100." : "Enter a whole-number count of zero or more.", 400);
      values[component] = value;
    }
    // Serializes first insert as well as updates. Database-local key includes year.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`kpi:${kpi.kpiUuid}:${year}`},0))`);
    const before = await readKpiTargets(req, kpi.code, year, tx);
    if (before.revision !== parsed.data.revision) throw new AccessControlError("These targets changed while you were editing. Reload before saving.", 409);
    const changed = Object.entries(values).filter(([id, value]) => before.values[id] !== value);
    if (!changed.length) return before;
    const actor = await authenticatedActor(req, tx);
    const header = (await tx.execute(sql`INSERT INTO kpi_target_years(kpi_uuid,year,created_by,updated_by,revision)
      VALUES (${kpi.kpiUuid}::uuid,${year},${String(actor.masterUserId)},${String(actor.masterUserId)},1)
      ON CONFLICT(kpi_uuid,year,scope) DO UPDATE SET revision=kpi_target_years.revision+1,
        updated_by=EXCLUDED.updated_by,updated_at=now() RETURNING target_year_uuid`)).rows[0];
    for (const [id, value] of changed) {
      if (value === null) await tx.execute(sql`DELETE FROM kpi_target_values
        WHERE target_year_uuid=${header.target_year_uuid}::uuid AND component_uuid=${id}::uuid`);
      else await tx.execute(sql`INSERT INTO kpi_target_values(target_year_uuid,component_uuid,kpi_uuid,target_value)
        VALUES (${header.target_year_uuid}::uuid,${id}::uuid,${kpi.kpiUuid}::uuid,${value}::numeric)
        ON CONFLICT(target_year_uuid,component_uuid) DO UPDATE SET target_value=EXCLUDED.target_value`);
      await appendAudit(tx, { ...actor, source: "kpi_targets" }, "kpi_target_changed", null,
        "kpi_targets", "set", before.values[id], value, {
          kpiUuid: kpi.kpiUuid, kpiLabel: kpi.label, componentUuid: id,
          componentLabel: kpi.components.find(c => c.componentUuid === id)!.label,
          direction: kpi.direction, unit: kpi.unit, year, scope: "company",
        });
    }
    return readKpiTargets(req, kpi.code, year, tx);
  });
}
