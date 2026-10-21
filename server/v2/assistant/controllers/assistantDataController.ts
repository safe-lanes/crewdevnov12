import type { Request, Response } from "express";
import { execute, manifestFor } from "../services/assistantDataService";

export class AssistantDataController {
  manifest(req: Request, res: Response) {
    const r = manifestFor(req);
    res.setHeader("Cache-Control", "no-store");
    return res.status(r.status).json(r.body);
  }

  async execute(req: Request, res: Response) {
    res.setHeader("Cache-Control", "no-store");
    try {
      const r = await execute(req);
      return res.status(r.status).json(r.body);
    } catch (error) {
      console.error("[AssistantDataController] execute failed:", error);
      return res.status(200).json({ ok: false, code: "failed", error: "The data could not be read — no result." });
    }
  }
}
