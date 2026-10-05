import { describe, expect, it } from "vitest";
import { createCrewAssignmentSubject } from "../../server/v2/company-forms/subjects/crewAssignmentSubject";
import { authorizeCrewSectionAction } from "../../server/v2/company-forms/subjects/vesselSigningPolicy";
import { validateCompanyFormLifecycle } from "../../server/v2/company-forms/lifecyclePolicy";
import { masterUsers, masterVessels } from "../../shared/schema";
import { admRoleMasterAc, admCompanyRanksV2 } from "../../shared/v2/admin/schema";
import { frmSections } from "../../shared/v2/forms-engine/schema";

const subject = { assignUuid: "a", crewUuid: "c", vesselUuid: "v",
  assignmentType: "OnBoard", isCurrent: true, isDeleted: false, signOffDate: null };
const adapter = createCrewAssignmentSubject();
describe("Sign-off stage policy", () => {
  it("permits a planned date only while the exact authoritative incumbent is aboard", async () => {
    const planning={crewAssignUuid:"a",crewUuid:"c",vesselUuid:"v",signOffDate:"2026-10-04"};
    const chain:any={from:()=>chain,where:()=>chain,limit:()=>chain,for:()=>chain,
      then:(resolve:any,reject:any)=>Promise.resolve([planning]).then(resolve,reject)};
    const executor:any={select:()=>chain};
    const query={planUuid:"p",crewUuid:"c",vesselUuid:"v"};
    await expect(adapter.assertRequestContext!(subject as any,query,executor,true)).resolves.toBeUndefined();
    await expect(adapter.assertRequestContext!({...subject,isCurrent:false,signOffDate:"2026-10-04"} as any,query,executor,true)).rejects.toMatchObject({statusCode:403});
    await expect(adapter.assertRequestContext!({...subject,assignUuid:"wrong"} as any,query,executor,true)).rejects.toMatchObject({statusCode:403});
  });
  it("releases ashore and dual-configured sign-off sections without widening before-joining", () => {
    const section = { onBoard: false, atSignOff: true, signatureOfficerRequired: true,
      signatureSeafarerRequired: true, responsibleMode: "seafarer", questions: [] };
    expect(validateCompanyFormLifecycle([section])).toEqual([]);
    expect(validateCompanyFormLifecycle([{ ...section, signatureVesselManagementRequired: true,
      vesselSignatureRoleUuids: ["master"] }])).toEqual([]);
    expect(validateCompanyFormLifecycle([{ ...section, atSignOff: false, signatureVesselManagementRequired: true,
      vesselSignatureRoleUuids: ["master"] }]).join()).toContain("outside the on-board stage");
  });
  it("allows aboard Ship sign-off writes but only signature saves after sign-off", () => {
    const principal = { kind: "vessel" } as any;
    expect(adapter.authorizeStageAction!(principal, "create_submission", subject as any, "at_sign_off")).toBe(true);
    for (const action of ["create_submission", "edit_draft", "submit_section", "remove_signature", "void_submission"] as const) {
      expect(adapter.authorizeStageAction!(principal, action, { ...subject, isCurrent: false, signOffDate: "2026-10-04" } as any, "at_sign_off")).toBe(false);
    }
    expect(adapter.authorizeStageAction!(principal, "save_signature", { ...subject, isCurrent: false, signOffDate: "2026-10-04" } as any, "at_sign_off")).toBe(true);
  });
  it("allows Office historical sign-off creation but not cancelled/deleted subjects", () => {
    for (const action of ["create_submission", "edit_draft", "submit_section", "save_signature"] as const) {
      expect(adapter.authorizeStageAction!({ kind: "office" } as any, action, { ...subject, isCurrent: false, signOffDate: "2026-10-04" } as any, "at_sign_off")).toBe(true);
      expect(adapter.authorizeStageAction!({ kind: "office" } as any, action, { ...subject, assignmentType: "Cancelled" } as any, "at_sign_off")).toBe(false);
    }
  });
  it("permits Office witnessing only when the sign-off section has Company Representative", async () => {
    const input = { principal: { kind: "office" }, subject, stageKey: "at_sign_off",
      action: "save_signature", signatureType: "seafarer", executor: {}, section: {} } as any;
    await expect(authorizeCrewSectionAction(input)).rejects.toMatchObject({ statusCode: 403 });
    await expect(authorizeCrewSectionAction({ ...input, section: { signatureOfficerRequired: true, signatureVesselManagementRequired: true } })).resolves.toBeUndefined();
    await expect(authorizeCrewSectionAction({ ...input, stageKey: "before_joining" })).resolves.toBeUndefined();
    await expect(authorizeCrewSectionAction({ ...input, stageKey: "on_board" })).rejects.toMatchObject({ statusCode: 403 });
  });
  it("refuses late signing with missing, mismatched or ambiguous aboard provenance", async () => {
    const input = { principal: { kind: "vessel", roleId: "master" }, subject: { ...subject, isCurrent: false, signOffDate: "2026-10-04" },
      stageKey: "at_sign_off", action: "save_signature", signatureType: "vessel_management", executor: {},
      section: { signatureVesselManagementRequired: true, vesselSignatureRoleUuids: ["master"] } } as any;
    const seafarer = { signatureType: "seafarer", signedAt: new Date(), subjectProvenance: adapter.signatureProvenance!(subject as any) };
    for (const signatures of [[], [{ ...seafarer, subjectProvenance: null }], [{ ...seafarer, subjectProvenance: { ...seafarer.subjectProvenance, crewUuid: "wrong" } }],
      [seafarer, seafarer], [seafarer, { signatureType: "vessel_management", isDeleted: true }]]) {
      await expect(authorizeCrewSectionAction({ ...input, signatures })).rejects.toMatchObject({ statusCode: 403 });
    }
    for (const signatureType of ["seafarer", "officer"]) {
      await expect(authorizeCrewSectionAction({ ...input, signatureType, signatures: [seafarer] })).rejects.toMatchObject({ statusCode: 403 });
    }
  });
  it("captures locked authoritative assignment provenance without historical reconstruction", () => {
    expect(adapter.signatureProvenance!(subject as any)).toEqual({ assignmentUuid: "a", crewUuid: "c", vesselUuid: "v", aboard: true });
    expect(adapter.signatureProvenance!({ ...subject, signOffDate: "2026-10-04" } as any).aboard).toBe(false);
  });
  it("authorizes only trusted active permitted Master membership for aboard and late signing", async () => {
    let pinned: any = { signatureVesselManagementRequired: true, vesselSignatureRoleUuids: ["master"] };
    let user: any = { id: 77, userType: "Ship", role: "TEST ONLY MASTER", designation: "Master",
      fullname: "TEST ONLY Witness", vesselIds: "2" };
    const tables = (table: any) => table === masterUsers ? [user] : table === admRoleMasterAc
      ? [{ ruid: "master", assignedRole: "TEST ONLY MASTER", roletype: "Ship" }]
      : table === admCompanyRanksV2 ? [{ rankId: "R001", rank: "Master" }]
      : table === masterVessels ? [{ id: 2, vesselUuid: "v" }]
      : table === frmSections ? [{ section: pinned, part: { isOfficeOnly: false } }] : [];
    const executor = { execute: async () => undefined, select: () => {
      let table: any;
      const chain: any = { from: (value: any) => { table = value; return chain; }, innerJoin: () => chain, where: () => chain,
        limit: async () => tables(table), then: (resolve: any, reject: any) => Promise.resolve(tables(table)).then(resolve, reject) };
      return chain;
    } };
    const base = { principal: { kind: "vessel", userId: 77, roleId: "master" }, subject,
      stageKey: "at_sign_off", action: "save_signature", signatureType: "seafarer", executor,
      section: { signatureOfficerRequired: true, signatureVesselManagementRequired: true, vesselSignatureRoleUuids: ["master"] } } as any;
    await expect(authorizeCrewSectionAction(base)).resolves.toBeUndefined();
    const start = { principal: base.principal, subject, stageKey: "at_sign_off", formVersionUuid: "version", executor } as any;
    await expect(adapter.authorizeVersionStart!(start)).resolves.toBeUndefined();
    pinned = { ...pinned, vesselSignatureRoleUuids: ["another-role"] };
    await expect(adapter.authorizeVersionStart!(start)).rejects.toMatchObject({ statusCode: 403 });
    pinned = { signatureOfficerRequired: true, signatureVesselManagementRequired: false };
    await expect(adapter.authorizeVersionStart!(start)).rejects.toMatchObject({ statusCode: 403 });
    pinned = { signatureVesselManagementRequired: true, vesselSignatureRoleUuids: ["master"] };
    const signatures = [{ signatureType: "seafarer", signedAt: new Date(), subjectProvenance: adapter.signatureProvenance!(subject as any) }];
    const late = { ...base, subject: { ...subject, isCurrent: false, signOffDate: "2026-10-04" },
      signatureType: "vessel_management", signatures };
    await expect(authorizeCrewSectionAction(late)).resolves.toBeUndefined();
    await expect(authorizeCrewSectionAction({ ...late, subject: { ...late.subject, vesselUuid: "wrong" } })).rejects.toMatchObject({ statusCode: 403 });
    user = { ...user, vesselIds: null };
    await expect(authorizeCrewSectionAction(late)).rejects.toMatchObject({ statusCode: 403 });
    await expect(adapter.authorizeVersionStart!(start)).rejects.toMatchObject({ statusCode: 403 });
    user = { ...user, vesselIds: "2", role: "Other role" };
    await expect(authorizeCrewSectionAction(late)).rejects.toMatchObject({ statusCode: 403 });
    for (const action of ["edit_draft", "submit_section", "remove_signature"] as const) {
      await expect(authorizeCrewSectionAction({ ...late, action })).rejects.toMatchObject({ statusCode: 403 });
    }
  });
  it("rejects cross-profile/vessel and stale exact planning contexts", async () => {
    await expect(adapter.assertRequestContext!(subject as any, { crewUuid: "wrong" })).rejects.toMatchObject({ statusCode: 403 });
    await expect(adapter.assertRequestContext!(subject as any, { vesselUuid: "wrong" })).rejects.toMatchObject({ statusCode: 403 });
    for (const row of [null, { crewAssignUuid: "wrong" }, { crewAssignUuid: "a", crewUuid: "c", vesselUuid: "v", isArchived: true }]) {
      const executor = { select: () => ({ from: () => ({ where: () => ({ limit: async () => row ? [row] : [] }) }) }) };
      await expect(adapter.assertRequestContext!(subject as any, { planUuid: "p", crewUuid: "c", vesselUuid: "v" }, executor)).rejects.toMatchObject({ statusCode: 403 });
    }
  });
});