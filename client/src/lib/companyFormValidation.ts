/** Presentation only: consume failures already returned; never run validators. */
export interface CompanyFormValidationContext {
  locationForPath?: (path: Array<string | number>) => string | undefined;
  references?: Record<string, string>;
  partLabel?: string;
}

const fields: Record<string, string> = {
  question_text: "Point wording", question_code: "Point label", response_type: "Response type",
  content_html: "Content", system_field_key: "System field", is_mandatory: "Mandatory answer",
  comment_enabled: "Comment setting", section_title: "Section title", section_code: "Section label",
  responsible_mode: "Responsible party", responsible_role_uuid: "Responsible role",
  responsible_department: "Responsible department", applicable_vessel_types: "Vessel types",
  signature_officer_required: "Company Representative signature",
  signature_seafarer_required: "Seafarer signature", signature_vessel_management_required: "Vessel Management signature",
  vessel_signature_role_uuids: "Permitted vessel roles", option_label: "Answer choice",
  option_value: "Answer choice value", option_set_name: "Named answer choices",
  option_set_uuid: "Answer choices", default_option_set_uuid: "Section answer choices",
  options: "Answer choices", sections: "Sections", questions: "Points",
  form_part_uuid: "Form part", form_version_uuid: "Form version", fvUuid: "Form version",
  obligation: "Mandatory or optional", specificDate: "Effective date", effectiveKind: "Effective date setting",
  mode: "Applicability", sets: "Condition groups", conditions: "Conditions",
};

const wording: Record<string, string> = {
  "System field key is required": "Choose the value to display for this System Field.",
  "System fields cannot require an answer or comment": "Turn off mandatory answers and comments for this System Field.",
  "System fields cannot contain answer options": "Remove the answer choices from this System Field.",
  "Only System fields may contain a field key": "Remove the System Field selection, or change this point to System Field.",
  "Content point HTML is required": "Enter the text for this Content point.",
  "Content point body is required after sanitization": "Enter safe, readable text for the Content point; remove scripts or embedded content.",
  "Only Content points may contain HTML": "Remove the formatted content, or change this point to Content.",
  "Content label must be at most 200 characters": "Keep the Content label to 200 characters or fewer.",
  "responsible_role_uuid is required when responsible_mode is role": "Choose the role responsible for this section.",
  "responsible_department is required when responsible_mode is department": "Enter the department responsible for this section.",
  "responsible_department must be empty when responsible_mode is role": "Clear the department when a role is responsible for this section.",
  "responsible_role_uuid must be empty when responsible_mode is department": "Clear the role when a department is responsible for this section.",
  "responsible targets must be empty when responsible_mode is not_applicable": "Clear the role and department when no responsible party is selected.",
  "Named option sets need a name": "Enter a name for the named answer choices.",
  "Named option sets need at least one option": "Add at least one choice to the named answer choices.",
  "Unknown System field key for this Company Form subject": "Choose a System Field available for this form's subject.",
  "Company Form versions must contain at least one section requiring submission.": "Add at least one section with an answer or required signature before releasing.",
  "Only draft versions can be released.": "Only a draft can be released. Refresh the version list and select a draft.",
  "Select a subject stage before releasing this Company Form version.": "Choose when this form is used before releasing it.",
  "This form does not declare subject stages; clear the stage before releasing.": "Clear the stage selection before releasing this form.",
  "Automatic modes require mandatory or optional": "Choose whether the form is mandatory or optional.",
  "A specific effective date is required": "Choose an effective date, or select On release.",
  "Released or archived applicability policy is immutable": "The applicability settings are read-only. Make changes in a new draft.",
  "Form version or form part not found": "This form part is no longer available. Close and reopen the editor.",
  "Form version not found": "This form version is no longer available. Refresh the version list.",
};

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : undefined;
}

function payload(error: unknown): { body: unknown; status?: number } {
  const original = record(error);
  const text = typeof error === "string" ? error : typeof original?.message === "string" ? original.message : "";
  const match = text.match(/^\s*(\d{3})\s*:\s*/);
  const body = text.replace(/^\s*\d{3}\s*:\s*/, "").trim();
  try { return { body: JSON.parse(body), status: match ? Number(match[1]) : undefined }; }
  catch { return { body: text ? body : original, status: match ? Number(match[1]) : undefined }; }
}

function readableLocation(text: string, context: CompanyFormValidationContext): string {
  for (const [reference, label] of Object.entries(context.references ?? {}))
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(reference)) text = text.split(reference).join(label);
  return text;
}

