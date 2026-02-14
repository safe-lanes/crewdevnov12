import { Request, Response } from "express";
import { storage } from "../../../storage";

export const oilMajorRulesController = {
  async getAll(req: Request, res: Response) {
    try {
      const rules = await storage.getOilMajorRules();
      const parsedRules = rules.map(rule => ({
        ...rule,
        rules: typeof rule.rules === 'string' ? JSON.parse(rule.rules) : rule.rules
      }));
      res.json(parsedRules);
    } catch (error) {
      console.error("Error fetching oil major rules:", error);
      res.status(500).json({ error: "Failed to fetch oil major rules" });
    }
  },
};
