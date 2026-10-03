import { describe, expect, it } from "vitest";
import { validateCompanyFormLifecycle, sectionRequiresSubmission } from "../../server/v2/company-forms/lifecyclePolicy";
const section = { responsibleMode: "seafarer", signatureOfficerRequired: false,
  signatureSeafarerRequired: false, questions: [], sectionTitle: "Policy" };
describe("Vessel signature release policy", () => {
  it("Vessel Management is content requiring submission", () => {
    expect(sectionRequiresSubmission({ ...section, signatureVesselManagementRequired: true })).toBe(true);
  });
  it("requires permitted roles for Vessel Management", () => {
    expect(validateCompanyFormLifecycle([{ ...section, signatureVesselManagementRequired: true }]).join()).toContain("permitted vessel role");
  });
  it("requires permitted roles for on-board seafarer witnessing", () => {
    expect(validateCompanyFormLifecycle([{ ...section, onBoard: true, signatureSeafarerRequired: true }]).join()).toContain("permitted vessel role");
  });
  it("does not impose vessel witnessing on before-joining forms", () => {
    expect(validateCompanyFormLifecycle([{ ...section, signatureSeafarerRequired: true }])).toEqual([]);
  });
  it("accepts multiple stable permitted roles", () => {
    expect(validateCompanyFormLifecycle([{ ...section, signatureVesselManagementRequired: true, vesselSignatureRoleUuids: ["stable-master","stable-chief"] }])).toEqual([]);
  });
  it("rejects inactive or unknown role policy", () => {
    expect(validateCompanyFormLifecycle([{ ...section, signatureVesselManagementRequired: true, vesselSignatureRoleUuids: ["role"], vesselRolePolicyValid: false }]).join()).toContain("invalid or inactive");
  });
});