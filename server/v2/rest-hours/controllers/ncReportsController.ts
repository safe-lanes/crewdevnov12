import { Request, Response } from "express";
import { ncReportsService } from "../services";

export const ncReportsController = {
  // V1 pattern: GET /api/nc-reports/all - returns all NC reports (no filtering)
  async getAll(req: Request, res: Response) {
    try {
      const reports = await ncReportsService.getAll({});
      res.json(reports);
    } catch (error) {
      console.error("Error fetching all NC reports:", error);
      res.status(500).json({ error: "Failed to fetch all NC reports" });
    }
  },

  // V1 pattern: GET /api/nc-reports - filters by crewMemberId, vesselId, monthValue
  async getFiltered(req: Request, res: Response) {
    try {
      const { vesselId, monthValue, crewMemberId } = req.query;
      
      if (!crewMemberId || !vesselId || !monthValue) {
        return res.status(400).json({ error: "crewMemberId, vesselId, and monthValue are required" });
      }
      
      const reports = await ncReportsService.getAll({
        vesselId: vesselId as string,
        monthValue: monthValue as string,
        crewMemberId: crewMemberId as string,
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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const report = await ncReportsService.create({ ...req.body, auditUserUuid });
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
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const report = await ncReportsService.update(uuid, { ...req.body, auditUserUuid });
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
