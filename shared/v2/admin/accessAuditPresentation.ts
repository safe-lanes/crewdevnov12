import { COMPANY_FORM_PERMISSIONS } from "./companyFormPermissions";

export interface AccessAuditEntry {
  id: string; event: string; actor?: unknown; role_id?: string | null;
  resource?: string | null; action?: string | null; before_value?: unknown;
  after_value?: unknown; details?: unknown; recorded_at?: string | null;
  actor_name?: string | null; role_name?: string | null; menu_name?: string | null;
  actor_display_name?: string | null;
  affected_role_name?: string | null;
}
export const AUDIT_SETTING_LABELS: Record<string, string> = {
  block_expiring_during_contract: "Block seafarer deployment when mandatory courses expiring during contract",
  block_missing_expiry: "Block seafarer deployment when a mandatory certificate's expiry is not recorded",
};
export const AUDIT_EVENT_LABELS: Record<string, string> = {
  grant_change: "Permission change", training_setting_changed: "Deployment blocking policy change",
  training_override: "Deployment block override", checklist_override: "Checklist override",
  role_eligibility_change: "Role availability change", company_document_branding: "Company logo change",
  parent_sync_management_eligibility: "Parent role eligibility update",
  parent_sync_category_readiness: "Parent support category update", parent_sync_rejected: "Parent update refused",
};
const actions: Record<string, string> = {
  ...Object.fromEntries(COMPANY_FORM_PERMISSIONS.map(p => [p.action, p.label])),
  manage: "Access Control management", override: "Override deployment block",
  view: "View", create: "Create", edit: "Edit", delete: "Delete",
  role_eligibility: "Role availability", management_eligibility: "Access Control management eligibility",
  category_readiness: "Parent support category", snapshot_rejected: "Parent update",
  branding: "Company logo", ...AUDIT_SETTING_LABELS,
};
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
const safeLabel = (value: unknown) => typeof value === "string" && value.trim() &&
  !/[0-9a-f]{8}-[0-9a-f-]{27,}|[{}]/i.test(value) ? value.trim() : undefined;
export function auditActionLabel(row: AccessAuditEntry): string {
  return actions[row.action ?? ""] ?? "Access setting";
}
export function auditValueWords(value: unknown, permission = false): string {
  if (value === true) return permission ? "Granted" : "On";
  if (value === false) return permission ? "Not granted" : "Off";
  if (value === null || value === undefined) return "Not recorded";
  if (typeof value === "object") return JSON.stringify(value, (_key, nested) =>
    nested === true ? "Yes" : nested === false ? "No" : nested, 2);
  return String(value);
}
export function auditDate(value?: string | null): string {
  const date = value ? new Date(value) : undefined;
  if (!date || !Number.isFinite(date.getTime())) return "Time not recorded";
  return `${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date)}, ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" }).format(date)} UTC`;
}
export function presentAccessAudit(row: AccessAuditEntry): { sentence: string; unmapped: string[] } {
  const actor = object(row.actor), details = object(row.details);
  const frozenName = typeof row.actor_display_name === "string" ? row.actor_display_name.trim() : "";
  const who = frozenName || safeLabel(row.actor_name) || safeLabel(actor.roleName) ||
    (String(actor.source ?? "").startsWith("trusted_parent_sync") ? "The parent application" : "A user whose name was not recorded");
  const roleName = row.affected_role_name?.trim() || row.role_name;
  const role = safeLabel(roleName) ? `the ${roleName} role` : "a role no longer available";
  const label = auditActionLabel(row);
  const unmapped = [
    ...(!AUDIT_EVENT_LABELS[row.event] ? [`event:${row.event}`] : []),
    ...(row.action && !actions[row.action] ? [`action:${row.action}`] : []),
  ];
  let change: string;
  switch (row.event) {
    case "training_setting_changed":
      change = row.after_value === true ? row.before_value === true ? `kept “${label}” turned on` : `turned on “${label}”`
        : row.after_value === false ? row.before_value === false ? `kept “${label}” turned off` : `turned off “${label}”`
        : `updated “${label}”`;
      break;
    case "grant_change": {
      const menu = safeLabel(row.menu_name) ?? safeLabel(details.menuName);
      if (row.resource?.startsWith("menu:") && !menu) unmapped.push(`menu:${row.resource.slice(5)}`);
      const permission = `${label}${row.resource?.startsWith("menu:") ? ` — ${menu ?? "an unavailable screen"}` : ""}`;
      change = row.after_value === true
        ? row.before_value === true ? `kept “${permission}” permission granted to ${role}` : `granted “${permission}” permission to ${role}`
        : row.after_value === false
          ? row.before_value === false || row.before_value == null ? `left “${permission}” permission not granted to ${role}` : `removed “${permission}” permission from ${role}`
          : `updated “${permission}” permission for ${role}`;
      break;
    }
    case "training_override": change = "overrode a training-related deployment block for a deployment checklist"; break;
    case "checklist_override": change = "overrode unresolved Company Form checks for a deployment checklist"; break;
    case "role_eligibility_change": change = `changed the availability of ${role}`; break;
    case "company_document_branding": change = "updated the company document logo"; break;
    case "parent_sync_management_eligibility": change = `updated whether ${role} is eligible to manage Access Control`; break;
    case "parent_sync_category_readiness": change = `${row.after_value === true ? "made" : "marked"} the parent support category ${row.after_value === true ? "available" : "unavailable"}`; break;
    case "parent_sync_rejected": change = "submitted a parent role update that was refused; existing access was preserved"; break;
    default: change = `updated access${row.role_id ? ` for ${role}` : ""}; export the history for the recorded information`;
  }
  return { sentence: `${auditDate(row.recorded_at)} — ${who} ${change}.`, unmapped };
}
