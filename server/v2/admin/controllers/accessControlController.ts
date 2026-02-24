import { Request, Response } from "express";
import { accessControlService } from "../services";

export const accessControlController = {
  async getAllMenus(req: Request, res: Response) {
    try {
      const records = await accessControlService.getAllMenus();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching menus:", error);
      res.status(500).json({ error: "Failed to fetch menus" });
    }
  },

  async createMenu(req: Request, res: Response) {
    try {
      const record = await accessControlService.createMenu(req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Error creating menu:", error);
      res.status(500).json({ error: "Failed to create menu" });
    }
  },

  async updateMenu(req: Request, res: Response) {
    try {
      const { muid } = req.params;
      const record = await accessControlService.updateMenuByUuid(muid, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating menu:", error);
      res.status(500).json({ error: "Failed to update menu" });
    }
  },

  async deleteMenu(req: Request, res: Response) {
    try {
      const { muid } = req.params;
      const deleted = await accessControlService.deleteMenuByUuid(muid);
      res.json({ success: deleted });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting menu:", error);
      res.status(500).json({ error: "Failed to delete menu" });
    }
  },

  async getAllRoles(req: Request, res: Response) {
    try {
      const records = await accessControlService.getAllRoles();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching roles:", error);
      res.status(500).json({ error: "Failed to fetch roles" });
    }
  },

  async createRole(req: Request, res: Response) {
    try {
      const record = await accessControlService.createRole(req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Error creating role:", error);
      res.status(500).json({ error: "Failed to create role" });
    }
  },

  async updateRole(req: Request, res: Response) {
    try {
      const { ruid } = req.params;
      const record = await accessControlService.updateRoleByUuid(ruid, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating role:", error);
      res.status(500).json({ error: "Failed to update role" });
    }
  },

  async deleteRole(req: Request, res: Response) {
    try {
      const { ruid } = req.params;
      const deleted = await accessControlService.deleteRoleByUuid(ruid);
      res.json({ success: deleted });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting role:", error);
      res.status(500).json({ error: "Failed to delete role" });
    }
  },

  async getMyPermissions(req: Request, res: Response) {
    try {
      const { roleId, roleName } = req.query;
      const result = await accessControlService.getMyPermissions(
        roleId as string | undefined,
        roleName as string | undefined
      );
      res.json(result);
    } catch (error: any) {
      console.error("Error fetching my permissions:", error);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  },

  async getPermissions(req: Request, res: Response) {
    try {
      const { ruid } = req.params;
      const records = await accessControlService.getPermissionsByRoleUuid(ruid);
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching permissions:", error);
      res.status(500).json({ error: "Failed to fetch permissions" });
    }
  },

  async savePermissions(req: Request, res: Response) {
    try {
      const { ruid } = req.params;
      const { permissions } = req.body;
      if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: "permissions must be an array" });
      }
      const records = await accessControlService.savePermissions(ruid, permissions);
      res.json(records);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error saving permissions:", error);
      res.status(500).json({ error: "Failed to save permissions" });
    }
  },
};
