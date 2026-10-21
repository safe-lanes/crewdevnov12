/**
 * Live-data area: crew assignments — who is on board (stage 2, PILOT TRIAL).
 *
 * One base row = ONE on-board assignment (vessel_planning_v2 row, Vessel-screen rule). People = distinct crew
 * (a person may hold a primary and a secondary assignment). Names come from scalar subqueries (no fan-out);
 * the cross-area document condition is an EXISTS over the documents rules.
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  DEFINITIONS, ON_BOARD_VP, RANK_GROUP_NAMES, dateOf, fullNameOf, hasText, nationalityOf, normalizeRankText,
  rankGroupLabelOf, rankKeyOf, ranksForGroups, vesselNameOf, windowBounds,
} from "./definitions";
import {
  inList, isoDate, num, pagingSchema, resolveNationalities, resolveRanks, resolveVesselNames, runArea, windowSchema,
  type AreaQuery, type ToolContext,
} from "./common";
import type { Query } from "../repositories/assistantDataRepository";

const GROUP_KEYS = ["vesselName", "rank", "rankGroup", "nationality", "crewStatus"] as const;

const documentCondition = z
  .object({
    documentTypes: z.array(z.enum(["licence", "training"])).min(1).optional(),
    documentNameContains: z.string().trim().min(2).max(80).optional(),
    expiryState: z.enum(["expired", "not_expired", "any"]).default("any"),
    expiryWithin: windowSchema.optional(),
  })
  .strict();

export const assignmentsArgs = z
  .object({
    mode: z.enum(["list", "count", "group"]).default("list"),
    unit: z.enum(["assignments", "people"]).default("people"),
    groupBy: z.array(z.enum(GROUP_KEYS)).min(1).max(2).optional(),
    vessels: z.array(z.string().trim().min(1).max(120)).min(1).max(10).optional(),
    ranks: z.array(z.string().trim().min(1).max(60)).min(1).max(20).optional(),
    rankGroups: z.array(z.enum(RANK_GROUP_NAMES as unknown as [string, ...string[]])).min(1).optional(),
    nationalities: z.array(z.string().trim().min(2).max(60)).min(1).max(10).optional(),
    crewStatus: z.array(z.enum(["primary", "secondary"])).min(1).optional(),
    signOnWithin: windowSchema.optional(),
    signOnFrom: isoDate.optional(),
    signOnTo: isoDate.optional(),
    reliefDueWithin: windowSchema.optional(),
    reliefDueBefore: isoDate.optional(),
    hasDocument: documentCondition.optional(),
    sort: z.enum(["vessel", "name", "rank", "sign_on_asc", "sign_on_desc", "relief_due_asc"]).default("vessel"),
    ...pagingSchema,
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.mode === "group" && !a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is required when mode is group" });
    if (a.mode !== "group" && a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is only allowed when mode is group" });
  });
export type AssignmentsArgs = z.infer<typeof assignmentsArgs>;

function docExistsCondition(asOf: string, c: z.infer<typeof documentCondition>): SQL {
  const parts: SQL[] = [];
  const lic: SQL[] = [sql`l.crew_uuid = vp.crew_uuid`, sql`l.is_deleted = false`, sql`l.archived_at IS NULL`];
  const trn: SQL[] = [sql`t.crew_uuid = vp.crew_uuid`, sql`t.is_deleted = false`];
  const expiryParts = (e: SQL): SQL[] => {
    const out: SQL[] = [];
    if (c.expiryState === "expired") out.push(sql`${e} < ${asOf}::date`);
    if (c.expiryState === "not_expired") out.push(sql`${e} >= ${asOf}::date`);
    if (c.expiryWithin) {
      const w = windowBounds(asOf, c.expiryWithin);
      out.push(sql`${e} >= ${w.from} AND ${e} <= ${w.to}`);
    }
    return out;
  };
  const nameLike = c.documentNameContains ? "%" + c.documentNameContains.replace(/[%_\\]/g, "\\$&") + "%" : null;
  if (nameLike) {
    lic.push(sql`COALESCE(NULLIF(btrim(l.certificate_document), ''), l.abbr) ILIKE ${nameLike}`);
    trn.push(sql`COALESCE(NULLIF(btrim(t.training_course), ''), t.abbr) ILIKE ${nameLike}`);
  }
  lic.push(...expiryParts(dateOf(sql`l.expiry`)));
  trn.push(...expiryParts(dateOf(sql`t.expiry`)));
  const types = c.documentTypes ?? ["licence", "training"];
  if (types.includes("licence")) parts.push(sql`EXISTS (SELECT 1 FROM crew_licenses l WHERE ${sql.join(lic, sql` AND `)})`);
  if (types.includes("training")) parts.push(sql`EXISTS (SELECT 1 FROM crew_training_courses t WHERE ${sql.join(trn, sql` AND `)})`);
  return sql`(${sql.join(parts, sql` OR `)})`;
}

export async function queryAssignments(q: Query, ctx: ToolContext, a: AssignmentsArgs) {
  const vessels = a.vessels ? await resolveVesselNames(q, a.vessels) : undefined;
  const ranks = a.ranks ? await resolveRanks(q, a.ranks, normalizeRankText, rankKeyOf) : undefined;
  const nationalities = a.nationalities ? await resolveNationalities(q, a.nationalities) : undefined;
  const signOn = dateOf(sql`vp.sign_on_date`);
  const reliefDue = dateOf(sql`vp.relief_due`);

  const conds: SQL[] = [ON_BOARD_VP];
  if (vessels) conds.push(inList(sql`vp.vessel_uuid`, vessels.map((v) => v.vesselId)));
  if (ranks) conds.push(inList(rankKeyOf(sql`vp.rank`), ranks));
  if (a.rankGroups) conds.push(inList(rankKeyOf(sql`vp.rank`), ranksForGroups(a.rankGroups)));
  if (a.crewStatus) conds.push(inList(sql`vp.crew_status`, a.crewStatus));
  if (nationalities) conds.push(inList(sql`lower(${nationalityOf(sql`cm.nationality_uuid`)})`, nationalities));
  if (a.hasDocument) conds.push(docExistsCondition(ctx.asOf, a.hasDocument));

  const dateConds: SQL[] = [];
  if (a.signOnWithin) {
    const w = windowBounds(ctx.asOf, a.signOnWithin);
    dateConds.push(sql`${signOn} >= ${w.from} AND ${signOn} <= ${w.to}`);
  }
  if (a.signOnFrom) dateConds.push(sql`${signOn} >= ${a.signOnFrom}::date`);
  if (a.signOnTo) dateConds.push(sql`${signOn} <= ${a.signOnTo}::date`);
  if (a.reliefDueWithin) {
    const w = windowBounds(ctx.asOf, a.reliefDueWithin);
    dateConds.push(sql`${reliefDue} >= ${w.from} AND ${reliefDue} <= ${w.to}`);
  }
  if (a.reliefDueBefore) dateConds.push(sql`${reliefDue} < ${a.reliefDueBefore}::date`);

  const from = sql`FROM vessel_planning_v2 vp LEFT JOIN crew_members_v2 cm ON cm.crew_uuid = vp.crew_uuid`;
  const where = (extra: SQL[]) => sql`WHERE ${sql.join([...conds, ...extra], sql` AND `)}`;

  const base = sql`SELECT 'A' || vp.id AS row_id, vp.crew_uuid, vp.vessel_uuid, ${vesselNameOf(sql`vp.vessel_uuid`)} AS vessel_name,
      COALESCE(NULLIF(${fullNameOf("cm")}, ''), '(no crew record)') AS full_name, regexp_replace(btrim(vp.rank), '_[0-9]+$', '') AS rank,
      ${rankGroupLabelOf(rankKeyOf(sql`vp.rank`))} AS rank_group, ${nationalityOf(sql`cm.nationality_uuid`)} AS nationality,
      vp.crew_status, ${signOn} AS sign_on, ${reliefDue} AS relief_due
    ${from} ${where(dateConds)}`;

  const area: AreaQuery = {
    base,
    rowUnit: "assignments",
    rowColumns: [
      ["fullName", sql`b.full_name`], ["rank", sql`b.rank`], ["vesselName", sql`b.vessel_name`], ["crewStatus", sql`b.crew_status`],
      ["signOnDate", sql`to_char(b.sign_on, 'YYYY-MM-DD')`], ["reliefDueDate", sql`to_char(b.relief_due, 'YYYY-MM-DD')`],
      ["nationality", sql`b.nationality`], ["crewId", sql`b.crew_uuid`],
    ],
    personColumns: [
      ["fullName", sql`min(b.full_name)`], ["rank", sql`string_agg(DISTINCT b.rank, ' / ')`],
      ["vesselName", sql`string_agg(DISTINCT b.vessel_name, ' / ')`], ["assignments", sql`count(*)::int`],
      ["signOnDate", sql`to_char(min(b.sign_on), 'YYYY-MM-DD')`], ["reliefDueDate", sql`to_char(min(b.relief_due), 'YYYY-MM-DD')`],
      ["nationality", sql`min(b.nationality)`], ["crewId", sql`b.crew_uuid`],
    ],
    rowSort:
      a.sort === "name" ? sql`b.full_name`
      : a.sort === "rank" ? sql`b.rank_group, b.rank`
      : a.sort === "sign_on_asc" ? sql`b.sign_on ASC NULLS LAST`
      : a.sort === "sign_on_desc" ? sql`b.sign_on DESC NULLS LAST`
      : a.sort === "relief_due_asc" ? sql`b.relief_due ASC NULLS LAST`
      : sql`b.vessel_name NULLS LAST, b.rank_group, b.rank, b.full_name`,
    personSort:
      a.sort === "name" ? sql`min(b.full_name)`
      : a.sort === "rank" ? sql`min(b.rank_group), min(b.rank)`
      : a.sort === "sign_on_asc" ? sql`min(b.sign_on) ASC NULLS LAST`
      : a.sort === "sign_on_desc" ? sql`min(b.sign_on) DESC NULLS LAST`
      : a.sort === "relief_due_asc" ? sql`min(b.relief_due) ASC NULLS LAST`
      : sql`min(b.vessel_name) NULLS LAST, min(b.rank_group), min(b.rank), min(b.full_name)`,
    groupKeys: {
      vesselName: sql`b.vessel_name`, rank: sql`b.rank`, rankGroup: sql`b.rank_group`, nationality: sql`b.nationality`, crewStatus: sql`b.crew_status`,
    },
  };
  const result = await runArea(q, area, a);

  let excluded: Record<string, number> | undefined;
  if (dateConds.length) {
    const [x] = await q(sql`SELECT
        count(*) FILTER (WHERE ${hasText(sql`vp.sign_on_date`)} AND ${signOn} IS NULL)::int AS sign_on_unreadable,
        count(*) FILTER (WHERE ${hasText(sql`vp.relief_due`)} AND ${reliefDue} IS NULL)::int AS relief_unreadable,
        count(*) FILTER (WHERE NOT ${hasText(sql`vp.relief_due`)})::int AS relief_missing
      ${from} ${where([])}`);
    excluded = {
      ...(a.signOnWithin || a.signOnFrom || a.signOnTo ? { unreadableSignOnDate: num(x?.sign_on_unreadable) } : {}),
      ...(a.reliefDueWithin || a.reliefDueBefore ? { unreadableReliefDueDate: num(x?.relief_unreadable), noReliefDueDate: num(x?.relief_missing) } : {}),
    };
  }

  return {
    ok: true as const,
    area: "assignments",
    asOf: ctx.asOf,
    mode: a.mode,
    unit: a.unit,
    query: { ...a, vessels: vessels?.map((v) => ({ vesselName: v.vesselName })) },
    definitions: [DEFINITIONS.onBoard, DEFINITIONS.onBoardSecondary,
      ...(a.hasDocument ? [DEFINITIONS.documents, DEFINITIONS.expired] : []),
      ...(a.rankGroups || a.groupBy?.includes("rankGroup") ? [DEFINITIONS.rankGroups] : []), DEFINITIONS.dates],
    ...result,
    ...(excluded ? { excluded } : {}),
  };
}
