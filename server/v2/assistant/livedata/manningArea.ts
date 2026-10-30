/**
 * Live-data area (Part B5): vessel manning and vacancies — Sahil's decision of 29-Oct-2026 ("if a seafarer has signed on he
 * fills a position, else not").
 *
 * One base row = ONE position: a vessel_planning_v2 row with crew_status 'primary' (empty slots included), not archived/deleted,
 * on an ACTIVE vessel. A position is FILLED when its person has signed on, or when a signed-on reliever (secondary row for the
 * same vessel, rank id and rank) is on board during a handover. States: filled · vacant (no person) · vacant_not_signed_on
 * (a person is planned but has not signed on). Ranks follow Rank Administration (A5).
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { DEFINITIONS, dateOf, fullNameOf, normalizeRankText, rankKeyOf, vesselNameOf } from "./definitions";
import { RANK_GROUP_NAMES, classifiedCondition, groupCondition, groupLabelExpr, loadRankConfig, rankConfigReport } from "./rankConfig";
import { inList, num, pagingSchema, resolveRanks, resolveVesselNames, runArea, type AreaQuery, type ToolContext } from "./common";
import type { Query } from "../repositories/assistantDataRepository";

const GROUP_KEYS = ["vesselName", "rank", "rankGroup", "state"] as const;

export const manningArgs = z
  .object({
    mode: z.enum(["list", "count", "group"]).default("group"),
    groupBy: z.array(z.enum(GROUP_KEYS)).min(1).max(2).optional(),
    /** vacant = both vacancy kinds; filled; any (default) */
    state: z.enum(["vacant", "filled", "any"]).default("any"),
    vessels: z.array(z.string().trim().min(1).max(120)).min(1).max(10).optional(),
    ranks: z.array(z.string().trim().min(1).max(60)).min(1).max(20).optional(),
    rankGroups: z.array(z.enum(RANK_GROUP_NAMES as unknown as [string, ...string[]])).min(1).optional(),
    sort: z.enum(["vessel", "rank"]).default("vessel"),
    ...pagingSchema,
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.mode === "group" && !a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is required when mode is group" });
    if (a.mode !== "group" && a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is only allowed when mode is group" });
  });
export type ManningArgs = z.infer<typeof manningArgs>;

