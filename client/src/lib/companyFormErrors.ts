import { companyFormValidationProblems, type CompanyFormValidationContext } from "./companyFormValidation";

export type CompanyFormErrorAction =
  | "load"
  | "loadHistory"
  | "loadEligible"
  | "verifyAssignment"
  | "loadRequirements"
  | "start"
  | "save"
  | "submit"
  | "sign"
  | "removeSignature"
  | "void"
  | "retryCheck"
  | "editorLoad"
  | "editorSave"
  | "release"
  | "ruleSearch"
  | "rulePreview"
  | "manageVersion";

const actionMessages: Record<CompanyFormErrorAction, string> = {
  load: "Company form details could not be loaded. Check your connection and try again.",
  loadHistory: "Saved company forms could not be loaded. Check your connection and try again.",
  loadEligible: "Available company forms could not be loaded. Refresh and try again.",
  verifyAssignment: "The assignment could not be verified. Refresh the assignment details and try again.",
  loadRequirements: "Assignment form requirements could not be loaded. Retry the check before continuing.",
  start: "The form could not be opened. Check that the assignment is current, then try again.",
  save: "Your form changes could not be saved. Check your connection and try again.",
  submit: "The form could not be submitted. Review the required answers and signatures, then try again.",
  sign: "The signature could not be saved. Check the signing details and try again.",
  removeSignature: "The signature could not be removed. Refresh the form and try again.",
  void: "The form could not be voided. Check the reason and your access, then try again.",
  retryCheck: "The form stage check could not be retried. Refresh the requirements and try again.",
  editorLoad: "Form settings could not be loaded. Refresh the editor and try again.",
  editorSave: "Form settings could not be saved. Check the draft and try again.",
  release: "This form version could not be released. Review the draft requirements and try again.",
  ruleSearch: "Crew assignments could not be searched. Check your connection and try again.",
  rulePreview: "This crew assignment could not be checked against the draft. Review the policy and try again.",
  manageVersion: "This form version could not be updated. Refresh the editor and try again.",
};

const knownCodes: Record<string, string> = {
  COMPANY_FORM_ASSIGNMENT_UNAVAILABLE: "This assignment is no longer available. Refresh the assignment details and try again.",
  ASSIGNMENT_NOT_FOUND: "This assignment is no longer available. Refresh the assignment details and try again.",
  ASSIGNMENT_MISMATCH: "The recorded assignment has changed. Close and reopen the form, then try again.",
  STAGE_CHECK_INCOMPLETE: "The required form stage check is not complete. Complete or retry the check before starting this form.",
  FORM_STAGE_CHECK_INCOMPLETE: "The required form stage check is not complete. Complete or retry the check before starting this form.",
  REQUIRED_ANSWERS_MISSING: "Complete the required answers before submitting this form.",
  REQUIRED_FIELDS_MISSING: "Complete the required answers before submitting this form.",
  SECTION_NOT_COMPLETE: "Complete the required answers and signatures in this section before submitting it.",
  SIGNATURE_REQUIRED: "Add the required signature before submitting this form.",
  WITNESS_REQUIRED: "The witnessing officer must confirm the seafarer is present before saving this signature.",
  SEAFARER_NOT_PRESENT: "The seafarer must be present to sign this witnessed form.",
  FORM_NOT_EDITABLE: "This form is read-only. Reopen an editable form or ask an administrator for help.",
  SUBMISSION_LOCKED: "This form is no longer editable. Refresh the form to see its current status.",
  FORM_VERSION_NOT_RELEASED: "This form version is not available to start. Choose a released version or contact an administrator.",
  FORM_NOT_ELIGIBLE: "This form is not currently available for this assignment. Refresh the eligible forms list.",
  FORM_ALREADY_VOIDED: "This form has already been voided. Refresh the saved forms list.",
  VOID_REASON_REQUIRED: "Enter a reason before voiding this form.",
  RANK_NOT_ELIGIBLE: "The rank could not be verified. Ask an administrator to check the assignment's contract rank and crew record, then try again.",
  CREW_RANK_NOT_APPLICABLE: "This form does not apply to the selected crew rank. Choose another eligible form or ask an administrator to review applicability.",
  RANK_NOT_ALLOWED: "This form is not available for the selected crew rank. Choose another eligible form or ask an administrator to review applicability.",
  EFFECTIVE_DATE_BEFORE_RELEASE: "This applicability date is earlier than the version's release date. Choose On release or a date on or after release; rules cannot apply retrospectively.",
  APPLICABILITY_EFFECTIVE_DATE_BEFORE_RELEASE: "This applicability date is earlier than the version's release date. Choose On release or a date on or after release; rules cannot apply retrospectively.",
  SPECIFIC_EFFECTIVE_DATE_REQUIRED: "Choose a specific effective date, or change the applicability timing to On release.",
  EFFECTIVE_DATE_INVALID: "Enter a valid calendar date and choose Specific date as the timing.",
  SOURCE_VALUE_MISSING: "No source value is recorded for this crew detail. Update the assignment or crew record, then refresh the rule facts.",
  MASTER_MATCH_UNAVAILABLE: "The recorded value does not match exactly one eligible master record. Ask an administrator to resolve the source or master-data entry.",
  RANK_UNRESOLVED: "The contract rank could not be matched to a unique rank master record. Ask an administrator to verify the selected rank.",
  FORBIDDEN: "You do not have permission to complete this action. Ask an administrator to review your access.",
  UNAUTHORIZED: "Your access could not be confirmed. Sign in again and retry.",
};

