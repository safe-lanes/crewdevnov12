/**
 * Live-data area (Part B3): rest-hour violations — Sahil's decision of 29-Oct-2026: live recalculation from the daily
 * records (the Rest Hours overview's engine), rest mode, OPA off unless asked; month and last-updated date always stated.
 *
 * One base row = ONE crew member's record for ONE month (rh_daily_records_v2). Violations and non-conformities are computed
 * here with the RH module's own helpers (CODE: rest-hours/utils/violationHelpers.ts, the same calls the date-accurate report
 * branch makes), restricted to the record's applicable days (sign-on / promotion windows). Stored monthly totals
 * (rh_crew_records_v2) are NOT read. Computation runs in the read-only transaction; nothing is written.
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { DEFINITIONS, normalizeRankText, rankKeyOf } from "./definitions";
import { RANK_GROUP_NAMES, classifiedCondition, groupCondition, groupLabelExpr, loadRankConfig, rankConfigReport } from "./rankConfig";
import { MAX_GROUPS, inList, num, pagingSchema, refuse, resolveRanks, resolveVesselNames, ToolRefusal, type ToolContext } from "./common";
import { calculateNCs, getViolationDates } from "../../rest-hours/utils/violationHelpers";
import type { Query } from "../repositories/assistantDataRepository";

const MAX_MONTHS = 12;

export const restHoursArgs = z
  .object({
    mode: z.enum(["list", "count", "group"]).default("list"),
    groupBy: z.array(z.enum(["vesselName", "rank", "rankGroup", "month"])).min(1).max(2).optional(),
    /** months to cover, YYYY-MM each (default: the as-of month) */
    months: z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)).min(1).max(MAX_MONTHS).optional(),
    /** or: the last N months counted back from the as-of month (1 = the as-of month only) */
    lastMonths: z.number().int().min(1).max(MAX_MONTHS).optional(),
    vessels: z.array(z.string().trim().min(1).max(120)).min(1).max(10).optional(),
    ranks: z.array(z.string().trim().min(1).max(60)).min(1).max(20).optional(),
    rankGroups: z.array(z.enum(RANK_GROUP_NAMES as unknown as [string, ...string[]])).min(1).optional(),
    crewIds: z.array(z.string().trim().min(8).max(64)).min(1).max(20).optional(),
    /** OPA 90 work-hour limits on top of the rest-hour rules — only when the user asks ("with OPA") */
    opa: z.boolean().default(false),
    /** true (default) = only records with at least one violation */
    violationsOnly: z.boolean().default(true),
    sort: z.enum(["violations_desc", "vessel", "name"]).default("violations_desc"),
    ...pagingSchema,
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.mode === "group" && !a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is required when mode is group" });
    if (a.mode !== "group" && a.groupBy) ctx.addIssue({ code: "custom", message: "groupBy is only allowed when mode is group" });
    if (a.months && a.lastMonths) ctx.addIssue({ code: "custom", message: "give months or lastMonths, not both" });
  });
export type RestHoursArgs = z.infer<typeof restHoursArgs>;

function monthsBack(asOf: string, n: number): string[] {
  const [y, m] = asOf.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out.reverse();
}

interface Row { recordId: string; crewId: string | null; fullName: string | null; rank: string | null; rankGroup: string; vesselName: string | null;
  month: string; violations: number; ncs: number; daysCounted: string; lastUpdated: string | null; }

