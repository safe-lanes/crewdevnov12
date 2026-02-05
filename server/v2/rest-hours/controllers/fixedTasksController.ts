import { Request, Response } from "express";
import { fixedTasksService } from "../services";

export const fixedTasksController = {
  async getAll(req: Request, res: Response) {
    try {
      const { vesselId, crewMemberId, monthYear } = req.query;
      const tasks = await fixedTasksService.getAll({
        vesselId: vesselId as string | undefined,
        crewMemberId: crewMemberId as string | undefined,
        monthYear: monthYear as string | undefined,
      });
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching fixed tasks:", error);
      res.status(500).json({ error: "Failed to fetch fixed tasks" });
    }
  },

  async getByKey(req: Request, res: Response) {
    try {
      const { crewMemberId, vesselId, monthYear } = req.params;
      const task = await fixedTasksService.getByKey(
        crewMemberId,
        vesselId,
        monthYear
      );
      if (!task) {
        return res.status(404).json({ error: "Fixed task not found" });
      }
      res.json(task);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error fetching fixed task by key:", error);
      res.status(500).json({ error: "Failed to fetch fixed task" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const task = await fixedTasksService.getByUuid(uuid);
      res.json(task);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching fixed task:", error);
      res.status(500).json({ error: "Failed to fetch fixed task" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const data = { ...req.body };
      if (data.vesselUuid && !data.vesselId) {
        data.vesselId = data.vesselUuid;
        delete data.vesselUuid;
      }
      const task = await fixedTasksService.create(data);
      res.status(201).json(task);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating fixed task:", error);
      res.status(500).json({ error: "Failed to create fixed task" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      const data = { ...req.body };
      if (data.vesselUuid && !data.vesselId) {
        data.vesselId = data.vesselUuid;
        delete data.vesselUuid;
      }
      const task = await fixedTasksService.update(uuid, data);
      res.json(task);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating fixed task:", error);
      res.status(500).json({ error: "Failed to update fixed task" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const { uuid } = req.params;
      await fixedTasksService.delete(uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting fixed task:", error);
      res.status(500).json({ error: "Failed to delete fixed task" });
    }
  },
};