const factReasons = new Map<string, string>([
  ["Not yet available: the parent application has not supplied master data", "This crew detail is not available because its parent application has not supplied master data. Ask an administrator to provide or configure that data."],
  ["Source value is blank", "No source value is recorded for this crew detail. Update the assignment or crew record, then refresh the rule facts."],
  ["Source reference has no unique eligible master match", "The recorded value does not match exactly one eligible master record. Ask an administrator to resolve the source or master-data entry."],
  ["Vessel stored membership has no unique eligible group master match", "The vessel's saved group membership does not match exactly one eligible group. Ask an administrator to review the fleet or additional-group master data."],
  ["No reliable pre-sign-on joining-history capture", "Verified pre-sign-on joining history is unavailable. Ask an administrator to review the crew member's service history."],
  ["Multiple authoritative personal-detail records", "More than one authoritative personal-detail record exists. Ask an administrator to resolve the duplicate records."],
  ["Invalid joining cutoff", "A valid joining date is unavailable. Ask an administrator to correct the assignment dates."],
  ["Missing/invalid service date or same-day service whose contract ordering cannot be proven", "Prior service dates are missing, invalid, or ambiguous on the joining date. Ask an administrator to review the service history."],
  ["Contract rank is UNRESOLVED", "The contract rank could not be matched to a unique rank master record. Ask an administrator to verify the selected rank."],
  ["Missing/ambiguous historical rank or contract ordering", "Historical ranks or contract ordering are ambiguous. Ask an administrator to review the service history and rank records."],
  ["Planning rank does not yield exactly one eligible master", "The planning rank does not resolve to one eligible rank master record. Ask an administrator to review the planning rank and rank master data."],
]);

