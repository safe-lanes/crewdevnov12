import { Request, Response } from "express";
import { z } from "zod";
import { getActor, getAuditUserUuid } from "./_auth";
import { assertOfficeUser, assertVesselScope } from "../services/vesselScope";
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
    notes: z.string().max(2000).nullable(),
  })
  .partial();

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const moneyStr = z.string().regex(/^-?\d+(\.\d{1,2})?$/);
const rateStr = z.string().regex(/^-?\d+(\.\d{1,4})?$/);

const payItemCreateSchema = z.object({
  payElementUuid: z.string().min(1),
  overrideMode: z.enum([
    "add_element",
    "replace_scale_value",
    "suppress_element",
  ]),
  amount: moneyStr.nullable().optional(),
  rate: rateStr.nullable().optional(),
  paymentTimingOverride: z
    .enum(["paid_on_board", "payable_at_settlement", "remitted_to_fund"])
    .nullable()
    .optional(),
  effectiveFrom: dateStr.nullable().optional(),
  effectiveTo: dateStr.nullable().optional(),
  remarks: z.string().max(2000).nullable().optional(),
});

const payItemUpdateSchema = payItemCreateSchema.partial();

function sendCoded(res: Response, error: any): boolean {
  if (error?.code === "FORBIDDEN") {
    res.status(403).json({ error: error.message });
    return true;
  }
  if (error?.code === "CONFLICT") {
    res.status(409).json({ error: error.message, details: error.details });
    return true;
  }
  if (error?.code === "VALIDATION") {
    res.status(400).json({ error: error.message });
    return true;
  }
  if (error?.code === "NOT_FOUND") {
    res.status(404).json({ error: error.message });
    return true;
  }
  return false;
}

const signOffSchema = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "period must be YYYY-MM"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
});

const timingOverrideSchema = z.object({
  payElementUuid: z.string().min(1),
  paymentTimingOverride: z
    .enum(["paid_on_board", "payable_at_settlement", "remitted_to_fund"])
    .nullable(),
});

