import { describe, expect, it } from "vitest";
import { COMPANY_FORM_PERMISSIONS, emptyCompanyFormGrants, hasCompanyFormPermission } from "../../shared/v2/admin/companyFormPermissions";

describe("Company Forms action catalogue", () => {
  it("declares seven independent permissions, all off without explicit grants", () => {
    expect(COMPANY_FORM_PERMISSIONS.map(item => item.label)).toEqual([
      "View", "Fill in", "Witness", "Sign as Company Representative", "Void", "Void completed", "Override checklist",
    ]);
    expect(Object.values(emptyCompanyFormGrants())).toEqual(Array(7).fill(false));
    const grants = emptyCompanyFormGrants();
    grants.witness = true;
    expect(grants.fill_in).toBe(false);
    expect(grants.sign_representative).toBe(false);
    expect(grants.override_checklist).toBe(false);
  });
  it("never default-allows missing browser actions or unknown categories", () => {
    expect(hasCompanyFormPermission(undefined, "Office", "view")).toBe(false);
    expect(hasCompanyFormPermission({ view: true }, "unknown", "view")).toBe(false);
    expect(hasCompanyFormPermission({ sign_representative: true }, "Ship", "sign_representative")).toBe(false);
    expect(hasCompanyFormPermission({ fill_in: true }, "SAIL Admin", "fill_in")).toBe(false);
  });
});