const safeLegacyReasons = new Map<string, string>([
  ["Fill in is required before joining", "A required pre-joining response is missing. Complete the requested information, then retry the stage check."],
  ["This planning association has changed or is unavailable. Close and reopen the reliever popup; no assignment will be inferred.", "The planning assignment has changed or is unavailable. Close and reopen the reliever form; no assignment will be inferred."],
  ["The recorded assignment is not a valid deployed reliever assignment. Starting a form is unavailable.", "This is not a current reliever assignment, so a form cannot be started. Refresh the planning record or ask an administrator for help."],
  ["No exact onboard assignment is linked to this planning row. An administrator must reconcile the assignment before forms can be opened.", "No exact onboard assignment is linked to this planning row. Ask an administrator to reconcile the assignment before opening forms."],
  ["The onboard assignment is stale, archived, deleted, or already signed off. Close and reopen the popup; no assignment will be inferred.", "This onboard assignment is no longer current. Close and reopen the form; no assignment will be inferred."],
  ["The form service did not return a submission link.", "The form was not opened because its saved link was missing. Refresh and try again."],
  ["The form service did not return a submission link", "The form was not opened because its saved link was missing. Refresh and try again."],
  ["No form submission link was returned.", "The form was not opened because its saved link was missing. Refresh and try again."],
  ["The form count response is incomplete.", "Form totals could not be confirmed. Refresh the page and try again."],
]);

function readErrorText(error: unknown): string | undefined {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

function safeCodeFrom(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim().toUpperCase();
    return /^[A-Z][A-Z0-9_]{1,79}$/.test(normalized) ? normalized : undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["code", "errorCode", "reasonCode", "reason", "failure_reason", "error"]) {
    const code = safeCodeFrom(record[key]);
    if (code) return code;
  }
  return undefined;
}

function knownPlainReason(value: unknown, depth = 0): string | undefined {
  if (depth > 4) return undefined;
  if (typeof value === "string") {
    return factReasons.get(value.trim()) ?? safeLegacyReasons.get(value.trim());
  }
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["reason", "failure_reason", "evidence"]) {
    const safeReason = knownPlainReason(record[key], depth + 1);
    if (safeReason) return safeReason;
  }
  return undefined;
}

function parseCode(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const body = message.replace(/^\s*\d{3}\s*:\s*/, "").trim();
  try {
    return safeCodeFrom(JSON.parse(body));
  } catch {
    return /^[A-Z][A-Z0-9_]{1,79}$/.test(body) ? body : undefined;
  }
}

function readAllowlistedPayloadMessage(message: string): string {
  const body = message.replace(/^\s*\d{3}\s*:\s*/, "").trim();
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    for (const key of ["message", "error", "reason"]) {
      if (typeof parsed[key] === "string") return (parsed[key] as string).trim();
    }
  } catch {
    // Plain service refusal. It is still compared against exact allowlists.
  }
  return body;
}

const dimensionLabels = new Set([
  "Vessel type", "Vessel", "Fleet group", "Additional group", "Nationality",
  "Contract rank", "Manning agent", "Crew pool", "First-ever with company", "First-in-rank",
]);

function applicabilityRefusal(message: string | undefined, action: CompanyFormErrorAction): string | undefined {
  if (!message || !["release", "editorSave", "rulePreview"].includes(action)) return undefined;
  const refusal = readAllowlistedPayloadMessage(message);
  const exact: Record<string, string> = {
    "Manual only has no obligation, effective date or condition sets": "Manual-only applicability cannot include an obligation, effective date, or conditions. Remove those settings or choose an automatic applicability mode.",
    "Automatic modes require mandatory or optional": "Choose whether the automatic form requirement is mandatory or optional before saving the policy.",
    "A specific effective date is required": "Choose a specific effective date, or change the applicability timing to On release.",
    "Choose a real effective date.": "Enter a valid calendar date for this applicability rule.",
    "Specific date must be a real calendar date and use specific_date": "Enter a valid calendar date and choose Specific date as the timing.",
    "Only conditional policies contain sets": "Remove the condition sets or change the policy to Conditional before saving.",
    "Conditional applicability requires at least one nonempty condition set": "Add at least one condition to a crew group before releasing this conditional form.",
    "Conditional applicability requires a registered subject": "Select a supported form subject before releasing conditional applicability.",
    "This effective date is before the earliest possible release date. Choose On release or a later date; rules never apply retrospectively.": "This effective date is before the earliest possible release date. Choose On release or a later date; rules cannot apply retrospectively.",
    "Form rule facts are not available.": "Applicability could not be checked because assignment facts are unavailable. Ask an administrator to check the form subject's fact sources.",
  };
  if (exact[refusal]) return exact[refusal];

  if (/^Effective-from date \d{4}-\d{2}-\d{2} is earlier than release date \d{4}-\d{2}-\d{2}; a rule cannot claim applicability before it existed and requirements are never resolved retrospectively$/.test(refusal)) {
    return knownCodes.EFFECTIVE_DATE_BEFORE_RELEASE;
  }
  const comparison = refusal.match(/^(.+): choose a supported comparison and active values before releasing this form\.$/);
  if (comparison && dimensionLabels.has(comparison[1])) {
    return `Update the ${comparison[1].toLowerCase()} comparison and choose active values before releasing this form.`;
  }
  const unavailable = refusal.match(/^(.+) is not yet available\. Remove it or wait for the parent master data\.$/);
  if (unavailable && (dimensionLabels.has(unavailable[1]) || unavailable[1] === "Selected condition")) {
    return `${unavailable[1]} is not yet available. Remove this condition or ask an administrator to provide the parent master data before releasing this form.`;
  }
  return undefined;
}

