import { Request, Response } from "express";
import { getAuditUserUuid } from "./_auth";
import { monthlyTransactionsService } from "../services";
import { insertAccMonthlyTransactionV2Schema } from "../../../../shared/v2/accounts/types";

const createSchema = insertAccMonthlyTransactionV2Schema.omit({ txnUuid: true });
const updateSchema = insertAccMonthlyTransactionV2Schema
  .partial()
  .omit({ txnUuid: true });

function handleError(res: Response, error: any, fallback: string) {
  if ((error as { code?: string })?.code === "CONFLICT") {
    return res.status(409).json({ error: error.message });
  }
  if (error.message?.includes("not found")) {
    return res.status(404).json({ error: error.message });
  }
  console.error(fallback, error);
  res.status(500).json({ error: fallback });
}

export const monthlyTransactionsController = {
  async getAll(req: Request, res: Response) {
    try {
      const { vesselUuid, period, crewUuid, engagementUuid, status } = req.query;
      const records = await monthlyTransactionsService.getAll({
        vesselUuid: vesselUuid as string | undefined,
        period: period as string | undefined,
        crewUuid: crewUuid as string | undefined,
        engagementUuid: engagementUuid as string | undefined,
        status: status as string | undefined,
      });
      res.json(records);
    } catch (error) {
      console.error("Error fetching monthly transactions:", error);
      res.status(500).json({ error: "Failed to fetch monthly transactions" });
    }
  },

  async getByUuid(req: Request, res: Response) {
    try {
      const record = await monthlyTransactionsService.getByUuid(req.params.uuid);
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
      const record = await monthlyTransactionsService.create({
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
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
      const record = await monthlyTransactionsService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      res.json(record);
    } catch (error: any) {
      handleError(res, error, "Failed to update monthly transaction");
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await monthlyTransactionsService.delete(req.params.uuid);
      res.status(204).send();
    } catch (error: any) {
      handleError(res, error, "Failed to delete monthly transaction");
    }
  },
};
