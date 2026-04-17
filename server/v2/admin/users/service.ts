import { randomUUID } from "crypto";
import { hashPassword } from "../../auth/tokens";
import { adminUsersRepository, type AdminUserRow } from "./repository";

export type ListFilters = { search?: string; type?: string; domain?: string | null };

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string | null;
  firstName: string;
  lastName?: string | null;
  designation?: string | null;
  department?: string | null;
  preferredAuthMethod?: "TOTP" | "NA";
  userType: "Office" | "Ship";
  roleId?: string | null;
  domain: string;
  isActive?: boolean;
  assignedVesselIds?: string[];
}

export interface UpdateUserInput {
  password?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  designation?: string | null;
  department?: string | null;
  preferredAuthMethod?: "TOTP" | "NA";
  userType?: "Office" | "Ship";
  roleId?: string | null;
  isActive?: boolean;
  assignedVesselIds?: string[];
}

function buildFullName(firstName?: string | null, lastName?: string | null): string | undefined {
  const f = (firstName || "").trim();
  const l = (lastName || "").trim();
  const joined = `${f} ${l}`.trim();
  return joined.length ? joined : undefined;
}

export const adminUsersService = {
  async list(filters: ListFilters): Promise<(AdminUserRow & { assignedVesselIds: string[] })[]> {
    const rows = await adminUsersRepository.list(filters);
    // For listing we don't need to fetch every user's vessels (potentially expensive);
    // include an empty array to keep the type stable on the client.
    return rows.map((r) => ({ ...r, assignedVesselIds: [] }));
  },

  async getByUuid(uuid: string, domain?: string | null) {
    const row = await adminUsersRepository.findByUuid(uuid, domain ?? undefined);
    if (!row) return null;
    const assignedVesselIds = await adminUsersRepository.getAssignedVesselIds(row.id);
    return { ...row, assignedVesselIds };
  },

  async usernameAvailable(username: string, domain: string, excludeUuid?: string): Promise<boolean> {
    const trimmed = username.trim();
    if (!trimmed) return false;
    let excludeId: number | undefined;
    if (excludeUuid) {
      const existing = await adminUsersRepository.findByUuid(excludeUuid, domain);
      excludeId = existing?.id;
    }
    const taken = await adminUsersRepository.usernameTakenInDomain(trimmed, domain, excludeId);
    return !taken;
  },

  async create(input: CreateUserInput, actor: { id?: number; username?: string }) {
    const taken = await adminUsersRepository.usernameTakenInDomain(input.username, input.domain);
    if (taken) {
      const err: any = new Error("username_taken");
      err.code = "username_taken";
      throw err;
    }

    const passwordHash = await hashPassword(input.password);
    const uuid = randomUUID();
    const fullName = buildFullName(input.firstName, input.lastName);

    const row = await adminUsersRepository.insertUser({
      uuid,
      username: input.username.trim(),
      password: passwordHash,
      email: input.email ?? null,
      firstName: input.firstName.trim(),
      lastName: (input.lastName || "").trim() || null,
      fullName,
      designation: input.designation ?? null,
      department: input.department ?? null,
      preferredAuthMethod: input.preferredAuthMethod ?? "NA",
      userType: input.userType,
      roleId: input.roleId ?? null,
      domain: input.domain,
      isActive: input.isActive ?? true,
      passwordChangedAt: new Date(),
    });

    if (input.assignedVesselIds && input.assignedVesselIds.length > 0) {
      await adminUsersRepository.replaceVesselAssignments(row.id, input.assignedVesselIds);
    }

    await adminUsersRepository.writeAudit({
      userId: actor.id ?? null,
      username: actor.username ?? null,
      domain: input.domain,
      event: "admin_create_user",
      success: true,
      detail: `created user ${row.username} (uuid=${uuid})`,
    });

    return this.getByUuid(uuid, input.domain);
  },

  async update(uuid: string, input: UpdateUserInput, actor: { id?: number; username?: string }, callerDomain?: string | null) {
    const existing = await adminUsersRepository.findByUuid(uuid, callerDomain ?? undefined);
    if (!existing) {
      const err: any = new Error("not_found");
      err.code = "not_found";
      throw err;
    }

    const update: any = {};
    if (input.email !== undefined) update.email = input.email;
    if (input.firstName !== undefined) update.firstName = input.firstName;
    if (input.lastName !== undefined) update.lastName = input.lastName;
    if (input.firstName !== undefined || input.lastName !== undefined) {
      const f = input.firstName !== undefined ? input.firstName : existing.firstName;
      const l = input.lastName !== undefined ? input.lastName : existing.lastName;
      update.fullName = buildFullName(f, l);
    }
    if (input.designation !== undefined) update.designation = input.designation;
    if (input.department !== undefined) update.department = input.department;
    if (input.preferredAuthMethod !== undefined) update.preferredAuthMethod = input.preferredAuthMethod;
    if (input.userType !== undefined) update.userType = input.userType;
    if (input.roleId !== undefined) update.roleId = input.roleId;
    if (input.isActive !== undefined) update.isActive = input.isActive;
    if (input.password) {
      update.password = await hashPassword(input.password);
      update.passwordChangedAt = new Date();
      await adminUsersRepository.revokeAllRefreshTokens(existing.id, "admin_password_reset");
    }

    if (Object.keys(update).length > 0) {
      await adminUsersRepository.updateUserById(existing.id, update);
    }

    if (input.assignedVesselIds !== undefined) {
      await adminUsersRepository.replaceVesselAssignments(existing.id, input.assignedVesselIds);
    }

    await adminUsersRepository.writeAudit({
      userId: actor.id ?? null,
      username: actor.username ?? null,
      domain: existing.domain ?? null,
      event: "admin_update_user",
      success: true,
      detail: `updated user ${existing.username} (uuid=${uuid})`,
    });

    return this.getByUuid(uuid, callerDomain ?? null);
  },
};
