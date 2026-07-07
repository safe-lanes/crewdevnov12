import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { bondItemsService } from "../services";
import { insertAccBondItemV2Schema } from "../../../../shared/v2/accounts/types";

const updateSchema = insertAccBondItemV2Schema.partial().omit({
  bondItemUuid: true,
});

function statusFor(error: any): number | null {
  if (error?.code === "VALIDATION") return 400;
  if (error?.code === "NOT_FOUND") return 404;
  if (error?.code === "CONFLICT") return 409;
  if (error?.message?.includes("not found")) return 404;
  if (error?.message?.includes("required")) return 400;
  return null;
}

export const bondItemsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid, status, period, vesselUuid } = req.query;
      const records = await bondItemsService.getAll({
        crewUuid: crewUuid as string | undefined,
        status: status as string | undefined,
        period: period as string | undefined,
        vesselUuid: vesselUuid as string | undefined,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching bond items:", error);
      res.status(500).json({ error: "Failed to fetch bond items" });
    }
  },

  async getByCrew(req: Request, res: Response) {
    try {
      const records = await bondItemsService.getByCrew(req.params.crewUuid);
      res.json(records);
    } catch (error) {
      console.error("Error fetching crew bond items:", error);
      res.status(500).json({ error: "Failed to fetch crew bond items" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await bondItemsService.getByUuid(req.params.uuid);
      res.json(record);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error fetching bond item:", error);
      res.status(500).json({ error: "Failed to fetch bond item" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = insertAccBondItemV2Schema
        .omit({ bondItemUuid: true })
        .safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid bond item data", details: parsed.error.issues });
      }
      const record = await bondItemsService.create({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.status(201).json(record);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error creating bond item:", error);
      res.status(500).json({ error: "Failed to create bond item" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid bond item data", details: parsed.error.issues });
      }
      const record = await bondItemsService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(record);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error updating bond item:", error);
      res.status(500).json({ error: "Failed to update bond item" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await bondItemsService.delete(req.params.uuid, getAuditUserUuid(req));
      res.status(204).send();
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error deleting bond item:", error);
      res.status(500).json({ error: "Failed to delete bond item" });
    }
  },
};
