import { Request, Response } from "express";
import { vesselRevisionsService } from "../services";

export const vesselRevisionsController = {
  async getAll(req: Request, res: Response) {
    try {
      const records = await vesselRevisionsService.getAll();
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching vessel revisions:", error);
      res.status(500).json({ error: "Failed to fetch vessel revisions" });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid vessel revision ID" });
      }
      const record = await vesselRevisionsService.getById(id);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching vessel revision:", error);
      res.status(500).json({ error: "Failed to fetch vessel revision" });
    }
  },

  async getByVesselId(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const records = await vesselRevisionsService.getByVesselId(vesselId);
      res.json(records);
    } catch (error: any) {
      console.error("Error fetching vessel revisions by vessel:", error);
      res.status(500).json({ error: "Failed to fetch vessel revisions" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const record = await vesselRevisionsService.create(req.body);
      res.json(record);
    } catch (error: any) {
      console.error("Error creating vessel revision:", error);
      res.status(500).json({ error: "Failed to create vessel revision" });
    }
  },

  async getNextRevision(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const nextRevision = await vesselRevisionsService.getNextRevision(vesselId);
      res.json({ nextRevision });
    } catch (error: any) {
      console.error("Error getting next revision:", error);
      res.status(500).json({ error: "Failed to get next revision" });
    }
  },

  async submit(req: Request, res: Response) {
    try {
      const result = await vesselRevisionsService.submit(req.body);
      res.json(result);
    } catch (error: any) {
      console.error("Error submitting vessel revision:", error);
      res.status(500).json({ error: "Failed to submit vessel revision" });
    }
  },

  async getRanks(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const ranks = await vesselRevisionsService.getRanksByVesselId(vesselId);
      res.json(ranks);
    } catch (error: any) {
      console.error("Error fetching vessel ranks:", error);
      res.status(500).json({ error: "Failed to fetch vessel ranks" });
    }
  },
};
