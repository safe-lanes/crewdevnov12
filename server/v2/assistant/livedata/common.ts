/**
 * Shared pieces of the live-data tools: the result envelope, vessel resolution, paging and the generic
 * list / count / group runner over an area's base query. Group and sort keys are chosen from fixed allow-lists
 * (static SQL), never from caller text.
 */
import { sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Query } from "../repositories/assistantDataRepository";

export const MAX_LIST = 10;
export const MAX_GROUPS = 50;

export type Refusal = { ok: false; error: string; code: string; details?: Record<string, unknown> };
export const refuse = (code: string, error: string, details?: Record<string, unknown>): Refusal => ({ ok: false, code, error, ...(details ? { details } : {}) });

export class ToolRefusal extends Error {
  constructor(public refusal: Refusal) {
    super(refusal.error);
  }
}

export type Area = "vessel" | "documents" | "crewPool" | "due" | "restHours" | "rotation" | "appraisalsAll";

export interface ToolContext {
  asOf: string;
  /** Data areas (menus) this role may view — decided in the service before the tool runs. */
  canView: (area: Area) => boolean;
  /** Data areas (menus) this role may edit (Part B: 'for me' on rotation approvals needs the approver permission). */
  canEdit?: (area: Area) => boolean;
  /** The verified identity behind the call (never a name or id supplied by the model). */
  actor?: { userId: string; role: string | null; userType: string | null };
}

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");
export const windowSchema = z
  .object({
    direction: z.enum(["next", "last"]),
    amount: z.number().int().min(0).max(3650),
    unit: z.enum(["days", "months"]),
  })
  .strict();
export const pagingSchema = {
  limit: z.number().int().min(1).max(MAX_LIST).default(MAX_LIST),
  offset: z.number().int().min(0).max(100000).default(0),
};

export function num(v: unknown): number {
  return typeof v === "number" ? v : parseInt(String(v ?? "0"), 10) || 0;
}

// ── vessels ───────────────────────────────────────────────────────────────────────────────────────────
export interface ResolvedVessel {
  vesselId: string;
  vesselName: string;
}

/** Exact (case-insensitive) name first; else a unique partial match; else not found / ambiguous (refusal). */
export async function resolveVesselNames(q: Query, names: string[]): Promise<ResolvedVessel[]> {
  const out: ResolvedVessel[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const exact = await q(sql`SELECT DISTINCT ON (vessel_uuid) vessel_uuid, vessel FROM master_vessels
      WHERE is_deleted IS NOT TRUE AND lower(btrim(vessel)) = lower(${name}) ORDER BY vessel_uuid, id LIMIT 5`);
    let rows = exact;
    if (rows.length === 0) {
      rows = await q(sql`SELECT DISTINCT ON (vessel_uuid) vessel_uuid, vessel FROM master_vessels
        WHERE is_deleted IS NOT TRUE AND vessel ILIKE ${"%" + name.replace(/[%_\\]/g, "\\$&") + "%"} ORDER BY vessel_uuid, id LIMIT 6`);
    }
    if (rows.length === 0) {
      throw new ToolRefusal(refuse("vessel_not_found", "No vessel with that name in this company.", { requested: { vesselName: name } }));
    }
    if (rows.length > 1) {
      throw new ToolRefusal(
        refuse("vessel_ambiguous", "More than one vessel matches that name — ask the user which one.", {
          requested: { vesselName: name },
          candidates: rows.slice(0, 5).map((r) => ({ vesselId: String(r.vessel_uuid), vesselName: String(r.vessel) })),
        }),
      );
    }
    out.push({ vesselId: String(rows[0].vessel_uuid), vesselName: String(rows[0].vessel) });
  }
  return out;
}

// ── filter values must exist: an unknown value is "not recognised", never a zero result ──────────────────
const DEMONYMS: Record<string, string> = {
  indian: "india", filipino: "philippines", filipina: "philippines", ukrainian: "ukraine", croatian: "croatia",
  british: "united kingdom", russian: "russia", polish: "poland", romanian: "romania", chinese: "china",
  indonesian: "indonesia", bangladeshi: "bangladesh", pakistani: "pakistan", "sri lankan": "sri lanka", myanmar: "myanmar",
};

/** Nationality words → the stored nationality/country text (lower case). Unknown → refusal. */
export async function resolveNationalities(q: Query, names: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim().toLocaleLowerCase();
    const want = DEMONYMS[n] ?? n;
    const rows = await q(sql`SELECT DISTINCT lower(COALESCE(NULLIF(nationality, ''), country_name)) AS v FROM master_nationalities
      WHERE is_deleted IS NOT TRUE AND (lower(nationality) = ${want} OR lower(country_name) = ${want}) LIMIT 2`);
    if (!rows.length) throw new ToolRefusal(refuse("nationality_not_recognised", `Nationality '${raw}' is not in the nationality list.`));
    out.push(String(rows[0].v));
  }
  return out;
}

