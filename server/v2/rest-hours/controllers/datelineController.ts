import { Request, Response } from "express";
import { datelineService } from "../services";

export const datelineController = {
  async getAll(req: Request, res: Response) {
    try {
      const { vesselId, monthValue } = req.query;
      const adjustments = await datelineService.getAll({
        vesselId: vesselId as string | undefined,
        monthValue: monthValue as string | undefined,
      });
      res.json(adjustments);
    } catch (error) {
      console.error("Error fetching dateline adjustments:", error);
      res.status(500).json({ error: "Failed to fetch dateline adjustments" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const adjustment = await datelineService.getByUuid(uuid);
      res.json(adjustment);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching dateline adjustment:", error);
      res.status(500).json({ error: "Failed to fetch dateline adjustment" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const adjustment = await datelineService.create(req.body);
      res.status(201).json(adjustment);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating dateline adjustment:", error);
      res.status(500).json({ error: "Failed to create dateline adjustment" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const adjustment = await datelineService.update(uuid, req.body);
      res.json(adjustment);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating dateline adjustment:", error);
      res.status(500).json({ error: "Failed to update dateline adjustment" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      await datelineService.delete(uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting dateline adjustment:", error);
      res.status(500).json({ error: "Failed to delete dateline adjustment" });
    }
  },
};
