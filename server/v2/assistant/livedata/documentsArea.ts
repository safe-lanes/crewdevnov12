/**
 * Live-data area: crew licences/certificates and training courses — expiry (stage 2, PILOT TRIAL).
 *
 * One base row = ONE document (licence or training course). People = distinct crew. Vessel/on-board facts come
 * from EXISTS / scalar subqueries over the on-board rule, so no join can multiply a document.
 * Reuses the rules of reports trn-certs-expiring / trn-training-expiring (handlers/training.ts) with the
 * corrections listed in DEFINITIONS (archived licences and archived crew excluded; expired vs expiring split).
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  DEFINITIONS, ON_BOARD_OB, RANK_GROUP_NAMES, dateOf, fullNameOf, hasText, normalizeRankText,
  rankGroupLabelOf, rankKeyOf, ranksForGroups, vesselNameOf, windowBounds,
} from "./definitions";
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
    expiryState: z.enum(["expired", "not_expired", "any"]).default("any"),
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
  const expiry = dateOf(sql`d.raw_expiry`);

  const conds: SQL[] = [];
  if (a.documentTypes) conds.push(inList(sql`d.doc_type`, a.documentTypes));
  if (a.documentNameContains) conds.push(sql`d.doc_name ILIKE ${"%" + a.documentNameContains.replace(/[%_\\]/g, "\\$&") + "%"}`);
  if (a.crewIds) conds.push(inList(sql`d.crew_uuid`, a.crewIds));
  if (ranks) conds.push(inList(rankKeyOf(sql`cm.present_rank`), ranks));
  if (a.rankGroups) conds.push(inList(rankKeyOf(sql`cm.present_rank`), ranksForGroups(a.rankGroups)));
  if (a.crewOnBoard === true) conds.push(sql`EXISTS (SELECT 1 FROM vessel_planning_v2 ob WHERE ob.crew_uuid = d.crew_uuid AND ${ON_BOARD_OB})`);
  if (a.crewOnBoard === false) conds.push(sql`NOT EXISTS (SELECT 1 FROM vessel_planning_v2 ob WHERE ob.crew_uuid = d.crew_uuid AND ${ON_BOARD_OB})`);
  if (vessels) {
    conds.push(sql`EXISTS (SELECT 1 FROM vessel_planning_v2 ob WHERE ob.crew_uuid = d.crew_uuid AND ${ON_BOARD_OB}
      AND ${inList(sql`ob.vessel_uuid`, vessels.map((v) => v.vesselId))})`);
  }

  const expiryConds: SQL[] = [];
  if (a.expiryState === "expired") expiryConds.push(sql`${expiry} < ${ctx.asOf}::date`);
  if (a.expiryState === "not_expired") expiryConds.push(sql`${expiry} >= ${ctx.asOf}::date`);
  if (a.expiryWithin) {
    const w = windowBounds(ctx.asOf, a.expiryWithin);
    expiryConds.push(sql`${expiry} >= ${w.from} AND ${expiry} <= ${w.to}`);
  }
  if (a.expiryFrom) expiryConds.push(sql`${expiry} >= ${a.expiryFrom}::date`);
  if (a.expiryTo) expiryConds.push(sql`${expiry} <= ${a.expiryTo}::date`);
  const usesExpiry = expiryConds.length > 0;

  const from = sql`FROM ${DOCS} d JOIN crew_members_v2 cm ON cm.crew_uuid = d.crew_uuid AND cm.is_deleted = false AND cm.archived_at IS NULL`;
  const where = (extra: SQL[]) => {
    const all = [...conds, ...extra];
    return all.length ? sql`WHERE ${sql.join(all, sql` AND `)}` : sql``;
  };

  const base = sql`SELECT d.row_id, d.crew_uuid, d.doc_type, d.doc_name, ${expiry} AS expiry,
      CASE WHEN ${expiry} IS NULL THEN NULL WHEN ${expiry} < ${ctx.asOf}::date THEN 'expired' ELSE 'not_expired' END AS expiry_state,
      ${fullNameOf("cm")} AS full_name, cm.present_rank AS rank, ${rankGroupLabelOf(rankKeyOf(sql`cm.present_rank`))} AS rank_group,
      ${vesselVisible ? vesselNameOf(DISPLAY_VESSEL) : sql`NULL::text`} AS vessel_name
    ${from} ${where(expiryConds)}`;

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
      ["documents", sql`count(*)::int`], ["earliestExpiry", sql`to_char(min(b.expiry), 'YYYY-MM-DD')`],
      ["documentNames", sql`left(string_agg(b.doc_name, '; ' ORDER BY b.expiry NULLS LAST, b.row_id), 300)`], ["crewId", sql`b.crew_uuid`],
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
      ${from} ${where([])}`);
    excluded = { unreadableExpiryDate: num(x?.unreadable), noExpiryDate: num(x?.missing) };
  }

  return {
    ok: true as const,
    area: "documents",
    asOf: ctx.asOf,
    mode: a.mode,
    unit: a.unit,
    query: { ...a, vessels: vessels?.map((v) => ({ vesselName: v.vesselName })) },
    definitions: [DEFINITIONS.documents, DEFINITIONS.expired, ...(documentsNeedsVessel(a) ? [DEFINITIONS.onBoard] : []),
      ...(a.rankGroups || a.groupBy?.includes("rankGroup") ? [DEFINITIONS.rankGroups] : []), DEFINITIONS.dates],
    ...result,
    ...(excluded ? { excluded } : {}),
    ...(vesselVisible ? {} : { notes: ["Vessel / on-board columns are hidden: your role cannot view vessel information."] }),
  };
}
