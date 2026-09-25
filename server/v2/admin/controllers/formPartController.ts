import type { Request, Response } from "express";
import { z } from "zod";
import { FormPartError, formPartService } from "../services/formPartService";

const versionParams = z.object({ fvUuid: z.string().uuid() });
const partParams = versionParams.extend({ partUuid: z.string().uuid() });
const createBody = z.object({
  part_code: z.string().trim().min(1).max(30).regex(/^[A-Za-z][A-Za-z0-9_-]*$/),
  part_title: z.string().trim().min(1).max(500),
  is_office_only: z.boolean().default(false),
}).strict();
const renameBody = z.object({ part_title: z.string().trim().min(1).max(500) }).strict();
const reorderBody = z.object({ part_uuids: z.array(z.string().uuid()) }).strict();

function respond(res: Response, error: unknown) {
  if (error instanceof FormPartError) {
    res.status(error.statusCode).json({ error: error.message });
  } else {
    console.error("Form part edit failed", error);
    res.status(500).json({ error: "Failed to edit form part" });
  }
}

function actor(req: Request): number | null {
  const id = req.user?.id;
  return Number.isSafeInteger(id) && id! > 0 ? id! : null;
}

export const formPartController = {
  async create(req: Request, res: Response) {
    const params = versionParams.safeParse(req.params);
    // Legacy callers may submit an audit field; it never controls the stamp.
    const { auditUserUuid: _ignored, ...payload } = req.body ?? {};
    const body = createBody.safeParse(payload);
    if (!params.success || !body.success) return res.status(400).json({ error: "Invalid part request" });
    const id = actor(req);
    if (id === null) return res.status(403).json({ error: "Authenticated identity required" });
    try {
      res.status(201).json(await formPartService.create(params.data.fvUuid, body.data, id));
    } catch (error) { respond(res, error); }
  },
  async rename(req: Request, res: Response) {
    const params = partParams.safeParse(req.params);
    const { auditUserUuid: _ignored, ...payload } = req.body ?? {};
    const body = renameBody.safeParse(payload);
    if (!params.success || !body.success) return res.status(400).json({ error: "Invalid part request" });
    const id = actor(req);
    if (id === null) return res.status(403).json({ error: "Authenticated identity required" });
    try {
      res.json(await formPartService.rename(params.data.fvUuid, params.data.partUuid, body.data.part_title, id));
    } catch (error) { respond(res, error); }
  },
  async reorder(req: Request, res: Response) {
    const params = versionParams.safeParse(req.params);
    const { auditUserUuid: _ignored, ...payload } = req.body ?? {};
    const body = reorderBody.safeParse(payload);
    if (!params.success || !body.success) return res.status(400).json({ error: "Invalid part request" });
    const id = actor(req);
    if (id === null) return res.status(403).json({ error: "Authenticated identity required" });
    try {
      res.json(await formPartService.reorder(params.data.fvUuid, body.data.part_uuids, id));
    } catch (error) { respond(res, error); }
  },
  async remove(req: Request, res: Response) {
    const params = partParams.safeParse(req.params);
    if (!params.success) return res.status(400).json({ error: "Invalid part request" });
    const id = actor(req);
    if (id === null) return res.status(403).json({ error: "Authenticated identity required" });
    try {
      res.json(await formPartService.remove(params.data.fvUuid, params.data.partUuid, id));
    } catch (error) { respond(res, error); }
  },
};