export function companyFormErrorMessage(error: unknown, action: CompanyFormErrorAction, context?: CompanyFormValidationContext): string {
  const message = readErrorText(error);
  const problems = action === "editorSave" || action === "release" ? companyFormValidationProblems(error, context) : [];
  if (problems.length && (/"(?:details|issues)"\s*:/.test(message ?? "") ||
    (typeof error === "object" && error !== null && ("details" in error || "issues" in error)))) return problems.join("\n");
  const code = safeCodeFrom(error) ?? parseCode(message);
  if (code && knownCodes[code]) return knownCodes[code];
  const refusal = applicabilityRefusal(message, action);
  if (refusal) return refusal;

  const status = message?.match(/^\s*(\d{3})\s*:/)?.[1];
  if (status === "401") return knownCodes.UNAUTHORIZED;
  if (status === "403") return knownCodes.FORBIDDEN;
  if (problems.length) return problems.join("\n");
  if (message && safeLegacyReasons.has(message.trim())) return safeLegacyReasons.get(message.trim())!;
  return actionMessages[action];
}

/** Converts backend-owned stage evidence into an allowlisted human explanation. */
export function safeCompanyFormReason(value: unknown): string {
  const safeReason = knownPlainReason(value);
  if (safeReason) return safeReason;
  if (typeof value === "string") {
    const factReason = factReasons.get(value.trim());
    if (factReason) return factReason;
    const code = parseCode(value);
    if (code && knownCodes[code]) return knownCodes[code];
    const safeReason = safeLegacyReasons.get(value.trim());
    if (safeReason) return safeReason;
    const body = value.trim();
    if (/^\d{3}\s*:/.test(body) || /(?:select|insert|update|delete)\s+.+\s+(?:from|into|where)/i.test(body)
      || /(?:exception|stack| at [\w$.]+\s*\()/i.test(body)) {
      return "The form stage check could not record a safe explanation. Retry the check or ask an administrator for help.";
    }
  }
  const code = safeCodeFrom(value);
  if (code && knownCodes[code]) return knownCodes[code];
  return "The form stage check needs attention. Retry the check or ask an administrator for help.";
}

/** Safe specifics for unresolved assignment facts; never labels a missing fact as a stage failure. */
export function safeCompanyFormFactReason(value: unknown): string {
  if (typeof value === "string") {
    const factReason = factReasons.get(readAllowlistedPayloadMessage(value));
    if (factReason) return factReason;
    const code = parseCode(value);
    if (code && knownCodes[code]) return knownCodes[code];
  }
  const code = safeCodeFrom(value);
  if (code && knownCodes[code]) return knownCodes[code];
  return "This crew fact could not be verified. Ask an administrator to check the source record or master data.";
}
