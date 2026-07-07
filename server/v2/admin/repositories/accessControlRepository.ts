import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { admMenuMasterAc, admRoleMasterAc, admRoleAccessAc } from "../../../../shared/v2/admin/schema";
import type { AdmMenuMasterAc, InsertAdmMenuMasterAc, AdmRoleMasterAc, InsertAdmRoleMasterAc, AdmRoleAccessAc, InsertAdmRoleAccessAc } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";
import { applyAuditUser } from "../utils/auditUser";

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

  async findRoleByName(roleName: string): Promise<AdmRoleMasterAc | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admRoleMasterAc)
      .where(and(eq(admRoleMasterAc.assignedRole, roleName), eq(admRoleMasterAc.isDeleted, false)));
    return results[0];
  }

  async findPermissionsWithMenusByRoleUuid(roleUuid: string): Promise<Array<{
    menuName: string;
    displayName: string | null;
    route: string;
    parentMenu: string | null;
    canview: boolean;
    cancreate: boolean;
    canedit: boolean;
    candelete: boolean;
  }>> {
    const db = getDb();
    const menus = await db
      .select()
      .from(admMenuMasterAc)
      .where(and(eq(admMenuMasterAc.isDeleted, false), eq(admMenuMasterAc.isActive, true)))
      .orderBy(asc(admMenuMasterAc.sortOrder));

    const permissions = await db
      .select()
      .from(admRoleAccessAc)
      .where(and(eq(admRoleAccessAc.roleId, roleUuid), eq(admRoleAccessAc.isDeleted, false)));

    const permMap = new Map(permissions.map(p => [p.menuId, p]));

    return menus.map(menu => {
      const perm = permMap.get(menu.muid);
      return {
        menuName: menu.name,
        displayName: menu.displayName,
        route: menu.route,
        parentMenu: menu.parentMenu,
        canview: perm?.canview ?? false,
        cancreate: perm?.cancreate ?? false,
        canedit: perm?.canedit ?? false,
        candelete: perm?.candelete ?? false,
      };
    });
  }

  async upsertPermissions(roleUuid: string, permissions: Array<{ menuId: string; canview: boolean; cancreate: boolean; canedit: boolean; candelete: boolean }>, auditUserUuid: string | null = null): Promise<AdmRoleAccessAc[]> {
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
          .set(applyAuditUser({
            canview: perm.canview,
            cancreate: perm.cancreate,
            canedit: perm.canedit,
            candelete: perm.candelete,
            auditUserUuid,
          }))
          .where(eq(admRoleAccessAc.id, existing[0].id))
          .returning();
        results.push(updated[0]);
      } else {
        const inserted = await db
          .insert(admRoleAccessAc)
          .values(applyAuditUser({
            rauid: uuidv4(),
            roleId: roleUuid,
            menuId: perm.menuId,
            canview: perm.canview,
            cancreate: perm.cancreate,
            canedit: perm.canedit,
            candelete: perm.candelete,
            auditUserUuid,
          }, true))
          .returning();
        results.push(inserted[0]);
      }
    }

    return results;
  }
}