export async function queryRestHours(q: Query, ctx: ToolContext, a: RestHoursArgs) {
  const vessels = a.vessels ? await resolveVesselNames(q, a.vessels) : undefined;
  const ranks = a.ranks ? await resolveRanks(q, a.ranks, normalizeRankText, rankKeyOf) : undefined;
  const cfg = await loadRankConfig(q);
  const usesGroups = !!a.rankGroups || !!a.groupBy?.includes("rankGroup");
  const months = a.months ?? monthsBack(ctx.asOf, a.lastMonths ?? 1);
  const rankKey = rankKeyOf(sql`d.rank`);

  const conds: SQL[] = [sql`d.is_deleted = false`, inList(sql`d.month_year`, months)];
  if (vessels) conds.push(inList(sql`d.vessel_id`, vessels.map((v) => v.vesselId)));
  if (ranks) conds.push(inList(rankKey, ranks));
  if (a.rankGroups) conds.push(groupCondition(cfg, a.rankGroups, null, rankKey));
  if (a.crewIds) conds.push(inList(sql`d.crew_member_id`, a.crewIds));
  const where = sql`WHERE ${sql.join(conds, sql` AND `)}`;

  const [cnt] = await q(sql`SELECT count(*)::int AS n FROM rh_daily_records_v2 d ${where}`);
  if (num(cnt?.n) > 2000) {
    throw new ToolRefusal(refuse("too_many_records", `${num(cnt?.n)} monthly records match — narrow the question (one vessel or fewer months).`));
  }
  const rows = await q(sql`SELECT d.rh_daily_uuid, d.crew_member_id, d.name, d.rank, d.month_year, d.daily_records::text AS daily_records,
      d.applicable_from, d.applicable_to, d.updated_at,
      (SELECT mv.vessel FROM master_vessels mv WHERE mv.vessel_uuid = d.vessel_id ORDER BY mv.is_deleted, mv.id LIMIT 1) AS vessel_name,
      ${groupLabelExpr(cfg, null, rankKey)} AS rank_group, ${classifiedCondition(cfg, null, rankKey)} AS classified
    FROM rh_daily_records_v2 d ${where} ORDER BY d.month_year, d.vessel_id, d.name, d.id`);

  const computed: Row[] = [];
  let unclassifiedPeople = new Set<string>();
  const unclassifiedRanks = new Set<string>();
  for (const r of rows) {
    const month = String(r.month_year);
    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let dayFrom = 1;
    let dayTo = daysInMonth;
    const af = r.applicable_from ? String(r.applicable_from) : "";
    const at = r.applicable_to ? String(r.applicable_to) : "";
    if (af.startsWith(month)) dayFrom = Math.max(dayFrom, parseInt(af.split("-")[2], 10) || 1);
    if (at.startsWith(month)) dayTo = Math.min(dayTo, parseInt(at.split("-")[2], 10) || daysInMonth);
    if (dayFrom > dayTo) continue;
    const dayRange = { from: dayFrom, to: dayTo };
    const json = String(r.daily_records ?? "[]");
    const violations = getViolationDates(json, "Rest", a.opa, false, dayRange).length;
    const { totalNCs } = calculateNCs(json, "Rest", a.opa, dayRange);
    if (r.classified === false && r.rank) { unclassifiedRanks.add(String(r.rank)); if (r.crew_member_id) unclassifiedPeople.add(String(r.crew_member_id)); }
    if (a.violationsOnly && violations === 0) continue;
    computed.push({
      recordId: String(r.rh_daily_uuid), crewId: r.crew_member_id ? String(r.crew_member_id) : null, fullName: r.name ? String(r.name) : null,
      rank: r.rank ? String(r.rank) : null, rankGroup: String(r.rank_group ?? "unclassified"), vesselName: r.vessel_name ? String(r.vessel_name) : null,
      month, violations, ncs: totalNCs, daysCounted: `${dayFrom}–${dayTo}`,
      lastUpdated: r.updated_at ? new Date(r.updated_at as string).toISOString().slice(0, 10) : null,
    });
  }

  const people = new Set(computed.map((r) => r.crewId ?? r.fullName ?? r.recordId)).size;
  const totals = { records: computed.length, people, violations: computed.reduce((s, r) => s + r.violations, 0), ncs: computed.reduce((s, r) => s + r.ncs, 0) };
  const lastUpdated = computed.reduce<string | null>((m, r) => (r.lastUpdated && (!m || r.lastUpdated > m) ? r.lastUpdated : m), null);
  const common = {
    ok: true as const, area: "restHours", asOf: ctx.asOf, mode: a.mode, unit: "records",
    query: { ...a, months, vessels: vessels?.map((v) => ({ vesselName: v.vesselName })) },
    definitions: [DEFINITIONS.restHours, ...(usesGroups ? [DEFINITIONS.rankGroups] : [])],
    totals, total: totals.records, months, opa: a.opa, lastUpdated,
    recordsRead: rows.length,
    ...(usesGroups ? { rankConfig: { ...rankConfigReport(cfg), unclassifiedInResult: { people: unclassifiedPeople.size, ranks: [...unclassifiedRanks].sort() } } } : {}),
  };
  if (a.mode === "count") return common;

  if (a.mode === "group") {
    const keyOf = (r: Row, k: string) => (k === "vesselName" ? r.vesselName : k === "rank" ? r.rank : k === "rankGroup" ? r.rankGroup : r.month) ?? null;
    const keys = a.groupBy ?? [];
    interface Group { labels: Record<string, string | null>; records: number; people: Set<string>; violations: number; ncs: number }
    const groups = new Map<string, Group>();
    for (const r of computed) {
      const id = keys.map((k) => String(keyOf(r, k))).join("\u0000");
      const g = groups.get(id) ?? { labels: Object.fromEntries(keys.map((k) => [k, keyOf(r, k)])), records: 0, people: new Set<string>(), violations: 0, ncs: 0 };
      g.records += 1;
      g.people.add(r.crewId ?? r.fullName ?? r.recordId);
      g.violations += r.violations;
      g.ncs += r.ncs;
      groups.set(id, g);
    }
    const list = [...groups.values()]
      .map((g) => ({ ...g.labels, records: g.records, people: g.people.size, violations: g.violations, ncs: g.ncs }))
      .sort((x, y) => y.violations - x.violations);
    return { ...common, groups: list.slice(0, MAX_GROUPS), groupsTotal: list.length, groupsTruncated: list.length > MAX_GROUPS };
  }

  const sorted = computed.slice().sort((x, y) =>
    a.sort === "vessel" ? String(x.vesselName ?? "").localeCompare(String(y.vesselName ?? "")) || y.violations - x.violations
    : a.sort === "name" ? String(x.fullName ?? "").localeCompare(String(y.fullName ?? ""))
    : y.violations - x.violations || String(x.fullName ?? "").localeCompare(String(y.fullName ?? "")));
  const page = sorted.slice(a.offset, a.offset + a.limit);
  const nextOffset = a.offset + page.length < sorted.length ? a.offset + page.length : null;
  return { ...common, returned: page.length, offset: a.offset, nextOffset, rows: page.map(({ recordId, ...r }) => r) };
}
