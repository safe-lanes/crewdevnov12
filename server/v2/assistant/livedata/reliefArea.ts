/**
 * Live-data area (Part B2): relief due — the Due Crew screen rule, Sahil's decision of 29-Oct-2026.
 *
 * One base row = ONE on-board assignment (Vessel-screen rule). CODE (rotation/services/dueCrewService.ts):
 *   contract end = sign-on + contract_end_range_start_months, else + contract_period_months, else the recorded relief-due date;
 *   range end    = sign-on + contract_end_range_end_months, else the contract end;
 *   overdue      = range end before the as-of date;
 *   due within a period = recorded relief-due date inside [as-of, period end], or already overdue.
 * The recorded relief-due date (vessel_planning_v2.relief_due) is returned and flagged when it differs from the contract end
 * (B2: the two should agree — at sign-on it is auto-calculated from the same inputs).
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { DEFINITIONS, ON_BOARD_VP, dateOf, fullNameOf, hasText, normalizeRankText, rankKeyOf, vesselNameOf, windowBounds } from "./definitions";
import { RANK_GROUP_NAMES, classifiedCondition, groupCondition, groupLabelExpr, loadRankConfig, rankConfigReport } from "./rankConfig";
import { inList, num, pagingSchema, resolveRanks, resolveVesselNames, runArea, windowSchema, type AreaQuery, type ToolContext } from "./common";
import type { Query } from "../repositories/assistantDataRepository";

const GROUP_KEYS = ["vesselName", "rank", "rankGroup", "dueState"] as const;

export const reliefArgs = z
  .object({
    mode: z.enum(["list", "count", "group"]).default("list"),
    groupBy: z.array(z.enum(GROUP_KEYS)).min(1).max(2).optional(),
    /** due within a forward window from the as-of date (Due Crew "due in N months"); omitted = no period */
    dueWithin: windowSchema.optional(),
    /** overdue = past the range end; due = inside the window (or overdue); any = every on-board assignment */
    dueState: z.enum(["overdue", "due", "any"]).optional(),
    vessels: z.array(z.string().trim().min(1).max(120)).min(1).max(10).optional(),
    ranks: z.array(z.string().trim().min(1).max(60)).min(1).max(20).optional(),
    rankGroups: z.array(z.enum(RANK_GROUP_NAMES as unknown as [string, ...string[]])).min(1).optional(),
    crewIds: z.array(z.string().trim().min(8).max(64)).min(1).max(20).optional(),
    sort: z.enum(["contract_end_asc", "relief_due_asc", "vessel", "name"]).default("contract_end_asc"),
    ...pagingSchema,
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.mode === "group" && !a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is required when mode is group" });
    if (a.mode !== "group" && a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is only allowed when mode is group" });
    if (a.dueWithin && a.dueWithin.direction !== "next") ctx.addIssue({ code: "custom", message: "dueWithin must look forward (direction next)" });
  });
export type ReliefArgs = z.infer<typeof reliefArgs>;

