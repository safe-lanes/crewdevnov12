import { Router, type Request, type Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { requirePermission } from "../../middleware/requirePermission";
import { resolveRequestRole } from "../auth/roleResolutionService";
import { getAuditUserUuid } from "../accounts/controllers/_auth";
import { AttachmentAccessError, authorizeAttachmentSubject } from "../shared/attachmentAccess";
import { readCanonicalReliever } from "../shared/training-compliance/reader";
import { reconcileAssignmentSuggestions } from "./complianceSuggestions";
import { decideTrainingSuggestion } from "./complianceSuggestionActions";

const ids = z.object({ planUuid: z.string().uuid(), assignUuid: z.string().uuid() });
async function canCreate(req: Request): Promise<boolean> {
  const role = await resolveRequestRole(req);
  if (!role.ok) return false;
  const result = (await getDb().execute(sql`SELECT g.cancreate FROM adm_roleaccess_ac g
    JOIN adm_menumaster_ac m ON m.muid=g.menu_id
    WHERE g.role_id=${role.role.roleId} AND lower(btrim(m.name))='training'
      AND m.is_active AND NOT m.is_deleted AND NOT g.is_deleted`)).rows;
  return result.length === 1 && result[0].cancreate === true;
}
function failed(res: Response, error: unknown) {
  const status = error instanceof AttachmentAccessError ? error.status
    : typeof (error as any)?.status === "number" ? (error as any).status : 500;
  if (status === 500) console.error("[TrainingSuggestions] Request failed", error);
  return res.status(status).json({ message: status === 403
    ? "You do not have permission to manage this seafarer's training suggestions. Ask your administrator to review your access."
    : status === 404 ? "This training suggestion or linked assignment is no longer available. Reload Planning."
    : status === 500 ? "Training suggestions could not be updated. Retry; if it fails again, contact your office."
    : (error as Error).message });
}
export async function checkTrainingSuggestions(req: Request, res: Response) {
  const parsed = ids.safeParse(req.params);
  if (!parsed.success || !z.object({}).strict().safeParse(req.body).success || Object.keys(req.query).length)
    return res.status(400).json({ message: "Reload Planning and check the linked reliever again. Do not supply training facts or an audit identity." });
  try {
    const canonical = await readCanonicalReliever(getDb(), {
      planUuid: parsed.data.planUuid, assignmentUuid: parsed.data.assignUuid });
    if (!canonical) throw new AttachmentAccessError(404);
    await authorizeAttachmentSubject(req, "Vessel", canonical.vesselUuid, "vessel");
    await authorizeAttachmentSubject(req, "Crew Database", canonical.crewUuid);
    const suggestions = await reconcileAssignmentSuggestions({
      planUuid: parsed.data.planUuid, assignmentUuid: parsed.data.assignUuid });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ suggestions, canCreate: await canCreate(req) });
  } catch (error) { return failed(res, error); }
}
export const complianceSuggestionRoutes = Router();
for (const action of ["confirm", "dismiss"] as const) {
  complianceSuggestionRoutes.post(`/:uuid/${action}`, requirePermission("Training", "create"),
    async (req: Request, res: Response) => {
      const body = (action === "confirm" ? z.object({}).strict()
        : z.object({ reason: z.string().trim().min(1).max(4000) }).strict()).safeParse(req.body);
      if (!z.string().uuid().safeParse(req.params.uuid).success || !body.success || Object.keys(req.query).length)
        return res.status(400).json({ message: action === "dismiss"
          ? "Provide only a written reason for dismissing the suggestion."
          : "Confirm without supplying an audit identity or other values." });
      try {
        const actor = getAuditUserUuid(req);
        if (!actor) return res.status(401).json({ message: "Sign in again before changing training suggestions." });
        const saved = await getDb().transaction(async (tx: any) => {
          const row = (await tx.execute(sql`SELECT * FROM training_compliance_suggestions
            WHERE suggestion_uuid=${req.params.uuid}`)).rows[0];
          if (!row) throw new AttachmentAccessError(404);
          await authorizeAttachmentSubject(req, "Vessel", row.vessel_uuid, "vessel");
          await authorizeAttachmentSubject(req, "Crew Database", row.crew_uuid);
          const current = await readCanonicalReliever(tx, { planUuid: row.plan_uuid, assignmentUuid: row.assign_uuid });
          const plan = (await tx.execute(sql`SELECT relief_status,is_deleted,is_archived
            FROM vessel_planning_v2 WHERE plan_uuid=${row.plan_uuid}`)).rows[0];
          if (!current || !plan || plan.is_deleted || plan.is_archived || plan.relief_status === "Deferred")
            throw Object.assign(new Error("This relief is no longer active. Reload Planning to see its current status."), { status: 409 });
          // Re-read authoritative facts before accepting a suggestion. This
          // closes a newly corrected gap or withdraws a changed lifecycle first.
          await reconcileAssignmentSuggestions({ planUuid: row.plan_uuid, assignmentUuid: row.assign_uuid }, tx);
          return decideTrainingSuggestion(tx, req.params.uuid, action, actor,
            "reason" in body.data && typeof body.data.reason === "string" ? body.data.reason : undefined);
        });
        return res.json(saved);
      } catch (error) { return failed(res, error); }
    });
}
complianceSuggestionRoutes.get("/:uuid/history", requirePermission("Training", "view"),
  async (req, res) => {
    try {
      if (!z.string().uuid().safeParse(req.params.uuid).success) throw new AttachmentAccessError(404);
      const row = (await getDb().execute(sql`SELECT * FROM training_compliance_suggestions
        WHERE suggestion_uuid=${req.params.uuid}`)).rows[0];
      if (!row) throw new AttachmentAccessError(404);
      await authorizeAttachmentSubject(req, "Vessel", row.vessel_uuid, "vessel");
      await authorizeAttachmentSubject(req, "Crew Database", row.crew_uuid);
      return res.json((await getDb().execute(sql`SELECT * FROM training_compliance_suggestion_history
        WHERE suggestion_uuid=${req.params.uuid} ORDER BY id`)).rows);
    } catch (error) { return failed(res, error); }
  });
