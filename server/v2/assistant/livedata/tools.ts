/**
 * The assistant's Crewing live-data tools (stage 2, PILOT TRIAL): manifest definitions + the allow-list.
 * Only these tools exist; each maps to ONE server function with a strict argument schema.
 * Parameter schemas are written by hand (OpenAI function format) and mirror the zod schemas, which stay the
 * enforcement point. Wording follows the business rules confirmed by Sahil on 29-Oct-2026 (questionnaire A1–A7).
 */
import { EXPIRY_STATES } from "./definitions";
import { RANK_GROUP_NAMES } from "./rankConfig";

const windowJson = {
  type: "object",
  description: "Window relative to today: next/last N days or N calendar months (days and months give different dates — use the unit the user said).",
  properties: {
    direction: { type: "string", enum: ["next", "last"] },
    amount: { type: "integer", minimum: 0, maximum: 3650 },
    unit: { type: "string", enum: ["days", "months"] },
  },
  required: ["direction", "amount", "unit"],
  additionalProperties: false,
};
const paging = {
  limit: { type: "integer", minimum: 1, maximum: 10, description: "Rows per page (max 10)." },
  offset: { type: "integer", minimum: 0, description: "Rows already shown (for 'show more' use the previous nextOffset)." },
};
const vesselsJson = { type: "array", items: { type: "string" }, description: "Vessel names as the user wrote them; the server resolves them (unknown → vessel_not_found, several → vessel_ambiguous)." };
const ranksJson = { type: "array", items: { type: "string" }, description: "Exact ranks, e.g. 'Chief Officer', '2nd Engineer'." };
const rankGroupsJson = {
  type: "array",
  items: { type: "string", enum: [...RANK_GROUP_NAMES] },
  description:
    "Rank groups as configured in Admin → Rank Administration (Company tab) — not a fixed list. Use the group named after the user's " +
    "word: 'engineers' → engineers (= the ranks flagged Eng Officer); 'officers' → officers; 'ratings' → ratings; 'deck crew' → deck; " +
    "'engine crew' / 'engine room' → engine; also senior_officers, deck_officers, engine_officers, petty_officers, deck_ratings, " +
    "engine_ratings, general_ratings, catering_ratings. Never combine groups to stand for one word. A rank with no category in the " +
    "configuration is reported under rankConfig.unclassified… — tell the user.",
};
const docTypesJson = {
  type: "array",
  items: { type: "string", enum: ["licence", "training"] },
  description: "licence = licences / certificates of competency, endorsements; training = training-course certificates. OMIT for both: " +
    "'certificates' or 'documents' means BOTH kinds (confirmed rule). Set licence only when the user says licence/CoC/endorsement, " +
    "training only when the user says course/training.",
};
const expiryStateJson = {
  type: "string",
  enum: [...EXPIRY_STATES],
  description: "expired = already expired (before today); not_expired = upcoming only; expired_or_expiring = already expired PLUS expiring " +
    "by the end of expiryWithin (the DEFAULT for 'expiring in N days/months' — omit expiryState then); any = no expiry condition.",
};

