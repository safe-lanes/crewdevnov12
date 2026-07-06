import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { cbaReferenceService } from "../services";
import { insertAccCbaReferenceV2Schema } from "../../../../shared/v2/accounts/types";

const updateSchema = insertAccCbaReferenceV2Schema.partial().omit({
  cbaRefUuid: true,
});

export const cbaReferenceController = {
  async getAll(_req: Request, res: Response) {
    try {
      const records = await cbaReferenceService.getAll();
      res.json(records);
    } catch (error) {
      console.error("Error fetching CBA references:", error);
      res.status(500).json({ error: "Failed to fetch CBA references" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await cbaReferenceService.getByUuid(req.params.uuid);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching CBA reference:", error);
      res.status(500).json({ error: "Failed to fetch CBA reference" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = insertAccCbaReferenceV2Schema
        .omit({ cbaRefUuid: true })
        .safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid CBA reference data", details: parsed.error.issues });
      }
      const record = await cbaReferenceService.create({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.status(201).json(record);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating CBA reference:", error);
      res.status(500).json({ error: "Failed to create CBA reference" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid CBA reference data", details: parsed.error.issues });
      }
      const record = await cbaReferenceService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating CBA reference:", error);
      res.status(500).json({ error: "Failed to update CBA reference" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await cbaReferenceService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting CBA reference:", error);
      res.status(500).json({ error: "Failed to delete CBA reference" });
    }
  },
};
