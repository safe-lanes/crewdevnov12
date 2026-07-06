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
  })
  .partial();

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
    } catch (error) {
      console.error("Error updating engagement:", error);
      res.status(500).json({ error: "Failed to update engagement" });
    }
  },
};
