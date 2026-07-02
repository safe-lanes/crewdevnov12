import { Request, Response } from "express";
import { companyTrainingGroupsService } from "../services";

const VALID_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export const companyTrainingGroupsController = {
  async getAll(req: Request, res: Response) {
    try {
      const records = await companyTrainingGroupsService.getAll();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching company training groups:", error);
      res.status(500).json({ error: "Failed to fetch company training groups" });
    }
  },

  async updateByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;
      if (!VALID_CODES.includes(code.toUpperCase())) {
        return res.status(400).json({ error: `Invalid code: ${code}. Must be A-J` });
      }
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const record = await companyTrainingGroupsService.updateByCode(code.toUpperCase(), { ...req.body, auditUserUuid });
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating company training group:", error);
      res.status(500).json({ error: "Failed to update company training group" });
    }
  },
};