export async function queryManning(q: Query, ctx: ToolContext, a: ManningArgs) {
  const vessels = a.vessels ? await resolveVesselNames(q, a.vessels) : undefined;
  const ranks = a.ranks ? await resolveRanks(q, a.ranks, normalizeRankText, rankKeyOf) : undefined;
  const cfg = await loadRankConfig(q);
  const usesGroups = !!a.rankGroups || !!a.groupBy?.includes("rankGroup");
  const rankKey = rankKeyOf(sql`vp.rank`);
  const rankId = sql`btrim(vp.rank_id)`;

  const signedOn = sql`(vp.crew_uuid IS NOT NULL AND vp.sign_on_date IS NOT NULL)`;
  const relieverOnBoard = sql`EXISTS (SELECT 1 FROM vessel_planning_v2 s WHERE s.vessel_uuid = vp.vessel_uuid AND s.rank_id = vp.rank_id AND s.rank = vp.rank
    AND s.crew_status = 'secondary' AND s.is_archived = false AND s.is_deleted = false AND s.crew_uuid IS NOT NULL AND s.sign_on_date IS NOT NULL)`;
  const stateExpr = sql`(CASE WHEN ${signedOn} OR ${relieverOnBoard} THEN 'filled' WHEN vp.crew_uuid IS NULL THEN 'vacant' ELSE 'vacant_not_signed_on' END)`;

  const conds: SQL[] = [
    sql`vp.crew_status = 'primary'`, sql`vp.is_archived = false`, sql`vp.is_deleted = false`, sql`vp.vessel_uuid IS NOT NULL`,
    sql`EXISTS (SELECT 1 FROM master_vessels mv WHERE mv.vessel_uuid = vp.vessel_uuid AND mv.is_deleted IS NOT TRUE AND COALESCE(mv.is_active, true) = true)`,
  ];
  if (vessels) conds.push(inList(sql`vp.vessel_uuid`, vessels.map((v) => v.vesselId)));
  if (ranks) conds.push(inList(rankKey, ranks));
  const groupCond = a.rankGroups ? groupCondition(cfg, a.rankGroups, rankId, rankKey) : null;
  const withGroup = groupCond ? [groupCond] : [];
  const stateConds: SQL[] = a.state === "vacant" ? [sql`${stateExpr} <> 'filled'`] : a.state === "filled" ? [sql`${stateExpr} = 'filled'`] : [];

  const from = sql`FROM vessel_planning_v2 vp LEFT JOIN crew_members_v2 cm ON cm.crew_uuid = vp.crew_uuid`;
  const where = (extra: SQL[]) => sql`WHERE ${sql.join([...conds, ...extra], sql` AND `)}`;

  const base = sql`SELECT 'P' || vp.id AS row_id, vp.crew_uuid, ${vesselNameOf(sql`vp.vessel_uuid`)} AS vessel_name,
      regexp_replace(btrim(vp.rank), '_[0-9]+$', '') AS rank, ${groupLabelExpr(cfg, rankId, rankKey)} AS rank_group, ${stateExpr} AS state,
      NULLIF(${fullNameOf("cm")}, '') AS full_name, ${dateOf(sql`vp.sign_on_date`)} AS sign_on, ${relieverOnBoard} AS reliever_on_board
    ${from} ${where([...stateConds, ...withGroup])}`;

  const area: AreaQuery = {
    base,
    rowUnit: "positions",
    rowColumns: [
      ["vesselName", sql`b.vessel_name`], ["rank", sql`b.rank`], ["state", sql`b.state`], ["fullName", sql`b.full_name`],
      ["signOnDate", sql`to_char(b.sign_on, 'YYYY-MM-DD')`], ["relieverOnBoard", sql`b.reliever_on_board`], ["crewId", sql`b.crew_uuid`],
    ],
    personColumns: [["fullName", sql`min(b.full_name)`], ["vesselName", sql`min(b.vessel_name)`], ["rank", sql`min(b.rank)`], ["crewId", sql`b.crew_uuid`]],
    rowSort: a.sort === "rank" ? sql`b.rank_group, b.rank, b.vessel_name` : sql`b.vessel_name NULLS LAST, b.rank_group, b.rank`,
    personSort: sql`min(b.vessel_name) NULLS LAST, min(b.rank)`,
    groupKeys: { vesselName: sql`b.vessel_name`, rank: sql`b.rank`, rankGroup: sql`b.rank_group`, state: sql`b.state` },
  };
  const result = await runArea(q, area, { ...a, unit: "positions" });

  // the manning picture over the SAME filters regardless of the state filter: positions / filled / vacant
  const [s] = await q(sql`SELECT count(*)::int AS positions, count(*) FILTER (WHERE ${stateExpr} = 'filled')::int AS filled,
      count(*) FILTER (WHERE ${stateExpr} = 'vacant')::int AS vacant, count(*) FILTER (WHERE ${stateExpr} = 'vacant_not_signed_on')::int AS vacant_not_signed_on
    ${from} ${where(withGroup)}`);
  const summary = { positions: num(s?.positions), filled: num(s?.filled), vacant: num(s?.vacant), vacantNotSignedOn: num(s?.vacant_not_signed_on) };

  let rankConfig: Record<string, unknown> | undefined;
  if (usesGroups) {
    const [u] = await q(sql`SELECT count(*)::int AS positions, array_remove(array_agg(DISTINCT regexp_replace(btrim(vp.rank), '_[0-9]+$', '')), NULL) AS ranks
      ${from} ${where([...stateConds, sql`NOT ${classifiedCondition(cfg, rankId, rankKey)}`])}`);
    rankConfig = { ...rankConfigReport(cfg), unclassifiedPositions: { positions: num(u?.positions), ranks: (u?.ranks as string[] | null) ?? [] } };
  }

  return {
    ok: true as const,
    area: "manning",
    asOf: ctx.asOf,
    mode: a.mode,
    unit: "positions",
    query: { ...a, vessels: vessels?.map((v) => ({ vesselName: v.vesselName })) },
    definitions: [DEFINITIONS.manning, DEFINITIONS.onBoard, ...(usesGroups ? [DEFINITIONS.rankGroups] : [])],
    ...result,
    summary,
    ...(rankConfig ? { rankConfig } : {}),
  };
}
