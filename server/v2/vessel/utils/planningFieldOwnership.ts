/**
 * VS-04: who may write a vessel planning row.
 *
 * The office owns every planning field. Ship users see them read-only. Ship
 * keeps only the company-form actions (Sign-off forms, Joining forms), which
 * are separate endpoints and not covered here.
 */

export const PLANNING_FIELDS = [
  "crewUuid",
  "crewStatus",
  "signOnDate",
  "reliefDue",
  "signOffDate",
  "signOffPortUuid",
  "signOffReason",
  "reliefStatus",
  "takeOverDate",
  "takeOverConfirmation",
  "handOverDate",
  "relieverCrewUuid",
  "relieverSignOnDate",
  "joiningPortUuid",
  "joiningStatus",
  "plannedConfirmedDate",
  "travelStartDate",
  "travelEndDate",
  "contractPeriodMonths",
  "contractEndRangeStartMonths",
  "contractEndRangeEndMonths",
  "relieverContractPeriodMonths",
  "relieverContractEndRangeStartMonths",
  "relieverContractEndRangeEndMonths",
  "deploymentChecklistCompleted",
  "applicableDocsChecked",
  "adminAccept",
] as const;

// Sent by the page but never written from the body (the server ignores or
// replaces them), so they are neither foreign nor unknown.
const IGNORED_FIELDS = [
  "relieverAssignUuid",
  "crewAssignUuid",
  "auditUserUuid",
  "updatedByUuid",
  "checklistOverride",
  "trainingOverride",
] as const;

const FIELDS = new Set<string>(PLANNING_FIELDS);
const IGNORED = new Set<string>(IGNORED_FIELDS);

export const SHIP_READ_ONLY_ERROR = "Planning is managed by the office. Ship users cannot change it.";

// null, undefined and "" all mean "empty", so a form that sends back an
// untouched blank field is not a change.
function sameValue(a: unknown, b: unknown): boolean {
  const empty = (v: unknown) => v === null || v === undefined || v === "";
  if (empty(a) && empty(b)) return true;
  return a === b || String(a) === String(b);
}

export interface PlanningFieldCheck {
  unknown: string[];
  foreign: string[];
}

/**
 * `foreign` lists fields a ship user would change. A field sent back with its
 * current value is accepted, because the edit dialogs send the whole form.
 * Office users have no foreign fields.
 */
export function checkPlanningFieldOwnership(
  body: Record<string, unknown>,
  existing: Record<string, unknown>,
  isShipUser: boolean,
): PlanningFieldCheck {
  const unknown: string[] = [];
  const foreign: string[] = [];
  for (const key of Object.keys(body || {})) {
    if (IGNORED.has(key)) continue;
    if (!FIELDS.has(key)) {
      unknown.push(key);
    } else if (isShipUser && !sameValue(body[key], existing[key])) {
      foreign.push(key);
    }
  }
  return { unknown, foreign };
}
