import { describe, expect, it } from "vitest";
import { validateCompanyFormLifecycle, sectionRequiresSubmission } from "../../server/v2/company-forms/lifecyclePolicy";
import { createCrewAssignmentSubject } from "../../server/v2/company-forms/subjects/crewAssignmentSubject";
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
  it("rejects Vessel Management on a before-joining release", () => {
    expect(validateCompanyFormLifecycle([{ ...section, onBoard: false,
      signatureVesselManagementRequired: true, vesselSignatureRoleUuids: ["master"] }]).join())
      .toContain("outside the on-board stage");
  });
  it("requires a current on-board subject for creation by Office as well as Ship", () => {
    const policy = createCrewAssignmentSubject().authorizeStageAction!;
    for (const kind of ["office", "vessel"] as const) {
      expect(policy({ kind } as any, "create_submission",
        { assignmentType: "Planned", isCurrent: false } as any, "on_board")).toBe(false);
      expect(policy({ kind } as any, "create_submission",
        { assignmentType: "OnBoard", isCurrent: true } as any, "on_board")).toBe(true);
    }
  });
  it("retains historical reads and Office before-joining creation", () => {
    const policy = createCrewAssignmentSubject().authorizeStageAction!;
    expect(policy({ kind: "vessel" } as any, "read_submission",
      { assignmentType: "Cancelled", isCurrent: false } as any, "on_board")).toBe(true);
    expect(policy({ kind: "office" } as any, "create_submission",
      { assignmentType: "Planned", isCurrent: false } as any, "before_joining")).toBe(true);
    expect(policy({ kind: "vessel" } as any, "create_submission",
      { assignmentType: "Planned", isCurrent: false } as any, "before_joining")).toBe(false);
  });
});