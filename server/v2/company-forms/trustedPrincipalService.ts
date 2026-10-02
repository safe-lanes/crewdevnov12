import type { Request } from "express";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { masterUsers, masterVessels } from "../../../shared/schema";
import { admMenuMasterAc, admRoleAccessAc } from "../../../shared/v2/admin/schema";
import { resolveRequestRole, type ResolvedRole } from "../auth/roleResolutionService";
import {
  CompanyFormAuthenticationError,
  CompanyFormPermissionError,
} from "./errors";
import type { CompanyFormAction, CompanyFormPrincipal } from "./contracts";

const OFFICE_ACTION_PERMISSION: Partial<Record<CompanyFormAction, "view" | "create" | "edit">> = {
  read_eligible_forms: "view",
  list_submissions: "view",
  count_submissions: "view",
  read_submission: "view",
  read_definition: "view",
  read_asset: "view",
  create_submission: "create",
  edit_draft: "edit",
  submit_section: "edit",
  save_signature: "edit",
  remove_signature: "edit",
  void_submission: "edit",
};

export type SeafarerCrewLinkResolver = (masterUserId: number) => Promise<string | null>;

export type PrincipalDependencies = {
  resolveRole?: typeof resolveRequestRole;
  resolveVesselScope?: (masterUserId: number) => Promise<readonly string[] | undefined>;
  hasOfficePermission?: (
    roleId: string,
    permission: "view" | "create" | "edit",
  ) => Promise<boolean>;
  resolveSeafarerCrewUuid?: SeafarerCrewLinkResolver;
};

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

/** Parse only complete positive decimal CSV IDs; prefix parsing is forbidden. */
export function decodeTrustedVesselIds(raw: string | null | undefined): number[] | undefined {
  if (!raw?.trim()) return undefined;
  const tokens = raw.split(",");
  const ids: number[] = [];
  for (const token of tokens) {
    const value = token.trim();
    if (!/^[1-9]\d*$/.test(value)) return undefined;
    const id = Number(value);
    if (!Number.isSafeInteger(id)) return undefined;
    ids.push(id);
  }
  return [...new Set(ids)];
}

async function resolveTrustedVesselScope(masterUserId: number): Promise<readonly string[] | undefined> {
  const db = getDb();
  const users = await db
    .select({
      id: masterUsers.id,
      vesselIds: masterUsers.vesselIds,
    })
    .from(masterUsers)
    .where(eq(masterUsers.id, masterUserId))
    .limit(1);
  const user = users[0];
  if (!user || user.id !== masterUserId) return undefined;

  const vesselIds = decodeTrustedVesselIds(user.vesselIds);
  if (!vesselIds?.length) return undefined;

  const vessels = await db
    .select({
      id: masterVessels.id,
      vesselUuid: masterVessels.vesselUuid,
    })
    .from(masterVessels)
    .where(and(
      inArray(masterVessels.id, vesselIds),
      eq(masterVessels.isActive, true),
      eq(masterVessels.isDeleted, false),
    ));

  // Do not silently discard unresolved, inactive, or malformed membership
  // records: partial scope can authorize the wrong operational boundary.
  if (vessels.length !== vesselIds.length) return undefined;
  const uuids = vessels.map((vessel: { id: number; vesselUuid: string | null }) => vessel.vesselUuid);
  if (uuids.some((uuid: string | null) => !uuid?.trim())) return undefined;
  return [...new Set(uuids as string[])];
}

async function hasCrewDatabasePermission(
  roleId: string,
  permission: "view" | "create" | "edit",
): Promise<boolean> {
  const db = getDb();
  const menus = await db
    .select({ menuId: admMenuMasterAc.muid })
    .from(admMenuMasterAc)
    .where(and(
      eq(admMenuMasterAc.name, "Crew Database"),
      eq(admMenuMasterAc.isActive, true),
      eq(admMenuMasterAc.isDeleted, false),
    ));
  if (menus.length !== 1) return false;

  const grants = await db
    .select({
      canview: admRoleAccessAc.canview,
      cancreate: admRoleAccessAc.cancreate,
      canedit: admRoleAccessAc.canedit,
    })
    .from(admRoleAccessAc)
    .where(and(
      eq(admRoleAccessAc.roleId, roleId),
      eq(admRoleAccessAc.menuId, menus[0].menuId),
      eq(admRoleAccessAc.isDeleted, false),
    ));
  if (grants.length !== 1) return false;
  return permission === "view" ? grants[0].canview
    : permission === "create" ? grants[0].cancreate
      : grants[0].canedit;
}

function requireAuthenticatedUser(req: Request): { id: number; userType: string } {
  if (!req.user) throw new CompanyFormAuthenticationError();
  if (!Number.isSafeInteger(req.user.id) || req.user.id <= 0 || !req.user.userType?.trim()) {
    throw new CompanyFormPermissionError();
  }
  return { id: req.user.id, userType: req.user.userType };
}

function trustedRoleForActor(role: ResolvedRole, userId: number, userType: string): void {
  if (role.masterUserId !== userId || normalize(role.masterUserType) !== normalize(userType)) {
    throw new CompanyFormPermissionError();
  }
}

/**
 * Resolve identity and authority from authenticated server records. JWT vessel
 * claims are intentionally never read here. Office access does not depend on
 * vessel provisioning; vessel access requires complete DB-resolved scope.
 */
export async function resolveCompanyFormPrincipal(
  req: Request,
  dependencies: PrincipalDependencies = {},
): Promise<CompanyFormPrincipal> {
  const authenticated = requireAuthenticatedUser(req);
  const normalizedJwtType = normalize(authenticated.userType);

  if (normalizedJwtType === "seafarer") {
    const crewUuid = await dependencies.resolveSeafarerCrewUuid?.(authenticated.id);
    if (!crewUuid?.trim()) throw new CompanyFormPermissionError();
    return {
      kind: "seafarer",
      userId: authenticated.id,
      crewUuid,
      linkageSource: "trusted_server_resolver",
    };
  }

  const roleResolution = await (dependencies.resolveRole ?? resolveRequestRole)(req);
  if (!roleResolution.ok) throw new CompanyFormPermissionError();
  const role = roleResolution.role;
  trustedRoleForActor(role, authenticated.id, authenticated.userType);

  const normalizedRoleType = normalize(role.roleType);
  if (normalizedRoleType === "office" && normalizedJwtType === "office") {
    return {
      kind: "office",
      userId: authenticated.id,
      roleId: role.roleId,
      roleName: role.roleName,
      roleType: "Office",
    };
  }

  if (normalizedRoleType !== "ship" || normalizedJwtType !== "ship") {
    throw new CompanyFormPermissionError();
  }

  const vesselUuids = await (dependencies.resolveVesselScope ?? resolveTrustedVesselScope)(role.masterUserId);
  if (!vesselUuids?.length || vesselUuids.some((uuid) => !uuid.trim())) {
    throw new CompanyFormPermissionError();
  }
  return {
    kind: "vessel",
    userId: authenticated.id,
    roleId: role.roleId,
    roleName: role.roleName,
    roleType: "Ship",
    vesselUuids: [...new Set(vesselUuids)],
  };
}

export async function authorizeOfficeAction(
  principal: CompanyFormPrincipal,
  action: CompanyFormAction,
  dependencies: PrincipalDependencies = {},
): Promise<boolean> {
  if (principal.kind !== "office") return false;
  const permission = OFFICE_ACTION_PERMISSION[action];
  if (!permission) return false;
  return (dependencies.hasOfficePermission ?? hasCrewDatabasePermission)(principal.roleId, permission);
}