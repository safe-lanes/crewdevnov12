/**
 * Business definitions for the assistant's live-data tools (stage 2, PILOT TRIAL) — ONE home per concept.
 *
 * Each definition says where it comes from:
 *   CODE        — taken unchanged from an existing Crewing screen/service (cited);
 *   PROVISIONAL — the code is silent or conflicting; a trial rule pending Sahil/Sagar (docs/output questionnaire).
 * The existing reports are NOT changed; several of them disagree with these rules (see the architecture proposal §1).
 *
 * All SQL here is static text or drizzle `sql` parameters — never caller-supplied identifiers.
 */
import { sql, type SQL } from "drizzle-orm";

export const DEFINITIONS = {
  onBoard:
    "CODE (Vessel screen crew count, vesselCrewCountController.ts): crew_status primary or secondary, assignment not archived/deleted, crew and vessel set, sign-on date set.",
  onBoardSecondary: "PROVISIONAL: secondary assignments count as on board (as the Vessel screen count does) — pending decision D1.",
  documents:
    "PROVISIONAL: licences/certificates (archived licences excluded) and training courses; crew who are deleted or archived are excluded.",
  expired: "PROVISIONAL: expired = expiry date before the as-of date; expiring = expiry date from the as-of date up to the end of the window.",
  rankGroups: "PROVISIONAL: rank groups are a fixed trial list (rank categories in the data are inconsistent) — pending decision D1.",
  dates: "Dates are stored as text; only YYYY-MM-DD values are read. Records with other date text are counted under 'excluded', never silently dropped.",
} as const;

