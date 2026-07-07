import { Request, Response } from "express";
import { z } from "zod";
import { getAuditUserUuid } from "./_auth";
import { engagementsService } from "../services";

const syncSchema = z.object({
  vesselUuid: z.string().min(1),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "period must be YYYY-MM"),
});

const updateSchema = z
  .object({
    scaleYearAtStart: z.number().int().min(1),
    nextStepDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    wageScaleUuid: z.string().min(1),
    status: z.enum(["draft", "active", "completed", "settled", "cancelled"]),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
  })
  .partial();

const timingOverrideSchema = z.object({
  payElementUuid: z.string().min(1),
  paymentTimingOverride: z
    .enum(["paid_on_board", "payable_at_settlement", "remitted_to_fund"])
    .nullable(),
});

export const engagementsController = {
  async sync(req: Request, res: Response) {
    try {
      const parsed = syncSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid sync request", details: parsed.error.issues });
      }
      const result = await engagementsService.sync(
        parsed.data.vesselUuid,
        parsed.data.period,
        getAuditUserUuid(req),
      );
      res.json(result);
    } catch (error) {
      console.error("Error syncing engagements:", error);
      res.status(500).json({ error: "Failed to sync engagements" });
    }
  },

  async review(req: Request, res: Response) {
    try {
      const { vesselUuid, period } = req.query;
      if (
        typeof vesselUuid !== "string" ||
        typeof period !== "string" ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)
      ) {
        return res
          .status(400)
          .json({ error: "vesselUuid and period (YYYY-MM) are required" });
      }
      const rows = await engagementsService.review(vesselUuid, period);
      res.json(rows);
    } catch (error) {
      console.error("Error building engagement review:", error);
      res.status(500).json({ error: "Failed to load engagement review" });
    }
  },

  async setTimingOverride(req: Request, res: Response) {
    try {
      const parsed = timingOverrideSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid timing override",
          details: parsed.error.issues,
        });
      }
      const row = await engagementsService.setTimingOverride(
        req.params.uuid,
        parsed.data.payElementUuid,
        parsed.data.paymentTimingOverride,
        getAuditUserUuid(req),
      );
      res.json({ override: row ?? null });
    } catch (error: any) {
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error setting timing override:", error);
      res.status(500).json({ error: "Failed to set timing override" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid engagement data",
          details: parsed.error.issues,
        });
      }
      const record = await engagementsService.update(req.params.uuid, {
        ...parsed.data,
        auditUserUuid: getAuditUserUuid(req),
      });
      if (!record) {
        return res.status(404).json({ error: "Engagement not found" });
      }
      res.json(record);
    } catch (error: any) {
      if (error?.code === "CONFLICT") {
        return res
          .status(409)
          .json({ error: error.message, details: error.details });
      }
      console.error("Error updating engagement:", error);
      res.status(500).json({ error: "Failed to update engagement" });
    }
  },

  async overlapAudit(_req: Request, res: Response) {
    try {
      res.json(await engagementsService.overlapAudit());
    } catch (error) {
      console.error("Error running engagement overlap audit:", error);
      res.status(500).json({ error: "Failed to run engagement overlap audit" });
    }
  },
};
