import { Request, Response } from "express";
import { testRecordsService } from "../services";

export const testRecordsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { vesselId, testType } = req.query;
      const records = await testRecordsService.getAll({
        vesselId: vesselId as string | undefined,
        testType: testType as string | undefined,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching test records:", error);
      res.status(500).json({ error: "Failed to fetch test records" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const record = await testRecordsService.getByUuid(uuid);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching test record:", error);
      res.status(500).json({ error: "Failed to fetch test record" });
    }
  },

  async getByVessel(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const { testType } = req.query;
      const records = await testRecordsService.getByVessel(
        vesselId,
        testType as string | undefined
      );
      res.json(records);
    } catch (error) {
      console.error("Error fetching test records by vessel:", error);
      res.status(500).json({ error: "Failed to fetch test records" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const record = await testRecordsService.create(req.body);
      res.status(201).json(record);
    } catch (error: any) {
      if (error.statusCode === 409) {
        return res.status(409).json({
          error: error.message,
          existingRecordId: error.existingRecordId,
        });
      }
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating test record:", error);
      res.status(500).json({ error: "Failed to create test record" });
    }
  },

  async updatePlannedFields(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const record = await testRecordsService.updatePlannedFields(uuid, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating planned fields:", error);
      res.status(500).json({ error: "Failed to update planned fields" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const record = await testRecordsService.update(uuid, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.statusCode === 409) {
        return res.status(409).json({
          error: error.message,
          existingRecordId: error.existingRecordId,
        });
      }
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating test record:", error);
      res.status(500).json({ error: "Failed to update test record" });
    }
  },

  async getViolationCounts(req: Request, res: Response) {
    try {
      const { periodFrom, periodTo } = req.query;
      if (typeof periodFrom !== "string" || typeof periodTo !== "string") {
        return res.status(400).json({
          error: "periodFrom and periodTo query params are required (YYYY-MM-DD)",
        });
      }
      const result = await testRecordsService.getViolationCounts({
        periodFrom,
        periodTo,
      });
      res.json(result);
    } catch (error: any) {
      if (error.message?.includes("Invalid period")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error computing violation counts:", error);
      res.status(500).json({ error: "Failed to compute violation counts" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      await testRecordsService.delete(uuid);
      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting test record:", error);
      res.status(500).json({ error: "Failed to delete test record" });
    }
  },
};
