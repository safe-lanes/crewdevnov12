import { Request, Response } from "express";
import {
  createTravelDocumentTypePayloadSchema,
  updateTravelDocumentTypeRowSchema,
} from "@shared/v2/masters/schema";
import {
  TravelDocumentTypeRepository,
  TravelDocumentTypeConflictError,
} from "../repositories/travelDocumentTypeRepository";

const repo = new TravelDocumentTypeRepository();

export const travelDocumentTypeController = {
  async list(_req: Request, res: Response) {
    try {
      const rows = await repo.findAll();
      res.json(rows);
    } catch (error) {
      console.error("Failed to fetch travel document types:", error);
      res.status(500).json({ error: "Failed to fetch travel document types" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = createTravelDocumentTypePayloadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid travel document type data", details: parsed.error.issues });
      }
      const { name, auditUserUuid } = parsed.data;
      const row = await repo.create(name, auditUserUuid);
      res.status(201).json(row);
    } catch (error) {
      if (error instanceof TravelDocumentTypeConflictError) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Failed to create travel document type:", error);
      res.status(500).json({ error: "Failed to create travel document type" });
    }
  },

  async updateRow(req: Request, res: Response) {
    try {
      const parsed = updateTravelDocumentTypeRowSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid travel document type data", details: parsed.error.issues });
      }
      const { name, isActive, auditUserUuid } = parsed.data;
      const row = await repo.updateRow(req.params.uuid, { name, isActive }, auditUserUuid);
      if (!row) {
        return res.status(404).json({ error: "Travel document type not found" });
      }
      res.json(row);
    } catch (error) {
      if (error instanceof TravelDocumentTypeConflictError) {
        return res.status(409).json({ error: error.message });
      }
      console.error("Failed to update travel document type:", error);
      res.status(500).json({ error: "Failed to update travel document type" });
    }
  },

  async deleteRow(req: Request, res: Response) {
    try {
      const auditUserUuid = typeof req.query.auditUserUuid === "string" ? req.query.auditUserUuid : undefined;
      const row = await repo.deleteRow(req.params.uuid, auditUserUuid);
      if (!row) {
        return res.status(404).json({ error: "Travel document type not found" });
      }
      res.json(row);
    } catch (error) {
      console.error("Failed to delete travel document type:", error);
      res.status(500).json({ error: "Failed to delete travel document type" });
    }
  },
};
