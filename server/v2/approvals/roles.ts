/**
 * Role → approvers, shared by every Crewing approval card.
 *
 * Chains store stable role ids: adm_rolemaster_ac.ruid. Membership is a name join, exactly as
 * the rest of Crewing resolves roles: adm_rolemaster_ac.assigned_role = master_users.role
 * (trimmed, case-insensitive). Approver ids returned are master_users.user_uuid.
 *
 * Vessel scope:
 *   - Ship-type roles: only users whose master_users.vessel_ids (comma list of
 *     master_vessels.id) includes the subject's vessel. No vessel on the subject → nobody.
 *   - Office-type roles: fleet-wide (Crewing office users are not assigned per vessel).
 * A step whose role resolves to nobody is reported by the engine (stuck step) and can only be
 * decided by an admin override; configure chains with roles that have users.
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import { masterUsers, masterVessels } from "../../../shared/schema";
import { admRoleMasterAc } from "../../../shared/v2/admin/schema";
import type { RoleOption } from "../approval-engine";

/** Active Access Control roles, offered in the chain builder. */
export async function listApprovalRoles(): Promise<RoleOption[]> {
  const rows = await getDb()
    .select({ ruid: admRoleMasterAc.ruid, name: admRoleMasterAc.assignedRole, isDeleted: admRoleMasterAc.isDeleted })
    .from(admRoleMasterAc)
    .where(eq(admRoleMasterAc.isActive, true));
  return rows
    .filter((r: { isDeleted: boolean | null }) => r.isDeleted !== true)
    .map((r: { ruid: string; name: string }) => ({ roleId: r.ruid, roleLabel: r.name }))
    .sort((a: RoleOption, b: RoleOption) => a.roleLabel.localeCompare(b.roleLabel));
}

function splitVesselIds(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n));
}

/** user_uuids currently holding the role, scoped to the subject's vessel for Ship roles. */
export async function resolveRoleApproverUserIds(roleId: string, vesselUuid: string | null): Promise<string[]> {
  const db = getDb();
  const role = (
    await db
      .select({ name: admRoleMasterAc.assignedRole, roletype: admRoleMasterAc.roletype, isDeleted: admRoleMasterAc.isDeleted, isActive: admRoleMasterAc.isActive })
      .from(admRoleMasterAc)
      .where(eq(admRoleMasterAc.ruid, roleId))
      .limit(1)
  )[0];
  if (!role || role.isDeleted === true || role.isActive !== true) return [];

  const users = await db
    .select({ userUuid: masterUsers.userUuid, vesselIds: masterUsers.vesselIds })
    .from(masterUsers)
    .where(
      and(
        isNotNull(masterUsers.userUuid),
        sql`lower(btrim(${masterUsers.role})) = ${role.name.trim().toLowerCase()}`,
      ),
    );
  const withUuid = users.filter((u: { userUuid: string | null }) => !!u.userUuid?.trim());

  const isShipRole = role.roletype.trim().toLowerCase() === "ship";
  if (!isShipRole) {
    return Array.from(new Set(withUuid.map((u: { userUuid: string | null }) => u.userUuid!.trim())));
  }

  if (!vesselUuid) return [];
  const vessel = (
    await db.select({ id: masterVessels.id }).from(masterVessels).where(eq(masterVessels.vesselUuid, vesselUuid)).limit(1)
  )[0];
  if (!vessel) return [];
  return Array.from(
    new Set(
      withUuid
        .filter((u: { vesselIds: string | null }) => splitVesselIds(u.vesselIds).includes(vessel.id))
        .map((u: { userUuid: string | null }) => u.userUuid!.trim()),
    ),
  );
}

/** Email addresses and names for user_uuids (notifications). */
export async function contactsForUsers(userUuids: string[]): Promise<Map<string, { email: string | null; name: string }>> {
  const unique = Array.from(new Set(userUuids.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const rows = await getDb()
    .select({ userUuid: masterUsers.userUuid, email: masterUsers.email, fullname: masterUsers.fullname, displayName: masterUsers.displayName })
    .from(masterUsers)
    .where(inArray(masterUsers.userUuid, unique));
  return new Map(
    rows.map((r: { userUuid: string | null; email: string | null; fullname: string | null; displayName: string | null }) => [
      r.userUuid ?? "",
      { email: r.email, name: (r.displayName || r.fullname || "").trim() },
    ]),
  );
}
