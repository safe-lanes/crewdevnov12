import { Router, Request, Response } from "express";
import { z } from "zod";
import { TrainingNeedsRepository } from "./repository";
import { insertTrainingNeedOtherSchema } from "../../../shared/v2/training-needs/schema";

type AuthedRequest = Request & { user?: { uuid?: string | null } };

const router = Router();
const repo = new TrainingNeedsRepository();

const sourcePatchSchema = z.object({
  status: z.string().nullable().optional(),
  targetDate: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
});

router.get("/", async (_req: Request, res: Response) => {
  try {
    const rows = await repo.aggregateAll();
    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Training needs aggregate error:", err);
    res.status(500).json({ error: "Failed to aggregate training needs", message });
  }
});

router.patch("/source/recruitment/:uuid", async (req: AuthedRequest, res: Response) => {
  try {
    const parsed = sourcePatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid", details: parsed.error.flatten() });
    const ok = await repo.patchRecruitment(req.params.uuid, parsed.data, req.user?.uuid ?? null);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Failed", message });
  }
});

router.patch("/source/appraisal/:uuid", async (req: AuthedRequest, res: Response) => {
  try {
    const parsed = sourcePatchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid", details: parsed.error.flatten() });
    const ok = await repo.patchAppraisal(req.params.uuid, parsed.data, req.user?.uuid ?? null);
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
    const ok = await repo.patchPromotion(req.params.uuid, parsed.data, req.user?.uuid ?? null);
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
    const auditUserUuid = req.user?.uuid ?? null;
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
    const auditUserUuid = req.user?.uuid ?? null;
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
