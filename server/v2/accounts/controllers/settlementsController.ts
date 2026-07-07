import { Request, Response } from "express";
import { z } from "zod";
import { getAuditUserUuid } from "./_auth";
import { settlementsService } from "../services";

const computeSchema = z.object({
  engagementUuid: z.string().min(1),
});

const adjustmentSchema = z.object({
  payElementUuid: z.string().min(1),
  type: z.enum(["earning", "deduction"]),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "amount must be a positive decimal"),
  remarks: z.string().nullish(),
});

const adjustmentPatchSchema = adjustmentSchema.partial();

const submitSchema = z.object({
  approvers: z
    .array(
      z.object({
        approverId: z.string().nullish(),
        approver: z.string().min(1),
      }),
    )
    .min(1),
});

const decisionSchema = z.object({
  decision: z.enum(["Approved", "Rejected"]),
  comments: z.string().nullish(),
});

const markPaidSchema = z.object({
  paidDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "paidDate must be YYYY-MM-DD"),
  paymentReference: z.string().nullish(),
});

function handleError(res: Response, error: any, fallback: string) {
  const code = (error as { code?: string })?.code;
  const details = (error as { details?: unknown })?.details;
  if (code === "CONFLICT") {
    return res.status(409).json({ error: error.message, details });
  }
  if (code === "VALIDATION") {
    return res.status(400).json({ error: error.message, details });
  }
  if (code === "NOT_FOUND") {
    return res.status(404).json({ error: error.message });
  }
  console.error(fallback, error);
  res.status(500).json({ error: fallback });
}

export const settlementsController = {
  async list(_req: Request, res: Response) {
    try {
      res.json(await settlementsService.list());
    } catch (error: any) {
      handleError(res, error, "Failed to load settlements");
    }
  },

  async get(req: Request, res: Response) {
    try {
      res.json(await settlementsService.get(req.params.uuid));
    } catch (error: any) {
      handleError(res, error, "Failed to load settlement");
    }
  },

  async compute(req: Request, res: Response) {
    const parsed = computeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid compute request", details: parsed.error.issues });
    }
    try {
      const detail = await settlementsService.compute(
        parsed.data.engagementUuid,
        getAuditUserUuid(req),
      );
      res.status(201).json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to compute settlement");
    }
  },

  async recompute(req: Request, res: Response) {
    try {
      const existing = await settlementsService.get(req.params.uuid);
      const detail = await settlementsService.compute(
        existing.settlement.engagementUuid,
        getAuditUserUuid(req),
      );
      res.json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to recompute settlement");
    }
  },

  async addAdjustment(req: Request, res: Response) {
    const parsed = adjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid adjustment", details: parsed.error.issues });
    }
    try {
      const detail = await settlementsService.addAdjustment(
        req.params.uuid,
        parsed.data,
        getAuditUserUuid(req),
      );
      res.status(201).json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to add adjustment");
    }
  },

  async updateAdjustment(req: Request, res: Response) {
    const parsed = adjustmentPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid adjustment", details: parsed.error.issues });
    }
    try {
      const detail = await settlementsService.updateAdjustment(
        req.params.adjustmentUuid,
        parsed.data,
        getAuditUserUuid(req),
      );
      res.json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to update adjustment");
    }
  },

  async deleteAdjustment(req: Request, res: Response) {
    try {
      const detail = await settlementsService.deleteAdjustment(
        req.params.adjustmentUuid,
        getAuditUserUuid(req),
      );
      res.json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to delete adjustment");
    }
  },

  async submit(req: Request, res: Response) {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid submission", details: parsed.error.issues });
    }
    try {
      const detail = await settlementsService.submit(
        req.params.uuid,
        parsed.data.approvers,
        getAuditUserUuid(req),
      );
      res.json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to submit settlement");
    }
  },

  async decide(req: Request, res: Response) {
    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid decision", details: parsed.error.issues });
    }
    try {
      const detail = await settlementsService.decide(
        req.params.approvalUuid,
        parsed.data.decision,
        parsed.data.comments ?? null,
        getAuditUserUuid(req),
      );
      res.json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to record decision");
    }
  },

  async markPaid(req: Request, res: Response) {
    const parsed = markPaidSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ error: "Invalid payment details", details: parsed.error.issues });
    }
    try {
      const detail = await settlementsService.markPaid(
        req.params.uuid,
        parsed.data,
        getAuditUserUuid(req),
      );
      res.json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to mark settlement paid");
    }
  },

  async lock(req: Request, res: Response) {
    try {
      const detail = await settlementsService.lock(
        req.params.uuid,
        getAuditUserUuid(req),
      );
      res.json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to lock settlement");
    }
  },

  async revertToDraft(req: Request, res: Response) {
    try {
      const detail = await settlementsService.revertToDraft(
        req.params.uuid,
        getAuditUserUuid(req),
      );
      res.json(detail);
    } catch (error: any) {
      handleError(res, error, "Failed to revert settlement to draft");
    }
  },
};
