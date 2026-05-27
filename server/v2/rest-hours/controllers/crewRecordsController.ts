import { Request, Response } from "express";
import { crewRecordsService } from "../services";

export const crewRecordsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { vesselId, monthValue, monthValues, ranks, search, complianceMode, opaMode } = req.query;

      const vesselIds = vesselId
        ? (vesselId as string).split(",").filter(Boolean)
        : undefined;

      const monthValuesList = monthValues
        ? (monthValues as string).split(",").filter(Boolean)
        : undefined;

      const rankList = ranks
        ? (ranks as string).split(",").filter(Boolean)
        : undefined;

      const mode: 'Rest' | 'Work' = complianceMode === 'Work' ? 'Work' : 'Rest';
      const opa = opaMode === 'true' || opaMode === '1';

      // Bulk path: multi-month aggregation (used by Periodic / Vessel Analysis charts).
      // Skips placeholder/sign-on resolution since these views only aggregate real totals.
      if (monthValuesList && monthValuesList.length > 0) {
        const records = await crewRecordsService.getBulkByMonths({
          vesselIds,
          monthValues: monthValuesList,
          complianceMode: mode,
          opaMode: opa,
        });
        return res.json(records);
      }

      const records = await crewRecordsService.getByFilters({
        vesselIds,
        monthValue: monthValue as string | undefined,
        ranks: rankList,
        search: search as string | undefined,
        complianceMode: mode,
        opaMode: opa,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching crew records:", error);
      res.status(500).json({ error: "Failed to fetch crew records" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const record = await crewRecordsService.getByUuid(uuid);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching crew record:", error);
      res.status(500).json({ error: "Failed to fetch crew record" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const record = await crewRecordsService.create(req.body);
      res.status(201).json(record);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating crew record:", error);
      res.status(500).json({ error: "Failed to create crew record" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const record = await crewRecordsService.update(uuid, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating crew record:", error);
      res.status(500).json({ error: "Failed to update crew record" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      await crewRecordsService.delete(uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting crew record:", error);
      res.status(500).json({ error: "Failed to delete crew record" });
    }
  },

  async getViolationsByRank(req: Request, res: Response) {
    try {
      const { vesselId, monthValue, complianceMode, opaMode } = req.query;
      const mode: 'Rest' | 'Work' = complianceMode === 'Work' ? 'Work' : 'Rest';
      const opa = opaMode === 'true' || opaMode === '1';
      const vesselIds = vesselId
        ? (vesselId as string).split(",").filter(Boolean)
        : undefined;
      const result = await crewRecordsService.getViolationsByRank({
        vesselIds,
        monthValue: monthValue as string | undefined,
        complianceMode: mode,
        opaMode: opa,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching violations by rank:", error);
      res.status(500).json({ error: "Failed to fetch violations by rank" });
    }
  },

  async getNcsByRank(req: Request, res: Response) {
    try {
      const { vesselId, monthValue, complianceMode, opaMode } = req.query;
      const mode: 'Rest' | 'Work' = complianceMode === 'Work' ? 'Work' : 'Rest';
      const opa = opaMode === 'true' || opaMode === '1';
      const vesselIds = vesselId
        ? (vesselId as string).split(",").filter(Boolean)
        : undefined;
      const result = await crewRecordsService.getNcsByRank({
        vesselIds,
        monthValue: monthValue as string | undefined,
        complianceMode: mode,
        opaMode: opa,
      });
      res.json(result);
    } catch (error) {
      console.error("Error fetching NCs by rank:", error);
      res.status(500).json({ error: "Failed to fetch NCs by rank" });
    }
  },
};
