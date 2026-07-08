import { Request, Response } from "express";
import { z } from "zod";
import { reportsService } from "../services/reportsService";

const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
const periodSchema = z.string().regex(periodRegex, "period must be YYYY-MM");

const payslipQuerySchema = z
  .object({
    period: periodSchema,
    crewUuid: z.string().min(1).optional(),
    engagementUuid: z.string().min(1).optional(),
  })
  .refine((q) => q.crewUuid || q.engagementUuid, {
    message: "Provide crewUuid or engagementUuid",
  });

const vesselPeriodQuerySchema = z.object({
  vesselUuid: z.string().min(1),
  period: periodSchema,
});

const fleetSummaryQuerySchema = z.object({
  period: periodSchema,
  vesselUuid: z.string().min(1).optional(),
});

function reportErrorStatus(error: unknown): number | null {
  const code = (error as { code?: string })?.code;
  if (code === "VALIDATION") return 400;
  if (code === "NOT_FOUND") return 404;
  return null;
}

function sendReportError(res: Response, error: unknown, fallback: string) {
  const status = reportErrorStatus(error);
  if (status) {
    return res.status(status).json({ error: (error as Error).message });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

export const reportsController = {
  async payslip(req: Request, res: Response) {
    const parsed = payslipQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid payslip request",
        details: parsed.error.issues,
      });
    }
    try {
      const { crewUuid, engagementUuid, period } = parsed.data;
      const payslip = engagementUuid
        ? await reportsService.payslipForEngagement(engagementUuid, period)
        : await reportsService.payslipForCrew(crewUuid!, period);
      res.json(payslip);
    } catch (error) {
      sendReportError(res, error, "Failed to build payslip");
    }
  },

  async payslipBatch(req: Request, res: Response) {
    const parsed = vesselPeriodQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid payslip batch request",
        details: parsed.error.issues,
      });
    }
    try {
      res.json(
        await reportsService.payslipBatch(
          parsed.data.vesselUuid,
          parsed.data.period,
        ),
      );
    } catch (error) {
      sendReportError(res, error, "Failed to build payslips");
    }
  },

  async glExport(req: Request, res: Response) {
    const parsed = vesselPeriodQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid GL export request",
        details: parsed.error.issues,
      });
    }
    try {
      res.json(
        await reportsService.glExport(
          parsed.data.vesselUuid,
          parsed.data.period,
        ),
      );
    } catch (error) {
      sendReportError(res, error, "Failed to build GL export");
    }
  },

  async fleetSummary(req: Request, res: Response) {
    const parsed = fleetSummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid fleet summary request",
        details: parsed.error.issues,
      });
    }
    try {
      res.json(
        await reportsService.fleetSummary(
          parsed.data.period,
          parsed.data.vesselUuid,
        ),
      );
    } catch (error) {
      sendReportError(res, error, "Failed to build fleet summary");
    }
  },
};