/** The as-of date for every calculation. Test seam: ASSISTANT_DATA_AS_OF (ignored in production). */
export function asOfDate(): string {
  const pinned = (process.env.ASSISTANT_DATA_AS_OF || "").trim();
  if (pinned && process.env.NODE_ENV !== "production" && /^\d{4}-\d{2}-\d{2}$/.test(pinned)) return pinned;
  const tz = (process.env.ASSISTANT_DATA_TIMEZONE || "UTC").trim();
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Text column → date, NULL unless strictly YYYY-MM-DD and a real calendar date (same rule as reports/_shared.ts). */
export function dateOf(col: SQL): SQL {
  return sql`(CASE WHEN ${col} ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' AND pg_input_is_valid(${col}, 'date') THEN (${col})::date ELSE NULL END)`;
}

export function hasText(col: SQL): SQL {
  return sql`(NULLIF(btrim(${col}), '') IS NOT NULL)`;
}

/** On-board assignment predicate over vessel_planning_v2 aliased `vp` (CODE: vesselCrewCountController.ts:12-31). */
export const ON_BOARD_VP: SQL = sql`(vp.crew_status IN ('primary', 'secondary') AND vp.is_archived = false AND vp.is_deleted = false
  AND vp.crew_uuid IS NOT NULL AND vp.vessel_uuid IS NOT NULL AND vp.sign_on_date IS NOT NULL)`;

/** Same predicate for an inner alias `ob` (used in EXISTS subqueries). */
export const ON_BOARD_OB: SQL = sql`(ob.crew_status IN ('primary', 'secondary') AND ob.is_archived = false AND ob.is_deleted = false
  AND ob.crew_uuid IS NOT NULL AND ob.vessel_uuid IS NOT NULL AND ob.sign_on_date IS NOT NULL)`;

/** Vessel name by uuid without join fan-out (master_vessels.vessel_uuid is not declared unique). */
export function vesselNameOf(uuidCol: SQL): SQL {
  return sql`(SELECT mv.vessel FROM master_vessels mv WHERE mv.vessel_uuid = ${uuidCol} ORDER BY mv.is_deleted, mv.id LIMIT 1)`;
}

/** Nationality by uuid without join fan-out (master_nationalities.nat_uuid is not unique). */
export function nationalityOf(uuidCol: SQL): SQL {
  return sql`(SELECT COALESCE(NULLIF(mn.nationality, ''), mn.country_name) FROM master_nationalities mn WHERE mn.nat_uuid = ${uuidCol} ORDER BY mn.id LIMIT 1)`;
}

export function fullNameOf(alias: "cm"): SQL {
  void alias;
  return sql`TRIM(BOTH ' ' FROM CONCAT_WS(' ', NULLIF(cm.first_name, ''), NULLIF(cm.middle_name, ''), NULLIF(cm.family_name, '')))`;
}

/** Rank text → normalised key: lower case, `_1` suffixes stripped, ordinals spelled out (2nd → second). */
export function normalizeRankText(rank: string): string {
  return rank
    .trim()
    .toLocaleLowerCase()
    .replace(/_\d+$/, "")
    .replace(/\b1st\b/g, "first")
    .replace(/\b2nd\b/g, "second")
    .replace(/\b3rd\b/g, "third")
    .replace(/\b4th\b/g, "fourth")
    .replace(/\b5th\b/g, "fifth")
    .replace(/\s+/g, " ");
}

/** SQL twin of normalizeRankText for a rank column. */
export function rankKeyOf(col: SQL): SQL {
  return sql`regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(btrim(${col})), '_[0-9]+$', ''),
    '\\m1st\\M', 'first', 'g'), '\\m2nd\\M', 'second', 'g'), '\\m3rd\\M', 'third', 'g'), '\\m4th\\M', 'fourth', 'g'), '\\m5th\\M', 'fifth', 'g')`;
}

/** PROVISIONAL rank groups (D1). Keys are normalised rank names. */
export const RANK_GROUPS: Record<string, string[]> = {
  deck_officers: ["master", "chief officer", "second officer", "third officer"],
  engine_officers: ["chief engineer", "second engineer", "third engineer", "fourth engineer", "fifth engineer", "electrical officer", "gas engineer"],
  deck_ratings: ["bosun", "able bodied seaman", "ordinary seaman", "pumpman"],
  engine_ratings: ["fitter", "motorman", "oiler", "wiper"],
  catering: ["chief cook", "messman"],
  cadets: ["deck cadet", "engine cadet"],
};
export const RANK_GROUP_UNIONS: Record<string, string[]> = {
  // "engineers" in everyday speech = the engine officers (PROVISIONAL, decision 5). A named group, so the word maps to
  // ONE server rule instead of the model choosing a combination (trial run 3 once combined officers + ratings).
  engineers: ["engine_officers"],
  officers: ["deck_officers", "engine_officers"],
  ratings: ["deck_ratings", "engine_ratings"],
  deck: ["deck_officers", "deck_ratings"],
  engine: ["engine_officers", "engine_ratings"],
};
export const RANK_GROUP_NAMES = [...Object.keys(RANK_GROUPS), ...Object.keys(RANK_GROUP_UNIONS)] as const;

export function ranksForGroups(groups: string[]): string[] {
  const out = new Set<string>();
  for (const g of groups) {
    for (const base of RANK_GROUP_UNIONS[g] ?? [g]) for (const r of RANK_GROUPS[base] ?? []) out.add(r);
  }
  if (groups.includes("deck")) out.add("deck cadet");
  if (groups.includes("engine")) out.add("engine cadet");
  return [...out];
}

/** Rank → primary group label (for grouping). */
export function rankGroupLabelOf(rankKey: SQL): SQL {
  const whens = Object.entries(RANK_GROUPS).map(
    ([g, ranks]) => sql`WHEN ${rankKey} IN (${sql.join(ranks.map((r) => sql`${r}`), sql`, `)}) THEN ${g}`,
  );
  return sql`(CASE ${sql.join(whens, sql` `)} ELSE 'other' END)`;
}

/** A date window relative to the as-of date: next/last N days or calendar months (never mixed). */
export interface Window {
  direction: "next" | "last";
  amount: number;
  unit: "days" | "months";
}

export function windowBounds(asOf: string, w: Window): { from: SQL; to: SQL } {
  const base = sql`${asOf}::date`;
  const shift = w.unit === "days" ? sql`make_interval(days => ${w.amount}::int)` : sql`make_interval(months => ${w.amount}::int)`;
  return w.direction === "next"
    ? { from: base, to: sql`(${base} + ${shift})::date` }
    : { from: sql`(${base} - ${shift})::date`, to: base };
}
