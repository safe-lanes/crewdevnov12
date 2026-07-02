import { Request, Response } from "express";
import { z } from "zod";
import { testRecordsService } from "../services";

function toArrayParam(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string" && v.length > 0)
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const violationFormSummariesQuerySchema = z
  .object({
    periodFrom: isoDate,
    periodTo: isoDate,
    type: z.enum(["alcohol", "drug"]),
  })
  .refine((v) => v.periodFrom <= v.periodTo, {
    message: "periodFrom must be on or before periodTo",
    path: ["periodFrom"],
  });

const violationCountsQuerySchema = z
  .object({
    periodFrom: isoDate,
    periodTo: isoDate,
  })
  .refine((v) => v.periodFrom <= v.periodTo, {
    message: "periodFrom must be on or before periodTo",
    path: ["periodFrom"],
  });

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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const record = await testRecordsService.create({ ...req.body, auditUserUuid });
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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const record = await testRecordsService.update(uuid, { ...req.body, auditUserUuid });
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
      const parsed = violationCountsQuerySchema.safeParse({
        periodFrom: req.query.periodFrom,
        periodTo: req.query.periodTo,
      });
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid query parameters",
          details: parsed.error.flatten(),
        });
      }
      const { periodFrom, periodTo } = parsed.data;
      const result = await testRecordsService.getViolationCounts({
        periodFrom,
        periodTo,
        vesselNames: toArrayParam(req.query.vesselIds ?? req.query["vesselIds[]"]),
        rankNames: toArrayParam(req.query.rankIds ?? req.query["rankIds[]"]),
        poolNames: toArrayParam(req.query.poolIds ?? req.query["poolIds[]"]),
        agentNames: toArrayParam(req.query.agentIds ?? req.query["agentIds[]"]),
        nationalityIds: toArrayParam(
          req.query.nationalityIds ?? req.query["nationalityIds[]"]
        ),
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

  async getViolationFormSummaries(req: Request, res: Response) {
    try {
      const parsed = violationFormSummariesQuerySchema.safeParse({
        periodFrom: req.query.periodFrom,
        periodTo: req.query.periodTo,
        type: req.query.type,
      });
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid query parameters",
          details: parsed.error.flatten(),
        });
      }
      const { periodFrom, periodTo, type } = parsed.data;
      const result = await testRecordsService.getViolationFormSummaries({
        periodFrom,
        periodTo,
        type,
        vesselNames: toArrayParam(req.query.vesselIds ?? req.query["vesselIds[]"]),
        rankNames: toArrayParam(req.query.rankIds ?? req.query["rankIds[]"]),
        poolNames: toArrayParam(req.query.poolIds ?? req.query["poolIds[]"]),
        agentNames: toArrayParam(req.query.agentIds ?? req.query["agentIds[]"]),
        nationalityIds: toArrayParam(
          req.query.nationalityIds ?? req.query["nationalityIds[]"]
        ),
      });
      res.json(result);
    } catch (error: any) {
      if (error.message?.includes("Invalid period")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error fetching violation form summaries:", error);
      res.status(500).json({ error: "Failed to fetch violation form summaries" });
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
