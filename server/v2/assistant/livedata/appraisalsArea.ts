/**
 * Live-data area (Part B6): appraisal status and, on request, the overall score of completed appraisals.
 *
 * Rules (Sahil 29-Oct-2026 + Ghazi's score decision of 30-Oct-2026):
 *   pending   = submitted but not completed (preliminary / submitted / pending office review) — drafts listed separately;
 *   completed = reviewed (CODE: appraisalResultsService STATUS_ORDER; the report's completed/approved/closed/final synonyms kept);
 *   archived and terminated crew excluded (A6); the crew member's vessel matched by RECORD (the on-board assignment), the
 *   appraisal's own vessel text is shown as recorded.
 *   Scores: ONLY the overall rating of a COMPLETED appraisal, ONLY when `includeScores` is asked for, and ONLY when the
 *   VERIFIED caller holds the Crewing permission to view appraisals ('Appraisals All'); draft scores, individual assessment
 *   scores (competence / behavioural) and remarks are never returned.
 *   'My appraisal': Crewing has no trusted link between a login (master_users) and a crew record (crew_members_v2 carries no
 *   user id or e-mail), so an own-score request is REFUSED with that reason — never resolved from a name the model supplies.
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { APPRAISAL_STATUS_CLASS, DEFINITIONS, NOT_TERMINATED_CM, ON_BOARD_OB, dateOf, fullNameOf, hasText, normalizeRankText, rankKeyOf, vesselNameOf, windowBounds } from "./definitions";
import { RANK_GROUP_NAMES, classifiedCondition, groupCondition, groupLabelExpr, loadRankConfig, rankConfigReport } from "./rankConfig";
import { ToolRefusal, inList, isoDate, num, pagingSchema, refuse, resolveRanks, resolveVesselNames, runArea, windowSchema, type AreaQuery, type ToolContext } from "./common";
import type { Query } from "../repositories/assistantDataRepository";

const GROUP_KEYS = ["statusClass", "vesselName", "rank", "rankGroup", "appraisalType"] as const;

export const appraisalsArgs = z
  .object({
    mode: z.enum(["list", "count", "group"]).default("list"),
    groupBy: z.array(z.enum(GROUP_KEYS)).min(1).max(2).optional(),
    /** pending (default) · draft · completed · any */
    statusClass: z.enum(["pending", "draft", "completed", "any"]).default("pending"),
    /** the crew member's CURRENT vessel (by record); the appraisal's own vessel text is shown, not filtered */
    vessels: z.array(z.string().trim().min(1).max(120)).min(1).max(10).optional(),
    ranks: z.array(z.string().trim().min(1).max(60)).min(1).max(20).optional(),
    rankGroups: z.array(z.enum(RANK_GROUP_NAMES as unknown as [string, ...string[]])).min(1).optional(),
    crewIds: z.array(z.string().trim().min(8).max(64)).min(1).max(20).optional(),
    appraisalDateWithin: windowSchema.optional(),
    appraisalDateFrom: isoDate.optional(),
    appraisalDateTo: isoDate.optional(),
    /** overall score of COMPLETED appraisals — only when the user explicitly asks; permission checked on the server */
    includeScores: z.boolean().default(false),
    /** the asking user's own appraisal — refused: Crewing has no trusted login → crew record link */
    own: z.boolean().default(false),
    sort: z.enum(["date_desc", "date_asc", "name"]).default("date_desc"),
    ...pagingSchema,
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.mode === "group" && !a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is required when mode is group" });
    if (a.mode !== "group" && a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is only allowed when mode is group" });
  });
export type AppraisalsArgs = z.infer<typeof appraisalsArgs>;

