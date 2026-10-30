/**
 * Live-data area (Part B1): crew available to join — Sahil's decision of 29-Oct-2026.
 *
 * One base row = ONE crew member. Available by <date> = not terminated, not deleted/archived, and
 *   (a) on leave (no on-board assignment) with an availability date (Next Availability, else Availability) on or before <date> —
 *       people already available today included; or
 *   (b) on board with a Next Availability date on or before <date> (Sahil's "signing off 20-Nov, wants to join 7-Dec" case).
 * The availability dates are read from crew_members_v2 first, then crew_personal_details (the crew dashboard's own fallback,
 * dashboardService.ts:175). Crew without a readable availability date are counted under `excluded`, never listed as available.
 * Not-for-rehire crew are excluded unless `includeNotForHire` is set (then flagged).
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  DEFINITIONS, NOT_TERMINATED_CM, ON_BOARD_OB, dateOf, fullNameOf, hasText, nationalityOf, normalizeRankText, rankKeyOf,
  vesselNameOf, windowBounds,
} from "./definitions";
import { RANK_GROUP_NAMES, classifiedCondition, groupCondition, groupLabelExpr, loadRankConfig, rankConfigReport } from "./rankConfig";
import {
  inList, isoDate, num, pagingSchema, resolveNationalities, resolveRanks, resolveVesselNames, runArea, windowSchema,
  type AreaQuery, type ToolContext,
} from "./common";
import type { Query } from "../repositories/assistantDataRepository";

const GROUP_KEYS = ["rank", "rankGroup", "crewStatus", "nationality", "vesselName"] as const;

export const availabilityArgs = z
  .object({
    mode: z.enum(["list", "count", "group"]).default("list"),
    groupBy: z.array(z.enum(GROUP_KEYS)).min(1).max(2).optional(),
    /** available on or before this date (default: the as-of date = available now) */
    availableBy: isoDate.optional(),
    /** or: available within a window from the as-of date, e.g. next 1 month */
    availableWithin: windowSchema.optional(),
    ranks: z.array(z.string().trim().min(1).max(60)).min(1).max(20).optional(),
    rankGroups: z.array(z.enum(RANK_GROUP_NAMES as unknown as [string, ...string[]])).min(1).optional(),
    nationalities: z.array(z.string().trim().min(2).max(60)).min(1).max(10).optional(),
    /** on_leave = not on board; on_board = currently on board with a Next Availability date */
    crewStatus: z.array(z.enum(["on_leave", "on_board"])).min(1).optional(),
    vessels: z.array(z.string().trim().min(1).max(120)).min(1).max(10).optional(),
    includeNotForHire: z.boolean().default(false),
    sort: z.enum(["available_asc", "name", "rank"]).default("available_asc"),
    ...pagingSchema,
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.mode === "group" && !a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is required when mode is group" });
    if (a.mode !== "group" && a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is only allowed when mode is group" });
    if (a.availableBy && a.availableWithin) ctx.addIssue({ code: "custom", message: "give availableBy or availableWithin, not both" });
    if (a.availableWithin && a.availableWithin.direction !== "next") ctx.addIssue({ code: "custom", message: "availableWithin must look forward (direction next)" });
  });
export type AvailabilityArgs = z.infer<typeof availabilityArgs>;

