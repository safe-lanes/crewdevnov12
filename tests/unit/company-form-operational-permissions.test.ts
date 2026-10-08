import { describe, expect, it } from "vitest";
import { assertCompanyFormPermission, assertCompanyFormSignaturePermission, authorizeCompanyFormAction } from "../../server/v2/company-forms/operationalPermissions";
import type { CompanyFormPrincipal } from "../../server/v2/company-forms/contracts";

const office: CompanyFormPrincipal = { kind: "office", userId: 1, roleId: "parent-role", roleName: "Unlisted role", roleType: "Office" };
const vessel: CompanyFormPrincipal = { kind: "vessel", userId: 2, roleId: "vessel-role", roleName: "Anything", roleType: "Ship", vesselUuids: ["own"] };
const allow = { hasPermission: async () => true };
const deny = { hasPermission: async () => false };
describe("Independent Company Forms operations", () => {
  it("uses Fill in for start, not legacy Create", async () => {
    await expect(authorizeCompanyFormAction(office, "create_submission", deny)).rejects.toThrow("Fill in");
    await expect(authorizeCompanyFormAction(office, "create_submission", allow)).resolves.toBe(true);
  });
  it("separates all six grants and permits representative/witness without Fill in", async () => {
    for (const permission of ["view", "fill_in", "witness", "sign_representative", "void", "void_completed"] as const) {
      await expect(assertCompanyFormPermission(office, permission, deny)).rejects.toThrow("Company Forms");
      await expect(assertCompanyFormPermission(office, permission, allow)).resolves.toBeUndefined();
    }
    await expect(assertCompanyFormSignaturePermission(office, "officer", {
      hasPermission: async (_role, permission) => permission === "sign_representative",
    })).resolves.toBeUndefined();
  });
  it("hard-denies Vessel representative despite an explicit grant", async () => {
    await expect(assertCompanyFormSignaturePermission(vessel, "officer", allow)).rejects.toThrow("Office category");
  });
  it("keeps pinned Vessel Management independent of operational grants", async () => {
    await expect(assertCompanyFormSignaturePermission(vessel, "vessel_management", deny)).resolves.toBeUndefined();
  });
  it("does not infer support category from a role name", async () => {
    await expect(assertCompanyFormPermission({ ...office, roleName: "Sail Admin" }, "fill_in", allow)).resolves.toBeUndefined();
  });
  it("denies every support operation despite grants, allowing only granted View", async () => {
    const support = { ...office, roleType: "SAIL Admin" } as CompanyFormPrincipal;
    await expect(assertCompanyFormPermission(support, "view", allow)).resolves.toBeUndefined();
    for (const permission of ["fill_in", "witness", "sign_representative", "void", "void_completed"] as const) {
      await expect(assertCompanyFormPermission(support, permission, allow)).rejects.toThrow("SAIL Admin category");
    }
    await expect(assertCompanyFormSignaturePermission(support, "vessel_management", allow)).rejects.toThrow("Vessel Management");
  });
});
