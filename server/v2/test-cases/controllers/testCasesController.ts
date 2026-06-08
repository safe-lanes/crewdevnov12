import { Request, Response } from "express";
import { testCasesService } from "../services/testCasesService";
import {
  insertTestCaseV2Schema,
  updateTestCaseV2Schema,
} from "../../../../shared/v2/test-cases/schema";

export const testCasesController = {
  async getAll(req: Request, res: Response) {
    try {
      const { module } = req.query;
      const records = await testCasesService.getAll({
        module: module as string | undefined,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching test cases:", error);
      res.status(500).json({ error: "Failed to fetch test cases" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const record = await testCasesService.getByUuid(uuid);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching test case:", error);
      res.status(500).json({ error: "Failed to fetch test case" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = insertTestCaseV2Schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parsed.error.flatten(),
        });
      }
      const record = await testCasesService.create(parsed.data);
      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating test case:", error);
      res.status(500).json({ error: "Failed to create test case" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const parsed = updateTestCaseV2Schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parsed.error.flatten(),
        });
      }
      const record = await testCasesService.update(uuid, parsed.data);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating test case:", error);
      res.status(500).json({ error: "Failed to update test case" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      await testCasesService.delete(uuid);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting test case:", error);
      res.status(500).json({ error: "Failed to delete test case" });
    }
  },
};
