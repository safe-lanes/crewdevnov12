import { Request, Response } from "express";
import { companyTrainingRequirementsService } from "../services";

export const companyTrainingRequirementsController = {
  async getAll(req: Request, res: Response) {
    try {
      const records = await companyTrainingRequirementsService.getAll();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching company training requirements:", error);
      res.status(500).json({ error: "Failed to fetch company training requirements" });
    }
  },

  async upsertBatch(req: Request, res: Response) {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: "Request body must be an array" });
      }
      await companyTrainingRequirementsService.upsertBatch(req.body);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes("Invalid")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error upserting company training requirements:", error);
      res.status(500).json({ error: "Failed to upsert company training requirements" });
    }
  },
};