export async function queryAppraisals(q: Query, ctx: ToolContext, a: AppraisalsArgs) {
  if (a.own) {
    throw new ToolRefusal(refuse("identity_mapping_unavailable",
      "Your own appraisal cannot be looked up: Crewing keeps no verified link between your login and a crew record, so the assistant will not guess which record is yours."));
  }
  const scoresAllowed = ctx.canView("appraisalsAll");
  if (a.includeScores && !scoresAllowed) {
    throw new ToolRefusal(refuse("not_allowed", "Your role cannot view other people's appraisals in Crewing, so appraisal scores are not available to you."));
  }
  const vessels = a.vessels ? await resolveVesselNames(q, a.vessels) : undefined;
  const ranks = a.ranks ? await resolveRanks(q, a.ranks, normalizeRankText, rankKeyOf) : undefined;
  const cfg = await loadRankConfig(q);
  const usesGroups = !!a.rankGroups || !!a.groupBy?.includes("rankGroup");
  const rankKey = rankKeyOf(sql`cm.present_rank`);
  const apprDate = dateOf(sql`a.appraisal_date`);
  const onBoardVessel = sql`(SELECT ob.vessel_uuid FROM vessel_planning_v2 ob WHERE ob.crew_uuid = cm.crew_uuid AND ${ON_BOARD_OB} ORDER BY (ob.crew_status = 'primary') DESC, ob.id LIMIT 1)`;

  const conds: SQL[] = [sql`a.is_deleted = false`];
  if (a.statusClass !== "any") conds.push(sql`${APPRAISAL_STATUS_CLASS} = ${a.statusClass}`);
  if (ranks) conds.push(inList(rankKey, ranks));
  if (a.crewIds) conds.push(inList(sql`a.crew_member_id`, a.crewIds));
  if (vessels) conds.push(inList(onBoardVessel, vessels.map((v) => v.vesselId)));
  const groupCond = a.rankGroups ? groupCondition(cfg, a.rankGroups, null, rankKey) : null;
  const withGroup = groupCond ? [groupCond] : [];
  const dateConds: SQL[] = [];
  let dateWindow: { from: string; to: string } | undefined;
  if (a.appraisalDateWithin) {
    const w = windowBounds(ctx.asOf, a.appraisalDateWithin);
    dateConds.push(sql`${apprDate} >= ${w.from} AND ${apprDate} <= ${w.to}`);
    const [r] = await q(sql`SELECT to_char(${w.from}, 'YYYY-MM-DD') AS f, to_char(${w.to}, 'YYYY-MM-DD') AS t`);
    dateWindow = { from: String(r?.f), to: String(r?.t) };
  }
  if (a.appraisalDateFrom) dateConds.push(sql`${apprDate} >= ${a.appraisalDateFrom}::date`);
  if (a.appraisalDateTo) dateConds.push(sql`${apprDate} <= ${a.appraisalDateTo}::date`);

  // A6: archived, deleted and terminated crew are excluded by the join
  const from = sql`FROM appraisal_results_v2 a JOIN crew_members_v2 cm ON cm.crew_uuid = a.crew_member_id AND cm.is_deleted = false AND cm.archived_at IS NULL AND ${NOT_TERMINATED_CM}`;
  const where = (extra: SQL[]) => sql`WHERE ${sql.join([...conds, ...extra], sql` AND `)}`;
  const score = a.includeScores && scoresAllowed
    ? sql`(CASE WHEN ${APPRAISAL_STATUS_CLASS} = 'completed' THEN NULLIF(btrim(a.overall_rating), '') END)`
    : sql`NULL::text`;

  const base = sql`SELECT a.appraisal_uuid AS row_id, a.crew_member_id AS crew_uuid, ${fullNameOf("cm")} AS full_name, cm.present_rank AS rank,
      ${groupLabelExpr(cfg, null, rankKey)} AS rank_group, ${vesselNameOf(onBoardVessel)} AS vessel_name, NULLIF(btrim(a.vessel), '') AS appraisal_vessel_name,
      a.appraisal_type, ${apprDate} AS appraisal_date, a.status, ${APPRAISAL_STATUS_CLASS} AS status_class, ${score} AS overall_score
    ${from} ${where([...dateConds, ...withGroup])}`;

  const area: AreaQuery = {
    base,
    rowUnit: "appraisals",
    rowColumns: [
      ["fullName", sql`b.full_name`], ["rank", sql`b.rank`], ["vesselName", sql`b.vessel_name`], ["appraisalVesselName", sql`b.appraisal_vessel_name`],
      ["appraisalType", sql`b.appraisal_type`], ["appraisalDate", sql`to_char(b.appraisal_date, 'YYYY-MM-DD')`], ["status", sql`b.status`], ["statusClass", sql`b.status_class`],
      ...(a.includeScores ? [["overallScore", sql`b.overall_score`] as [string, SQL]] : []), ["crewId", sql`b.crew_uuid`],
    ],
    personColumns: [
      ["fullName", sql`min(b.full_name)`], ["rank", sql`min(b.rank)`], ["vesselName", sql`min(b.vessel_name)`], ["appraisals", sql`count(*)::int`],
      ["latestAppraisalDate", sql`to_char(max(b.appraisal_date), 'YYYY-MM-DD')`], ["crewId", sql`b.crew_uuid`],
    ],
    rowSort: a.sort === "date_asc" ? sql`b.appraisal_date ASC NULLS LAST` : a.sort === "name" ? sql`b.full_name` : sql`b.appraisal_date DESC NULLS LAST, b.full_name`,
    personSort: a.sort === "name" ? sql`min(b.full_name)` : sql`max(b.appraisal_date) DESC NULLS LAST`,
    groupKeys: { statusClass: sql`b.status_class`, vesselName: sql`b.vessel_name`, rank: sql`b.rank`, rankGroup: sql`b.rank_group`, appraisalType: sql`b.appraisal_type` },
  };
  const result = await runArea(q, area, { ...a, unit: a.mode === "list" ? "appraisals" : "appraisals" });

  const [s] = await q(sql`SELECT count(*) FILTER (WHERE ${APPRAISAL_STATUS_CLASS} = 'pending')::int AS pending, count(*) FILTER (WHERE ${APPRAISAL_STATUS_CLASS} = 'draft')::int AS drafts,
      count(*) FILTER (WHERE ${APPRAISAL_STATUS_CLASS} = 'completed')::int AS completed,
      count(*) FILTER (WHERE ${hasText(sql`a.appraisal_date`)} AND ${apprDate} IS NULL)::int AS unreadable_date
    ${from} ${where(withGroup)}`);
  const summary = { pending: num(s?.pending), drafts: num(s?.drafts), completed: num(s?.completed) };
  const notes: string[] = [];
  if (a.includeScores) notes.push("Scores shown are the overall rating of completed appraisals only; draft scores, individual assessment scores and remarks are never shown.");

  let rankConfig: Record<string, unknown> | undefined;
  if (usesGroups) {
    const [u] = await q(sql`SELECT count(*)::int AS appraisals, count(DISTINCT a.crew_member_id)::int AS people, array_remove(array_agg(DISTINCT cm.present_rank), NULL) AS ranks
      ${from} ${where([...dateConds, sql`NOT ${classifiedCondition(cfg, null, rankKey)}`])}`);
    rankConfig = { ...rankConfigReport(cfg), unclassifiedInResult: { appraisals: num(u?.appraisals), people: num(u?.people), ranks: (u?.ranks as string[] | null) ?? [] } };
  }

  return {
    ok: true as const,
    area: "appraisals",
    asOf: ctx.asOf,
    mode: a.mode,
    unit: "appraisals",
    query: { ...a, vessels: vessels?.map((v) => ({ vesselName: v.vesselName })) },
    ...(dateWindow ? { appraisalDateWindow: dateWindow } : {}),
    definitions: [DEFINITIONS.appraisals, DEFINITIONS.documents, ...(usesGroups ? [DEFINITIONS.rankGroups] : []), DEFINITIONS.dates],
    ...result,
    summary,
    excluded: { unreadableAppraisalDate: num(s?.unreadable_date) },
    ...(notes.length ? { notes } : {}),
    ...(rankConfig ? { rankConfig } : {}),
  };
}