function translate(message: string, field: string, context: CompanyFormValidationContext): string | undefined {
  if (/^(Invalid form structures?|Failed to (?:save|release) form.*|Failed to fetch|Network Error|server_error)$/i.test(message)) return undefined;
  if (wording[message]) return wording[message];
  if (message.includes("only draft versions are editable"))
    return "This version is read-only. Create or select a draft before changing the form.";
  const location = readableLocation(message, context);
  const section = location.match(/^Section "(.+)" (.+)$/);
  if (section) {
    const reason = section[2]
      .replace("enables Vessel Management outside the on-board stage or at-sign-off stage.", "uses Vessel Management signing, which is available only on board or at sign-off.")
      .replace("requires at least one permitted vessel role.", "needs at least one permitted vessel role for signing.")
      .replace("has an invalid or inactive permitted vessel role.", "has a signing role that is no longer available. Choose an active vessel role.");
    if (/[_{}<>]|\b(SQL|SQLSTATE|constraint|column|TypeError)\b|[0-9a-f]{8}-[0-9a-f-]{27,}/i.test(reason)) return undefined;
    // Some lifecycle failures identify the section by UUID rather than title.
    const label = context.references?.[section[1]] ??
      (/[0-9a-f]{8}-[0-9a-f-]{27,}/i.test(section[1])
        ? context.partLabel ?? "This form's sections" : `Section "${section[1]}"`);
    return `${label}: ${reason}`;
  }
  if (/questions cannot define options$/.test(message))
    return "This response type cannot have answer choices. Remove the choices or choose a selection response.";
  if (/questions require options, an option_set_uuid, or a section default_option_set_uuid$/.test(message))
    return "Add answer choices, or select the point's or section's named answer choices.";
  if (/^(Unknown vessel type UUID|Unknown responsible role UUID)/.test(message))
    return message.startsWith("Unknown vessel") ? "Choose vessel types that are still available." : "Choose responsible roles that are still available.";
  const referenceFailure = message.match(/^(Duplicate |Conflicting definitions for |(?:section_uuid|question_uuid|option_uuid|option_set_uuid|default_option_set_uuid)|Option set does not belong|Form part .+ does not belong)/);
  if (referenceFailure) {
    const references = Object.entries(context.references ?? {}).filter(([id]) => message.includes(id)).map(([, label]) => label);
    const where = [...new Set(references)].join("; ") || context.partLabel || "Form structure";
    const reason = message.startsWith("Duplicate") ? "A saved entry is used more than once. Remove the duplicate or recreate the entry."
      : message.startsWith("Conflicting") ? "An answer choice has conflicting settings. Review its wording and value."
      : "An entry belongs to another part or version. Reload this draft and select or recreate the entry here.";
    return `${where}: ${reason}`;
  }
  if (/^Expected .+, received (undefined|null)$/.test(message) || message === "Required")
    return `${field} is required.`;
  const minimum = message.match(/^String must contain at least (\d+) character/);
  if (minimum) return `${field}: enter at least ${minimum[1]} character${minimum[1] === "1" ? "" : "s"}.`;
  const maximum = message.match(/^String must contain at most (\d+) character/);
  if (maximum) return `${field}: use no more than ${maximum[1]} characters.`;
  if (/^Array must contain at least (\d+) element/.test(message)) return `${field}: add at least one entry.`;
  if (/^Array must contain at most (\d+) element/.test(message)) return `${field}: reduce the number of entries.`;
  if (/^(Invalid enum value|Invalid literal value|Expected )/.test(message)) return `${field}: choose a supported value.`;
  if (/^Invalid uuid/i.test(message)) return `${field}: the saved reference is unavailable. Reload the draft and select it again.`;
  if (/^Unrecognized key/.test(message)) return `${field}: unsupported settings were supplied. Reload the draft before trying again.`;
  // Unknown readable service explanations are retained, not allowlisted away.
  // Technical diagnostics must never be echoed into a Company Forms screen.
  if (location.length > 0 && location.length < 2000 && !/^\d+$|^[A-Z][A-Z0-9_]+$/.test(location) &&
    !/[_{}<>]|[0-9a-f]{8}-[0-9a-f-]{27,}|\b(SQL|SQLSTATE|SELECT|INSERT|UPDATE|DELETE|TypeError|Error:|constraint|relation|column|Uuid|UUID)\b|(?:^|\s)at \S+|\/(?:srv|home|server)\//i.test(location) &&
    !/\b(?:record|assignment|version|section|point)\s+[a-f0-9]{4,}\b/i.test(location)) return location;
  return undefined;
}

/** All returned issues, in server order. Empty means no safe explanation exists. */
export function companyFormValidationProblems(error: unknown, context: CompanyFormValidationContext = {}): string[] {
  const parsed = payload(error);
  if (parsed.status && parsed.status >= 500) return [];
  const body = record(parsed.body);
  const issues = Array.isArray(parsed.body) ? parsed.body
    : Array.isArray(body?.details) ? body.details
    : Array.isArray(record(body?.details)?.issues) ? record(body?.details)!.issues as unknown[]
    : Array.isArray(body?.issues) ? body.issues : [];
  if (issues.length) {
    return issues.flatMap(issue => {
      const item = record(issue);
      const path = Array.isArray(item?.path) ? item.path.filter((p): p is string | number => typeof p === "string" || typeof p === "number") : [];
      const field = fields[String(path.at(-1))] ?? "This entry";
      const message = typeof issue === "string" ? issue : typeof item?.message === "string" ? item.message : "";
      const explanation = translate(message, field, context) ?? `${field} could not be accepted. Review this entry and try again.`;
      const location = context.locationForPath?.(path);
      return [`${location ? `${location}: ` : ""}${explanation}`];
    });
  }
  const message = typeof parsed.body === "string" ? parsed.body
    : typeof body?.message === "string" ? body.message : typeof body?.error === "string" ? body.error : "";
  // Lifecycle joins independent Section explanations with spaces; do not split
  // the sentences belonging to each individual explanation.
  return message.split(/;\s+| (?=Section ")/).flatMap(part => {
    const translated = translate(part.trim(), "This entry", context);
    return translated ? [translated] : [];
  });
}
