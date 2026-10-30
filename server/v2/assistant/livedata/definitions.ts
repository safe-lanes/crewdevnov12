/**
 * Business definitions for the assistant's live-data tools (stage 2, PILOT TRIAL) — ONE home per concept.
 *
 * Each definition says where it comes from:
 *   CODE        — taken unchanged from an existing Crewing screen/service (cited);
 *   CONFIRMED   — decided by Sahil in the business-rules questionnaire (responses of 29-Oct-2026, question number cited);
 *   PROVISIONAL — the code is silent or conflicting and the question is still open.
 * The existing reports are NOT changed; several of them disagree with these rules (see the architecture proposal §1).
 *
 * All SQL here is static text or drizzle `sql` parameters — never caller-supplied identifiers.
 */
import { sql, type SQL } from "drizzle-orm";

export const DEFINITIONS = {
  onBoard:
    "CODE (Vessel screen crew count, vesselCrewCountController.ts): an assignment with crew status primary or secondary, not archived/deleted, " +
    "crew and vessel set, sign-on date set. CONFIRMED (A1): during a handover the person on board is 'primary' and the reliever who has " +
    "signed on is 'secondary'; both count while both are on board. A planned reliever who has not signed on does not count.",
  documents:
    "CONFIRMED (A2): 'certificates' means both kinds — licences/certificates (archived ones excluded) and training-course certificates. " +
    "CONFIRMED (A6): terminated crew (status starting with 'Terminated') are excluded; inactive crew are included; deleted or archived crew are excluded.",
  expired:
    "CONFIRMED (A4): a question about documents expiring in a period lists the documents already expired TOGETHER with those expiring " +
    "by the end of the period; each record is marked expired or upcoming and both counts are given. Expired = expiry date before the as-of date. " +
    "PROVISIONAL: no lower bound — a document that expired years ago is still listed as expired.",
  rankGroups:
    "CONFIRMED (A5): rank groups (officers, engineers, ratings, deck/engine officers and ratings, catering…) come from Admin → Rank " +
    "Administration → Company tab, not from a fixed list. A rank with no category there is 'unclassified' and is reported, never guessed.",
  dates: "Dates are stored as text; only YYYY-MM-DD values are read. Records with other date text are counted under 'excluded', never silently dropped.",
  // ── Part B (Sahil's decisions of 29-Oct-2026, applied 30-Oct-2026) ──
  availability:
    "CONFIRMED (B1): 'available to join by <date>' = crew not terminated, (a) on leave with an availability date on or before the date " +
    "— people already available today included — or (b) currently on board with a Next Availability date on or before the date. Crew without " +
    "an availability date are counted under 'excluded', not listed. Not-for-rehire crew are left out unless asked for.",
  relief:
    "CONFIRMED (B2): due / overdue follow the Due Crew screen rule — contract end = sign-on + contract months (or the tolerance range " +
    "set on the assignment); overdue = past the range end; 'due within a period' = the recorded relief-due date inside the period, or " +
    "already overdue. The recorded relief-due date is shown and flagged when it differs from the contract end.",
  restHours:
    "CONFIRMED (B3): rest-hour violations are recalculated live from the daily records (the Rest Hours overview's engine), rest mode; " +
    "OPA off unless the user asks for it; the month and the date the records were last updated are always stated. Stored monthly totals are not used.",
  rotation:
    "CONFIRMED (B4): a rotation plan is waiting for approval when its status is Proposed or Partially Approved; approval is recorded per " +
    "entry (Pending / Deployed = approved / Rejected). Company-wide. Crewing records no individual approver, so a personal approval queue " +
    "cannot be identified: 'waiting for my approval' is answered with the company's pending plans, labelled as such. Drafts (In Draft) are listed separately.",
  manning:
    "CONFIRMED (B5): a position is a planned rank slot on an active vessel; it is filled when a person has SIGNED ON to it (primary, or the " +
    "signed-on reliever during a handover); an empty slot or a planned person who has not signed on is a vacancy. Ranks follow Rank Administration.",
  appraisals:
    "CONFIRMED (B6): pending = submitted but not completed (preliminary / submitted / pending office review); drafts are listed separately; " +
    "completed = reviewed. Archived and terminated crew are excluded. The vessel is the one the appraisal was made on (its recorded vessel " +
    "name matched exactly to one vessel; unmatched, ambiguous or missing names are reported). CONFIRMED (Sahil, 31-Oct-2026): office users " +
    "who may use the assistant may view appraisals across all vessels of their own company. Scores: only the overall score of a COMPLETED " +
    "appraisal with its date, only when asked for; draft scores, individual assessment scores and remarks are never shown.",
} as const;

/** Appraisal status classes (CODE: appraisalResultsService STATUS_ORDER + report synonyms). */
export const APPRAISAL_STATUS_CLASS: SQL = sql`(CASE
  WHEN lower(btrim(coalesce(a.status, ''))) IN ('draft', '') THEN 'draft'
  WHEN lower(btrim(a.status)) IN ('reviewed', 'stage3_submitted', 'completed', 'approved', 'closed', 'final') THEN 'completed'
  ELSE 'pending' END)`;

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

/** CONFIRMED (A6): terminated = crew status starting with 'Terminated' (covers the UT / BT / General / NFR variants). Alias `cm`. */
export const NOT_TERMINATED_CM: SQL = sql`(cm.status IS NULL OR cm.status NOT ILIKE 'Terminated%')`;

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

/**
 * Expiry states a question can ask for (CONFIRMED A4, 29-Oct-2026):
 *   expired              expiry date before the as-of date
 *   not_expired          expiry date on or after the as-of date ("upcoming only")
 *   expired_or_expiring  already expired PLUS expiring by the end of the window — the DEFAULT for "expiring in N days / months"
 *   any                  no expiry condition
 */
export type ExpiryState = "expired" | "not_expired" | "expired_or_expiring" | "any";
export const EXPIRY_STATES: [ExpiryState, ...ExpiryState[]] = ["expired", "not_expired", "expired_or_expiring", "any"];

export function effectiveExpiryState(state: ExpiryState | undefined, win: Window | undefined): ExpiryState {
  if (state) return state;
  return win && win.direction === "next" ? "expired_or_expiring" : "any";
}

/** Conditions on an expiry-date expression for a state + optional window (empty = no condition). */
export function expiryConditions(asOf: string, expiry: SQL, state: ExpiryState, win: Window | undefined): SQL[] {
  const out: SQL[] = [];
  const w = win ? windowBounds(asOf, win) : null;
  if (state === "expired") {
    // a FUTURE window never narrows "expired" (expired documents lie before the as-of date); a "last N" window does
    out.push(sql`${expiry} < ${asOf}::date`);
    if (w && win?.direction === "last") out.push(sql`${expiry} >= ${w.from} AND ${expiry} <= ${w.to}`);
    return out;
  }
  if (state === "not_expired") out.push(sql`${expiry} >= ${asOf}::date`);
  if (state === "expired_or_expiring") {
    // expired (any age) together with the ones expiring by the window end; without a window = everything dated
    out.push(w ? sql`${expiry} <= ${w.to}` : sql`${expiry} IS NOT NULL`);
    return out;
  }
  if (w) out.push(sql`${expiry} >= ${w.from} AND ${expiry} <= ${w.to}`);
  return out;
}