export async function queryAvailability(q: Query, ctx: ToolContext, a: AvailabilityArgs) {
  const vessels = a.vessels ? await resolveVesselNames(q, a.vessels) : undefined;
  const ranks = a.ranks ? await resolveRanks(q, a.ranks, normalizeRankText, rankKeyOf) : undefined;
  const nationalities = a.nationalities ? await resolveNationalities(q, a.nationalities) : undefined;
  const cfg = await loadRankConfig(q);
  const usesGroups = !!a.rankGroups || !!a.groupBy?.includes("rankGroup");
  const rankKey = rankKeyOf(sql`cm.present_rank`);

  // the date limit: availableBy, else the end of the window, else today (= available now)
  let limit: SQL = sql`${ctx.asOf}::date`;
  let limitText: string = ctx.asOf;
  if (a.availableBy) {
    limit = sql`${a.availableBy}::date`;
    limitText = a.availableBy;
  } else if (a.availableWithin) {
    const w = windowBounds(ctx.asOf, a.availableWithin);
    limit = w.to;
    const [r] = await q(sql`SELECT to_char(${w.to}, 'YYYY-MM-DD') AS t`);
    limitText = String(r?.t);
  }

  const onBoard = sql`EXISTS (SELECT 1 FROM vessel_planning_v2 ob WHERE ob.crew_uuid = cm.crew_uuid AND ${ON_BOARD_OB})`;
  const nextAvail = sql`COALESCE(${dateOf(sql`cm.next_availability`)}, ${dateOf(sql`pd.next_availability`)})`;
  const availField = sql`COALESCE(${dateOf(sql`cm.availability`)}, ${dateOf(sql`pd.availability`)})`;
  /** the date the person becomes available: on board → Next Availability only; on leave → Next Availability, else Availability */
  const availableFrom = sql`(CASE WHEN ${onBoard} THEN ${nextAvail} ELSE COALESCE(${nextAvail}, ${availField}) END)`;
  const anyAvailText = sql`(${hasText(sql`cm.next_availability`)} OR ${hasText(sql`pd.next_availability`)} OR ${hasText(sql`cm.availability`)} OR ${hasText(sql`pd.availability`)})`;
  const crewStatus = sql`(CASE WHEN ${onBoard} THEN 'on_board' ELSE 'on_leave' END)`;
  const onBoardVessel = sql`(SELECT ob.vessel_uuid FROM vessel_planning_v2 ob WHERE ob.crew_uuid = cm.crew_uuid AND ${ON_BOARD_OB}
    ORDER BY (ob.crew_status = 'primary') DESC, ob.id LIMIT 1)`;

  // B1 precedence (CODE calculateCrewStatus: Terminated → Inactive → On Board → On Leave): inactive crew are not available
  const conds: SQL[] = [sql`cm.is_deleted = false`, sql`cm.archived_at IS NULL`, NOT_TERMINATED_CM, sql`COALESCE(cm.is_active, true) = true`];
  if (!a.includeNotForHire) conds.push(sql`COALESCE(cm.not_for_hire, false) = false`);
  if (ranks) conds.push(inList(rankKey, ranks));
  if (nationalities) conds.push(inList(sql`lower(${nationalityOf(sql`cm.nationality_uuid`)})`, nationalities));
  if (a.crewStatus) conds.push(inList(crewStatus, a.crewStatus));
  if (vessels) conds.push(inList(onBoardVessel, vessels.map((v) => v.vesselId)));
  const groupCond = a.rankGroups ? groupCondition(cfg, a.rankGroups, null, rankKey) : null;
  const withGroup = groupCond ? [groupCond] : [];

  const from = sql`FROM crew_members_v2 cm LEFT JOIN crew_personal_details pd ON pd.crew_uuid = cm.crew_uuid AND pd.is_deleted = false`;
  const where = (extra: SQL[]) => sql`WHERE ${sql.join([...conds, ...extra], sql` AND `)}`;
  const availableCond = sql`${availableFrom} IS NOT NULL AND ${availableFrom} <= ${limit}`;

  const base = sql`SELECT cm.crew_uuid AS row_id, cm.crew_uuid, ${fullNameOf("cm")} AS full_name, cm.present_rank AS rank,
      ${groupLabelExpr(cfg, null, rankKey)} AS rank_group, ${nationalityOf(sql`cm.nationality_uuid`)} AS nationality,
      ${crewStatus} AS crew_status, ${vesselNameOf(onBoardVessel)} AS vessel_name, ${availableFrom} AS available_from,
      COALESCE(cm.not_for_hire, false) AS not_for_hire
    ${from} ${where([availableCond, ...withGroup])}`;

  const area: AreaQuery = {
    base,
    rowUnit: "people",
    rowColumns: [
      ["fullName", sql`b.full_name`], ["rank", sql`b.rank`], ["crewStatus", sql`b.crew_status`], ["vesselName", sql`b.vessel_name`],
      ["availableFrom", sql`to_char(b.available_from, 'YYYY-MM-DD')`], ["nationality", sql`b.nationality`],
      ...(a.includeNotForHire ? [["notForHire", sql`b.not_for_hire`] as [string, SQL]] : []), ["crewId", sql`b.crew_uuid`],
    ],
    personColumns: [
      ["fullName", sql`min(b.full_name)`], ["rank", sql`min(b.rank)`], ["crewStatus", sql`min(b.crew_status)`], ["vesselName", sql`min(b.vessel_name)`],
      ["availableFrom", sql`to_char(min(b.available_from), 'YYYY-MM-DD')`], ["nationality", sql`min(b.nationality)`], ["crewId", sql`b.crew_uuid`],
    ],
    rowSort: a.sort === "name" ? sql`b.full_name` : a.sort === "rank" ? sql`b.rank_group, b.rank, b.available_from` : sql`b.available_from ASC, b.full_name`,
    personSort: a.sort === "name" ? sql`min(b.full_name)` : a.sort === "rank" ? sql`min(b.rank_group), min(b.rank)` : sql`min(b.available_from) ASC, min(b.full_name)`,
    groupKeys: { rank: sql`b.rank`, rankGroup: sql`b.rank_group`, crewStatus: sql`b.crew_status`, nationality: sql`b.nationality`, vesselName: sql`b.vessel_name` },
  };
  const result = await runArea(q, area, { ...a, unit: "people" });

  // people matching the other filters whose availability date is missing or unreadable — never silently dropped
  // (on-board crew without a Next Availability date are simply not available — only crew NOT on board count as "no date")
  const [x] = await q(sql`SELECT
      count(*) FILTER (WHERE NOT ${onBoard} AND ${availableFrom} IS NULL AND NOT ${anyAvailText})::int AS missing,
      count(*) FILTER (WHERE ${availableFrom} IS NULL AND ${anyAvailText})::int AS unreadable,
      count(*) FILTER (WHERE ${availableFrom} IS NOT NULL AND ${availableFrom} > ${limit})::int AS later
    ${from} ${where(withGroup)}`);
  const excluded = { noAvailabilityDate: num(x?.missing), unreadableAvailabilityDate: num(x?.unreadable), availableLaterThanAsked: num(x?.later) };

  let rankConfig: Record<string, unknown> | undefined;
  if (usesGroups) {
    const [u] = await q(sql`SELECT count(*)::int AS people, array_remove(array_agg(DISTINCT cm.present_rank), NULL) AS ranks
      ${from} ${where([availableCond, sql`NOT ${classifiedCondition(cfg, null, rankKey)}`])}`);
    rankConfig = { ...rankConfigReport(cfg), unclassifiedInResult: { people: num(u?.people), ranks: (u?.ranks as string[] | null) ?? [] } };
  }

  return {
    ok: true as const,
    area: "availability",
    asOf: ctx.asOf,
    mode: a.mode,
    unit: "people",
    query: { ...a, availableBy: limitText, vessels: vessels?.map((v) => ({ vesselName: v.vesselName })) },
    definitions: [DEFINITIONS.availability, DEFINITIONS.onBoard, ...(usesGroups ? [DEFINITIONS.rankGroups] : []), DEFINITIONS.dates],
    ...result,
    excluded,
    ...(rankConfig ? { rankConfig } : {}),
  };
}
