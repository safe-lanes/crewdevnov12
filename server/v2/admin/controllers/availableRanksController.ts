import { Request, Response } from "express";
import { availableRanksService } from "../services";
import { insertAdmAvailableRankV2Schema } from "../../../../shared/v2/admin/types";
import { z } from "zod";

export const availableRanksController = {
  async getAll(req: Request, res: Response) {
    try {
      const companyOnly = req.query.companyOnly === "true";
      const ranks = await availableRanksService.getAll(companyOnly);
      res.json(ranks);
    } catch (error) {
      console.error("Error fetching available ranks:", error);
      res.status(500).json({ error: "Failed to fetch available ranks" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const result = insertAdmAvailableRankV2Schema
        .omit({ arUuid: true })
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rank data", details: result.error.issues });
      }
      const rank = await availableRanksService.create(result.data);
      res.status(201).json(rank);
    } catch (error) {
      console.error("Error creating available rank:", error);
      res.status(400).json({ error: "Invalid rank data" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid rank ID" });
      }
      const result = insertAdmAvailableRankV2Schema
        .omit({ arUuid: true })
        .partial()
        .safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid rank data", details: result.error.issues });
      }
      const rank = await availableRanksService.updateById(id, result.data);
      res.json(rank);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("system rank")) {
        return res.status(403).json({ error: error.message });
      }
      console.error("Error updating available rank:", error);
      res.status(400).json({ error: "Invalid rank data" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid rank ID" });
      }
      const deleted = await availableRanksService.deleteById(id);
      if (!deleted) {
        return res.status(404).json({ error: "Rank not found" });
      }
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes("system rank")) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting available rank:", error);
      res.status(500).json({ error: "Failed to delete rank" });
    }
  },

  async deleteAll(req: Request, res: Response) {
    try {
      await availableRanksService.deleteAll();
      res.json({ success: true, message: "All ranks cleared successfully" });
    } catch (error) {
      console.error("Error clearing all ranks:", error);
      res.status(500).json({ error: "Failed to clear ranks" });
    }
  },

  async reorder(req: Request, res: Response) {
    try {
      const orders = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ error: "Invalid reorder data: body must be an array of {id, sortOrder}" });
      }
      const success = await availableRanksService.reorder(orders);
      if (!success) {
        return res.status(500).json({ error: "Failed to update rank orders" });
      }
      res.json({ success: true, message: "Rank orders updated successfully" });
    } catch (error) {
      console.error("Error reordering ranks:", error);
      res.status(500).json({ error: "Failed to reorder ranks" });
    }
  },
};
