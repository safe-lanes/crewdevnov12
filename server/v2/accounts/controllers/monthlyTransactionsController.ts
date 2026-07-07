import { Request, Response } from "express";
import { z } from "zod";
import { getActor, getAuditUserUuid } from "./_auth";
import { monthlyTransactionsService } from "../services";
import { assertVesselScope } from "../services/vesselScope";
import { insertAccMonthlyTransactionV2Schema } from "../../../../shared/v2/accounts/types";

const createSchema = insertAccMonthlyTransactionV2Schema.omit({ txnUuid: true });
const updateSchema = insertAccMonthlyTransactionV2Schema
  .partial()
  .omit({ txnUuid: true });

const rejectSchema = z.object({
  reviewComment: z
    .string()
    .trim()
    .min(1, "A review comment is required to reject an entry"),
});

function handleError(res: Response, error: any, fallback: string) {
  const code = (error as { code?: string })?.code;
  if (code === "CONFLICT") return res.status(409).json({ error: error.message });
  if (code === "VALIDATION") return res.status(400).json({ error: error.message });
  if (code === "FORBIDDEN") return res.status(403).json({ error: error.message });
  if (code === "NOT_FOUND" || error.message?.includes("not found")) {
    return res.status(404).json({ error: error.message });
  }
  console.error(fallback, error);
  res.status(500).json({ error: fallback });
}

export const monthlyTransactionsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { vesselUuid, period, crewUuid, engagementUuid, status, origin } =
        req.query;
      const actor = getActor(req);
      if (actor.vesselUser) {
        // Vessel users must read within their own vessel scope.
        assertVesselScope(actor, (vesselUuid as string | undefined) ?? null);
      }
      const records = await monthlyTransactionsService.getAll({
        vesselUuid: vesselUuid as string | undefined,
        period: period as string | undefined,
        crewUuid: crewUuid as string | undefined,
        engagementUuid: engagementUuid as string | undefined,
        status: status as string | undefined,
        origin: origin as string | undefined,
      });
      res.json(records);
    } catch (error: any) {
      handleError(res, error, "Failed to fetch monthly transactions");
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await monthlyTransactionsService.getByUuid(req.params.uuid);
      const actor = getActor(req);
      if (actor.vesselUser) {
        assertVesselScope(actor, record.vesselUuid);
      }
      res.json(record);
    } catch (error: any) {
      handleError(res, error, "Failed to fetch monthly transaction");
    }
  },

  async create(req: Request, res: Response) {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid monthly transaction data",
          details: parsed.error.issues,
        });
      }
      const record = await monthlyTransactionsService.create(
        {
          ...parsed.data,
          auditUserUuid: getAuditUserUuid(req),
        },
        getActor(req),
      );
      res.status(201).json(record);
    } catch (error: any) {
      handleError(res, error, "Failed to create monthly transaction");
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid monthly transaction data",
          details: parsed.error.issues,
        });
      }
      const record = await monthlyTransactionsService.update(
        req.params.uuid,
        {
          ...parsed.data,
          auditUserUuid: getAuditUserUuid(req),
        },
        getActor(req),
      );
      res.json(record);
    } catch (error: any) {
      handleError(res, error, "Failed to update monthly transaction");
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await monthlyTransactionsService.delete(
        req.params.uuid,
        getActor(req),
        getAuditUserUuid(req),
      );
      res.status(204).send();
    } catch (error: any) {
      handleError(res, error, "Failed to delete monthly transaction");
    }
  },

  /** Office review: accept a submitted vessel entry. */
  async accept(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      if (actor.vesselUser) {
        return res
          .status(403)
          .json({ error: "Accepting entries is an office action" });
      }
      const record = await monthlyTransactionsService.accept(
        req.params.uuid,
        actor.auditUserUuid,
      );
      res.json(record);
    } catch (error: any) {
      handleError(res, error, "Failed to accept monthly transaction");
    }
  },

  /** Office review: reject a submitted vessel entry (comment required). */
  async reject(req: Request, res: Response) {
    try {
      const actor = getActor(req);
      if (actor.vesselUser) {
        return res
          .status(403)
          .json({ error: "Rejecting entries is an office action" });
      }
      const parsed = rejectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "A review comment is required",
          details: parsed.error.issues,
        });
      }
      const record = await monthlyTransactionsService.reject(
        req.params.uuid,
        parsed.data.reviewComment,
        actor.auditUserUuid,
      );
      res.json(record);
    } catch (error: any) {
      handleError(res, error, "Failed to reject monthly transaction");
    }
  },
};
