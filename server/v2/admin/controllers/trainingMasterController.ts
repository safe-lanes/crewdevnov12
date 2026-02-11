import { Request, Response } from "express";
import { trainingMasterService } from "../services";

export const trainingMasterController = {
  async getAll(req: Request, res: Response) {
    try {
      const records = await trainingMasterService.getAll();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching training masters:", error);
      res.status(500).json({ error: "Failed to fetch training masters" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training master ID" });
      }
      const record = await trainingMasterService.getById(id);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching training master:", error);
      res.status(500).json({ error: "Failed to fetch training master" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const record = await trainingMasterService.create(req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Error creating training master:", error);
      res.status(500).json({ error: "Failed to create training master" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training master ID" });
      }
      const record = await trainingMasterService.updateById(id, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating training master:", error);
      res.status(500).json({ error: "Failed to update training master" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training master ID" });
      }
      const deleted = await trainingMasterService.deleteById(id);
      res.json({ success: deleted });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("Cannot delete")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error deleting training master:", error);
      res.status(500).json({ error: "Failed to delete training master" });
    }
  },

  async batchUpdate(req: Request, res: Response) {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: "Request body must be an array" });
      }
      const results = await trainingMasterService.batchUpdate(req.body);
      res.json(results);
    } catch (error: any) {
      console.error("Error batch updating training masters:", error);
      res.status(500).json({ error: "Failed to batch update training masters" });
    }
  },

  async reorder(req: Request, res: Response) {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: "Request body must be an array of {id, sortOrder}" });
      }
      await trainingMasterService.reorder(req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error reordering training masters:", error);
      res.status(500).json({ error: "Failed to reorder training masters" });
    }
  },
};
