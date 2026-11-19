/**
 * Lookups used before a query when a name is uncertain (stage 2, PILOT TRIAL): vessels and crew members.
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { ON_BOARD_OB, fullNameOf, vesselNameOf } from "./definitions";
import { num, refuse, ToolRefusal, type ToolContext } from "./common";
import type { Query } from "../repositories/assistantDataRepository";

export const resolveVesselArgs = z.object({ name: z.string().trim().min(1).max(120) }).strict();
export const findCrewArgs = z.object({ name: z.string().trim().min(2).max(120) }).strict();

export async function resolveVessel(q: Query, ctx: ToolContext, a: z.infer<typeof resolveVesselArgs>) {
  const like = "%" + a.name.replace(/[%_\\]/g, "\\$&") + "%";
  const rows = await q(sql`SELECT DISTINCT ON (vessel_uuid) vessel_uuid, vessel, (lower(btrim(vessel)) = lower(${a.name})) AS exact
    FROM master_vessels WHERE is_deleted IS NOT TRUE AND vessel ILIKE ${like} ORDER BY vessel_uuid, id`);
  const exact = rows.filter((r) => r.exact === true);
  const matches = (exact.length ? exact : rows).slice(0, 5).map((r) => ({ vesselId: String(r.vessel_uuid), vesselName: String(r.vessel) }));
  return { ok: true as const, area: "vessels", asOf: ctx.asOf, total: exact.length || rows.length, matches,
    note: matches.length === 0 ? "No vessel with that name in this company." : matches.length > 1 ? "Several vessels match — ask the user which one." : undefined };
}

export async function findCrew(q: Query, ctx: ToolContext, a: z.infer<typeof findCrewArgs>) {
  const tokens = a.name.split(/\s+/).filter((t) => t.length >= 2).slice(0, 4);
  if (!tokens.length) throw new ToolRefusal(refuse("invalid_args", "Give at least two letters of the name."));
  const name = fullNameOf("cm");
  const conds = tokens.map((t) => sql`${name} ILIKE ${"%" + t.replace(/[%_\\]/g, "\\$&") + "%"}`);
  const where = sql`cm.is_deleted = false AND cm.archived_at IS NULL AND ${sql.join(conds, sql` AND `)}`;
  const vesselVisible = ctx.canView("vessel");
  const onBoardVessel = sql`(SELECT ob.vessel_uuid FROM vessel_planning_v2 ob WHERE ob.crew_uuid = cm.crew_uuid AND ${ON_BOARD_OB}
    ORDER BY (ob.crew_status = 'primary') DESC, ob.id LIMIT 1)`;
  const [tot] = await q(sql`SELECT count(*)::int AS n FROM crew_members_v2 cm WHERE ${where}`);
  const rows = await q(sql`SELECT cm.crew_uuid AS "crewId", ${name} AS "fullName", cm.present_rank AS "rank",
      ${vesselVisible ? vesselNameOf(onBoardVessel) : sql`NULL::text`} AS "vesselName"
    FROM crew_members_v2 cm WHERE ${where} ORDER BY ${name}, cm.crew_uuid LIMIT 5`);
  return { ok: true as const, area: "crew", asOf: ctx.asOf, total: num(tot?.n), returned: rows.length, matches: rows,
    note: num(tot?.n) > rows.length ? "More people match — ask the user to be more specific." : undefined };
}