const RANK_SYNONYMS: Record<string, string> = {
  captain: "master", capt: "master", "chief mate": "chief officer", "c/o": "chief officer", "2/o": "second officer",
  "3/o": "third officer", "2nd mate": "second officer", "3rd mate": "third officer", "second mate": "second officer",
  "third mate": "third officer", "c/e": "chief engineer", "2/e": "second engineer", "3/e": "third engineer", "4/e": "fourth engineer",
  eto: "electrical officer", "electro technical officer": "electrical officer", "electro-technical officer": "electrical officer",
  ab: "able bodied seaman", "able seaman": "able bodied seaman", os: "ordinary seaman", cook: "chief cook", boatswain: "bosun",
};

/** Rank words → normalised rank keys that exist (company rank list or any assignment). Unknown → refusal. */
export async function resolveRanks(q: Query, ranks: string[], normalize: (r: string) => string, rankKey: (c: SQL) => SQL): Promise<string[]> {
  const out: string[] = [];
  for (const raw of ranks) {
    const n = normalize(raw);
    const want = RANK_SYNONYMS[n] ?? n;
    const rows = await q(sql`SELECT 1 FROM (
        SELECT ${rankKey(sql`name`)} AS k FROM adm_available_ranks_v2 WHERE is_deleted = false
        UNION SELECT ${rankKey(sql`rank`)} FROM vessel_planning_v2 WHERE is_deleted = false
        UNION SELECT ${rankKey(sql`present_rank`)} FROM crew_members_v2 WHERE is_deleted = false AND present_rank IS NOT NULL) r
      WHERE r.k = ${want} LIMIT 1`);
    if (!rows.length) throw new ToolRefusal(refuse("rank_not_recognised", `Rank '${raw}' is not a recognised rank.`));
    out.push(want);
  }
  return out;
}

export function inList(expr: SQL, values: string[]): SQL {
  return sql`${expr} IN (${sql.join(values.map((v) => sql`${v}`), sql`, `)})`;
}

// ── generic runner ────────────────────────────────────────────────────────────────────────────────────
export interface AreaQuery {
  /** SELECT … over ONE row per counted record (row_id unique, crew_uuid set); already filtered. */
  base: SQL;
  /** unit name for one base row, e.g. "documents" or "assignments". */
  rowUnit: string;
  /** columns of a row-level list item: [outputKey, SQL over alias b]. */
  rowColumns: [string, SQL][];
  /** columns of a person-level list item (aggregates over alias b grouped by crew_uuid). */
  personColumns: [string, SQL][];
  rowSort: SQL;
  personSort: SQL;
  groupKeys: Record<string, SQL>;
}

export interface RunArgs {
  mode: "list" | "count" | "group";
  unit: "people" | string;
  groupBy?: string[];
  limit: number;
  offset: number;
}

function selectList(cols: [string, SQL][]): SQL {
  return sql.join(
    cols.map(([k, e]) => sql`${e} AS ${sql.identifier(k)}`),
    sql`, `,
  );
}

export async function runArea(q: Query, a: AreaQuery, r: RunArgs) {
  const [tot] = await q(sql`SELECT count(*)::int AS rows_n, count(DISTINCT b.crew_uuid)::int AS people_n FROM (${a.base}) b`);
  const totals: Record<string, number> = { [a.rowUnit]: num(tot?.rows_n), people: num(tot?.people_n) };
  const unitTotal = r.unit === "people" ? totals.people : totals[a.rowUnit];

  if (r.mode === "count") {
    return { totals, total: unitTotal };
  }

  if (r.mode === "group") {
    const keys = (r.groupBy ?? []).map((k) => [k, a.groupKeys[k]] as [string, SQL]);
    const sel = selectList(keys.map(([k, e]) => [k, e]));
    const by = sql.join(keys.map(([, e]) => e), sql`, `);
    const groups = await q(sql`SELECT ${sel}, count(*)::int AS ${sql.identifier(a.rowUnit)}, count(DISTINCT b.crew_uuid)::int AS people
      FROM (${a.base}) b GROUP BY ${by}
      ORDER BY ${r.unit === "people" ? sql`count(DISTINCT b.crew_uuid)` : sql`count(*)`} DESC, ${by} LIMIT ${MAX_GROUPS}`);
    const [g] = await q(sql`SELECT count(*)::int AS n FROM (SELECT 1 FROM (${a.base}) b GROUP BY ${by}) g`);
    const groupsTotal = num(g?.n);
    return { totals, total: unitTotal, groups, groupsTotal, groupsTruncated: groupsTotal > groups.length };
  }

  const rows =
    r.unit === "people"
      ? await q(sql`SELECT ${selectList(a.personColumns)} FROM (${a.base}) b GROUP BY b.crew_uuid ORDER BY ${a.personSort}, b.crew_uuid
          LIMIT ${r.limit} OFFSET ${r.offset}`)
      : await q(sql`SELECT ${selectList(a.rowColumns)} FROM (${a.base}) b ORDER BY ${a.rowSort}, b.row_id LIMIT ${r.limit} OFFSET ${r.offset}`);
  const nextOffset = r.offset + rows.length < unitTotal ? r.offset + rows.length : null;
  return { totals, total: unitTotal, returned: rows.length, offset: r.offset, nextOffset, rows };
}
