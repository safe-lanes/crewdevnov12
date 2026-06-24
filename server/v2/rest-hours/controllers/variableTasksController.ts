import { Request, Response } from "express";
import { z } from "zod";
import { variableTasksService, rankResolutionService } from "../services";

const rankAsOfDateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  crewMemberIds: z
    .string()
    .min(1, "crewMemberIds is required")
    .transform((s) => s.split(",").map((v) => v.trim()).filter(Boolean)),
});

export const variableTasksController = {
  async getRanksAsOfDate(req: Request, res: Response) {
    try {
      const parsed = rankAsOfDateQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0]?.message || "Invalid query" });
      }
      const { date, crewMemberIds } = parsed.data;
      const ranks = await rankResolutionService.resolveRanksAsOfDate(crewMemberIds, date);
      res.json(ranks);
    } catch (error) {
      console.error("Error resolving ranks as of date:", error);
      res.status(500).json({ error: "Failed to resolve ranks as of date" });
    }
  },

  async getAll(req: Request, res: Response) {
    try {
      const { vesselId, vesselUuid, periodValue } = req.query;
      const tasks = await variableTasksService.getAll({
        vesselId: (vesselId || vesselUuid) as string | undefined,
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

      if (task.vesselId && task.periodValue) {
        variableTasksService.recalculateConflictsForVessel(task.vesselId, task.periodValue).catch(err => console.error('Failed to recalculate conflicts after create:', err));
      }
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
      const originalTask = await variableTasksService.getByUuid(uuid);
      const task = await variableTasksService.update(uuid, req.body);
      res.json(task);

      const recalcPromises: Promise<void>[] = [];
      if (task.vesselId && task.periodValue) {
        recalcPromises.push(variableTasksService.recalculateConflictsForVessel(task.vesselId, task.periodValue));
      }
      if (originalTask.vesselId && originalTask.periodValue &&
          (originalTask.vesselId !== task.vesselId || originalTask.periodValue !== task.periodValue)) {
        recalcPromises.push(variableTasksService.recalculateConflictsForVessel(originalTask.vesselId, originalTask.periodValue));
      }
      Promise.all(recalcPromises).catch(err => console.error('Failed to recalculate conflicts after update:', err));
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
      const task = await variableTasksService.getByUuid(uuid);
      await variableTasksService.delete(uuid);
      res.status(204).send();

      if (task.vesselId && task.periodValue) {
        variableTasksService.recalculateConflictsForVessel(task.vesselId, task.periodValue).catch(err => console.error('Failed to recalculate conflicts after delete:', err));
      }
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

      if (task.vesselId && task.periodValue) {
        variableTasksService.recalculateConflictsForVessel(task.vesselId, task.periodValue).catch(err => console.error('Failed to recalculate conflicts after publish:', err));
      }
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
