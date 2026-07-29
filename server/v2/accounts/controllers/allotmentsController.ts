import { Request, Response } from "express";
import { getActor, getAuditUserUuid } from "./_auth";
import { allotmentsService } from "../services";
import { assertVesselScope } from "../services/vesselScope";
import { insertAccAllotmentV2Schema } from "../../../../shared/v2/accounts/types";

const updateSchema = insertAccAllotmentV2Schema.partial().omit({
  allotmentUuid: true,
});

function statusFor(error: any): number | null {
  if (error?.code === "VALIDATION") return 400;
  if (error?.code === "NOT_FOUND") return 404;
  if (error?.code === "CONFLICT") return 409;
  if (error?.message?.includes("not found")) return 404;
  if (error?.message?.includes("required")) return 400;
  return null;
}

export const allotmentsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { crewUuid, status, vesselUuid } = req.query;
      const actor = getActor(req);
      if (actor.vesselUser && vesselUuid) {
        // If a Ship actor names a vessel explicitly, it must be their own.
        assertVesselScope(actor, vesselUuid as string);
      }
      const records = await allotmentsService.getAll({
        crewUuid: crewUuid as string | undefined,
        status: status as string | undefined,
        vesselUuid: vesselUuid as string | undefined,
      });
      if (actor.vesselUser) {
        // Ship actors see only allotments of crew engaged on their own
        // vessel(s) — fail-closed when the JWT carries no vessels claim.
        return res.json(
          records.filter(
            (a: { vesselUuid: string | null }) =>
              a.vesselUuid != null && actor.vessels.includes(a.vesselUuid),
          ),
        );
      }
      res.json(records);
    } catch (error: any) {
      if (error?.code === "FORBIDDEN") {
        return res.status(403).json({ error: error.message });
      }
      console.error("Error fetching allotments:", error);
      res.status(500).json({ error: "Failed to fetch allotments" });
    }
  },

  async getByCrew(req: Request, res: Response) {
    try {
      const records = await allotmentsService.getByCrew(req.params.crewUuid);
      res.json(records);
    } catch (error) {
      console.error("Error fetching crew allotments:", error);
      res.status(500).json({ error: "Failed to fetch crew allotments" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await allotmentsService.getByUuid(req.params.uuid);
      res.json(record);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error fetching allotment:", error);
      res.status(500).json({ error: "Failed to fetch allotment" });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = insertAccAllotmentV2Schema
        .omit({ allotmentUuid: true })
        .safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid allotment data", details: parsed.error.issues });
      }
      const result = await allotmentsService.create({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.status(201).json(result);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error creating allotment:", error);
      res.status(500).json({ error: "Failed to create allotment" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid allotment data", details: parsed.error.issues });
      }
      const result = await allotmentsService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(result);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error updating allotment:", error);
      res.status(500).json({ error: "Failed to update allotment" });
    }
  },

  async suspend(req: Request, res: Response) {
    try {
      const record = await allotmentsService.suspend(
        req.params.uuid,
        getAuditUserUuid(req),
      );
      res.json(record);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error suspending allotment:", error);
      res.status(500).json({ error: "Failed to suspend allotment" });
    }
  },

  async reactivate(req: Request, res: Response) {
    try {
      const record = await allotmentsService.reactivate(
        req.params.uuid,
        getAuditUserUuid(req),
      );
      res.json(record);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error reactivating allotment:", error);
      res.status(500).json({ error: "Failed to reactivate allotment" });
    }
  },

  async end(req: Request, res: Response) {
    try {
      const record = await allotmentsService.end(
        req.params.uuid,
        typeof req.body?.validTo === "string" ? req.body.validTo : undefined,
        getAuditUserUuid(req),
      );
      res.json(record);
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error ending allotment:", error);
      res.status(500).json({ error: "Failed to end allotment" });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await allotmentsService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error: any) {
      const status = statusFor(error);
      if (status) return res.status(status).json({ error: error.message });
      console.error("Error deleting allotment:", error);
      res.status(500).json({ error: "Failed to delete allotment" });
    }
  },
};
