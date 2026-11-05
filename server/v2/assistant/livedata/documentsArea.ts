/**
 * Live-data area: crew licences/certificates and training courses — expiry (stage 2, PILOT TRIAL).
 *
 * One base row = ONE document (licence or training course). People = distinct crew. Vessel/on-board facts come
 * from EXISTS / scalar subqueries over the on-board rule, so no join can multiply a document.
 * Reuses the rules of reports trn-certs-expiring / trn-training-expiring (handlers/training.ts) with the
 * corrections listed in DEFINITIONS (archived licences, archived and terminated crew excluded; expired listed with
 * expiring and marked — Sahil A4/A6, 29-Oct-2026). Rank groups come from Rank Administration (rankConfig.ts).
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  DEFINITIONS, EXPIRY_STATES, NOT_TERMINATED_CM, ON_BOARD_OB, dateOf, effectiveExpiryState, expiryConditions, fullNameOf, hasText,
  normalizeRankText, rankKeyOf, vesselNameOf, windowBounds,
} from "./definitions";
import { RANK_GROUP_NAMES, classifiedCondition, groupCondition, groupLabelExpr, loadRankConfig, rankConfigReport } from "./rankConfig";
import {
  ToolRefusal, inList, isoDate, num, pagingSchema, refuse, resolveRanks, resolveVesselNames, runArea, windowSchema,
  type AreaQuery, type ToolContext,
} from "./common";
import type { Query } from "../repositories/assistantDataRepository";

const GROUP_KEYS = ["vesselName", "documentType", "documentName", "rank", "rankGroup", "expiryMonth", "expiryState"] as const;
const VESSEL_GROUPS = new Set(["vesselName"]);

export const documentsArgs = z
  .object({
    mode: z.enum(["list", "count", "group"]).default("list"),
    unit: z.enum(["documents", "people"]).default("documents"),
    groupBy: z.array(z.enum(GROUP_KEYS)).min(1).max(2).optional(),
    documentTypes: z.array(z.enum(["licence", "training"])).min(1).optional(),
    documentNameContains: z.string().trim().min(2).max(80).optional(),
    expiryState: z.enum(EXPIRY_STATES).optional(),
    expiryWithin: windowSchema.optional(),
    expiryFrom: isoDate.optional(),
    expiryTo: isoDate.optional(),
    crewOnBoard: z.boolean().optional(),
    vessels: z.array(z.string().trim().min(1).max(120)).min(1).max(10).optional(),
    ranks: z.array(z.string().trim().min(1).max(60)).min(1).max(20).optional(),
    rankGroups: z.array(z.enum(RANK_GROUP_NAMES as unknown as [string, ...string[]])).min(1).optional(),
    crewIds: z.array(z.string().trim().min(8).max(64)).min(1).max(20).optional(),
    sort: z.enum(["expiry_asc", "expiry_desc", "name", "vessel"]).default("expiry_asc"),
    ...pagingSchema,
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.mode === "group" && !a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is required when mode is group" });
    if (a.mode !== "group" && a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is only allowed when mode is group" });
  });
export type DocumentsArgs = z.infer<typeof documentsArgs>;

export function documentsNeedsVessel(a: DocumentsArgs): boolean {
  return a.crewOnBoard !== undefined || !!a.vessels || !!a.groupBy?.some((g) => VESSEL_GROUPS.has(g)) || a.sort === "vessel";
}

const DOCS = sql`(
  SELECT 'licence'::text AS doc_type, 'L' || l.id AS row_id, l.crew_uuid,
         COALESCE(NULLIF(btrim(l.certificate_document), ''), NULLIF(btrim(l.abbr), ''), '(unnamed)') AS doc_name, l.expiry AS raw_expiry
  FROM crew_licenses l WHERE l.is_deleted = false AND l.archived_at IS NULL
  UNION ALL
  SELECT 'training'::text, 'T' || t.id, t.crew_uuid,
         COALESCE(NULLIF(btrim(t.training_course), ''), NULLIF(btrim(t.abbr), ''), '(unnamed)'), t.expiry
  FROM crew_training_courses t WHERE t.is_deleted = false
)`;

/** The person's on-board vessel for display (primary first). Facts for filters use EXISTS below. */
const DISPLAY_VESSEL = sql`(SELECT ob.vessel_uuid FROM vessel_planning_v2 ob WHERE ob.crew_uuid = d.crew_uuid AND ${ON_BOARD_OB}
  ORDER BY (ob.crew_status = 'primary') DESC, ob.id LIMIT 1)`;

