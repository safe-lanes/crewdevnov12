/**
 * The assistant's Crewing live-data tools (stage 2, PILOT TRIAL): manifest definitions + the allow-list.
 * Only these tools exist; each maps to ONE server function with a strict argument schema.
 * Parameter schemas are written by hand (OpenAI function format) and mirror the zod schemas, which stay the
 * enforcement point.
 */
import { RANK_GROUP_NAMES } from "./definitions";

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
  description: "Rank groups (provisional list): officers, deck_officers, engine_officers ('engineers'), ratings, deck_ratings, engine_ratings, deck, engine, catering, cadets.",
};
const docTypesJson = {
  type: "array",
  items: { type: "string", enum: ["licence", "training"] },
  description: "licence = licences / certificates of competency, endorsements; training = training-course certificates. OMIT for both: " +
    "everyday 'certificates' or 'documents' means both (PROVISIONAL trial rule). Set licence only when the user says licence/CoC/endorsement, " +
    "training only when the user says course/training.",
};

export const CREWING_TOOLS = [
  {
    name: "crewing_query_assignments",
    description:
      "Crew ON BOARD vessels now (Vessel-screen rule). One record = one on-board assignment; unit 'people' counts distinct persons " +
      "(default) and 'assignments' counts assignments (a person can hold two). mode: list (≤10 rows + total, page with offset), count " +
      "(totals only), group (counts per vesselName/rank/rankGroup/nationality/crewStatus; returns people and assignments per group). " +
      "Combine filters freely. hasDocument restricts to crew holding a matching licence/training document (e.g. expiring in 60 days). " +
      "Totals are computed over ALL matching records — quote `total`/`totals`, never count rows yourself.",
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
        crewStatus: { type: "array", items: { type: "string", enum: ["primary", "secondary"] } },
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
            expiryState: { type: "string", enum: ["expired", "not_expired", "any"] },
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
      "expiryState expired = expiry before today; 'expiring' questions = expiryState not_expired + expiryWithin. mode list/count/group " +
      "(groupBy vesselName/documentType/documentName/rank/rankGroup/expiryMonth/expiryState; each group returns documents and people). " +
      "crewOnBoard / vessels restrict to crew currently on board (that vessel). Archived licences and archived crew are excluded. " +
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
        expiryState: { type: "string", enum: ["expired", "not_expired", "any"] },
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
] as const;

export type CrewingToolName = (typeof CREWING_TOOLS)[number]["name"];

export function manifest() {
  return {
    apiVersion: 1,
    module: "crewing",
    tools: CREWING_TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
  };
}
