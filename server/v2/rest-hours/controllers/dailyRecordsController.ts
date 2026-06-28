import { Request, Response } from "express";
import { dailyRecordsService } from "../services";

export const dailyRecordsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { vesselId, crewMemberId, monthYear } = req.query;
      const records = await dailyRecordsService.getAll({
        vesselId: vesselId as string | undefined,
        crewMemberId: crewMemberId as string | undefined,
        monthYear: monthYear as string | undefined,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching daily records:", error);
      res.status(500).json({ error: "Failed to fetch daily records" });
    }
  },

  async getByKey(req: Request, res: Response) {
    try {
      const { crewMemberId, vesselId, monthYear } = req.params;
      const rank = typeof req.query.rank === "string" ? req.query.rank : undefined;
      const record = await dailyRecordsService.getByKey(
        crewMemberId,
        vesselId,
        monthYear,
        rank
      );
      if (!record) {
        return res.status(404).json({ error: "Daily record not found" });
      }
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error fetching daily record by key:", error);
      res.status(500).json({ error: "Failed to fetch daily record" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const record = await dailyRecordsService.getByUuid(uuid);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching daily record:", error);
      res.status(500).json({ error: "Failed to fetch daily record" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const record = await dailyRecordsService.create({ ...req.body, auditUserUuid });
      res.status(201).json(record);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating daily record:", error);
      res.status(500).json({ error: "Failed to create daily record" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const record = await dailyRecordsService.update(uuid, { ...req.body, auditUserUuid });
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating daily record:", error);
      res.status(500).json({ error: "Failed to update daily record" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      await dailyRecordsService.delete(uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting daily record:", error);
      res.status(500).json({ error: "Failed to delete daily record" });
    }
  },

  async backfillViolations(req: Request, res: Response) {
    try {
      const { vesselId, monthYear } = req.body;
      if (!vesselId || !monthYear) {
        return res.status(400).json({ error: "Vessel ID and month year are required" });
      }
      const result = await dailyRecordsService.backfillViolations({
        vesselId,
        monthYear,
      });
      res.json(result);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error backfilling violations:", error);
      res.status(500).json({ error: "Failed to backfill violations" });
    }
  },

  async resyncAllRecords(req: Request, res: Response) {
    try {
      const result = await dailyRecordsService.resyncAllRecords();
      res.json(result);
    } catch (error) {
      console.error("Error resyncing records:", error);
      res.status(500).json({ error: "Failed to resync records" });
    }
  },
};
