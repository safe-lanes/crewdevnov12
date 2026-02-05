import { Request, Response } from "express";
import { ncReportsService } from "../services";

export const ncReportsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { vesselId, monthValue, crewMemberId } = req.query;
      const reports = await ncReportsService.getAll({
        vesselId: vesselId as string | undefined,
        monthValue: monthValue as string | undefined,
        crewMemberId: crewMemberId as string | undefined,
      });
      res.json(reports);
    } catch (error) {
      console.error("Error fetching NC reports:", error);
      res.status(500).json({ error: "Failed to fetch NC reports" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const report = await ncReportsService.getByUuid(uuid);
      res.json(report);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching NC report:", error);
      res.status(500).json({ error: "Failed to fetch NC report" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const report = await ncReportsService.create(req.body);
      res.status(201).json(report);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating NC report:", error);
      res.status(500).json({ error: "Failed to create NC report" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const report = await ncReportsService.update(uuid, req.body);
      res.json(report);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating NC report:", error);
      res.status(500).json({ error: "Failed to update NC report" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      await ncReportsService.delete(uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting NC report:", error);
      res.status(500).json({ error: "Failed to delete NC report" });
    }
  },
};
