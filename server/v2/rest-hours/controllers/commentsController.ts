import { Request, Response } from "express";
import { vesselCommentsService, officeCommentsService } from "../services";

export const commentsController = {
  async getAllVesselComments(req: Request, res: Response) {
    try {
      const { vesselId, monthValue } = req.query;
      const comments = await vesselCommentsService.getAll({
        vesselId: vesselId as string | undefined,
        monthValue: monthValue as string | undefined,
      });
      res.json(comments);
    } catch (error) {
      console.error("Error fetching vessel comments:", error);
      res.status(500).json({ error: "Failed to fetch vessel comments" });
    }
  },

  async getVesselCommentByUuid(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const comment = await vesselCommentsService.getByUuid(uuid);
      res.json(comment);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching vessel comment:", error);
      res.status(500).json({ error: "Failed to fetch vessel comment" });
    }
  },

  async createVesselComment(req: Request, res: Response) {
    try {
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const comment = await vesselCommentsService.create({ ...req.body, auditUserUuid });
      res.status(201).json(comment);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating vessel comment:", error);
      res.status(500).json({ error: "Failed to create vessel comment" });
    }
  },

  async updateVesselComment(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const comment = await vesselCommentsService.update(uuid, { ...req.body, auditUserUuid });
      res.json(comment);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating vessel comment:", error);
      res.status(500).json({ error: "Failed to update vessel comment" });
    }
  },

  async deleteVesselComment(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      await vesselCommentsService.delete(uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting vessel comment:", error);
      res.status(500).json({ error: "Failed to delete vessel comment" });
    }
  },

  async getAllOfficeComments(req: Request, res: Response) {
    try {
      const { vesselId, monthValue } = req.query;
      const comments = await officeCommentsService.getAll({
        vesselId: vesselId as string | undefined,
        monthValue: monthValue as string | undefined,
      });
      res.json(comments);
    } catch (error) {
      console.error("Error fetching office comments:", error);
      res.status(500).json({ error: "Failed to fetch office comments" });
    }
  },

  async getOfficeCommentByUuid(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const comment = await officeCommentsService.getByUuid(uuid);
      res.json(comment);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching office comment:", error);
      res.status(500).json({ error: "Failed to fetch office comment" });
    }
  },

  async createOfficeComment(req: Request, res: Response) {
    try {
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const comment = await officeCommentsService.create({ ...req.body, auditUserUuid });
      res.status(201).json(comment);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating office comment:", error);
      res.status(500).json({ error: "Failed to create office comment" });
    }
  },

  async updateOfficeComment(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const auditUserUuid = req.body?.auditUserUuid ?? null;
      const comment = await officeCommentsService.update(uuid, { ...req.body, auditUserUuid });
      res.json(comment);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating office comment:", error);
      res.status(500).json({ error: "Failed to update office comment" });
    }
  },

  async deleteOfficeComment(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      await officeCommentsService.delete(uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting office comment:", error);
      res.status(500).json({ error: "Failed to delete office comment" });
    }
  },
};
