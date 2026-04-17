import { randomUUID } from "crypto";
import { hashPassword } from "../../auth/tokens";
import { adminUsersRepository, type AdminUserRow } from "./repository";
import type { users as usersTable } from "@shared/schema";

export type ListFilters = { search?: string; type?: string; domain?: string | null };

export interface CreateUserInput {
  username: string;
  password: string;
  crewId?: string | null;
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
  username?: string;
  password?: string;
  crewId?: string | null;
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

  async crewIdAvailable(crewId: string, domain: string, excludeUuid?: string): Promise<boolean> {
    const trimmed = crewId.trim();
    if (!trimmed) return true;
    let excludeId: number | undefined;
    if (excludeUuid) {
      const existing = await adminUsersRepository.findByUuid(excludeUuid, domain);
      excludeId = existing?.id;
    }
    // Mirror the create/update guards: a Crew ID is only "available" if it
    // isn't taken AND doesn't collide with another user's username in the
    // same domain — otherwise the UI would show a green check and then fail
    // on save with a 409.
    const taken = await adminUsersRepository.crewIdTakenInDomain(trimmed, domain, excludeId);
    if (taken) return false;
    const collides = await adminUsersRepository.crewIdCollidesWithUsername(trimmed, domain, excludeId);
    return !collides;
  },

  async usernameAvailableStrict(username: string, domain: string, excludeUuid?: string): Promise<boolean> {
    // Username availability is already wired through usernameAvailable above;
    // this strict variant is exposed for callers that want the same
    // cross-field guard the create/update path applies. (Kept as a separate
    // method to avoid changing the existing usernameAvailable contract.)
    const trimmed = username.trim();
    if (!trimmed) return false;
    let excludeId: number | undefined;
    if (excludeUuid) {
      const existing = await adminUsersRepository.findByUuid(excludeUuid, domain);
      excludeId = existing?.id;
    }
    const taken = await adminUsersRepository.usernameTakenInDomain(trimmed, domain, excludeId);
    if (taken) return false;
    const collides = await adminUsersRepository.usernameCollidesWithCrewId(trimmed, domain, excludeId);
    return !collides;
  },

  async create(input: CreateUserInput, actor: { id?: number; username?: string }) {
    const taken = await adminUsersRepository.usernameTakenInDomain(input.username, input.domain);
    if (taken) {
      const err = new Error("username_taken") as Error & { code: string };
      err.code = "username_taken";
      throw err;
    }
    // Cross-field guard: the new username must not match any existing crew_id
    // in this domain — otherwise sign-in would be ambiguous.
    const userCollides = await adminUsersRepository.usernameCollidesWithCrewId(input.username, input.domain);
    if (userCollides) {
      const err = new Error("username_taken") as Error & { code: string };
      err.code = "username_taken";
      throw err;
    }

    const trimmedCrewId = (input.crewId || "").trim();
    if (trimmedCrewId) {
      const crewTaken = await adminUsersRepository.crewIdTakenInDomain(trimmedCrewId, input.domain);
      if (crewTaken) {
        const err = new Error("crewid_taken") as Error & { code: string };
        err.code = "crewid_taken";
        throw err;
      }
      const crewCollides = await adminUsersRepository.crewIdCollidesWithUsername(trimmedCrewId, input.domain);
      if (crewCollides) {
        const err = new Error("crewid_taken") as Error & { code: string };
        err.code = "crewid_taken";
        throw err;
      }
    }

    const passwordHash = await hashPassword(input.password);
    const uuid = randomUUID();
    const fullName = buildFullName(input.firstName, input.lastName);

    const row = await adminUsersRepository.insertUser({
      uuid,
      username: input.username.trim(),
      password: passwordHash,
      crewId: trimmedCrewId || null,
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
      const err = new Error("not_found") as Error & { code: string };
      err.code = "not_found";
      throw err;
    }

    const update: Partial<typeof usersTable.$inferInsert> = {};
    if (input.username !== undefined) {
      const newUsername = input.username.trim();
      if (newUsername && newUsername.toLowerCase() !== existing.username.toLowerCase()) {
        const taken = await adminUsersRepository.usernameTakenInDomain(
          newUsername,
          existing.domain ?? "",
          existing.id,
        );
        if (taken) {
          const err = new Error("username_taken") as Error & { code: string };
          err.code = "username_taken";
          throw err;
        }
        const collides = await adminUsersRepository.usernameCollidesWithCrewId(
          newUsername,
          existing.domain ?? "",
          existing.id,
        );
        if (collides) {
          const err = new Error("username_taken") as Error & { code: string };
          err.code = "username_taken";
          throw err;
        }
        update.username = newUsername;
      }
    }
    if (input.crewId !== undefined) {
      const newCrewId = input.crewId === null ? null : input.crewId.trim();
      const existingCrewId = existing.crewId ?? null;
      const normalizedNew = newCrewId ? newCrewId : null;
      if ((normalizedNew ?? "").toLowerCase() !== (existingCrewId ?? "").toLowerCase()) {
        if (normalizedNew) {
          const taken = await adminUsersRepository.crewIdTakenInDomain(
            normalizedNew,
            existing.domain ?? "",
            existing.id,
          );
          if (taken) {
            const err = new Error("crewid_taken") as Error & { code: string };
            err.code = "crewid_taken";
            throw err;
          }
          const collides = await adminUsersRepository.crewIdCollidesWithUsername(
            normalizedNew,
            existing.domain ?? "",
            existing.id,
          );
          if (collides) {
            const err = new Error("crewid_taken") as Error & { code: string };
            err.code = "crewid_taken";
            throw err;
          }
        }
        update.crewId = normalizedNew;
      }
    }
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
