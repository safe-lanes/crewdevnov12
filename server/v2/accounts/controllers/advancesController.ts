import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { advancesService } from "../services";
import { insertAccAdvanceV2Schema } from "../../../../shared/v2/accounts/types";

const updateSchema = insertAccAdvanceV2Schema.partial().omit({
  advanceUuid: true,
});

export const advancesController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid, status } = req.query;
      const records = await advancesService.getAll({
        crewUuid: crewUuid as string | undefined,
        status: status as string | undefined,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching advances:", error);
      res.status(500).json({ error: "Failed to fetch advances" });
    }
  },

  async getByCrew(req: Request, res: Response) {
    try {
      const records = await advancesService.getByCrew(req.params.crewUuid);
      res.json(records);
    } catch (error) {
      console.error("Error fetching crew advances:", error);
      res.status(500).json({ error: "Failed to fetch crew advances" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await advancesService.getByUuid(req.params.uuid);
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error fetching advance:", error);
      res.status(500).json({ error: "Failed to fetch advance" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = insertAccAdvanceV2Schema
        .omit({ advanceUuid: true })
        .safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid advance data", details: parsed.error.issues });
      }
      const record = await advancesService.create({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.status(201).json(record);
    } catch (error: any) {
      if (error.message?.includes("required")) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating advance:", error);
      res.status(500).json({ error: "Failed to create advance" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid advance data", details: parsed.error.issues });
      }
      const record = await advancesService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(record);
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error updating advance:", error);
      res.status(500).json({ error: "Failed to update advance" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await advancesService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error deleting advance:", error);
      res.status(500).json({ error: "Failed to delete advance" });
    }
  },
};
