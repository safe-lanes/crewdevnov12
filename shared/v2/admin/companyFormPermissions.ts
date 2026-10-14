export const COMPANY_FORMS_RESOURCE = "company_forms";
export const COMPANY_FORM_PERMISSIONS = [
  { action: "view", label: "View" },
  { action: "fill_in", label: "Fill in" },
  { action: "witness", label: "Witness" },
  { action: "sign_representative", label: "Sign as Company Representative" },
  { action: "void", label: "Void" },
  { action: "void_completed", label: "Void completed" },
  { action: "override_checklist", label: "Override checklist" },
] as const;
export type CompanyFormPermission = typeof COMPANY_FORM_PERMISSIONS[number]["action"];
export type CompanyFormGrants = Record<CompanyFormPermission, boolean>;
export function emptyCompanyFormGrants(): CompanyFormGrants {
  return Object.fromEntries(COMPANY_FORM_PERMISSIONS.map(({ action }) => [action, false])) as CompanyFormGrants;
}
export function companyFormPermissionLabel(action: CompanyFormPermission): string {
  return COMPANY_FORM_PERMISSIONS.find(item => item.action === action)!.label;
}
/** These actions are always default-deny; never use menu unknown/default-allow. */
export function hasCompanyFormPermission(grants: Partial<CompanyFormGrants> | undefined,
  category: string | undefined, action: CompanyFormPermission): boolean {
  const normalized = category?.trim().toLowerCase();
  if (!["office", "ship", "vessel", "sail admin"].includes(normalized ?? "")) return false;
  if (normalized === "sail admin" && action !== "view") return false;
  if (action === "sign_representative" && normalized !== "office") return false;
  return grants?.[action] === true;
}
