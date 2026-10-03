import type { Request, Response } from "express";
import { z } from "zod";
import { completeNonDeletionRequest, executeDeletionRequest, listPrivacyRequestAudit, listPrivacyRequests, transitionPrivacyRequest } from "./privacyRequestService";

const explanation = { reason: z.string().trim().min(10).max(2000), requesterMessage: z.string().trim().min(3).max(1000) };
const reasonSchema = z.object(explanation).strict();
const executeSchema = z.object({ erpOutcome: z.enum(["deleted", "retained", "not_applicable"]), ...explanation, evidenceReference: z.string().trim().min(3).max(500) }).strict();
const completeSchema = z.object({ outcome: z.enum(["completed", "partially_completed"]), ...explanation, evidenceReference: z.string().trim().min(3).max(500) }).strict();
const actor = (req: Request) => ({ uuid: String(req.user?.userUuid ?? req.user?.id ?? ""), correlationId: req.requestId ?? "privacy-action" });
function fail(res: Response, error: any) { const status = Number(error?.status) || 500; res.status(status).json({ error: status >= 500 ? "privacy_operation_failed" : String(error?.message || "privacy_operation_failed") }); }

export async function listOfficePrivacyRequests(_req: Request, res: Response) { try { res.setHeader("Cache-Control", "no-store"); res.json(await listPrivacyRequests()); } catch (error) { fail(res, error); } }
export async function privacyRequestAudit(req: Request, res: Response) { try { res.setHeader("Cache-Control", "no-store"); res.json(await listPrivacyRequestAudit(req.params.requestUuid)); } catch (error) { fail(res, error); } }
export const privacyTransition = (action: "verify" | "approve" | "reject" | "legal_hold") => async (req: Request, res: Response) => {
  const parsed = reasonSchema.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() }); return; }
  try { res.json(await transitionPrivacyRequest(req.params.requestUuid, actor(req), action, parsed.data.reason, parsed.data.requesterMessage)); } catch (error) { fail(res, error); }
};
export async function executePrivacyDeletion(req: Request, res: Response) {
  const parsed = executeSchema.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() }); return; }
  try { res.json(await executeDeletionRequest(req.params.requestUuid, actor(req), parsed.data)); } catch (error) { fail(res, error); }
}
export async function completePrivacyRequest(req: Request, res: Response) {
  const parsed = completeSchema.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() }); return; }
  try { res.json(await completeNonDeletionRequest(req.params.requestUuid, actor(req), parsed.data)); } catch (error) { fail(res, error); }
}
