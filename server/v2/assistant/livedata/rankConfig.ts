/**
 * Rank groups from Rank Administration — the configured authority (Sahil, questionnaire A5, 29-Oct-2026):
 * "Always use reference from this Admin section for rank categories, rather than relying on a hard coded table."
 *
 * Where the configuration lives (READ from the Crewing code, 29-Oct-2026):
 *   Rank Master  adm_available_ranks_v2   name, rank_id (R001…), applicable_to_company → which ranks the Company tab offers
 *   Company      adm_company_ranks_v2     one row per rank (+ one per role variant, e.g. AB_1) with the category flags
 *                                         officer, rating, senior_officer, deck_officer, eng_officer, petty_officer,
 *                                         deck_rating, engine_rating, general_rating, catering_rating (+ duty flags)
 *   Vessel       vessel revision JSON     getRanksByVesselId (vesselRevisionsService.ts) takes the CATEGORY flags from the
 *                                         company row first (`companyRank?.officer ?? vesselRank.officer`); only the duty
 *                                         flags (safety officer, SSO, medical, navigating, environmental) are vessel-first.
 * So for "officers / engineers / ratings / …" the Company tab is the authority and no vessel override exists. The duty
 * flags are per vessel and are NOT offered as groups here (a later area, if asked).
 *
 * A rank is matched to its configuration row by rank_id (vessel_planning_v2.rank_id holds the Rank Master id) and,
 * failing that, by normalised name (company rank, role variant such as AB_1, or the Rank Master name of the same
 * rank_id). A rank that has no category flag, or that is not configured at all, is UNCLASSIFIED: it is never put into a
 * group silently — the tool result reports it (`rankConfig.unclassified…`), the model tells the user.
 *
 * All SQL here is static text or drizzle `sql` parameters — never caller-supplied identifiers.
 */
import { sql, type SQL } from "drizzle-orm";
import type { Query } from "../repositories/assistantDataRepository";
import { normalizeRankText } from "./definitions";

/** Base groups = the category flag columns of the Company tab. */
export const RANK_GROUP_FLAGS = {
  officers: "officer",
  ratings: "rating",
  senior_officers: "senior_officer",
  deck_officers: "deck_officer",
  engine_officers: "eng_officer",
  petty_officers: "petty_officer",
  deck_ratings: "deck_rating",
  engine_ratings: "engine_rating",
  general_ratings: "general_rating",
  catering_ratings: "catering_rating",
} as const;
export type BaseGroup = keyof typeof RANK_GROUP_FLAGS;

/** Everyday words that stand for ONE configured flag or a union of flags (never a hand-written rank list). */
export const RANK_GROUP_UNIONS: Record<string, BaseGroup[]> = {
  engineers: ["engine_officers"], // "engineers" = the ranks flagged Eng Officer on the Company tab (Electrical Officer is one where the company ticks it)
  deck: ["deck_officers", "deck_ratings"],
  engine: ["engine_officers", "engine_ratings"],
};
export const RANK_GROUP_NAMES = [...(Object.keys(RANK_GROUP_FLAGS) as BaseGroup[]), ...Object.keys(RANK_GROUP_UNIONS)] as const;

/** Label precedence when a rank carries several flags (Master = officer + senior + deck → "deck_officers"). */
const LABEL_ORDER: BaseGroup[] = [
  "deck_officers", "engine_officers", "petty_officers", "deck_ratings", "engine_ratings", "catering_ratings", "general_ratings",
  "senior_officers", "officers", "ratings",
];

export const RANK_CONFIG_SOURCE = "Admin → Rank Administration → Company tab (adm_company_ranks_v2), matched by rank id, else by name";

export interface RankConfig {
  keysByGroup: Record<BaseGroup, Set<string>>;
  idsByGroup: Record<BaseGroup, Set<string>>;
  classifiedKeys: Set<string>;
  classifiedIds: Set<string>;
  /** configured ranks (display names) that carry no category flag */
  unclassifiedConfigured: string[];
  /** configuration problems found (reported, never repaired here) */
  issues: string[];
  configuredRanks: number;
}

function baseGroupsOf(groups: string[]): BaseGroup[] {
  const out = new Set<BaseGroup>();
  for (const g of groups) {
    const bases = RANK_GROUP_UNIONS[g] ?? ((g in RANK_GROUP_FLAGS) ? [g as BaseGroup] : []);
    for (const b of bases) out.add(b);
  }
  return [...out];
}

