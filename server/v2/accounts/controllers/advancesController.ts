import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { advancesService } from "../services";
import { insertAccAdvanceV2Schema } from "../../../../shared/v2/accounts/types";

const updateSchema = insertAccAdvanceV2Schema.partial().omit({
  advanceUuid: true,
});

function statusFor(error: any): number | null {
  if (error?.code === "VALIDATION") return 400;
  if (error?.code === "NOT_FOUND") return 404;
  if (error?.code === "CONFLICT") return 409;
  if (error?.message?.includes("not found")) return 404;
  if (error?.message?.includes("required")) return 400;
  return null;
}

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
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error fetching advance:", error);
      res.status(500).json({ error: "Failed to fetch advance" });
    }
  },

  /** Recovery schedule projection + actual ledger recoveries. */
  async getDetail(req: Request, res: Response) {
    try {
      const detail = await advancesService.getDetail(req.params.uuid);
      res.json(detail);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error fetching advance detail:", error);
      res.status(500).json({ error: "Failed to fetch advance detail" });
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
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
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
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error updating advance:", error);
      res.status(500).json({ error: "Failed to update advance" });
    }
  },

  /** Cancel: only while no recovery has been posted. */
  async cancel(req: Request, res: Response) {
    try {
      const record = await advancesService.cancel(
        req.params.uuid,
        getAuditUserUuid(req),
      );
      res.json(record);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error cancelling advance:", error);
      res.status(500).json({ error: "Failed to cancel advance" });
    }
  },

  /** Close: write off the remainder; remark required. */
  async close(req: Request, res: Response) {
    try {
      const remark =
        typeof req.body?.remark === "string" ? req.body.remark : "";
      const record = await advancesService.close(
        req.params.uuid,
        remark,
        getAuditUserUuid(req),
      );
      res.json(record);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error closing advance:", error);
      res.status(500).json({ error: "Failed to close advance" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await advancesService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error deleting advance:", error);
      res.status(500).json({ error: "Failed to delete advance" });
    }
  },
};
