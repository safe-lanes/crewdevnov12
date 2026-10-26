import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { AttachmentAccessError, authorizeAttachmentMenu, authorizeAttachmentSubject } from "../../shared/attachmentAccess";

export async function getTrainingChecklistHistory(req: Request, res: Response) {
  if (!z.string().uuid().safeParse(req.params.planUuid).success)
    return res.status(400).json({ message: "Reload the linked Planning record to see its accepted checklist history." });
  try {
    await authorizeAttachmentMenu(req, "Vessel");
    await authorizeAttachmentMenu(req, "Crew Database");
    const rows = await getDb().transaction(async (tx: any) => {
      const plan = (await tx.execute(sql`SELECT vessel_uuid,reliever_crew_uuid FROM vessel_planning_v2
        WHERE plan_uuid=${req.params.planUuid} AND NOT is_deleted`)).rows[0];
      if (!plan) throw new AttachmentAccessError(404);
      await authorizeAttachmentSubject(req, "Vessel", plan.vessel_uuid, "vessel");
      if (!plan.reliever_crew_uuid) return [];
      await authorizeAttachmentSubject(req, "Crew Database", plan.reliever_crew_uuid);
      // History only for this exact reliever, not earlier occupants of this plan.
      return (await tx.execute(sql`SELECT s.snapshot_uuid AS "snapshotUuid",s.recorded_at AS "recordedAt",
        s.actor,s.evidence,s.evidence_sha256 AS fingerprint FROM training_checklist_snapshots s
        JOIN vessel_planning_v2 p ON p.plan_uuid=s.plan_uuid AND p.reliever_assign_uuid=s.assignment_uuid
        WHERE s.plan_uuid=${req.params.planUuid} ORDER BY s.recorded_at DESC`)).rows;
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.setHeader("Cache-Control", "no-store");
    return res.json(rows);
  } catch (error) {
    const status = error instanceof AttachmentAccessError ? error.status : 500;
    return res.status(status).json({ message: status === 403
      ? "You do not have permission to view this checklist history. Ask the office to review your access."
      : "The accepted checklist history could not load. Reload Planning and retry." });
  }
}
