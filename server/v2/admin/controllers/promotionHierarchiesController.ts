import { Request, Response } from "express";
import { promotionHierarchiesService } from "../services";
import { insertAdmPromotionHierarchyV2Schema } from "../../../../shared/v2/admin/types";
import { z } from "zod";

export const promotionHierarchiesController = {
  async getAll(req: Request, res: Response) {
    try {
      const hierarchies = await promotionHierarchiesService.getAll();
      res.json(hierarchies);
    } catch (error) {
      console.error("Error fetching promotion hierarchies:", error);
      res.status(500).json({ error: "Failed to fetch promotion hierarchies" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid promotion hierarchy ID" });
      }
      const hierarchy = await promotionHierarchiesService.getById(id);
      res.json(hierarchy);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to fetch promotion hierarchy" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const result = insertAdmPromotionHierarchyV2Schema
        .omit({ phUuid: true })
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion hierarchy data", details: result.error.issues });
      }
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const payload = { ...result.data, auditUserUuid };
      const hierarchy = await promotionHierarchiesService.create(payload);
      res.status(201).json(hierarchy);
    } catch (error) {
      console.error("Error creating promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to create promotion hierarchy" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid promotion hierarchy ID" });
      }
      const result = insertAdmPromotionHierarchyV2Schema
        .omit({ phUuid: true })
        .partial()
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid promotion hierarchy data", details: result.error.issues });
      }
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const payload = { ...result.data, auditUserUuid };
      const hierarchy = await promotionHierarchiesService.updateById(id, payload);
      res.json(hierarchy);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to update promotion hierarchy" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid promotion hierarchy ID" });
      }
      const success = await promotionHierarchiesService.deleteById(id);
      if (!success) {
        return res.status(404).json({ error: "Promotion hierarchy not found" });
      }
      res.json({ success: true, message: "Promotion hierarchy deleted successfully" });
    } catch (error) {
      console.error("Error deleting promotion hierarchy:", error);
      res.status(500).json({ error: "Failed to delete promotion hierarchy" });
    }
  },
};
