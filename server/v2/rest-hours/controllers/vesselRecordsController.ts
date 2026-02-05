import { Request, Response } from "express";
import { vesselRecordsService } from "../services";

export const vesselRecordsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { vesselId, monthValue } = req.query;
      
      const vesselIds = vesselId
        ? (vesselId as string).split(",").filter(Boolean)
        : undefined;

      if (vesselIds && vesselIds.length > 0) {
        const records = await vesselRecordsService.getByFilters(
          vesselIds,
          monthValue as string | undefined
        );
        return res.json(records);
      }

      const records = await vesselRecordsService.getAll({
        vesselId: undefined,
        monthValue: monthValue as string | undefined,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching vessel records:", error);
      res.status(500).json({ error: "Failed to fetch vessel records" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const record = await vesselRecordsService.getByUuid(uuid);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching vessel record:", error);
      res.status(500).json({ error: "Failed to fetch vessel record" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const record = await vesselRecordsService.create(req.body);
      res.status(201).json(record);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating vessel record:", error);
      res.status(500).json({ error: "Failed to create vessel record" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const record = await vesselRecordsService.update(uuid, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating vessel record:", error);
      res.status(500).json({ error: "Failed to update vessel record" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      await vesselRecordsService.delete(uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting vessel record:", error);
      res.status(500).json({ error: "Failed to delete vessel record" });
    }
  },

  async submitVesselReview(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const record = await vesselRecordsService.submitVesselReview(uuid, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error submitting vessel review:", error);
      res.status(500).json({ error: "Failed to submit vessel review" });
    }
  },

  async submitOfficeReview(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const record = await vesselRecordsService.submitOfficeReview(uuid, req.body);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error submitting office review:", error);
      res.status(500).json({ error: "Failed to submit office review" });
    }
  },
};