export const engagementsController = {
  async list(req: Request, res: Response) {
    try {
      // Contracts are an office-only screen (menu grants exclude Ship
      // roles); enforce the same policy at the API.
      assertOfficeUser(getActor(req), "Contracts list");
      const { vesselUuid, status } = req.query;
      const rows = await engagementsService.list({
        vesselUuid: typeof vesselUuid === "string" ? vesselUuid : undefined,
        status: typeof status === "string" ? status : undefined,
      });
      res.json(rows);
    } catch (error: any) {
      if (sendCoded(res, error)) return;
      console.error("Error listing engagements:", error);
      res.status(500).json({ error: "Failed to list engagements" });
    }
  },

  async detail(req: Request, res: Response) {
    try {
      assertOfficeUser(getActor(req), "Contract detail");
      const detail = await engagementsService.detail(req.params.uuid);
      if (!detail) {
        return res.status(404).json({ error: "Engagement not found" });
      }
      res.json(detail);
    } catch (error: any) {
      if (sendCoded(res, error)) return;
      console.error("Error loading engagement detail:", error);
      res.status(500).json({ error: "Failed to load engagement detail" });
    }
  },

  async createPayItem(req: Request, res: Response) {
    try {
      assertOfficeUser(getActor(req), "Contract pay-item edit");
      const parsed = payItemCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid contract pay item",
          details: parsed.error.issues,
        });
      }
      const row = await engagementsService.createPayItem(
        req.params.uuid,
        parsed.data,
        getAuditUserUuid(req),
      );
      res.status(201).json(row);
    } catch (error: any) {
      if (sendCoded(res, error)) return;
      console.error("Error creating contract pay item:", error);
      res.status(500).json({ error: "Failed to create contract pay item" });
    }
  },

  async updatePayItem(req: Request, res: Response) {
    try {
      assertOfficeUser(getActor(req), "Contract pay-item edit");
      const parsed = payItemUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid contract pay item",
          details: parsed.error.issues,
        });
      }
      const row = await engagementsService.updatePayItem(
        req.params.epeUuid,
        parsed.data,
        getAuditUserUuid(req),
      );
      res.json(row);
    } catch (error: any) {
      if (sendCoded(res, error)) return;
      console.error("Error updating contract pay item:", error);
      res.status(500).json({ error: "Failed to update contract pay item" });
    }
  },

  async deletePayItem(req: Request, res: Response) {
    try {
      assertOfficeUser(getActor(req), "Contract pay-item edit");
      await engagementsService.deletePayItem(
        req.params.epeUuid,
        getAuditUserUuid(req),
      );
      res.status(204).end();
    } catch (error: any) {
      if (sendCoded(res, error)) return;
      console.error("Error deleting contract pay item:", error);
      res.status(500).json({ error: "Failed to delete contract pay item" });
    }
  },

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
      // Ship users may read the review rows, but only for their own vessels.
      assertVesselScope(getActor(req), vesselUuid);
      const rows = await engagementsService.review(vesselUuid, period);
      res.json(rows);
    } catch (error) {
      if (sendCoded(res, error)) return;
      console.error("Error building engagement review:", error);
      res.status(500).json({ error: "Failed to load engagement review" });
    }
  },

  /**
   * On-load auto-create (task #179 part 1): create-only subset of sync,
   * safe for vessel actors on their own vessels.
   */
  async autoCreate(req: Request, res: Response) {
    try {
      const parsed = syncSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid auto-create request",
          details: parsed.error.issues,
        });
      }
      assertVesselScope(getActor(req), parsed.data.vesselUuid);
      const result = await engagementsService.autoCreate(
        parsed.data.vesselUuid,
        parsed.data.period,
        getAuditUserUuid(req),
      );
      res.json(result);
    } catch (error) {
      if (sendCoded(res, error)) return;
      console.error("Error auto-creating engagements:", error);
      res.status(500).json({ error: "Failed to auto-create engagements" });
    }
  },

  /**
   * Vessel-editable sign-off date (task #179 part 4). Vessel-scoped;
   * office users may also use it.
   */
  async setSignOff(req: Request, res: Response) {
    try {
      const parsed = signOffSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid sign-off request",
          details: parsed.error.issues,
        });
      }
      const record = await engagementsService.setSignOffDate(
        req.params.uuid,
        parsed.data.period,
        parsed.data.endDate,
        getActor(req),
      );
      res.json(record);
    } catch (error) {
      if (sendCoded(res, error)) return;
      console.error("Error setting sign-off date:", error);
      res.status(500).json({ error: "Failed to set sign-off date" });
    }
  },

  async setTimingOverride(req: Request, res: Response) {
    try {
      assertOfficeUser(getActor(req), "Contract timing override");
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
      if (sendCoded(res, error)) return;
      if (error.message?.includes("not found")) {
        return res.status(404).json({ error: error.message });
      }
      console.error("Error setting timing override:", error);
      res.status(500).json({ error: "Failed to set timing override" });
    }
  },

  async update(req: Request, res: Response) {
    try {
      // Engagement/contract edits (dates, anchor, scale, status) are
      // office-only, same policy as the Contracts menu grant.
      assertOfficeUser(getActor(req), "Contract update");
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
      if (error?.code === "FORBIDDEN") {
        return res.status(403).json({ error: error.message });
      }
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

  /**
   * Bulk-confirm seniority anchors for a list of engagement UUIDs.
   * PATCH /v2/accounts/engagements/confirm-seniority-anchors
   * Body: { engagementUuids: string[] }
   */
  async confirmSeniorityAnchors(req: Request, res: Response) {
    try {
      assertOfficeUser(getActor(req), "Seniority anchor confirmation");
      const parsed = z
        .object({ engagementUuids: z.array(z.string().min(1)).min(1) })
        .safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "engagementUuids must be a non-empty array of strings",
          details: parsed.error.issues,
        });
      }
      const result = await engagementsService.bulkConfirmSeniorityAnchors(
        parsed.data.engagementUuids,
        getAuditUserUuid(req),
      );
      res.json(result);
    } catch (error: any) {
      if (sendCoded(res, error)) return;
      console.error("Error confirming seniority anchors:", error);
      res.status(500).json({ error: "Failed to confirm seniority anchors" });
    }
  },
};
