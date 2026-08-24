import type { Request, Response } from "express";
import { z } from "zod";
import { formStructureInputSchema } from "../../../../shared/v2/forms-engine/schema";
import { formStructureService } from "../services";

const paramsSchema = z.object({
  fvUuid: z.string().uuid(),
  partUuid: z.string().uuid(),
});
const versionParamsSchema = z.object({ fvUuid: z.string().uuid() });
const batchStructureSchema = z.object({
  parts: z.array(z.object({
    form_part_uuid: z.string().uuid(),
    structure: formStructureInputSchema,
  })).min(1),
});

function parseParams(req: Request, res: Response): z.infer<typeof paramsSchema> | null {
  const result = paramsSchema.safeParse(req.params);
  if (!result.success) {
    res.status(400).json({ error: "Invalid form version or form part UUID", details: result.error.issues });
    return null;
  }
  return result.data;
}

function handleError(res: Response, error: any, fallback: string): void {
  const statusCode = error?.statusCode;
  if (statusCode === 400 || statusCode === 404 || statusCode === 409) {
    res.status(statusCode).json({ error: error.message });
    return;
  }
  console.error(fallback, error);
  res.status(500).json({ error: fallback });
}

export const formStructureController = {
  async getStructure(req: Request, res: Response) {
    const params = parseParams(req, res);
    if (!params) return;
    try {
      const result = await formStructureService.getStructure(params.fvUuid, params.partUuid);
      res.json(result);
    } catch (error) {
      handleError(res, error, "Failed to fetch form structure");
    }
  },

  async replaceStructure(req: Request, res: Response) {
    const params = parseParams(req, res);
    if (!params) return;

    const { auditUserUuid, ...structureBody } = req.body ?? {};
    const parsed = formStructureInputSchema.safeParse(structureBody);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid form structure", details: parsed.error.issues });
      return;
    }

    try {
      const result = await formStructureService.replaceStructure(
        params.fvUuid,
        params.partUuid,
        parsed.data,
        typeof auditUserUuid === "string" ? auditUserUuid : null,
      );
      res.json(result);
    } catch (error) {
      handleError(res, error, "Failed to save form structure");
    }
  },

  async replaceStructures(req: Request, res: Response) {
    const params = versionParamsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid form version UUID", details: params.error.issues });
      return;
    }
    const { auditUserUuid, ...batchBody } = req.body ?? {};
    const parsed = batchStructureSchema.safeParse(batchBody);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid form structures", details: parsed.error.issues });
      return;
    }
    try {
      const result = await formStructureService.replaceStructures(
        params.data.fvUuid,
        parsed.data.parts.map((part) => ({
          partUuid: part.form_part_uuid,
          structure: part.structure,
        })),
        typeof auditUserUuid === "string" ? auditUserUuid : null,
      );
      res.json(result);
    } catch (error) {
      handleError(res, error, "Failed to save form structures");
    }
  },
};