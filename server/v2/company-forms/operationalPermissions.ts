import { readCompanyFormGrants } from "../admin/services/actionPermissionsService";
import { companyFormPermissionLabel, type CompanyFormPermission } from "../../../shared/v2/admin/companyFormPermissions";
import { CompanyFormPermissionError } from "./errors";
import type { CompanyFormAction, CompanyFormPrincipal } from "./contracts";
import type { PrincipalDependencies } from "./trustedPrincipalService";

export const ACTION_PERMISSION: Partial<Record<CompanyFormAction, CompanyFormPermission>> = {
  read_eligible_forms: "view", list_submissions: "view", count_submissions: "view",
  read_submission: "view", read_definition: "view", read_asset: "view",
  create_submission: "fill_in", edit_draft: "fill_in", submit_section: "fill_in",
  remove_signature: "fill_in", void_submission: "void", void_completed_submission: "void_completed",
};

export async function assertCompanyFormPermission(principal: CompanyFormPrincipal,
  permission: CompanyFormPermission, dependencies: PrincipalDependencies = {}, executor?: any): Promise<void> {
  const label = companyFormPermissionLabel(permission);
  if (principal.kind === "office" && principal.roleType === "SAIL Admin" && permission !== "view") {
    throw new CompanyFormPermissionError(`Company Forms ${label} is not permitted for the SAIL Admin category.`);
  }
  if (principal.kind === "vessel" && permission === "sign_representative") {
    throw new CompanyFormPermissionError("Company Forms Sign as Company Representative is restricted to the Office category.");
  }
  if (principal.kind === "seafarer") {
    if (permission === "view" || permission === "fill_in") return;
    throw new CompanyFormPermissionError(`Company Forms ${label} permission is required.`);
  }
  let allowed = false;
  try {
    allowed = dependencies.hasPermission
      ? await dependencies.hasPermission(principal.roleId, permission, executor)
      : (await readCompanyFormGrants(principal.roleId, executor))[permission];
  } catch {
    throw new CompanyFormPermissionError(`Unable to verify Company Forms ${label} permission.`);
  }
  if (!allowed) throw new CompanyFormPermissionError(`Company Forms ${label} permission is required.`);
}

export async function authorizeCompanyFormAction(principal: CompanyFormPrincipal,
  action: CompanyFormAction, dependencies: PrincipalDependencies = {}, executor?: any): Promise<boolean> {
  // Signing is authorized per exact signature type/method, not via Fill in.
  if (action === "save_signature") {
    if (principal.kind === "office" && principal.roleType === "SAIL Admin") {
      throw new CompanyFormPermissionError("Company Forms signing is not permitted for the SAIL Admin category.");
    }
    return true;
  }
  const permission = ACTION_PERMISSION[action];
  if (!permission) return false;
  await assertCompanyFormPermission(principal, permission, dependencies, executor);
  return true;
}

export async function assertCompanyFormSignaturePermission(principal: CompanyFormPrincipal,
  signatureType: string, dependencies: PrincipalDependencies = {}, executor?: any): Promise<void> {
  if (signatureType === "officer") {
    await assertCompanyFormPermission(principal, "sign_representative", dependencies, executor);
  } else if (signatureType === "seafarer" && principal.kind !== "seafarer") {
    await assertCompanyFormPermission(principal, "witness", dependencies, executor);
  } else if (signatureType === "vessel_management") {
    // Independent of the action grants; pinned role/scope checks still run.
    if (principal.kind !== "vessel") {
      throw new CompanyFormPermissionError("Vessel Management signing is restricted to permitted Vessel roles.");
    }
  } else if (signatureType !== "seafarer") {
    throw new CompanyFormPermissionError("Unsupported Company Forms signing permission.");
  }
}
