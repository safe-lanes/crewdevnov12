import { and, eq, sql, desc, inArray, type SQL } from "drizzle-orm";
import { getDb } from "../../db";
import {
  users,
  userVesselAssignments,
  loginAuditLog,
  refreshTokens,
  type SelectUser,
} from "@shared/schema";
import { admRoleMasterAc } from "@shared/v2/admin/schema";

export type AdminUserRow = Omit<SelectUser, "password"> & {
  roleName: string | null;
};

export class AdminUsersRepository {
  async list(opts: { search?: string; type?: string; domain?: string | null }): Promise<AdminUserRow[]> {
    const db = getDb();
    const conditions: SQL[] = [];
    if (opts.domain) {
      conditions.push(sql`LOWER(COALESCE(${users.domain}, '')) = LOWER(${opts.domain})`);
    }
    if (opts.type === "Office" || opts.type === "Ship") {
      conditions.push(eq(users.userType, opts.type));
    }
    if (opts.search && opts.search.trim()) {
      const q = `%${opts.search.trim().toLowerCase()}%`;
      conditions.push(
        sql`(LOWER(${users.username}) LIKE ${q} OR LOWER(COALESCE(${users.email}, '')) LIKE ${q} OR LOWER(COALESCE(${users.fullName}, '')) LIKE ${q} OR LOWER(COALESCE(${users.firstName}, '')) LIKE ${q} OR LOWER(COALESCE(${users.lastName}, '')) LIKE ${q})`
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        uuid: users.uuid,
        email: users.email,
        fullName: users.fullName,
        firstName: users.firstName,
        lastName: users.lastName,
        designation: users.designation,
        department: users.department,
        preferredAuthMethod: users.preferredAuthMethod,
        userType: users.userType,
        roleId: users.roleId,
        domain: users.domain,
        tenantId: users.tenantId,
        isActive: users.isActive,
        isLocked: users.isLocked,
        failedLoginAttempts: users.failedLoginAttempts,
        lockoutUntil: users.lockoutUntil,
        lastLoginAt: users.lastLoginAt,
        lastLoginIp: users.lastLoginIp,
        passwordChangedAt: users.passwordChangedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        roleName: admRoleMasterAc.assignedRole,
      })
      .from(users)
      .leftJoin(admRoleMasterAc, eq(admRoleMasterAc.ruid, users.roleId))
      .where(where)
      .orderBy(desc(users.createdAt));

    return rows as AdminUserRow[];
  }

  async findByUuid(uuid: string, domain?: string | null): Promise<AdminUserRow | undefined> {
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        uuid: users.uuid,
        email: users.email,
        fullName: users.fullName,
        firstName: users.firstName,
        lastName: users.lastName,
        designation: users.designation,
        department: users.department,
        preferredAuthMethod: users.preferredAuthMethod,
        userType: users.userType,
        roleId: users.roleId,
        domain: users.domain,
        tenantId: users.tenantId,
        isActive: users.isActive,
        isLocked: users.isLocked,
        failedLoginAttempts: users.failedLoginAttempts,
        lockoutUntil: users.lockoutUntil,
        lastLoginAt: users.lastLoginAt,
        lastLoginIp: users.lastLoginIp,
        passwordChangedAt: users.passwordChangedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        roleName: admRoleMasterAc.assignedRole,
      })
      .from(users)
      .leftJoin(admRoleMasterAc, eq(admRoleMasterAc.ruid, users.roleId))
      .where(
        domain
          ? and(eq(users.uuid, uuid), sql`LOWER(COALESCE(${users.domain}, '')) = LOWER(${domain})`)
          : eq(users.uuid, uuid),
      )
      .limit(1);
    return rows[0] as AdminUserRow | undefined;
  }

  async findById(id: number): Promise<SelectUser | undefined> {
    const db = getDb();
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async usernameTakenInDomain(username: string, domain: string, excludeId?: number): Promise<boolean> {
    const db = getDb();
    const conds: SQL[] = [
      sql`LOWER(${users.username}) = LOWER(${username})`,
      sql`LOWER(COALESCE(${users.domain}, '')) = LOWER(${domain})`,
    ];
    if (excludeId) conds.push(sql`${users.id} <> ${excludeId}`);
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(...conds))
      .limit(1);
    return rows.length > 0;
  }

  async insertUser(data: typeof users.$inferInsert): Promise<SelectUser> {
    const db = getDb();
    const rows = await db.insert(users).values(data).returning();
    return rows[0];
  }

  async updateUserById(
    id: number,
    data: Partial<typeof users.$inferInsert>,
  ): Promise<SelectUser | undefined> {
    const db = getDb();
    const rows = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return rows[0];
  }

  async getAssignedVesselIds(userId: number): Promise<string[]> {
    const db = getDb();
    const rows = await db
      .select({ vesselId: userVesselAssignments.vesselId })
      .from(userVesselAssignments)
      .where(eq(userVesselAssignments.userId, userId));
    return rows.map((r: { vesselId: string }) => r.vesselId);
  }

  async replaceVesselAssignments(userId: number, vesselIds: string[]): Promise<void> {
    const db = getDb();
    await db.delete(userVesselAssignments).where(eq(userVesselAssignments.userId, userId));
    if (vesselIds.length === 0) return;
    const unique = Array.from(new Set(vesselIds.filter((v) => typeof v === "string" && v.length > 0)));
    if (unique.length === 0) return;
    await db
      .insert(userVesselAssignments)
      .values(unique.map((vesselId) => ({ userId, vesselId })))
      .onConflictDoNothing();
  }

  async revokeAllRefreshTokens(userId: number, reason: string): Promise<void> {
    const db = getDb();
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(), revokedReason: reason })
      .where(and(eq(refreshTokens.userId, userId), sql`${refreshTokens.revokedAt} IS NULL`));
  }

  async getRoleNameByRuid(ruid: string): Promise<string | null> {
    const db = getDb();
    const rows = await db
      .select({ assignedRole: admRoleMasterAc.assignedRole })
      .from(admRoleMasterAc)
      .where(eq(admRoleMasterAc.ruid, ruid))
      .limit(1);
    return rows[0]?.assignedRole ?? null;
  }

  async writeAudit(args: {
    userId?: number | null;
    username?: string | null;
    domain?: string | null;
    event: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    detail?: string;
  }): Promise<void> {
    const db = getDb();
    try {
      await db.insert(loginAuditLog).values({
        userId: args.userId ?? null,
        username: args.username ?? null,
        domain: args.domain ?? null,
        event: args.event,
        success: args.success,
        ipAddress: args.ipAddress ?? null,
        userAgent: args.userAgent ?? null,
        detail: args.detail ?? null,
      });
    } catch (err) {
      console.error("[admin-users] audit log failed:", (err as Error).message);
    }
  }
}

export const adminUsersRepository = new AdminUsersRepository();
