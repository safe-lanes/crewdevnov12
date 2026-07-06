import { Request, Response } from "express";
import {
  createTrainingStatusPayloadSchema,
  updateTrainingStatusRowSchema,
  groupUpdateTrainingStatusSchema,
  TRAINING_STATUS_MODULES,
} from "@shared/v2/masters/schema";
import {
  TrainingStatusRepository,
  TrainingStatusConflictError,
} from "../repositories/trainingStatusRepository";

const repo = new TrainingStatusRepository();

export const trainingStatusController = {
  async list(req: Request, res: Response) {
    try {
      const module = typeof req.query.module === "string" ? req.query.module : undefined;
      if (module && !(TRAINING_STATUS_MODULES as readonly string[]).includes(module)) {
        return res.status(400).json({ error: `Invalid module: ${module}` });
      }
      const rows = await repo.findAll(module);
      res.json(rows);
    } catch (error) {
      console.error("Failed to fetch training statuses:", error);
      res.status(500).json({ error: "Failed to fetch training statuses" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = createTrainingStatusPayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid training status data", details: parsed.error.issues });
      }
      const { label, modules, auditUserUuid } = parsed.data;
      const rows = await repo.createForModules(label, modules, auditUserUuid);
      res.status(201).json(rows);
    } catch (error) {
      console.error("Failed to create training status:", error);
      res.status(500).json({ error: "Failed to create training status" });
    }
  },

  async groupUpdate(req: Request, res: Response) {
    try {
      const parsed = groupUpdateTrainingStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid training status data", details: parsed.error.issues });
      }
      const { originalLabel, label, modules, auditUserUuid } = parsed.data;
      const rows = await repo.groupUpdate(originalLabel, label, modules, auditUserUuid);
      res.json(rows);
    } catch (error) {
      if (error instanceof TrainingStatusConflictError) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Failed to update training status group:", error);
      res.status(500).json({ error: "Failed to update training status" });
    }
  },

  async updateRow(req: Request, res: Response) {
    try {
      const parsed = updateTrainingStatusRowSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid training status data", details: parsed.error.issues });
      }
      const { label, isActive, auditUserUuid } = parsed.data;
      const row = await repo.updateRow(req.params.uuid, { label, isActive }, auditUserUuid);
      if (!row) {
        return res.status(404).json({ error: "Training status not found" });
      }
      res.json(row);
    } catch (error) {
      if (error instanceof TrainingStatusConflictError) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Failed to update training status:", error);
      res.status(500).json({ error: "Failed to update training status" });
    }
  },

  async deleteRow(req: Request, res: Response) {
    try {
      const auditUserUuid = typeof req.query.auditUserUuid === "string" ? req.query.auditUserUuid : undefined;
      const row = await repo.deleteRow(req.params.uuid, auditUserUuid);
      if (!row) {
        return res.status(404).json({ error: "Training status not found" });
      }
      res.json(row);
    } catch (error) {
      console.error("Failed to delete training status:", error);
      res.status(500).json({ error: "Failed to delete training status" });
    }
  },
};
