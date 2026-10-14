import type { Request, Response } from "express";
import { getDb } from "../../db";
import { getPolicyVersion, readApplicability, writeApplicability } from "../services/applicabilityService";
import { previewApplicability, searchRuleAssignments } from "../services/applicabilityPreviewService";

export const applicabilityController = {
  async assignments(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid version ID" });
      return res.json(await searchRuleAssignments(req, id, String(req.query.search ?? "").slice(0,100)));
    } catch (e: any) { return res.status(e.statusCode ?? 500).json({ error: e.statusCode ? e.message : "Unable to search assignments" }); }
  },
  async preview(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid version ID" });
      return res.json(await previewApplicability(req, id));
    } catch (e: any) { return res.status(e.statusCode ?? 500).json({ error: e.statusCode ? e.message : "Unable to try this rule" }); }
  },
  async read(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid version ID" });
      const version = await getPolicyVersion(id, getDb());
      return res.json(await readApplicability(version.fv_uuid));
    } catch (e: any) { return res.status(e.statusCode ?? 500).json({ error: e.statusCode ? e.message : "Unable to read applicability" }); }
  },
  async write(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid version ID" });
      return res.json(await writeApplicability(id, req.body));
    } catch (e: any) { return res.status(e.statusCode ?? 500).json({ error: e.statusCode ? e.message : "Unable to write applicability" }); }
  },
};
