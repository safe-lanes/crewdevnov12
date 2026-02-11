import { Request, Response } from "express";
import { vesselGroupsService } from "../services";

export const vesselGroupsController = {
  async getAll(req: Request, res: Response) {
    try {
      const records = await vesselGroupsService.getAll();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching vessel groups:", error);
      res.status(500).json({ error: "Failed to fetch vessel groups" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid vessel group ID" });
      }
      const record = await vesselGroupsService.getById(id);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching vessel group:", error);
      res.status(500).json({ error: "Failed to fetch vessel group" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const record = await vesselGroupsService.create(req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Error creating vessel group:", error);
      res.status(500).json({ error: "Failed to create vessel group" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid vessel group ID" });
      }
      const record = await vesselGroupsService.updateById(id, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating vessel group:", error);
      res.status(500).json({ error: "Failed to update vessel group" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid vessel group ID" });
      }
      const deleted = await vesselGroupsService.deleteById(id);
      res.json({ success: deleted });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting vessel group:", error);
      res.status(500).json({ error: "Failed to delete vessel group" });
    }
  },
};
