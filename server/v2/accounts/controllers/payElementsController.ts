import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { payElementsService } from "../services";
import { insertAccPayElementV2Schema } from "../../../../shared/v2/accounts/types";

const updateSchema = insertAccPayElementV2Schema.partial().omit({
  payElementUuid: true,
});

export const payElementsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { status, type } = req.query;
      const records = await payElementsService.getAll({
        status: status as string | undefined,
        type: type as string | undefined,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching pay elements:", error);
      res.status(500).json({ error: "Failed to fetch pay elements" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await payElementsService.getByUuid(req.params.uuid);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching pay element:", error);
      res.status(500).json({ error: "Failed to fetch pay element" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = insertAccPayElementV2Schema
        .omit({ payElementUuid: true })
        .safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid pay element data", details: parsed.error.issues });
      }
      const record = await payElementsService.create({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.status(201).json(record);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating pay element:", error);
      res.status(500).json({ error: "Failed to create pay element" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid pay element data", details: parsed.error.issues });
      }
      const record = await payElementsService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating pay element:", error);
      res.status(500).json({ error: "Failed to update pay element" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await payElementsService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting pay element:", error);
      res.status(500).json({ error: "Failed to delete pay element" });
    }
  },
};
