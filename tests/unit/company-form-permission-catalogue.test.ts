import { describe, expect, it } from "vitest";
import { COMPANY_FORM_PERMISSIONS, emptyCompanyFormGrants } from "../../shared/v2/admin/companyFormPermissions";

describe("Company Forms action catalogue", () => {
  it("declares six independent permissions, all off without explicit grants", () => {
    expect(COMPANY_FORM_PERMISSIONS.map(item => item.label)).toEqual([
      "View", "Fill in", "Witness", "Sign as Company Representative", "Void", "Void completed",
    ]);
    expect(Object.values(emptyCompanyFormGrants())).toEqual(Array(6).fill(false));
    const grants = emptyCompanyFormGrants();
    grants.witness = true;
    expect(grants.fill_in).toBe(false);
    expect(grants.sign_representative).toBe(false);
  });
});