export async function queryDocuments(q: Query, ctx: ToolContext, a: DocumentsArgs) {
  const vesselVisible = ctx.canView("vessel");
  if (documentsNeedsVessel(a) && !vesselVisible) {
    throw new ToolRefusal(refuse("not_allowed", "Your role cannot view vessel / on-board information, which this question needs."));
  }
  const vessels = a.vessels ? await resolveVesselNames(q, a.vessels) : undefined;
  const ranks = a.ranks ? await resolveRanks(q, a.ranks, normalizeRankText, rankKeyOf) : undefined;
  const cfg = await loadRankConfig(q);
  const usesGroups = !!a.rankGroups || !!a.groupBy?.includes("rankGroup");
  const expiry = dateOf(sql`d.raw_expiry`);
  const rankKey = rankKeyOf(sql`cm.present_rank`);
  const state = effectiveExpiryState(a.expiryState, a.expiryWithin);

  const conds: SQL[] = [];
  if (a.documentTypes) conds.push(inList(sql`d.doc_type`, a.documentTypes));
  if (a.documentNameContains) conds.push(sql`d.doc_name ILIKE ${"%" + a.documentNameContains.replace(/[%_\\]/g, "\\$&") + "%"}`);
  if (a.crewIds) conds.push(inList(sql`d.crew_uuid`, a.crewIds));
  if (ranks) conds.push(inList(rankKey, ranks));
  if (a.crewOnBoard === true) conds.push(sql`EXISTS (SELECT 1 FROM vessel_planning_v2 ob WHERE ob.crew_uuid = d.crew_uuid AND ${ON_BOARD_OB})`);
  if (a.crewOnBoard === false) conds.push(sql`NOT EXISTS (SELECT 1 FROM vessel_planning_v2 ob WHERE ob.crew_uuid = d.crew_uuid AND ${ON_BOARD_OB})`);
  if (vessels) {
    conds.push(sql`EXISTS (SELECT 1 FROM vessel_planning_v2 ob WHERE ob.crew_uuid = d.crew_uuid AND ${ON_BOARD_OB}
      AND ${inList(sql`ob.vessel_uuid`, vessels.map((v) => v.vesselId))})`);
  }
  const groupCond = a.rankGroups ? groupCondition(cfg, a.rankGroups, null, rankKey) : null;

  const expiryConds: SQL[] = expiryConditions(ctx.asOf, expiry, state, a.expiryWithin);
  if (a.expiryFrom) expiryConds.push(sql`${expiry} >= ${a.expiryFrom}::date`);
  if (a.expiryTo) expiryConds.push(sql`${expiry} <= ${a.expiryTo}::date`);
  const usesExpiry = expiryConds.length > 0;

  // CONFIRMED (A6): deleted, archived and terminated crew are excluded; inactive crew stay
  const from = sql`FROM ${DOCS} d JOIN crew_members_v2 cm ON cm.crew_uuid = d.crew_uuid AND cm.is_deleted = false AND cm.archived_at IS NULL
    AND ${NOT_TERMINATED_CM}`;
  const where = (extra: SQL[]) => {
    const all = [...conds, ...extra];
    return all.length ? sql`WHERE ${sql.join(all, sql` AND `)}` : sql``;
  };
  const withGroup = groupCond ? [groupCond] : [];

  const base = sql`SELECT d.row_id, d.crew_uuid, d.doc_type, d.doc_name, ${expiry} AS expiry,
      CASE WHEN ${expiry} IS NULL THEN NULL WHEN ${expiry} < ${ctx.asOf}::date THEN 'expired' ELSE 'upcoming' END AS expiry_state,
      ${fullNameOf("cm")} AS full_name, cm.present_rank AS rank, ${groupLabelExpr(cfg, null, rankKey)} AS rank_group,
      ${vesselVisible ? vesselNameOf(DISPLAY_VESSEL) : sql`NULL::text`} AS vessel_name
    ${from} ${where([...expiryConds, ...withGroup])}`;

  const area: AreaQuery = {
    base,
    rowUnit: "documents",
    rowColumns: [
      ["fullName", sql`b.full_name`], ["rank", sql`b.rank`], ["vesselName", sql`b.vessel_name`],
      ["documentType", sql`b.doc_type`], ["documentName", sql`b.doc_name`], ["expiryDate", sql`to_char(b.expiry, 'YYYY-MM-DD')`],
      ["expiryState", sql`b.expiry_state`], ["crewId", sql`b.crew_uuid`],
    ],
    personColumns: [
      ["fullName", sql`min(b.full_name)`], ["rank", sql`min(b.rank)`], ["vesselName", sql`min(b.vessel_name)`],
      ["documents", sql`count(*)::int`], ["expiredDocuments", sql`count(*) FILTER (WHERE b.expiry_state = 'expired')::int`],
      ["earliestExpiry", sql`to_char(min(b.expiry), 'YYYY-MM-DD')`],
      ["documentNames", sql`left(string_agg(b.doc_name || CASE WHEN b.expiry_state = 'expired' THEN ' (expired)' ELSE '' END, '; ' ORDER BY b.expiry NULLS LAST, b.row_id), 300)`],
      ["crewId", sql`b.crew_uuid`],
    ],
    rowSort:
      a.sort === "expiry_desc" ? sql`b.expiry DESC NULLS LAST`
      : a.sort === "name" ? sql`b.full_name`
      : a.sort === "vessel" ? sql`b.vessel_name NULLS LAST, b.expiry NULLS LAST`
      : sql`b.expiry ASC NULLS LAST`,
    personSort:
      a.sort === "expiry_desc" ? sql`min(b.expiry) DESC NULLS LAST`
      : a.sort === "name" ? sql`min(b.full_name)`
      : a.sort === "vessel" ? sql`min(b.vessel_name) NULLS LAST`
      : sql`min(b.expiry) ASC NULLS LAST`,
    groupKeys: {
      vesselName: sql`b.vessel_name`, documentType: sql`b.doc_type`, documentName: sql`b.doc_name`, rank: sql`b.rank`,
      rankGroup: sql`b.rank_group`, expiryMonth: sql`to_char(b.expiry, 'YYYY-MM')`, expiryState: sql`b.expiry_state`,
    },
  };
  const result = await runArea(q, area, a);

  // records an expiry condition could not evaluate: counted, never silently dropped
  let excluded: Record<string, number> | undefined;
  if (usesExpiry) {
    const [x] = await q(sql`SELECT
        count(*) FILTER (WHERE ${expiry} IS NULL AND ${hasText(sql`d.raw_expiry`)})::int AS unreadable,
        count(*) FILTER (WHERE NOT ${hasText(sql`d.raw_expiry`)})::int AS missing
      ${from} ${where(withGroup)}`);
    excluded = { unreadableExpiryDate: num(x?.unreadable), noExpiryDate: num(x?.missing) };
  }

  // CONFIRMED (A4): expired and upcoming are identified separately whenever an expiry condition applies
  let breakdown: Record<string, unknown> | undefined;
  let expiryWindow: Record<string, unknown> | undefined;
  if (usesExpiry) {
    const [b] = await q(sql`SELECT
        count(*) FILTER (WHERE b.expiry_state = 'expired')::int AS expired_docs, count(DISTINCT b.crew_uuid) FILTER (WHERE b.expiry_state = 'expired')::int AS expired_people,
        count(*) FILTER (WHERE b.expiry_state = 'upcoming')::int AS upcoming_docs, count(DISTINCT b.crew_uuid) FILTER (WHERE b.expiry_state = 'upcoming')::int AS upcoming_people
      FROM (${base}) b`);
    breakdown = {
      expired: { documents: num(b?.expired_docs), people: num(b?.expired_people) },
      upcoming: { documents: num(b?.upcoming_docs), people: num(b?.upcoming_people) },
    };
  }
  if (a.expiryWithin) {
    const w = windowBounds(ctx.asOf, a.expiryWithin);
    const [r] = await q(sql`SELECT to_char(${w.from}, 'YYYY-MM-DD') AS f, to_char(${w.to}, 'YYYY-MM-DD') AS t`);
    expiryWindow = { from: String(r?.f), to: String(r?.t), state };
  }

  // CONFIRMED (A5): ranks Rank Administration does not classify are reported whenever groups are involved
  let rankConfig: Record<string, unknown> | undefined;
  if (usesGroups) {
    const notClassified = sql`NOT ${classifiedCondition(cfg, null, rankKey)}`;
    const [u] = await q(sql`SELECT count(*)::int AS documents, count(DISTINCT d.crew_uuid)::int AS people,
        array_remove(array_agg(DISTINCT cm.present_rank), NULL) AS ranks
      ${from} ${where([...expiryConds, notClassified])}`);
    rankConfig = {
      ...rankConfigReport(cfg),
      unclassifiedInResult: { documents: num(u?.documents), people: num(u?.people), ranks: (u?.ranks as string[] | null) ?? [] },
    };
  }

  return {
    ok: true as const,
    area: "documents",
    asOf: ctx.asOf,
    mode: a.mode,
    unit: a.unit,
    query: { ...a, expiryState: state, vessels: vessels?.map((v) => ({ vesselName: v.vesselName })) },
    definitions: [DEFINITIONS.documents, DEFINITIONS.expired, ...(documentsNeedsVessel(a) ? [DEFINITIONS.onBoard] : []),
      ...(usesGroups ? [DEFINITIONS.rankGroups] : []), DEFINITIONS.dates],
    ...result,
    ...(breakdown ? { breakdown } : {}),
    ...(expiryWindow ? { expiryWindow } : {}),
    ...(excluded ? { excluded } : {}),
    ...(rankConfig ? { rankConfig } : {}),
    ...(vesselVisible ? {} : { notes: ["Vessel / on-board columns are hidden: your role cannot view vessel information."] }),
  };
}
