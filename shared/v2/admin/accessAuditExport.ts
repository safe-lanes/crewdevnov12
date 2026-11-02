import { auditValueWords, liveAuditActionLabel, presentAccessAudit, type AccessAuditEntry } from "./accessAuditPresentation";

export const ACCESS_AUDIT_CSV_COLUMNS = [
  { key: "sentence", label: "Plain-language sentence" },
  { key: "timestamp", label: "Timestamp (UTC)" },
  { key: "person", label: "Person (current name)" },
  { key: "frozenPerson", label: "Person (recorded at event)" },
  { key: "role", label: "Affected role (current name)" },
  { key: "frozenRole", label: "Affected role (recorded at event)" },
  { key: "permission", label: "Permission (current label)" },
  { key: "frozenPermission", label: "Permission (recorded at event)" },
  { key: "event", label: "Event key" },
  { key: "resource", label: "Resource" },
  { key: "setting", label: "Setting / action key" },
  { key: "before", label: "Before value" },
  { key: "after", label: "After value" },
  { key: "auditId", label: "Audit ID" },
  { key: "personId", label: "Actor account ID" },
  { key: "roleId", label: "Affected role UUID" },
  { key: "actor", label: "Recorded actor (JSON)" },
  { key: "details", label: "Recorded details (JSON)" },
];

/** Keep simple named comparisons unchanged; structured payload belongs in export. */
export function auditScreenValue(value: unknown, permission: boolean): string {
  return value !== null && typeof value === "object"
    ? "See the export for the recorded details."
    : auditValueWords(value, permission);
}

const rawValue = (value: unknown): string =>
  value === undefined ? "" : JSON.stringify(value);

export function accessAuditExportRow(row: AccessAuditEntry & { sentence?: string }): Record<string, string> {
  const actor = row.actor !== null && typeof row.actor === "object"
    ? row.actor as Record<string, unknown> : {};
  const values = {
    sentence: row.sentence ?? presentAccessAudit(row).sentence,
    timestamp: row.recorded_at ?? "",
    person: row.actor_name ?? "",
    frozenPerson: row.actor_display_name ?? "",
    role: row.role_name ?? "",
    frozenRole: row.affected_role_name ?? "",
    permission: liveAuditActionLabel(row),
    frozenPermission: row.permission_display_label ?? "",
    event: row.event,
    resource: row.resource ?? "",
    setting: row.action ?? "",
    before: rawValue(row.before_value),
    after: rawValue(row.after_value),
    auditId: String(row.id),
    personId: String(actor.masterUserId ?? ""),
    roleId: row.role_id ?? "",
    actor: rawValue(row.actor),
    details: rawValue(row.details),
  };
  // Spreadsheet safety for untrusted names, labels and recorded string values.
  return Object.fromEntries(Object.entries(values).map(([key, value]) =>
    [key, /^[=+\-@\t\r]/.test(value) ? `'${value}` : value]));
}