export async function loadRankConfig(q: Query): Promise<RankConfig> {
  const flagCols = Object.values(RANK_GROUP_FLAGS);
  const company = await q(sql`SELECT id, rank, role, rank_id, is_role_row, original_rank_id,
      ${sql.join(flagCols.map((c) => sql`COALESCE(${sql.identifier(c)}, false) AS ${sql.identifier(c)}`), sql`, `)}
    FROM adm_company_ranks_v2 WHERE is_deleted = false ORDER BY id`);
  const master = await q(sql`SELECT name, rank_id, applicable_to_company FROM adm_available_ranks_v2 WHERE is_deleted = false ORDER BY sort_order, id`);

  const masterNamesById = new Map<string, string[]>();
  for (const m of master) {
    const id = String(m.rank_id ?? "").trim();
    if (!id) continue;
    masterNamesById.set(id, [...(masterNamesById.get(id) ?? []), String(m.name)]);
  }

  const empty = () => Object.fromEntries(Object.keys(RANK_GROUP_FLAGS).map((g) => [g, new Set<string>()])) as Record<BaseGroup, Set<string>>;
  const cfg: RankConfig = {
    keysByGroup: empty(), idsByGroup: empty(), classifiedKeys: new Set(), classifiedIds: new Set(),
    unclassifiedConfigured: [], issues: [], configuredRanks: 0,
  };
  const parentFlags = new Map<string, Set<BaseGroup>>(); // company row id → groups (for role rows)
  const unclassified = new Set<string>();
  const configuredIds = new Set<string>();

  for (const r of company) {
    const groups = new Set<BaseGroup>();
    for (const [g, col] of Object.entries(RANK_GROUP_FLAGS) as [BaseGroup, string][]) if (r[col] === true) groups.add(g);
    const rankName = String(r.rank ?? "").trim();
    const roleName = String(r.role ?? "").trim();
    const rankId = String(r.rank_id ?? "").trim();
    const isRole = r.is_role_row === true;
    if (!isRole) {
      cfg.configuredRanks++;
      parentFlags.set(String(r.id), groups);
      if (rankId) configuredIds.add(rankId);
    }
    if (groups.has("officers") && groups.has("ratings")) cfg.issues.push(`'${roleName || rankName}' is flagged both Officer and Rating`);
    let effective = groups;
    if (isRole && groups.size === 0) {
      const parent = parentFlags.get(String(r.original_rank_id ?? ""));
      if (parent && parent.size) {
        effective = parent;
        cfg.issues.push(`role variant '${roleName}' has no category flags; its parent rank '${rankName}' is used`);
      }
    }
    if (isRole && groups.size && parentFlags.get(String(r.original_rank_id ?? ""))?.size &&
        [...groups].sort().join(",") !== [...(parentFlags.get(String(r.original_rank_id ?? "")) as Set<BaseGroup>)].sort().join(",")) {
      cfg.issues.push(`role variant '${roleName}' is flagged differently from its parent rank '${rankName}'`);
    }
    const keys = new Set<string>();
    if (rankName) keys.add(normalizeRankText(rankName));
    if (roleName) keys.add(normalizeRankText(roleName));
    for (const n of masterNamesById.get(rankId) ?? []) keys.add(normalizeRankText(n));
    if (effective.size === 0) {
      unclassified.add(rankName || roleName);
      continue;
    }
    for (const g of effective) {
      for (const k of keys) cfg.keysByGroup[g].add(k);
      if (rankId) cfg.idsByGroup[g].add(rankId);
    }
    for (const k of keys) cfg.classifiedKeys.add(k);
    if (rankId) cfg.classifiedIds.add(rankId);
  }
  // a rank name is unclassified only if NO row (rank or role variant) classifies it
  cfg.unclassifiedConfigured = [...unclassified].filter((n) => !cfg.classifiedKeys.has(normalizeRankText(n))).sort();
  for (const m of master) {
    const id = String(m.rank_id ?? "").trim();
    if (m.applicable_to_company === true && id && !configuredIds.has(id)) {
      cfg.issues.push(`'${String(m.name)}' is applicable to the company in Rank Master but has no row on the Company tab`);
    }
  }
  if (cfg.configuredRanks === 0) cfg.issues.push("the Company tab of Rank Administration has no ranks — no rank group can be answered");
  return cfg;
}

function inOrFalse(expr: SQL, values: Iterable<string>): SQL | null {
  const list = [...values];
  return list.length ? sql`${expr} IN (${sql.join(list.map((v) => sql`${v}`), sql`, `)})` : null;
}

function anyOf(parts: (SQL | null)[]): SQL {
  const live = parts.filter((p): p is SQL => p !== null);
  return live.length ? sql`(${sql.join(live, sql` OR `)})` : sql`FALSE`;
}

/** Rank belongs to one of the requested groups. `rankIdCol` may be null where only the rank text is available. */
export function groupCondition(cfg: RankConfig, groups: string[], rankIdCol: SQL | null, rankKeyExpr: SQL): SQL {
  const keys = new Set<string>();
  const ids = new Set<string>();
  for (const b of baseGroupsOf(groups)) {
    for (const k of cfg.keysByGroup[b]) keys.add(k);
    for (const i of cfg.idsByGroup[b]) ids.add(i);
  }
  return anyOf([rankIdCol ? inOrFalse(rankIdCol, ids) : null, inOrFalse(rankKeyExpr, keys)]);
}

/** Rank carries at least one category flag in the configuration. */
export function classifiedCondition(cfg: RankConfig, rankIdCol: SQL | null, rankKeyExpr: SQL): SQL {
  return anyOf([rankIdCol ? inOrFalse(rankIdCol, cfg.classifiedIds) : null, inOrFalse(rankKeyExpr, cfg.classifiedKeys)]);
}

/** Group label for grouping / sorting: the most specific configured category, else 'unclassified'. */
export function groupLabelExpr(cfg: RankConfig, rankIdCol: SQL | null, rankKeyExpr: SQL): SQL {
  const whens: SQL[] = [];
  for (const g of LABEL_ORDER) {
    const cond = anyOf([rankIdCol ? inOrFalse(rankIdCol, cfg.idsByGroup[g]) : null, inOrFalse(rankKeyExpr, cfg.keysByGroup[g])]);
    whens.push(sql`WHEN ${cond} THEN ${g}`);
  }
  return sql`(CASE ${sql.join(whens, sql` `)} ELSE 'unclassified' END)`;
}

/** What the tool result says about the configuration it used (always present when groups were involved). */
export function rankConfigReport(cfg: RankConfig) {
  return {
    source: RANK_CONFIG_SOURCE,
    groups: Object.keys(RANK_GROUP_FLAGS),
    unclassifiedConfiguredRanks: cfg.unclassifiedConfigured,
    ...(cfg.issues.length ? { issues: cfg.issues } : {}),
  };
}
