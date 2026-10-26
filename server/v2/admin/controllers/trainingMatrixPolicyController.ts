import type { Request, Response } from "express";
import { z } from "zod";
import { getAuditUserUuid } from "../../accounts/controllers/_auth";
import { MatrixPolicyError, readMatrixEquivalents, writeMatrixEquivalents } from "../services/trainingMatrixEquivalents";

const linkSchema = z.object({
  requiredCourseUuid: z.string().uuid(), acceptedCourseUuid: z.string().uuid(),
}).strict();
const writeSchema = z.object({
  links: z.array(linkSchema).max(2000),
  expectedDraftUuid: z.string().uuid().nullable(),
  expectedRevisionUuid: z.string().uuid().nullable(),
  draftData: z.object({ applicableTrainingIds: z.array(z.number().int().positive()).max(2000) }).strict().optional(),
}).strict();
const matrixData = z.union([z.string(), z.array(z.any()), z.record(z.any())]);
const drafts = z.object({ vesselId: z.string().min(1), revision: z.string().optional(), draftData: matrixData }).strict();
const revisions = z.object({ vesselId: z.string().min(1), revision: z.string().optional(),
  revisionDate: z.string().min(1), revisionData: matrixData }).strict();
export function matrixActor(req: Request): string {
  const actor = getAuditUserUuid(req);
  if (!actor) throw new MatrixPolicyError(401, "Sign in again before saving this matrix.");
  return actor;
}
export function matrixWriteData(req: Request, kind: "draft" | "revision", partial = false): any {
  matrixActor(req);
  const schema = kind === "draft" ? drafts : revisions;
  const value = (partial ? schema.partial() : schema).parse(req.body);
  const key = kind === "draft" ? "draftData" : "revisionData";
  const data = (value as any)[key];
  if (data !== undefined) {
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      if (!parsed || typeof parsed !== "object") throw Error();
      (value as any)[key] = typeof data === "string" ? data : JSON.stringify(data);
    } catch { throw new MatrixPolicyError(400, "The matrix data could not be read. Reload the matrix and try again."); }
  }
  return { ...value, auditUserUuid: matrixActor(req) };
}
export function sendMatrixPolicyError(error: unknown, res: Response): boolean {
  if (error instanceof MatrixPolicyError) { res.status(error.status).json({ message: error.message }); return true; }
  if (error instanceof z.ZodError) {
    res.status(400).json({ message: "The matrix request contains missing or unsupported values. Reload and try again. Audit identity is set by the server, not the browser." });
    return true;
  }
  return false;
}
export const trainingMatrixPolicyController = {
  async read(req: Request, res: Response) {
    try {
      const revision = req.query.revisionUuid;
      if (revision !== undefined && typeof revision !== "string") throw new MatrixPolicyError(400, "Choose one matrix revision.");
      res.json(await readMatrixEquivalents(req.params.vesselId, revision));
    } catch (error) {
      if (sendMatrixPolicyError(error, res)) return;
      console.error("Unable to read training alternatives:", error);
      res.status(500).json({ message: "The accepted courses could not be loaded. Please try again." });
    }
  },
  async write(req: Request, res: Response) {
    try {
      res.json(await writeMatrixEquivalents(req.params.vesselId, writeSchema.parse(req.body), matrixActor(req)));
    } catch (error) {
      if (sendMatrixPolicyError(error, res)) return;
      console.error("Unable to save training alternatives:", error);
      res.status(500).json({ message: "The accepted courses could not be saved. Reload the matrix and try again." });
    }
  },
};
