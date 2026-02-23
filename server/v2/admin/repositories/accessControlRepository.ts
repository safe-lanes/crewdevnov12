import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { admMenuMasterAc, admRoleMasterAc, admRoleAccessAc } from "../../../../shared/v2/admin/schema";
import type { AdmMenuMasterAc, InsertAdmMenuMasterAc, AdmRoleMasterAc, InsertAdmRoleMasterAc, AdmRoleAccessAc, InsertAdmRoleAccessAc } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class AccessControlRepository {
  async findAllMenus(): Promise<AdmMenuMasterAc[]> {
    const db = getDb();
    return db
      .select()
      .from(admMenuMasterAc)
      .where(and(eq(admMenuMasterAc.isDeleted, false), eq(admMenuMasterAc.isActive, true)))
      .orderBy(asc(admMenuMasterAc.sortOrder));
  }

  async findMenuByUuid(muid: string): Promise<AdmMenuMasterAc | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admMenuMasterAc)
      .where(and(eq(admMenuMasterAc.muid, muid), eq(admMenuMasterAc.isDeleted, false)));
    return results[0];
  }

  async createMenu(data: Omit<InsertAdmMenuMasterAc, "muid">): Promise<AdmMenuMasterAc> {
    const db = getDb();
    const results = await db
      .insert(admMenuMasterAc)
      .values({ ...data, muid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateMenuByUuid(muid: string, data: Partial<InsertAdmMenuMasterAc>): Promise<AdmMenuMasterAc | undefined> {
    const db = getDb();
    const results = await db
      .update(admMenuMasterAc)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admMenuMasterAc.muid, muid), eq(admMenuMasterAc.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteMenuByUuid(muid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admMenuMasterAc)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admMenuMasterAc.muid, muid), eq(admMenuMasterAc.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async findAllRoles(): Promise<AdmRoleMasterAc[]> {
    const db = getDb();
    return db
      .select()
      .from(admRoleMasterAc)
      .where(and(eq(admRoleMasterAc.isDeleted, false), eq(admRoleMasterAc.isActive, true)))
      .orderBy(asc(admRoleMasterAc.sortOrder));
  }

  async findRoleByUuid(ruid: string): Promise<AdmRoleMasterAc | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admRoleMasterAc)
      .where(and(eq(admRoleMasterAc.ruid, ruid), eq(admRoleMasterAc.isDeleted, false)));
    return results[0];
  }

  async createRole(data: Omit<InsertAdmRoleMasterAc, "ruid">): Promise<AdmRoleMasterAc> {
    const db = getDb();
    const results = await db
      .insert(admRoleMasterAc)
      .values({ ...data, ruid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateRoleByUuid(ruid: string, data: Partial<InsertAdmRoleMasterAc>): Promise<AdmRoleMasterAc | undefined> {
    const db = getDb();
    const results = await db
      .update(admRoleMasterAc)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admRoleMasterAc.ruid, ruid), eq(admRoleMasterAc.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteRoleByUuid(ruid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admRoleMasterAc)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admRoleMasterAc.ruid, ruid), eq(admRoleMasterAc.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async findPermissionsByRoleUuid(roleUuid: string): Promise<AdmRoleAccessAc[]> {
    const db = getDb();
    return db
      .select()
      .from(admRoleAccessAc)
      .where(and(eq(admRoleAccessAc.roleId, roleUuid), eq(admRoleAccessAc.isDeleted, false)))
      .orderBy(asc(admRoleAccessAc.sortOrder));
  }

  async upsertPermissions(roleUuid: string, permissions: Array<{ menuId: string; canview: boolean; cancreate: boolean; canedit: boolean; candelete: boolean }>): Promise<AdmRoleAccessAc[]> {
    const db = getDb();
    const results: AdmRoleAccessAc[] = [];

    for (const perm of permissions) {
      const existing = await db
        .select()
        .from(admRoleAccessAc)
        .where(and(
          eq(admRoleAccessAc.roleId, roleUuid),
          eq(admRoleAccessAc.menuId, perm.menuId),
          eq(admRoleAccessAc.isDeleted, false)
        ));

      if (existing.length > 0) {
        const updated = await db
          .update(admRoleAccessAc)
          .set({
            canview: perm.canview,
            cancreate: perm.cancreate,
            canedit: perm.canedit,
            candelete: perm.candelete,
            updatedAt: new Date(),
          })
          .where(eq(admRoleAccessAc.id, existing[0].id))
          .returning();
        results.push(updated[0]);
      } else {
        const inserted = await db
          .insert(admRoleAccessAc)
          .values({
            rauid: uuidv4(),
            roleId: roleUuid,
            menuId: perm.menuId,
            canview: perm.canview,
            cancreate: perm.cancreate,
            canedit: perm.canedit,
            candelete: perm.candelete,
          })
          .returning();
        results.push(inserted[0]);
      }
    }

    return results;
  }
}
