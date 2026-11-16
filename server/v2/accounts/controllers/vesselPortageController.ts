import { Request, Response } from "express";
import { z } from "zod";
import { getActor } from "./_auth";
import { vesselPortageService } from "../services";
import { assertVesselScope } from "../services/vesselScope";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { accMonthlyTransactionsV2 } from "../../../../shared/v2/accounts/schema";
import { EngineReads } from "../engine/engineReads";
import { monthInfo } from "../engine/periodMath";
import { readApplicableWageValues } from "../engine/wageEngineService";
import { protectedTxnUuids } from "../repositories/wageRevisionProtectionRepository";

const returnSchema = z.object({
  comment: z.string().trim().min(1, "A comment is required to return a month"),
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

export const vesselPortageController = {
  async getWageValues(req: Request, res: Response) {
    try {
      const { vesselUuid, period } = req.params;
      const actor = getActor(req);
      assertVesselScope(actor, vesselUuid);
      if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
        return res.status(400).json({ error: "Enter a valid period" });
      }
      const reads = new EngineReads();
      const month = monthInfo(period);
      const engagements = await reads.findEngagementsForVesselPeriod(
        vesselUuid, month.monthStart, month.monthEnd,
      );
      const values = await readApplicableWageValues(period, engagements);
      const txns = await getDb().select().from(accMonthlyTransactionsV2).where(and(
        eq(accMonthlyTransactionsV2.vesselUuid, vesselUuid),
        eq(accMonthlyTransactionsV2.period, period),
        eq(accMonthlyTransactionsV2.isDeleted, false),
      ));
      const protectedIds = await protectedTxnUuids(txns);
      const frozen = await reads.findFrozenSettlements(engagements.map(item => item.engagementUuid));
      res.json({
        values: Object.fromEntries(values),
        protectedTxnUuids: [...protectedIds],
        frozenEngagementUuids: frozen.map(item => item.engagementUuid),
      });
    } catch (error: any) {
      handleError(res, error, "Failed to load applicable wage values");
    }
  },
  async submit(req: Request, res: Response) {
    try {
      const { vesselUuid, period } = req.params;
      const result = await vesselPortageService.submit(
        vesselUuid,
        period,
        getActor(req),
      );
      res.json(result);
    } catch (error: any) {
      handleError(res, error, "Failed to submit month to office");
    }
  },

  async returnToVessel(req: Request, res: Response) {
    try {
      const parsed = returnSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "A comment is required", details: parsed.error.issues });
      }
      const result = await vesselPortageService.returnToVessel(
        req.params.portageUuid,
        parsed.data.comment,
        getActor(req),
      );
      res.json(result);
    } catch (error: any) {
      handleError(res, error, "Failed to return month to vessel");
    }
  },

  async getStatus(req: Request, res: Response) {
    try {
      const { vesselUuid, period } = req.params;
      const actor = getActor(req);
      assertVesselScope(actor, vesselUuid);
      const status = await vesselPortageService.getStatus(vesselUuid, period);
      res.json(status);
    } catch (error: any) {
      handleError(res, error, "Failed to load vessel package status");
    }
  },
};
