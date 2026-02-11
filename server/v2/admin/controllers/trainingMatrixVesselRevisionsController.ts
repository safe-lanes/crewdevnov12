import { Request, Response } from "express";
import { trainingMatrixVesselRevisionsService } from "../services";

export const trainingMatrixVesselRevisionsController = {
  async getAll(req: Request, res: Response) {
    try {
      const records = await trainingMatrixVesselRevisionsService.getAll();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching training matrix vessel revisions:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel revisions" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid training matrix vessel revision ID" });
      }
      const record = await trainingMatrixVesselRevisionsService.getById(id);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching training matrix vessel revision:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel revision" });
    }
  },

  async getByVesselId(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const records = await trainingMatrixVesselRevisionsService.getByVesselId(vesselId);
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching training matrix vessel revisions by vessel:", error);
      res.status(500).json({ error: "Failed to fetch training matrix vessel revisions" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const record = await trainingMatrixVesselRevisionsService.create(req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Error creating training matrix vessel revision:", error);
      res.status(500).json({ error: "Failed to create training matrix vessel revision" });
    }
  },

  async getNextRevision(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const nextRevision = await trainingMatrixVesselRevisionsService.getNextRevision(vesselId);
      res.json({ nextRevision });
    } catch (error: any) {
      console.error("Error getting next revision:", error);
      res.status(500).json({ error: "Failed to get next revision" });
    }
  },

  async submit(req: Request, res: Response) {
    try {
      const result = await trainingMatrixVesselRevisionsService.submit(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Error submitting training matrix vessel revision:", error);
      res.status(500).json({ error: "Failed to submit training matrix vessel revision" });
    }
  },
};