export const CREWING_TOOLS = [
  {
    name: "crewing_query_assignments",
    description:
      "Crew ON BOARD vessels now (Vessel-screen rule: signed on, not signed off). One record = one on-board assignment; unit 'people' " +
      "counts distinct persons (default) and 'assignments' counts assignments. During a handover both the person on board (primary) and " +
      "the reliever who has signed on (secondary) are on board and count; a planned reliever who has not signed on is not. mode: list " +
      "(≤10 rows + total, page with offset), count (totals only), group (counts per vesselName/rank/rankGroup/nationality/crewStatus). " +
      "Combine filters freely. hasDocument restricts to crew holding a matching licence/training document (expiring questions include " +
      "already-expired documents; `breakdown` says how many people hold an expired vs an upcoming one). Totals are computed over ALL " +
      "matching records — quote `total`/`totals`, never count rows yourself.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["list", "count", "group"] },
        unit: { type: "string", enum: ["people", "assignments"] },
        groupBy: { type: "array", items: { type: "string", enum: ["vesselName", "rank", "rankGroup", "nationality", "crewStatus"] }, maxItems: 2 },
        vessels: vesselsJson,
        ranks: ranksJson,
        rankGroups: rankGroupsJson,
        nationalities: { type: "array", items: { type: "string" }, description: "Nationality names, e.g. 'Indian'." },
        crewStatus: {
          type: "array", items: { type: "string", enum: ["primary", "secondary"] },
          description: "ONLY when the user says so: 'primary' excludes signed-on relievers in handover; 'secondary' = only those relievers.",
        },
        signOnWithin: { ...windowJson, description: "Signed on within a window, e.g. last 30 days." },
        signOnFrom: { type: "string", description: "YYYY-MM-DD" },
        signOnTo: { type: "string", description: "YYYY-MM-DD" },
        reliefDueWithin: { ...windowJson, description: "Relief-due date AS RECORDED on the assignment falls in the window." },
        reliefDueBefore: { type: "string", description: "YYYY-MM-DD — relief-due date as recorded is before this date." },
        hasDocument: {
          type: "object",
          properties: {
            documentTypes: docTypesJson,
            documentNameContains: { type: "string" },
            expiryState: expiryStateJson,
            expiryWithin: windowJson,
          },
          additionalProperties: false,
        },
        sort: { type: "string", enum: ["vessel", "name", "rank", "sign_on_asc", "sign_on_desc", "relief_due_asc"] },
        ...paging,
      },
      additionalProperties: false,
    },
  },
  {
    name: "crewing_query_documents",
    description:
      "Crew licences/certificates and training-course certificates with their expiry. One record = one document; unit 'documents' " +
      "(default) counts documents, 'people' counts distinct crew holding them (e.g. 2 crew with 5 certificates → people 2, documents 5). " +
      "'Expiring in N days/months' = expiryWithin next N with expiryState omitted: the result lists the documents ALREADY EXPIRED together " +
      "with those expiring by the window end, each row marked expiryState expired/upcoming, and `breakdown` gives both counts — always " +
      "report both. 'Only upcoming' = expiryState not_expired; 'expired' = expiryState expired. mode list/count/group (groupBy " +
      "vesselName/documentType/documentName/rank/rankGroup/expiryMonth/expiryState). crewOnBoard / vessels restrict to crew currently " +
      "on board (that vessel). Archived licences, archived crew and terminated crew are excluded; inactive crew are included. " +
      "`excluded` reports documents whose expiry date is missing or unreadable — mention it when non-zero. Quote totals, never count rows yourself.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["list", "count", "group"] },
        unit: { type: "string", enum: ["documents", "people"] },
        groupBy: {
          type: "array",
          items: { type: "string", enum: ["vesselName", "documentType", "documentName", "rank", "rankGroup", "expiryMonth", "expiryState"] },
          maxItems: 2,
        },
        documentTypes: docTypesJson,
        documentNameContains: { type: "string", description: "Part of the certificate/course name, e.g. 'GMDSS', 'Basic Safety'." },
        expiryState: expiryStateJson,
        expiryWithin: windowJson,
        expiryFrom: { type: "string", description: "YYYY-MM-DD" },
        expiryTo: { type: "string", description: "YYYY-MM-DD" },
        crewOnBoard: { type: "boolean", description: "true = only crew currently on board; false = only crew not on board." },
        vessels: vesselsJson,
        ranks: ranksJson,
        rankGroups: rankGroupsJson,
        crewIds: { type: "array", items: { type: "string" }, description: "crewId values from crewing_find_crew." },
        sort: { type: "string", enum: ["expiry_asc", "expiry_desc", "name", "vessel"] },
        ...paging,
      },
      additionalProperties: false,
    },
  },
  {
    name: "crewing_find_crew",
    description: "Find crew members by (part of) name. Returns ≤5 matches with crewId, rank and current vessel, and the total number of matches. Use when the user names a person; if several match, ask which one.",
    parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
  },
  {
    name: "crewing_resolve_vessel",
    description: "Check a vessel name in this company. Returns the matching vessels (several → ask the user which one; none → say it was not found).",
    parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
  },
  // ── Part B (30-Oct-2026) ──
  {
    name: "crewing_query_availability",
    description:
      "Crew AVAILABLE TO JOIN by a date (confirmed rule): not terminated, and either on leave with an availability date on or before the " +
      "date (people already available today included) or currently on board with a Next Availability date on or before it. Default date = " +
      "today ('available now'); 'available next month' = availableWithin next 1 month; 'by 15 December' = availableBy. One record = one " +
      "person; totals.people is the count. Crew without an availability date are in `excluded.noAvailabilityDate` — mention it. " +
      "Not-for-rehire crew are left out unless includeNotForHire is true (only when the user asks).",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["list", "count", "group"] },
        groupBy: { type: "array", items: { type: "string", enum: ["rank", "rankGroup", "crewStatus", "nationality", "vesselName"] }, maxItems: 2 },
        availableBy: { type: "string", description: "YYYY-MM-DD — available on or before this date." },
        availableWithin: { ...windowJson, description: "Available within a forward window from today, e.g. next 1 month (direction next)." },
        ranks: ranksJson,
        rankGroups: rankGroupsJson,
        nationalities: { type: "array", items: { type: "string" } },
        crewStatus: { type: "array", items: { type: "string", enum: ["on_leave", "on_board"] }, description: "Only when the user says so." },
        vessels: { ...vesselsJson, description: "For on-board crew: their current vessel." },
        includeNotForHire: { type: "boolean", description: "true ONLY when the user asks to include not-for-rehire crew." },
        sort: { type: "string", enum: ["available_asc", "name", "rank"] },
        ...paging,
      },
      additionalProperties: false,
    },
  },
  {
    name: "crewing_query_relief_due",
    description:
      "Crew on board whose RELIEF is due or overdue — the Due Crew screen rule (confirmed): contract end = sign-on + contract months (or " +
      "the tolerance range on the assignment); overdue = past the range end; 'due in N months' = dueWithin next N months (recorded " +
      "relief-due date inside the period, or already overdue). One record = one on-board assignment. Each row carries contractEndDate, " +
      "rangeEndDate and the recorded reliefDueDate with reliefDueDiffers — when true, name both dates. dueState: overdue | due | any.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["list", "count", "group"] },
        groupBy: { type: "array", items: { type: "string", enum: ["vesselName", "rank", "rankGroup", "dueState"] }, maxItems: 2 },
        dueWithin: { ...windowJson, description: "Due within a forward window, e.g. next 1 month / next 30 days (direction next)." },
        dueState: { type: "string", enum: ["overdue", "due", "any"], description: "overdue only; due (inside the window or overdue); any = all on board." },
        vessels: vesselsJson,
        ranks: ranksJson,
        rankGroups: rankGroupsJson,
        sort: { type: "string", enum: ["contract_end_asc", "relief_due_asc", "vessel", "name"] },
        ...paging,
      },
      additionalProperties: false,
    },
  },
  {
    name: "crewing_query_rest_hours",
    description:
      "REST-HOUR violations and non-conformities per crew member and month, recalculated live from the daily records (confirmed rule), " +
      "rest mode, OPA OFF unless the user says 'with OPA' (opa: true). Default month = the current (as-of) month; months: ['2026-10'] or " +
      "lastMonths: 3. One record = one person-month; violationsOnly true (default) lists only records with violations. ALWAYS state the " +
      "month(s) and `lastUpdated` (the date the records were last updated) in the answer. too_many_records → ask for one vessel or fewer months.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["list", "count", "group"] },
        groupBy: { type: "array", items: { type: "string", enum: ["vesselName", "rank", "rankGroup", "month"] }, maxItems: 2 },
        months: { type: "array", items: { type: "string" }, description: "YYYY-MM values, e.g. ['2026-10']." },
        lastMonths: { type: "integer", minimum: 1, maximum: 12, description: "The last N months counted back from the current month (1 = current month)." },
        vessels: vesselsJson,
        ranks: ranksJson,
        rankGroups: rankGroupsJson,
        crewIds: { type: "array", items: { type: "string" }, description: "crewId values from crewing_find_crew." },
        opa: { type: "boolean", description: "true ONLY when the user asks for OPA 90 limits." },
        violationsOnly: { type: "boolean" },
        sort: { type: "string", enum: ["violations_desc", "vessel", "name"] },
        ...paging,
      },
      additionalProperties: false,
    },
  },
  {
    name: "crewing_query_rotation_approvals",
    description:
      "ROTATION PLANS waiting for approval (confirmed rule): status Proposed or Partially Approved, company-wide; each plan reports its " +
      "entries waiting / approved / rejected and the vessels it covers. status: waiting (default) | draft (plans not yet proposed, listed " +
      "separately) | all. forMe: true ONLY when the user asks for plans waiting for THEM — the server decides from the verified login " +
      "(never from a name); read `notes` for the outcome. One record = one plan.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["list", "count", "group"] },
        groupBy: { type: "array", items: { type: "string", enum: ["status", "vesselName"] }, maxItems: 1 },
        status: { type: "string", enum: ["waiting", "draft", "all"] },
        vessels: { ...vesselsJson, description: "Plans that include this vessel." },
        forMe: { type: "boolean" },
        sort: { type: "string", enum: ["proposed_desc", "plan_from_asc"] },
        ...paging,
      },
      additionalProperties: false,
    },
  },
  {
    name: "crewing_query_manning",
    description:
      "Vessel MANNING and VACANCIES (confirmed rule): one record = one planned position (rank slot) on an active vessel; filled when a " +
      "person has SIGNED ON (or a signed-on reliever is on board during a handover); vacant = empty slot; vacant_not_signed_on = a person " +
      "is planned but has not signed on. Default mode group by vesselName; `summary` gives positions / filled / vacant / vacantNotSignedOn " +
      "over the same filters. state: vacant | filled | any.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["list", "count", "group"] },
        groupBy: { type: "array", items: { type: "string", enum: ["vesselName", "rank", "rankGroup", "state"] }, maxItems: 2 },
        state: { type: "string", enum: ["vacant", "filled", "any"] },
        vessels: vesselsJson,
        ranks: ranksJson,
        rankGroups: rankGroupsJson,
        sort: { type: "string", enum: ["vessel", "rank"] },
        ...paging,
      },
      additionalProperties: false,
    },
  },
  {
    name: "crewing_query_appraisals",
    description:
      "APPRAISALS by status (confirmed rule): pending (default) = submitted but not completed (preliminary / submitted / pending office " +
      "review); draft = not yet submitted (listed separately); completed = reviewed. Archived and terminated crew excluded; vessels = the " +
      "crew member's current vessel by record (the appraisal's own vessel text is shown as appraisalVesselName). One record = one appraisal. " +
      "SCORES: set includeScores: true ONLY when the user explicitly asks for a score — the server returns the overall score of COMPLETED " +
      "appraisals only, and only if the user's Crewing role may view appraisals (else not_allowed: relay it). Never draft scores, " +
      "assessment scores or remarks. own: true when the user asks for THEIR OWN appraisal — the server refuses (identity_mapping_unavailable): relay the reason.",
    parameters: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["list", "count", "group"] },
        groupBy: { type: "array", items: { type: "string", enum: ["statusClass", "vesselName", "rank", "rankGroup", "appraisalType"] }, maxItems: 2 },
        statusClass: { type: "string", enum: ["pending", "draft", "completed", "any"] },
        vessels: vesselsJson,
        ranks: ranksJson,
        rankGroups: rankGroupsJson,
        crewIds: { type: "array", items: { type: "string" }, description: "crewId values from crewing_find_crew." },
        appraisalDateWithin: windowJson,
        appraisalDateFrom: { type: "string", description: "YYYY-MM-DD" },
        appraisalDateTo: { type: "string", description: "YYYY-MM-DD" },
        includeScores: { type: "boolean" },
        own: { type: "boolean" },
        sort: { type: "string", enum: ["date_desc", "date_asc", "name"] },
        ...paging,
      },
      additionalProperties: false,
    },
  },
] as const;

export type CrewingToolName = (typeof CREWING_TOOLS)[number]["name"];

export function manifest() {
  return {
    apiVersion: 1,
    module: "crewing",
    tools: CREWING_TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
  };
}
