import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { payrunsService } from "../services";
import {
  insertAccPayrunV2Schema,
  insertAccPayrunEntryV2Schema,
} from "../../../../shared/v2/accounts/types";
import { z } from "zod";

const updateSchema = insertAccPayrunV2Schema.partial().omit({
  payrunUuid: true,
});

const saveEntriesSchema = z.object({
  entries: z.array(
    insertAccPayrunEntryV2Schema.omit({
      payrunEntryUuid: true,
      payrunUuid: true,
    }),
  ),
});

export const payrunsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { vesselUuid, status } = req.query;
      const records = await payrunsService.getAll({
        vesselUuid: vesselUuid as string | undefined,
        status: status as string | undefined,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching payruns:", error);
      res.status(500).json({ error: "Failed to fetch payruns" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await payrunsService.getByUuid(req.params.uuid);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching payrun:", error);
      res.status(500).json({ error: "Failed to fetch payrun" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = insertAccPayrunV2Schema
        .omit({ payrunUuid: true })
        .safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid payrun data", details: parsed.error.issues });
      }
      const record = await payrunsService.create({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.status(201).json(record);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating payrun:", error);
      res.status(500).json({ error: "Failed to create payrun" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid payrun data", details: parsed.error.issues });
      }
      const record = await payrunsService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating payrun:", error);
      res.status(500).json({ error: "Failed to update payrun" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await payrunsService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting payrun:", error);
      res.status(500).json({ error: "Failed to delete payrun" });
    }
  },

  async getEntries(req: Request, res: Response) {
    try {
      const records = await payrunsService.getEntries(req.params.uuid);
      res.json(records);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching payrun entries:", error);
      res.status(500).json({ error: "Failed to fetch payrun entries" });
    }
  },

  async saveEntries(req: Request, res: Response) {
    try {
      const parsed = saveEntriesSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid payrun entries data",
          details: parsed.error.issues,
        });
      }
      const records = await payrunsService.saveEntries(
        req.params.uuid,
        parsed.data.entries,
        getAuditUserUuid(req),
      );
      res.json(records);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error saving payrun entries:", error);
      res.status(500).json({ error: "Failed to save payrun entries" });
    }
  },
};
