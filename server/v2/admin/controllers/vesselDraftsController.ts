import { Request, Response } from "express";
import { vesselDraftsService } from "../services";

export const vesselDraftsController = {
  async getAll(req: Request, res: Response) {
    try {
      const records = await vesselDraftsService.getAll();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching vessel drafts:", error);
      res.status(500).json({ error: "Failed to fetch vessel drafts" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid vessel draft ID" });
      }
      const record = await vesselDraftsService.getById(id);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching vessel draft:", error);
      res.status(500).json({ error: "Failed to fetch vessel draft" });
    }
  },

  async getByVesselId(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const records = await vesselDraftsService.getByVesselId(vesselId);
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching vessel drafts by vessel:", error);
      res.status(500).json({ error: "Failed to fetch vessel drafts" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const record = await vesselDraftsService.create(req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Error creating vessel draft:", error);
      res.status(500).json({ error: "Failed to create vessel draft" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid vessel draft ID" });
      }
      const record = await vesselDraftsService.updateById(id, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating vessel draft:", error);
      res.status(500).json({ error: "Failed to update vessel draft" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid vessel draft ID" });
      }
      const deleted = await vesselDraftsService.deleteById(id);
      res.json({ success: deleted });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting vessel draft:", error);
      res.status(500).json({ error: "Failed to delete vessel draft" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const record = await vesselDraftsService.upsert(req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Error upserting vessel draft:", error);
      res.status(500).json({ error: "Failed to upsert vessel draft" });
    }
  },
};
