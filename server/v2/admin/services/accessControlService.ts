import { AccessControlRepository } from "../repositories/accessControlRepository";
import { applyAuditUser } from "../utils/auditUser";
import type { AdmMenuMasterAc, InsertAdmMenuMasterAc, AdmRoleMasterAc, InsertAdmRoleMasterAc, AdmRoleAccessAc } from "../../../../shared/v2/admin/types";

const accessControlRepo = new AccessControlRepository();

export const accessControlService = {
  async getAllMenus(): Promise<AdmMenuMasterAc[]> {
    return accessControlRepo.findAllMenus();
  },

  async getMenuByUuid(muid: string): Promise<AdmMenuMasterAc> {
    const record = await accessControlRepo.findMenuByUuid(muid);
    if (!record) throw new Error(`Menu not found: ${muid}`);
    return record;
  },

  async createMenu(data: Omit<InsertAdmMenuMasterAc, "muid">): Promise<AdmMenuMasterAc> {
    return accessControlRepo.createMenu(applyAuditUser(data, true));
  },

  async updateMenuByUuid(muid: string, data: Partial<InsertAdmMenuMasterAc>): Promise<AdmMenuMasterAc> {
    const updated = await accessControlRepo.updateMenuByUuid(muid, applyAuditUser(data));
    if (!updated) throw new Error(`Menu not found: ${muid}`);
    return updated;
  },

  async deleteMenuByUuid(muid: string): Promise<boolean> {
    const existing = await accessControlRepo.findMenuByUuid(muid);
    if (!existing) throw new Error(`Menu not found: ${muid}`);
    return accessControlRepo.softDeleteMenuByUuid(muid);
  },

  async getAllRoles(): Promise<AdmRoleMasterAc[]> {
    return accessControlRepo.findAllRoles();
  },

  async getRoleByUuid(ruid: string): Promise<AdmRoleMasterAc> {
    const record = await accessControlRepo.findRoleByUuid(ruid);
    if (!record) throw new Error(`Role not found: ${ruid}`);
    return record;
  },

  async createRole(data: Omit<InsertAdmRoleMasterAc, "ruid">): Promise<AdmRoleMasterAc> {
    return accessControlRepo.createRole(applyAuditUser(data, true));
  },

  async updateRoleByUuid(ruid: string, data: Partial<InsertAdmRoleMasterAc>): Promise<AdmRoleMasterAc> {
    const updated = await accessControlRepo.updateRoleByUuid(ruid, applyAuditUser(data));
    if (!updated) throw new Error(`Role not found: ${ruid}`);
    return updated;
  },

  async deleteRoleByUuid(ruid: string): Promise<boolean> {
    const existing = await accessControlRepo.findRoleByUuid(ruid);
    if (!existing) throw new Error(`Role not found: ${ruid}`);
    return accessControlRepo.softDeleteRoleByUuid(ruid);
  },

  async getPermissionsByRoleUuid(roleUuid: string): Promise<AdmRoleAccessAc[]> {
    return accessControlRepo.findPermissionsByRoleUuid(roleUuid);
  },

  async getMyPermissions(roleId?: string, roleName?: string) {
    let ruid = roleId;
    if (!ruid && roleName) {
      const role = await accessControlRepo.findRoleByName(roleName);
      if (!role) return { permissions: [], roleName: roleName || null, roleId: null };
      ruid = role.ruid;
    }
    if (!ruid) return { permissions: [], roleName: roleName || null, roleId: null };

    const permissions = await accessControlRepo.findPermissionsWithMenusByRoleUuid(ruid);
    return { permissions, roleName: roleName || null, roleId: ruid };
  },

  async savePermissions(roleUuid: string, permissions: Array<{ menuId: string; canview: boolean; cancreate: boolean; canedit: boolean; candelete: boolean }>): Promise<AdmRoleAccessAc[]> {
    const role = await accessControlRepo.findRoleByUuid(roleUuid);
    if (!role) throw new Error(`Role not found: ${roleUuid}`);
    return accessControlRepo.upsertPermissions(roleUuid, permissions);
  },
};
