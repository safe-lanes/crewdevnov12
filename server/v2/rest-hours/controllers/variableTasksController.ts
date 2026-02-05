import { Request, Response } from "express";
import { variableTasksService } from "../services";

export const variableTasksController = {
  async getAll(req: Request, res: Response) {
    try {
      const { vesselId, periodValue } = req.query;
      const tasks = await variableTasksService.getAll({
        vesselId: vesselId as string | undefined,
        periodValue: periodValue as string | undefined,
      });
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching variable tasks:", error);
      res.status(500).json({ error: "Failed to fetch variable tasks" });
    }
  },

  async getDrafts(req: Request, res: Response) {
    try {
      const { vesselId } = req.query;
      const tasks = await variableTasksService.getDrafts(
        vesselId as string | undefined
      );
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching draft variable tasks:", error);
      res.status(500).json({ error: "Failed to fetch draft variable tasks" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const task = await variableTasksService.getByUuid(uuid);
      res.json(task);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching variable task:", error);
      res.status(500).json({ error: "Failed to fetch variable task" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const task = await variableTasksService.create(req.body);
      res.status(201).json(task);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating variable task:", error);
      res.status(500).json({ error: "Failed to create variable task" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const task = await variableTasksService.update(uuid, req.body);
      res.json(task);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating variable task:", error);
      res.status(500).json({ error: "Failed to update variable task" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      await variableTasksService.delete(uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting variable task:", error);
      res.status(500).json({ error: "Failed to delete variable task" });
    }
  },

  async publish(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const { auditUserUuid } = req.body;
      const task = await variableTasksService.publishDraft(uuid, auditUserUuid);
      res.json(task);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("not a draft")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error publishing variable task:", error);
      res.status(500).json({ error: "Failed to publish variable task" });
    }
  },
};
