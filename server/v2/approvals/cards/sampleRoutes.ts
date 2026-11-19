/**
 * Routes for the SAMPLE card (only mounted when APPROVAL_ENGINE_SAMPLE_CARD=true).
 * They show the two patterns every real flow follows:
 *
 *   POST /api/v2/approvals/sample              create a record and submit it for approval
 *        → module checks first, then submitForApproval(); NO_WORKFLOW/DISABLED keep the
 *          "legacy" behaviour (here: the record is approved at once, as if no approval existed)
 *   POST /api/v2/approvals/sample/:ref/decide  engine-first decide; legacy path when no request
 *   GET  /api/v2/approvals/sample/:ref         read the record (and its engine status)
 */
import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import {
  approvalErrorStatus,
  decideApproval,
  engineCtx,
  getCrewingEngine,
  pendingRequestFor,
  scopeFor,
  submitForApproval,
} from "../gateway";
import { currentEngineTenantId } from "../tenantProvider";
import { SAMPLE_MODULE_ID, SAMPLE_SCREEN_ID, sampleGetRecord, sampleSaveRecord, type SampleRecord } from "./sampleCard";

const scope = scopeFor(SAMPLE_MODULE_ID, SAMPLE_SCREEN_ID);

function fail(res: Response, err: unknown): void {
  const status = approvalErrorStatus(err) ?? 500;
  res.status(status).json({ error: err instanceof Error ? err.message : String(err) });
}

export function sampleApprovalRoutes(): Router {
  const r = Router();

  r.post("/", async (req: Request, res: Response) => {
    try {
      // 1. The module's own checks run first.
      const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
      if (!title) { res.status(400).json({ error: "title is required" }); return; }
      const vesselUuid = typeof req.body?.vesselUuid === "string" && req.body.vesselUuid.trim() ? req.body.vesselUuid.trim() : null;
      const tenantId = currentEngineTenantId();
      const rec: SampleRecord = {
        ref: randomUUID(), title, vesselUuid, urgent: req.body?.urgent === true,
        status: "draft", decidedBy: null, remarks: null, applyCount: 0,
      };
      sampleSaveRecord(tenantId, rec);

      // 2. Then the engine.
      const outcome = await submitForApproval(req, { scope, subjectRef: rec.ref, subject: { ref: rec.ref }, vesselId: vesselUuid });
      if (outcome.outcome === "STARTED" || outcome.outcome === "ALREADY_PENDING") {
        rec.status = "pending-approval";
      } else {
        // NO_WORKFLOW / DISABLED: behave exactly as the flow did before approvals existed.
        rec.status = "approved";
      }
      res.status(201).json({ record: rec, outcome });
    } catch (err) { fail(res, err); }
  });

  r.get("/:ref", async (req: Request, res: Response) => {
    try {
      const rec = sampleGetRecord(currentEngineTenantId(), req.params.ref);
      if (!rec) { res.status(404).json({ error: "not found" }); return; }
      const engine = getCrewingEngine();
      const requests = engine ? await engine.status(await engineCtx(req), scope, rec.ref) : [];
      res.json({ record: rec, requests });
    } catch (err) { fail(res, err); }
  });

  r.post("/:ref/decide", async (req: Request, res: Response) => {
    try {
      const rec = sampleGetRecord(currentEngineTenantId(), req.params.ref);
      if (!rec) { res.status(404).json({ error: "not found" }); return; }
      const decision = req.body?.decision === "reject" ? "reject" : req.body?.decision === "approve" ? "approve" : null;
      if (!decision) { res.status(400).json({ error: "decision must be approve or reject" }); return; }
      const remarks = typeof req.body?.remarks === "string" ? req.body.remarks : undefined;

      // Engine first: if a request is pending, the engine decides and the card's onDecision
      // applies the final result. The actor comes from the login token, never from the body.
      const pending = await pendingRequestFor(req, scope, rec.ref);
      if (pending) {
        const result = await decideApproval(req, pending.requuid, decision, remarks);
        res.json({ record: sampleGetRecord(currentEngineTenantId(), rec.ref), result });
        return;
      }
      // No engine request: today's behaviour (the sample has none, so it refuses).
      res.status(409).json({ error: "This record is not waiting for approval." });
    } catch (err) { fail(res, err); }
  });

  return r;
}
