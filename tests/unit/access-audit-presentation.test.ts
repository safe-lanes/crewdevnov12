import { describe, expect, it } from "vitest";
import { presentAccessAudit, auditValueWords, AUDIT_SETTING_LABELS, type AccessAuditEntry } from "@shared/v2/admin/accessAuditPresentation";
import { accessAuditExportRow } from "@shared/v2/admin/accessAuditExport";

const row: AccessAuditEntry = {
  id: "99", event: "grant_change", recorded_at: "2026-10-20T03:58:00Z",
  actor: { masterUserId: 24, roleName: "Admin", roleId: "11111111-1111-4111-8111-111111111111", userType: "Office" },
  role_name: "PDF Layout Review Vessel", role_id: "22222222-2222-4222-8222-222222222222",
  resource: "company_forms", action: "witness", before_value: false, after_value: true,
};
describe("plain Access audit sentences", () => {
  it("uses the current deployment permission wording for new and historical rows without mutating either", () => {
    const historical = { ...row, resource: "training_compliance", action: "override" };
    const frozen = JSON.stringify(historical);
    expect(presentAccessAudit(historical).sentence).toContain("granted “Override deployment block” permission");
    expect(accessAuditExportRow(historical).sentence).toContain("Override deployment block");
    expect(JSON.stringify(historical)).toBe(frozen);
  });
  it("names the permission, actor, role and time without technical payload", () => {
    const result = presentAccessAudit(row);
    expect(result.sentence).toBe("20 Oct 2026, 03:58 UTC — Admin granted “Witness” permission to the PDF Layout Review Vessel role.");
    expect(result.unmapped).toEqual([]);
    expect(result.sentence).not.toMatch(/masterUserId|roleId|true|false|11111111|22222222|grant_change/);
  });
  it("prefers an identified person without replacing the stored actor", () => {
    const before = JSON.stringify(row);
    expect(presentAccessAudit({ ...row, actor_name: "Jane Smith" }).sentence).toContain("Jane Smith granted");
    expect(JSON.stringify(row)).toBe(before);
  });
  it("uses the on-screen policy labels and distinguishes on, off and unchanged", () => {
    for (const action of Object.keys(AUDIT_SETTING_LABELS)) {
      const setting = { ...row, event: "training_setting_changed", resource: "training_compliance", action };
      expect(presentAccessAudit(setting).sentence).toContain(`turned on “${AUDIT_SETTING_LABELS[action]}”`);
      expect(presentAccessAudit({ ...setting, before_value: true, after_value: false }).sentence).toContain("turned off");
      expect(presentAccessAudit({ ...setting, before_value: true }).sentence).toContain("kept");
    }
  });
  it("does not describe an unchanged denial as removing a permission", () => {
    expect(presentAccessAudit({ ...row, after_value: false }).sentence).toContain("left “Witness” permission not granted");
    expect(presentAccessAudit({ ...row, before_value: true, after_value: false }).sentence).toContain("removed “Witness” permission");
  });
  it("resolves menu grants and reports missing mappings without displaying keys", () => {
    expect(presentAccessAudit({ ...row, action: "view", resource: "menu:internal", menu_name: "Travel ID Documents" }).sentence).toContain("View — Travel ID Documents");
    const unknown = presentAccessAudit({ ...row, event: "future_event", action: "new_internal_action" });
    expect(unknown.unmapped).toEqual(["event:future_event", "action:new_internal_action"]);
    expect(unknown.sentence).not.toMatch(/future_event|new_internal_action/);
  });
  it.each(["training_override", "checklist_override", "role_eligibility_change", "company_document_branding",
    "parent_sync_management_eligibility", "parent_sync_category_readiness", "parent_sync_rejected"])("maps %s", event => {
    const result = presentAccessAudit({ ...row, event });
    expect(result.unmapped).toEqual([]);
    expect(result.sentence).not.toContain(event);
  });
  it("handles unavailable names and dates without inventing them", () => {
    expect(presentAccessAudit({ ...row, actor: {}, role_name: null, recorded_at: "invalid" }).sentence)
      .toContain("Time not recorded — A user whose name was not recorded");
  });
  it("renders before and after as words, including nested values", () => {
    expect(auditValueWords(false, true)).toBe("Not granted");
    expect(auditValueWords(true)).toBe("On");
    expect(auditValueWords({ active: false })).toContain('"No"');
    expect(auditValueWords(null)).toBe("Not recorded");
  });
  it("uses the frozen actor name even after the current name changes or disappears", () => {
    for (const actor_name of ["Renamed Person", null]) {
      const result = presentAccessAudit({ ...row, actor_display_name: "Captured Person", actor_name });
      expect(result.sentence).toContain("Captured Person granted");
      expect(result.sentence).not.toContain("Renamed Person");
    }
    expect(presentAccessAudit({ ...row, actor_display_name: null, actor_name: "Legacy Person" }).sentence)
      .toContain("Legacy Person granted");
  });
});
