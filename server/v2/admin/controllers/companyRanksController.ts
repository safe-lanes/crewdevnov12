import { Request, Response } from "express";
import { companyRanksService } from "../services";

export const companyRanksController = {
  async getAll(req: Request, res: Response) {
    try {
      const records = await companyRanksService.getAll();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching company ranks:", error);
      res.status(500).json({ error: "Failed to fetch company ranks" });
    }
  },

  async saveAll(req: Request, res: Response) {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: "Request body must be an array" });
      }
      const records = await companyRanksService.saveAll(req.body);
      res.json(records);
    } catch (error: any) {
      console.error("Error saving company ranks:", error);
      res.status(500).json({ error: "Failed to save company ranks" });
    }
  },

  async getByName(req: Request, res: Response) {
    try {
      const { rankName } = req.params;
      const record = await companyRanksService.getByName(rankName);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching company rank:", error);
      res.status(500).json({ error: "Failed to fetch company rank" });
    }
  },
};