export async function queryRelief(q: Query, ctx: ToolContext, a: ReliefArgs) {
  const vessels = a.vessels ? await resolveVesselNames(q, a.vessels) : undefined;
  const ranks = a.ranks ? await resolveRanks(q, a.ranks, normalizeRankText, rankKeyOf) : undefined;
  const cfg = await loadRankConfig(q);
  const usesGroups = !!a.rankGroups || !!a.groupBy?.includes("rankGroup");
  const rankKey = rankKeyOf(sql`vp.rank`);
  const rankId = sql`btrim(vp.rank_id)`;
  const state = a.dueState ?? (a.dueWithin ? "due" : "any");

  const signOn = dateOf(sql`vp.sign_on_date`);
  const reliefDue = dateOf(sql`vp.relief_due`);
  const contractEnd = sql`(CASE
    WHEN ${signOn} IS NOT NULL AND COALESCE(vp.contract_end_range_start_months, vp.contract_period_months) IS NOT NULL
      THEN (${signOn} + make_interval(months => COALESCE(vp.contract_end_range_start_months, vp.contract_period_months)))::date
    ELSE ${reliefDue} END)`;
  const rangeEnd = sql`(CASE
    WHEN ${signOn} IS NOT NULL AND vp.contract_end_range_end_months IS NOT NULL THEN (${signOn} + make_interval(months => vp.contract_end_range_end_months))::date
    ELSE ${contractEnd} END)`;
  const overdue = sql`(${rangeEnd} IS NOT NULL AND ${rangeEnd} < ${ctx.asOf}::date)`;
  let windowTo: SQL | null = null;
  let windowText: { from: string; to: string } | undefined;
  if (a.dueWithin) {
    const w = windowBounds(ctx.asOf, a.dueWithin);
    windowTo = w.to;
    const [r] = await q(sql`SELECT to_char(${w.from}, 'YYYY-MM-DD') AS f, to_char(${w.to}, 'YYYY-MM-DD') AS t`);
    windowText = { from: String(r?.f), to: String(r?.t) };
  }
  const dueInWindow = windowTo ? sql`(${reliefDue} >= ${ctx.asOf}::date AND ${reliefDue} <= ${windowTo})` : sql`FALSE`;
  const dueStateExpr = sql`(CASE WHEN ${overdue} THEN 'overdue' WHEN ${dueInWindow} THEN 'due' ELSE 'not_due' END)`;

  const conds: SQL[] = [ON_BOARD_VP];
  if (vessels) conds.push(inList(sql`vp.vessel_uuid`, vessels.map((v) => v.vesselId)));
  if (ranks) conds.push(inList(rankKey, ranks));
  if (a.crewIds) conds.push(inList(sql`vp.crew_uuid`, a.crewIds));
  const groupCond = a.rankGroups ? groupCondition(cfg, a.rankGroups, rankId, rankKey) : null;
  const withGroup = groupCond ? [groupCond] : [];
  const stateConds: SQL[] = state === "overdue" ? [overdue] : state === "due" ? [sql`(${overdue} OR ${dueInWindow})`] : [];

  const from = sql`FROM vessel_planning_v2 vp LEFT JOIN crew_members_v2 cm ON cm.crew_uuid = vp.crew_uuid`;
  const where = (extra: SQL[]) => sql`WHERE ${sql.join([...conds, ...extra], sql` AND `)}`;
  const relieverName = sql`(SELECT TRIM(BOTH ' ' FROM CONCAT_WS(' ', NULLIF(r.first_name, ''), NULLIF(r.family_name, ''))) FROM crew_members_v2 r WHERE r.crew_uuid = vp.reliever_crew_uuid LIMIT 1)`;

  const base = sql`SELECT 'A' || vp.id AS row_id, vp.crew_uuid, ${vesselNameOf(sql`vp.vessel_uuid`)} AS vessel_name,
      COALESCE(NULLIF(${fullNameOf("cm")}, ''), '(no crew record)') AS full_name, regexp_replace(btrim(vp.rank), '_[0-9]+$', '') AS rank,
      ${groupLabelExpr(cfg, rankId, rankKey)} AS rank_group, vp.crew_status, ${signOn} AS sign_on,
      COALESCE(vp.contract_end_range_start_months, vp.contract_period_months) AS contract_months, vp.contract_end_range_end_months AS range_end_months,
      ${contractEnd} AS contract_end, ${rangeEnd} AS range_end, ${reliefDue} AS relief_due,
      (${reliefDue} IS NOT NULL AND ${contractEnd} IS NOT NULL AND ${reliefDue} <> ${contractEnd}) AS relief_due_differs,
      ${dueStateExpr} AS due_state, ${relieverName} AS planned_reliever_name, vp.reliever_sign_on_date AS planned_reliever_sign_on
    ${from} ${where([...stateConds, ...withGroup])}`;

  const area: AreaQuery = {
    base,
    rowUnit: "assignments",
    rowColumns: [
      ["fullName", sql`b.full_name`], ["rank", sql`b.rank`], ["vesselName", sql`b.vessel_name`], ["crewStatus", sql`b.crew_status`],
      ["signOnDate", sql`to_char(b.sign_on, 'YYYY-MM-DD')`], ["contractMonths", sql`b.contract_months`],
      ["contractEndDate", sql`to_char(b.contract_end, 'YYYY-MM-DD')`], ["rangeEndDate", sql`to_char(b.range_end, 'YYYY-MM-DD')`],
      ["reliefDueDate", sql`to_char(b.relief_due, 'YYYY-MM-DD')`], ["reliefDueDiffers", sql`b.relief_due_differs`], ["dueState", sql`b.due_state`],
      ["plannedRelieverName", sql`b.planned_reliever_name`], ["plannedRelieverSignOn", sql`b.planned_reliever_sign_on`], ["crewId", sql`b.crew_uuid`],
    ],
    personColumns: [
      ["fullName", sql`min(b.full_name)`], ["rank", sql`string_agg(DISTINCT b.rank, ' / ')`], ["vesselName", sql`string_agg(DISTINCT b.vessel_name, ' / ')`],
      ["contractEndDate", sql`to_char(min(b.contract_end), 'YYYY-MM-DD')`], ["reliefDueDate", sql`to_char(min(b.relief_due), 'YYYY-MM-DD')`],
      ["dueState", sql`min(b.due_state)`], ["crewId", sql`b.crew_uuid`],
    ],
    rowSort: a.sort === "relief_due_asc" ? sql`b.relief_due ASC NULLS LAST` : a.sort === "vessel" ? sql`b.vessel_name NULLS LAST, b.contract_end NULLS LAST`
      : a.sort === "name" ? sql`b.full_name` : sql`b.contract_end ASC NULLS LAST, b.vessel_name`,
    personSort: a.sort === "relief_due_asc" ? sql`min(b.relief_due) ASC NULLS LAST` : a.sort === "vessel" ? sql`min(b.vessel_name) NULLS LAST`
      : a.sort === "name" ? sql`min(b.full_name)` : sql`min(b.contract_end) ASC NULLS LAST`,
    groupKeys: { vesselName: sql`b.vessel_name`, rank: sql`b.rank`, rankGroup: sql`b.rank_group`, dueState: sql`b.due_state` },
  };
  const result = await runArea(q, area, { ...a, unit: "assignments" });

  // assignments with no usable date at all (no readable sign-on + contract months, and no readable relief-due) — reported, not dropped
  const [x] = await q(sql`SELECT
      count(*) FILTER (WHERE ${contractEnd} IS NULL)::int AS no_due_date,
      count(*) FILTER (WHERE ${hasText(sql`vp.relief_due`)} AND ${reliefDue} IS NULL)::int AS unreadable_relief_due,
      count(*) FILTER (WHERE ${hasText(sql`vp.sign_on_date`)} AND ${signOn} IS NULL)::int AS unreadable_sign_on,
      count(*) FILTER (WHERE ${reliefDue} IS NOT NULL AND ${contractEnd} IS NOT NULL AND ${reliefDue} <> ${contractEnd})::int AS relief_due_differs
    ${from} ${where(withGroup)}`);
  const excluded = { noDueDate: num(x?.no_due_date), unreadableReliefDueDate: num(x?.unreadable_relief_due), unreadableSignOnDate: num(x?.unreadable_sign_on) };
  const notes: string[] = [];
  if (num(x?.relief_due_differs) > 0) notes.push(`${num(x?.relief_due_differs)} assignment(s) have a recorded relief-due date that differs from the contract end (Due Crew rule) — both dates are shown.`);

  let rankConfig: Record<string, unknown> | undefined;
  if (usesGroups) {
    const [u] = await q(sql`SELECT count(*)::int AS assignments, count(DISTINCT vp.crew_uuid)::int AS people,
        array_remove(array_agg(DISTINCT regexp_replace(btrim(vp.rank), '_[0-9]+$', '')), NULL) AS ranks
      ${from} ${where([...stateConds, sql`NOT ${classifiedCondition(cfg, rankId, rankKey)}`])}`);
    rankConfig = { ...rankConfigReport(cfg), unclassifiedOnBoard: { assignments: num(u?.assignments), people: num(u?.people), ranks: (u?.ranks as string[] | null) ?? [] } };
  }

  return {
    ok: true as const,
    area: "relief",
    asOf: ctx.asOf,
    mode: a.mode,
    unit: "assignments",
    query: { ...a, dueState: state, vessels: vessels?.map((v) => ({ vesselName: v.vesselName })) },
    ...(windowText ? { dueWindow: windowText } : {}),
    definitions: [DEFINITIONS.relief, DEFINITIONS.onBoard, ...(usesGroups ? [DEFINITIONS.rankGroups] : []), DEFINITIONS.dates],
    ...result,
    excluded,
    ...(notes.length ? { notes } : {}),
    ...(rankConfig ? { rankConfig } : {}),
  };
}
