import { Router, type Request, type Response } from "express";
import { ZodError } from "zod";
import { getReport } from "./registry";
import { registerAllReports } from "./handlers";
import { reportRunRequestSchema, type ReportRunResponse } from "./types";

registerAllReports();

const router = Router();

router.post("/run", async (req: Request, res: Response) => {
  let parsed;
  try {
    parsed = reportRunRequestSchema.parse(req.body ?? {});
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: "invalid_request",
        message: "Invalid report run request",
        details: err.flatten(),
      });
    }
    throw err;
  }

  const handler = getReport(parsed.reportId);
  if (!handler) {
    return res.status(404).json({
      error: "report_not_found",
      message: `No report registered for id "${parsed.reportId}"`,
    });
  }

  let filters;
  try {
    filters = handler.filterSchema.parse(parsed.filters ?? {});
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        error: "invalid_filters",
        message: `Invalid filters for report "${parsed.reportId}"`,
        details: err.flatten(),
      });
    }
    throw err;
  }

  try {
    const { rows, total } = await handler.run(filters, {
      page: parsed.page,
      pageSize: parsed.pageSize,
      sort: parsed.sort ?? null,
    });

    const response: ReportRunResponse = {
      reportId: handler.reportId,
      title: handler.title,
      columns: handler.columns,
      rows,
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
    return res.json(response);
  } catch (err: any) {
    console.error(`[reports] handler "${parsed.reportId}" failed:`, err);
    return res.status(500).json({
      error: "report_failed",
      message: err?.message ?? "Failed to run report",
    });
  }
});

export default router;
