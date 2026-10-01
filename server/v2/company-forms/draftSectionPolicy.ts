import { eq } from "drizzle-orm";
import { masterUsers } from "../../../shared/schema";
import type { CompanyFormPrincipal } from "./contracts";
import { CompanyFormPermissionError } from "./errors";

type SectionPolicyInput = {
  principal: CompanyFormPrincipal;
  section: {
    responsibleMode: string;
    responsibleRoleUuid: string | null;
    responsibleDepartment: string | null;
  };
  part: { isOfficeOnly: boolean };
  executor: any;
};

export async function assertCompanyFormSectionEditable(input: SectionPolicyInput): Promise<void> {
  const { principal, section, part, executor } = input;
  if (part.isOfficeOnly && principal.kind !== "office") {
    throw new CompanyFormPermissionError("Office-only Company Form parts can only be edited by office users.");
  }

  if (section.responsibleMode === "role") {
    if (principal.kind === "seafarer" || !section.responsibleRoleUuid ||
      principal.roleId !== section.responsibleRoleUuid) {
      throw new CompanyFormPermissionError("This Company Form section is assigned to a different role.");
    }
    return;
  }

  if (section.responsibleMode === "department") {
    const requiredDepartment = section.responsibleDepartment?.trim();
    if (!requiredDepartment) {
      throw new CompanyFormPermissionError("This Company Form section has no valid responsible department.");
    }
    const users = await executor.select({ department: masterUsers.department })
      .from(masterUsers)
      .where(eq(masterUsers.id, principal.userId))
      .limit(1);
    const trustedDepartment = users[0]?.department?.trim();
    if (!trustedDepartment ||
      trustedDepartment.toLocaleLowerCase() !== requiredDepartment.toLocaleLowerCase()) {
      throw new CompanyFormPermissionError("This Company Form section is assigned to a different department.");
    }
    return;
  }

  if (section.responsibleMode === "seafarer") {
    if (principal.kind !== "seafarer" || principal.linkageSource !== "trusted_server_resolver") {
      throw new CompanyFormPermissionError("Only the linked seafarer may edit this Company Form section.");
    }
    return;
  }

  if (section.responsibleMode === "not_applicable") {
    if (principal.kind !== "office" && principal.kind !== "vessel") {
      throw new CompanyFormPermissionError("This Company Form section is not assigned to the current actor.");
    }
    return;
  }

  throw new CompanyFormPermissionError("This Company Form section has an unsupported responsibility policy.");
}