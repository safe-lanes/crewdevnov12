import { Router, Request, Response } from "express";
import { z } from "zod";
import { TrainingNeedsRepository } from "./repository";
import { insertTrainingNeedOtherSchema } from "../../../shared/v2/training-needs/schema";
import { complianceSuggestionRoutes } from "./complianceSuggestionController";
import { complianceNeedRows } from "./complianceNeedRows";
import { AttachmentAccessError } from "../shared/attachmentAccess";
import { getActor } from "../accounts/controllers/_auth";
import { resolveAppraisalActor } from "../appraisals/utils/requestActor";

type AuthedRequest = Request & { user?: { uuid?: string | null } };

const router = Router();
router.use("/compliance", complianceSuggestionRoutes);
const repo = new TrainingNeedsRepository();

const sourcePatchSchema = z.object({
  status: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
  correspondingInDb: z.string().nullable().optional(),
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const rows = await repo.aggregateAll();
    res.json([...rows, ...await complianceNeedRows(req)]);
  } catch (err) {
    console.error("Training needs aggregate error:", err);
    const status = err instanceof AttachmentAccessError ? err.status : 500;
    res.status(status).json({ message: status === 403
      ? "You do not have permission to view Training Needs. Ask your administrator to review your access."
      : "Training Needs could not be loaded. Retry; if it fails again, contact your office." });
  }
});

router.patch("/source/recruitment/:uuid", async (req: AuthedRequest, res: Response) => {
  try {
    const parsed = sourcePatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid", details: parsed.error.flatten() });
    const ok = await repo.patchRecruitment(req.params.uuid, parsed.data, req.body?.auditUserUuid ?? null);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed", message });
  }
});

// An appraisal G2 row is Part G, which is office-owned (APD-38): the same
// login and ship rules as the appraisal's own Part G writes.
router.patch("/source/appraisal/:uuid", async (req: AuthedRequest, res: Response) => {
  try {
    const actor = await resolveAppraisalActor(req);
    if (!actor) return res.status(401).json({ error: "Your sign-in could not be verified. Reload the page and try again." });
    if (getActor(req).vesselUser) {
      return res.status(403).json({ error: "Part G is for office use only. Ship users cannot change it." });
    }
    const parsed = sourcePatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid", details: parsed.error.flatten() });
    const ok = await repo.patchAppraisal(req.params.uuid, parsed.data, actor.userUuid);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed", message });
  }
});

router.patch("/source/promotion/:uuid", async (req: AuthedRequest, res: Response) => {
  try {
    const parsed = sourcePatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid", details: parsed.error.flatten() });
    const ok = await repo.patchPromotion(req.params.uuid, parsed.data, req.body?.auditUserUuid ?? null);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed", message });
  }
});

router.post("/others", async (req: AuthedRequest, res: Response) => {
  try {
    const parsed = insertTrainingNeedOtherSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid", details: parsed.error.flatten() });
    const auditUserUuid = req.body?.auditUserUuid ?? null;
    const created = await repo.createOther(parsed.data, auditUserUuid);
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed", message });
  }
});

router.patch("/others/:uuid", async (req: AuthedRequest, res: Response) => {
  try {
    const parsed = insertTrainingNeedOtherSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid", details: parsed.error.flatten() });
    const auditUserUuid = req.body?.auditUserUuid ?? null;
    const updated = await repo.updateOther(req.params.uuid, parsed.data, auditUserUuid);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed", message });
  }
});

router.delete("/others/:uuid", async (req: Request, res: Response) => {
  try {
    const ok = await repo.deleteOther(req.params.uuid);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed", message });
  }
});

export default router;
