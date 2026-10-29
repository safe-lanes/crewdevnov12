import { describe, expect, it } from "vitest";
import { ACCESS_AUDIT_CSV_COLUMNS, accessAuditExportRow, auditScreenValue } from "@shared/v2/admin/accessAuditExport";
import { rowsToCsv } from "../../client/src/lib/csvExport";
import type { AccessAuditEntry } from "@shared/v2/admin/accessAuditPresentation";

const row: AccessAuditEntry = {
  id: "123", event: "training_setting_changed", actor_name: 'Jane, "Smith"',
  actor: { masterUserId: 24, roleId: "actor-role", roleName: "Manager" },
  role_id: "affected-role", role_name: "Office", resource: "training_compliance",
  action: "block_missing_expiry", before_value: true, after_value: false,
  recorded_at: "2026-10-29T10:00:00Z", details: { reason: "First line\nSecond line" },
};
describe("audit screen comparisons and CSV export", () => {
  it("keeps the named simple values unchanged without rendering structured payload", () => {
    expect(auditScreenValue(true, false)).toBe("On");
    expect(auditScreenValue(false, false)).toBe("Off");
    expect(auditScreenValue(true, true)).toBe("Granted");
    expect(auditScreenValue(false, true)).toBe("Not granted");
    expect(auditScreenValue(null, false)).toBe("Not recorded");
    expect(auditScreenValue({ roleId: "internal" }, false)).toBe("See the export for the recorded details.");
  });
  it("includes the sentence and separately named technical columns without changing capture", () => {
    const original = JSON.stringify(row);
    const result = accessAuditExportRow(row);
    expect(result.sentence).toContain("turned off");
    expect(result.person).toBe('Jane, "Smith"');
    expect(result.role).toBe("Office");
    expect(result.before).toBe("true");
    expect(result.after).toBe("false");
    expect(result.actor).toBe(JSON.stringify(row.actor));
    expect(result.details).toBe(JSON.stringify(row.details));
    expect(result).toMatchObject({ event: row.event, resource: row.resource, setting: row.action,
      timestamp: row.recorded_at, auditId: "123", personId: "24", roleId: "affected-role" });
    expect(Object.keys(result)).toEqual(ACCESS_AUDIT_CSV_COLUMNS.map(c => c.key));
    expect(JSON.stringify(row)).toBe(original);
  });
  it("reuses Reports CSV quoting for commas, quotes, newlines and Unicode", () => {
    const csv = rowsToCsv(ACCESS_AUDIT_CSV_COLUMNS, [accessAuditExportRow(row)]);
    expect(csv).toContain('"Jane, ""Smith"""');
    expect(csv).toContain("Plain-language sentence,Timestamp (UTC)");
    expect(csv).toContain("“");
    expect(csv).toContain('""reason""');
  });
  it.each(["=SUM(1,2)", "+formula", "-formula", "@formula", "\tformula", "\rformula"])(
    "prevents spreadsheet formula execution for %j", name => {
      expect(accessAuditExportRow({ ...row, actor_name: name }).person).toBe(`'${name}`);
    });
  it("does not substitute an actor role for an unknown person's name", () => {
    expect(accessAuditExportRow({ ...row, actor_name: null }).person).toBe("");
  });
  it("preserves structured values and distinguishes missing values from null in export", () => {
    expect(accessAuditExportRow({ ...row, before_value: { active: true }, after_value: null }))
      .toMatchObject({ before: '{"active":true}', after: "null" });
    expect(accessAuditExportRow({ ...row, before_value: undefined }).before).toBe("");
  });
  it("exports the frozen name separately from the current name", () => {
    expect(accessAuditExportRow({ ...row, actor_display_name: "Original Person" }))
      .toMatchObject({ person: 'Jane, "Smith"', frozenPerson: "Original Person" });
    expect(accessAuditExportRow(row).frozenPerson).toBe("");
  });
  it("exports the affected role snapshot separately from its current name", () => {
    const result = accessAuditExportRow({ ...row, affected_role_name: "Original Office", event: "grant_change" });
    expect(result).toMatchObject({ role: "Office", frozenRole: "Original Office" });
    expect(result.sentence).toContain("Original Office");
    expect(accessAuditExportRow(row).frozenRole).toBe("");
    expect(ACCESS_AUDIT_CSV_COLUMNS).toContainEqual({
      key: "frozenRole", label: "Affected role (recorded at event)",
    });
  });
});
