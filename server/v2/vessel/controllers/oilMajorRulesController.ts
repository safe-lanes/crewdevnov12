import { Request, Response } from "express";
import { asc } from "drizzle-orm";
import { getDb } from "../../db";
import { oilMajorRules } from "../../../../shared/schema";

export const oilMajorRulesController = {
  async getAll(req: Request, res: Response) {
    try {
      const db = getDb();
      const rules = await db.select().from(oilMajorRules).orderBy(asc(oilMajorRules.oilMajorName));
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
