/**
 * Live-data area (Part B6): appraisal status and, on request, the overall score of completed appraisals.
 *
 * Rules (Sahil 29-Oct-2026 + Ghazi's score decision of 30-Oct-2026):
 *   pending   = submitted but not completed (preliminary / submitted / pending office review) — drafts listed separately;
 *   completed = reviewed (CODE: appraisalResultsService STATUS_ORDER; the report's completed/approved/closed/final synonyms kept);
 *   archived and terminated crew excluded (A6).
 *   VESSEL = the vessel the APPRAISAL was made on (31-Oct-2026 correction). appraisal_results_v2 stores only free text
 *   (`vessel`, no vessel id — READ: appraisalResultsService writes appraisalData.vessel as received). It is associated with a
 *   vessel only by an exact, case- and whitespace-normalised match to ONE non-deleted vessel of the company; no match, several
 *   matches or empty text are reported (`vesselAssociation` unmatched / ambiguous / missing), never guessed.
 *   ACCESS (Sahil, 31-Oct-2026): the chatbot is shore-only, so Office users the chatbot already allows may view crew appraisals
 *   across all vessels of their own company — no extra appraisal menu right. Verified login, Office-only, the chatbot role
 *   allow-list and company isolation are enforced before the tool runs.
 *   Scores: ONLY the overall rating of a COMPLETED appraisal, with its date, ONLY when `includeScores` is asked for; draft
 *   scores, individual assessment scores (competence / behavioural) and remarks are never selected.
 *   'My appraisal': Crewing links no login to a crew record, so `own` returns identity_not_linked with the question to ask
 *   (which crew member) — never resolved from a name the model supplies.
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { APPRAISAL_STATUS_CLASS, DEFINITIONS, NOT_TERMINATED_CM, dateOf, fullNameOf, hasText, normalizeRankText, rankKeyOf, vesselNameOf, windowBounds } from "./definitions";
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
    /** the vessel the appraisal was made on (its recorded vessel name matched to the vessel master) */
    vessels: z.array(z.string().trim().min(1).max(120)).min(1).max(10).optional(),
    ranks: z.array(z.string().trim().min(1).max(60)).min(1).max(20).optional(),
    rankGroups: z.array(z.enum(RANK_GROUP_NAMES as unknown as [string, ...string[]])).min(1).optional(),
    crewIds: z.array(z.string().trim().min(8).max(64)).min(1).max(20).optional(),
    appraisalDateWithin: windowSchema.optional(),
    appraisalDateFrom: isoDate.optional(),
    appraisalDateTo: isoDate.optional(),
    /** overall score of COMPLETED appraisals — only when the user explicitly asks; permission checked on the server */
    includeScores: z.boolean().default(false),
    /** the asking user's own appraisal — Crewing links no login to a crew record: answered with identity_not_linked */
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
    throw new ToolRefusal(refuse("identity_not_linked",
      "Your login is not linked to a crew record in Crewing, so the assistant cannot tell which appraisal is yours. Ask the user which crew member they mean, then look that person up.",
      { askUser: "Which crew member do you mean?" }));
  }
  const vessels = a.vessels ? await resolveVesselNames(q, a.vessels) : undefined;
  const ranks = a.ranks ? await resolveRanks(q, a.ranks, normalizeRankText, rankKeyOf) : undefined;
  const cfg = await loadRankConfig(q);
  const usesGroups = !!a.rankGroups || !!a.groupBy?.includes("rankGroup");
  const rankKey = rankKeyOf(sql`cm.present_rank`);
  const apprDate = dateOf(sql`a.appraisal_date`);
  // the appraisal's vessel: exact normalised name match to exactly ONE non-deleted vessel of this company
  const norm = (x: SQL) => sql`lower(regexp_replace(btrim(${x}), '[[:space:]]+', ' ', 'g'))`;
  const matchCount = sql`(SELECT count(DISTINCT mv.vessel_uuid) FROM master_vessels mv WHERE mv.is_deleted IS NOT TRUE AND ${norm(sql`mv.vessel`)} = ${norm(sql`a.vessel`)})`;
  const matchedVessel = sql`(CASE WHEN ${matchCount} = 1 THEN (SELECT mv.vessel_uuid FROM master_vessels mv WHERE mv.is_deleted IS NOT TRUE
    AND ${norm(sql`mv.vessel`)} = ${norm(sql`a.vessel`)} ORDER BY mv.id LIMIT 1) END)`;
  const association = sql`(CASE WHEN NULLIF(btrim(a.vessel), '') IS NULL THEN 'missing' WHEN ${matchCount} = 0 THEN 'unmatched'
    WHEN ${matchCount} > 1 THEN 'ambiguous' ELSE 'matched' END)`;

  const conds: SQL[] = [sql`a.is_deleted = false`];
  if (a.statusClass !== "any") conds.push(sql`${APPRAISAL_STATUS_CLASS} = ${a.statusClass}`);
  if (ranks) conds.push(inList(rankKey, ranks));
  if (a.crewIds) conds.push(inList(sql`a.crew_member_id`, a.crewIds));
  const vesselCond = vessels ? inList(matchedVessel, vessels.map((v) => v.vesselId)) : null;
  if (vesselCond) conds.push(vesselCond);
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
  const score = a.includeScores
    ? sql`(CASE WHEN ${APPRAISAL_STATUS_CLASS} = 'completed' THEN NULLIF(btrim(a.overall_rating), '') END)`
    : sql`NULL::text`;

  const base = sql`SELECT a.appraisal_uuid AS row_id, a.crew_member_id AS crew_uuid, ${fullNameOf("cm")} AS full_name, cm.present_rank AS rank,
      ${groupLabelExpr(cfg, null, rankKey)} AS rank_group, ${vesselNameOf(matchedVessel)} AS vessel_name, NULLIF(btrim(a.vessel), '') AS appraisal_vessel_text,
      ${association} AS vessel_association,
      a.appraisal_type, ${apprDate} AS appraisal_date, a.status, ${APPRAISAL_STATUS_CLASS} AS status_class, ${score} AS overall_score
    ${from} ${where([...dateConds, ...withGroup])}`;

  const area: AreaQuery = {
    base,
    rowUnit: "appraisals",
    rowColumns: [
      ["fullName", sql`b.full_name`], ["rank", sql`b.rank`], ["vesselName", sql`b.vessel_name`], ["vesselAsRecorded", sql`b.appraisal_vessel_text`], ["vesselAssociation", sql`b.vessel_association`],
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
  // association counts are taken WITHOUT the vessel filter: an appraisal that cannot be tied to a vessel is by definition outside it
  const assocConds = conds.filter((c) => c !== vesselCond);
  const [va] = await q(sql`SELECT count(*) FILTER (WHERE ${association} = 'unmatched')::int AS v_unmatched,
      count(*) FILTER (WHERE ${association} = 'ambiguous')::int AS v_ambiguous, count(*) FILTER (WHERE ${association} = 'missing')::int AS v_missing
    ${from} WHERE ${sql.join([...assocConds, ...dateConds, ...withGroup], sql` AND `)}`);
  const summary = { pending: num(s?.pending), drafts: num(s?.drafts), completed: num(s?.completed) };
  const notes: string[] = [];
  const vesselAssociation = { unmatched: num(va?.v_unmatched), ambiguous: num(va?.v_ambiguous), missing: num(va?.v_missing) };
  const untied = vesselAssociation.unmatched + vesselAssociation.ambiguous + vesselAssociation.missing;
  if (vessels && untied > 0) {
    notes.push(`${untied} appraisal(s) could not be tied to a vessel (recorded vessel name matches no vessel: ${vesselAssociation.unmatched}, several vessels: ${vesselAssociation.ambiguous}, no vessel recorded: ${vesselAssociation.missing}) and are not in this vessel filter.`);
  }
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
    vesselAssociation,
    ...(notes.length ? { notes } : {}),
    ...(rankConfig ? { rankConfig } : {}),
  };
}
