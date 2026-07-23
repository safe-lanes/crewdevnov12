import { Request, Response } from "express";
import { z } from "zod";
import { getActor, getAuditUserUuid } from "./_auth";
import { assertOfficeUser } from "../services/vesselScope";
import { portageService } from "../services";

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

function handleError(res: Response, error: any, fallback: string) {
  const code = (error as { code?: string })?.code;
  if (code === "FORBIDDEN") return res.status(403).json({ error: error.message });
  if (code === "CONFLICT") return res.status(409).json({ error: error.message });
  if (code === "VALIDATION") return res.status(400).json({ error: error.message });
  if (code === "NOT_FOUND" || error.message?.includes("not found")) {
    return res.status(404).json({ error: error.message });
  }
  console.error(fallback, error);
  res.status(500).json({ error: fallback });
}

export const portageController = {
  async getWorkspace(req: Request, res: Response) {
    try {
      const { vesselUuid, period } = req.query;
      if (typeof vesselUuid !== "string" || typeof period !== "string") {
        return res
          .status(400)
          .json({ error: "vesselUuid and period are required" });
      }
      const workspace = await portageService.getWorkspace(vesselUuid, period);
      res.json(workspace);
    } catch (error: any) {
      handleError(res, error, "Failed to load portage workspace");
    }
  },

  async submit(req: Request, res: Response) {
    try {
      const parsed = submitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid submission", details: parsed.error.issues });
      }
      const result = await portageService.submit(
        req.params.uuid,
        parsed.data.approvers,
        getAuditUserUuid(req),
      );
      res.json(result);
    } catch (error: any) {
      handleError(res, error, "Failed to submit portage bill");
    }
  },

  async decide(req: Request, res: Response) {
    try {
      const parsed = decisionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Invalid decision", details: parsed.error.issues });
      }
      const actor = getActor(req);
      assertOfficeUser(actor, "Approval decision");
      const result = await portageService.decide(
        req.params.approvalUuid,
        parsed.data.decision,
        parsed.data.comments ?? null,
        actor.auditUserUuid,
        actor.auditUserUuid ?? null,
      );
      res.json(result);
    } catch (error: any) {
      handleError(res, error, "Failed to record approval decision");
    }
  },
};
