import { Request, Response } from "express";
import { companyTrainingsService } from "../services";

export const companyTrainingsController = {
  async getAll(req: Request, res: Response) {
    try {
      const records = await companyTrainingsService.getAll();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching company trainings:", error);
      res.status(500).json({ error: "Failed to fetch company trainings" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid company training ID" });
      }
      const record = await companyTrainingsService.getById(id);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching company training:", error);
      res.status(500).json({ error: "Failed to fetch company training" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const record = await companyTrainingsService.create(req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Error creating company training:", error);
      res.status(500).json({ error: "Failed to create company training" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid company training ID" });
      }
      const record = await companyTrainingsService.updateById(id, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating company training:", error);
      res.status(500).json({ error: "Failed to update company training" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid company training ID" });
      }
      const deleted = await companyTrainingsService.deleteById(id);
      res.json({ success: deleted });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting company training:", error);
      res.status(500).json({ error: "Failed to delete company training" });
    }
  },

  async import(req: Request, res: Response) {
    try {
      const results = await companyTrainingsService.importFromMaster();
      res.json(results);
    } catch (error: any) {
      console.error("Error importing company trainings:", error);
      res.status(500).json({ error: "Failed to import company trainings" });
    }
  },

  async reorder(req: Request, res: Response) {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: "Request body must be an array of {id, sortOrder}" });
      }
      await companyTrainingsService.reorder(req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error reordering company trainings:", error);
      res.status(500).json({ error: "Failed to reorder company trainings" });
    }
  },
};
