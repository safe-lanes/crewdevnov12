import { Request, Response } from "express";
import { trainingMatrixVesselDraftsService } from "../services";

export const trainingMatrixVesselDraftsController = {
  async getAll(req: Request, res: Response) {
    try {
      const records = await trainingMatrixVesselDraftsService.getAll();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching training matrix vessel drafts:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel drafts" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training matrix vessel draft ID" });
      }
      const record = await trainingMatrixVesselDraftsService.getById(id);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching training matrix vessel draft:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel draft" });
    }
  },

  async getByVesselId(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const records = await trainingMatrixVesselDraftsService.getByVesselId(vesselId);
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching training matrix vessel drafts by vessel:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel drafts" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const record = await trainingMatrixVesselDraftsService.create(req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Error creating training matrix vessel draft:", error);
      res.status(500).json({ error: "Failed to create training matrix vessel draft" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training matrix vessel draft ID" });
      }
      const record = await trainingMatrixVesselDraftsService.updateById(id, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating training matrix vessel draft:", error);
      res.status(500).json({ error: "Failed to update training matrix vessel draft" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training matrix vessel draft ID" });
      }
      const deleted = await trainingMatrixVesselDraftsService.deleteById(id);
      res.json({ success: deleted });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting training matrix vessel draft:", error);
      res.status(500).json({ error: "Failed to delete training matrix vessel draft" });
    }
  },

  async upsert(req: Request, res: Response) {
    try {
      const record = await trainingMatrixVesselDraftsService.upsert(req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Error upserting training matrix vessel draft:", error);
      res.status(500).json({ error: "Failed to upsert training matrix vessel draft" });
    }
  },
};
