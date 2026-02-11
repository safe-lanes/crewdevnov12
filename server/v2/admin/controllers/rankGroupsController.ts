import { Request, Response } from "express";
import { rankGroupsService } from "../services";
import { insertAdmRankGroupV2Schema } from "../../../../shared/v2/admin/types";
import { z } from "zod";

export const rankGroupsController = {
  async getAll(req: Request, res: Response) {
    try {
      const rankGroups = await rankGroupsService.getAll();
      res.json(rankGroups);
    } catch (error) {
      console.error("Error fetching rank groups:", error);
      res.status(500).json({ error: "Failed to fetch rank groups" });
    }
  },

  async getByFormUuid(req: Request, res: Response) {
    try {
      const { formUuid } = req.params;
      const includeArchived = req.query.includeArchived !== "false";
      const rankGroups = await rankGroupsService.getByFormUuid(formUuid, includeArchived);
      res.json(rankGroups);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching rank groups:", error);
      res.status(500).json({ error: "Failed to fetch rank groups" });
    }
  },

  async checkAssignment(req: Request, res: Response) {
    try {
      const rankLabel = req.query.rankLabel as string;
      const formName = req.query.formName as string;
      if (!rankLabel || !formName) {
        return res.status(400).json({ error: "rankLabel and formName query parameters are required" });
      }
      const result = await rankGroupsService.checkAssignment(rankLabel, formName);
      res.json(result);
    } catch (error) {
      console.error("Error checking rank assignment:", error);
      res.status(500).json({ error: "Failed to check rank assignment" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { rgUuid } = req.params;
      const rankGroup = await rankGroupsService.getByUuid(rgUuid);
      res.json(rankGroup);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching rank group:", error);
      res.status(500).json({ error: "Failed to fetch rank group" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const result = insertAdmRankGroupV2Schema
        .omit({ rgUuid: true })
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rank group data", details: result.error.issues });
      }
      const rankGroup = await rankGroupsService.create(result.data);
      res.json(rankGroup);
    } catch (error: any) {
      if (error.message?.includes("already assigned")) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Error creating rank group:", error);
      res.status(400).json({ error: "Invalid rank group data" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { rgUuid } = req.params;
      const result = insertAdmRankGroupV2Schema
        .omit({ rgUuid: true })
        .partial()
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rank group data", details: result.error.issues });
      }
      const rankGroup = await rankGroupsService.update(rgUuid, result.data);
      res.json(rankGroup);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("already assigned")) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Error updating rank group:", error);
      res.status(400).json({ error: "Invalid rank group data" });
    }
  },

  async updateConfiguration(req: Request, res: Response) {
    try {
      const { rgUuid } = req.params;
      const { configuration } = req.body;
      const configStr = typeof configuration === "string" ? configuration : JSON.stringify(configuration);
      const rankGroup = await rankGroupsService.updateConfiguration(rgUuid, configStr);
      res.json(rankGroup);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating rank group configuration:", error);
      res.status(500).json({ error: "Failed to update rank group configuration" });
    }
  },

  async archive(req: Request, res: Response) {
    try {
      const { rgUuid } = req.params;
      const rankGroup = await rankGroupsService.archive(rgUuid);
      res.json(rankGroup);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error archiving rank group:", error);
      res.status(500).json({ error: "Failed to archive rank group" });
    }
  },

  async unarchive(req: Request, res: Response) {
    try {
      const { rgUuid } = req.params;
      const rankGroup = await rankGroupsService.unarchive(rgUuid);
      res.json(rankGroup);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error unarchiving rank group:", error);
      res.status(500).json({ error: "Failed to unarchive rank group" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { rgUuid } = req.params;
      const deleted = await rankGroupsService.delete(rgUuid);
      if (!deleted) {
        return res.status(404).json({ error: "Rank group not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting rank group:", error);
      res.status(500).json({ error: "Failed to delete rank group" });
    }
  },

  async getRankConflicts(req: Request, res: Response) {
    try {
      const { formUuid } = req.params;
      const excludeGroupUuid = req.query.excludeGroupUuid as string | undefined;
      const conflicts = await rankGroupsService.getRankConflicts(formUuid, excludeGroupUuid);
      res.json(conflicts);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error getting rank conflicts:", error);
      res.status(500).json({ error: "Failed to get rank conflicts" });
    }
  },
};
