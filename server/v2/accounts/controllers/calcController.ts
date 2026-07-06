import { Request, Response } from "express";
import { z } from "zod";
import { getAuditUserUuid } from "./_auth";
import { wageEngineService, ledgerQueries } from "../engine";

const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;

const runSchema = z.object({
  vesselUuid: z.string().min(1),
  period: z.string().regex(periodRegex, "period must be YYYY-MM"),
});

const runEngagementSchema = z.object({
  engagementUuid: z.string().min(1),
  period: z.string().regex(periodRegex, "period must be YYYY-MM"),
});

const adjustmentsSchema = z.object({
  period: z.string().regex(periodRegex, "period must be YYYY-MM"),
  lines: z
    .array(
      z.object({
        adjustsLedgerUuid: z.string().min(1),
        amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "positive amount"),
        payElementUuid: z.string().min(1).optional(),
        remarks: z.string().optional(),
      }),
    )
    .min(1),
});

function engineErrorStatus(error: unknown): number | null {
  const code = (error as { code?: string })?.code;
  if (code === "VALIDATION") return 400;
  if (code === "NOT_FOUND") return 404;
  if (code === "CONFLICT") return 409;
  return null;
}

function sendEngineError(res: Response, error: unknown, fallback: string) {
  const status = engineErrorStatus(error);
  if (status) {
    return res.status(status).json({
      error: (error as Error).message,
      details: (error as { details?: unknown }).details,
    });
  }
  console.error(fallback, error);
  return res.status(500).json({ error: fallback });
}

export const calcController = {
  async run(req: Request, res: Response) {
    const parsed = runSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid run request", details: parsed.error.issues });
    }
    try {
      const summary = await wageEngineService.runForVesselPeriod(
        parsed.data.vesselUuid,
        parsed.data.period,
        getAuditUserUuid(req),
      );
      res.json(summary);
    } catch (error) {
      sendEngineError(res, error, "Failed to run wage calculation");
    }
  },

  async runEngagement(req: Request, res: Response) {
    const parsed = runEngagementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid run request", details: parsed.error.issues });
    }
    try {
      const summary = await wageEngineService.runForEngagement(
        parsed.data.engagementUuid,
        parsed.data.period,
        getAuditUserUuid(req),
      );
      res.json(summary);
    } catch (error) {
      sendEngineError(res, error, "Failed to run wage calculation");
    }
  },

  async createAdjustments(req: Request, res: Response) {
    const parsed = adjustmentsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid adjustments request",
        details: parsed.error.issues,
      });
    }
    try {
      const result = await wageEngineService.createAdjustments(
        parsed.data,
        getAuditUserUuid(req),
      );
      res.status(201).json(result);
    } catch (error) {
      sendEngineError(res, error, "Failed to create adjustments");
    }
  },

  async getLedger(req: Request, res: Response) {
    try {
      const portageUuid =
        typeof req.query.portageUuid === "string" ? req.query.portageUuid : null;
      const engagementUuid =
        typeof req.query.engagementUuid === "string"
          ? req.query.engagementUuid
          : null;
      const period =
        typeof req.query.period === "string" ? req.query.period : null;
      if (portageUuid) {
        return res.json(await ledgerQueries.findLinesByPortage(portageUuid));
      }
      if (engagementUuid && period) {
        if (!periodRegex.test(period)) {
          return res.status(400).json({ error: "period must be YYYY-MM" });
        }
        return res.json(
          await ledgerQueries.findLinesByEngagementPeriod(
            engagementUuid,
            period,
          ),
        );
      }
      return res.status(400).json({
        error:
          "Provide either portageUuid or engagementUuid + period query parameters",
      });
    } catch (error) {
      console.error("Error fetching ledger lines:", error);
      res.status(500).json({ error: "Failed to fetch ledger lines" });
    }
  },
};
