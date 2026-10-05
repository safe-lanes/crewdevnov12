import { and, eq, sql } from "drizzle-orm";
import { masterUsers } from "../../../../shared/schema";
import { admCompanyRanksV2, admRoleMasterAc } from "../../../../shared/v2/admin/schema";
import { CompanyFormPermissionError } from "../errors";
import { resolveTrustedVesselScope } from "../trustedPrincipalService";
import type { CompanyFormSubjectAdapter } from "../contracts";
import type { CrewAssignmentSubject } from "./crewAssignmentSubject";

export async function captureVesselSigner(principal: any, executor: any) {
  if (principal.kind !== "vessel") throw new CompanyFormPermissionError();
  // In lifecycle transactions this holds the authenticated user's provisioning
  // and role steady until the signature/draft/submit operation commits.
  await executor.execute(sql`SELECT id FROM master_users WHERE id = ${principal.userId} FOR SHARE`);
  await executor.execute(sql`SELECT ruid FROM adm_rolemaster_ac WHERE ruid = ${principal.roleId} FOR SHARE`);
  const users = await executor.select().from(masterUsers).where(eq(masterUsers.id, principal.userId)).limit(1);
  const user = users[0];
  const roles = await executor.select().from(admRoleMasterAc).where(and(
    eq(admRoleMasterAc.ruid, principal.roleId), eq(admRoleMasterAc.roletype, "Ship"),
    eq(admRoleMasterAc.isActive, true), eq(admRoleMasterAc.isDeleted, false),
  )).limit(1);
  if (!user || user.userType?.toLowerCase() !== "ship" ||
    user.role?.trim().toLowerCase() !== roles[0]?.assignedRole?.trim().toLowerCase()) {
    throw new CompanyFormPermissionError("The authenticated vessel role is no longer valid.");
  }
  const designation = user.designation?.trim();
  const ranks = await executor.select().from(admCompanyRanksV2).where(and(
    eq(admCompanyRanksV2.isDeleted, false), eq(admCompanyRanksV2.isRoleRow, false),
  ));
  const matched = ranks.filter((rank: any) => designation &&
    (rank.rankId === designation || rank.rank?.trim().toLowerCase() === designation.toLowerCase()));
  const name = (user.fullname || user.displayName || [user.firstname,user.lastname].filter(Boolean).join(" ")).trim();
  if (!name || matched.length !== 1) throw new CompanyFormPermissionError("The vessel signer's own name/rank cannot be verified.");
  return { name, rank: matched[0].rank as string };
}

export const authorizeCrewSectionAction: NonNullable<CompanyFormSubjectAdapter<CrewAssignmentSubject>["authorizeSectionAction"]> = async input => {
  if (input.principal.kind !== "vessel") {
    if (input.principal.kind === "office" && input.signatureType === "seafarer" &&
      input.stageKey !== "before_joining" &&
      !(input.stageKey === "at_sign_off" && input.section.signatureOfficerRequired)) {
      throw new CompanyFormPermissionError("Office witnessing requires before-joining or a configured Company Representative sign-off route.");
    }
    return;
  }
  if (!["on_board", "at_sign_off"].includes(input.stageKey ?? "") ||
    !input.section.vesselSignatureRoleUuids?.includes(input.principal.roleId) ||
    input.signatureType === "officer" ||
    (input.stageKey === "at_sign_off" && !input.section.signatureVesselManagementRequired)) {
    throw new CompanyFormPermissionError("This role is not permitted for on-board signing or witnessing.");
  }
  if (!input.subject.isCurrent || input.subject.signOffDate) {
    const signatures = input.signatures ?? [];
    const seafarer = signatures.filter(s => !s.isDeleted && s.signatureType === "seafarer");
    const provenance = seafarer[0]?.subjectProvenance;
    if (input.stageKey !== "at_sign_off" || input.subject.isDeleted ||
      input.subject.assignmentType !== "OnBoard" || input.subject.isCurrent || !input.subject.signOffDate ||
      input.action !== "save_signature" || input.signatureType !== "vessel_management" ||
      signatures.some(s => s.signatureType === "vessel_management") ||
      seafarer.length !== 1 || !seafarer[0].signedAt ||
      provenance?.aboard !== true || provenance.assignmentUuid !== input.subject.assignUuid ||
      provenance.crewUuid !== input.subject.crewUuid || provenance.vesselUuid !== input.subject.vesselUuid) {
      throw new CompanyFormPermissionError("After sign-off only a missing Vessel Management signature with proven aboard Seafarer signing is permitted.");
    }
  }
  await captureVesselSigner(input.principal, input.executor);
  const scope = await resolveTrustedVesselScope(input.principal.userId, input.executor);
  if (!input.subject.vesselUuid || !scope?.includes(input.subject.vesselUuid)) {
    throw new CompanyFormPermissionError("The vessel user does not belong to this submission's vessel.");
  }
};