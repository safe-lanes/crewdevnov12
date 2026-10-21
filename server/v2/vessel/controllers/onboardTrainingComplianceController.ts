import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { AttachmentAccessError, authorizeAttachmentMenu, authorizeAttachmentSubject } from "../../shared/attachmentAccess";
import { readOnboardAssignments, readOnboardCompliance, onboardDot } from "../../shared/training-compliance/onboard";
import { contractEndDate } from "../../shared/training-compliance/dates";
import { decorateTrainingCompliance } from "./trainingComplianceController";

/** One read-only snapshot, no dates/rank/revision supplied by the browser. */
export async function getOnboardTrainingCompliance(req: Request, res: Response) {
  const parsed = z.string().uuid().safeParse(req.params.vesselUuid);
  if (!parsed.success || Object.keys(req.query ?? {}).length)
    return res.status(400).json({ message: "Choose a vessel and reload its Training Matrix." });
  try {
    await authorizeAttachmentMenu(req, "Crew Database");
    await authorizeAttachmentSubject(req, "Vessel", parsed.data, "vessel");
    const result = await getDb().transaction(async (db: ReturnType<typeof getDb>) => {
      const referenceDate = (await db.execute(sql`SELECT (now() AT TIME ZONE 'UTC')::date::text AS today`)).rows[0].today as string;
      const assignments = await readOnboardAssignments(db, parsed.data);
      const crew = [];
      for (const assignment of assignments) {
        await authorizeAttachmentSubject(req, "Crew Database", assignment.crewUuid);
        const { check, matrix } = await readOnboardCompliance(db, assignment, referenceDate);
        const details = await decorateTrainingCompliance(db, assignment, check, matrix);
        const dots = check.courses.map(course => onboardDot(course, check, referenceDate));
        crew.push({ ...details, referenceKind: "on_board", plannedReliefDate: assignment.plannedReliefDate,
          dots, courses: details.courses.map(course => ({
            ...course, displayStatus: dots.find(dot => dot.courseUuid === course.courseUuid)?.reasons.join("; ") ?? "Incomplete",
          })) });
      }
      const saved = (await db.execute(sql`SELECT revision,revision_data AS data FROM adm_training_matrix_vessel_revisions_v2
        WHERE vessel_id=${parsed.data} AND NOT is_deleted ORDER BY id DESC LIMIT 1`)).rows[0];
      let ids: number[] = [];
      try {
        const parsedIds = JSON.parse(saved?.data as string).applicableTrainingIds;
        if (Array.isArray(parsedIds) && parsedIds.every(id => Number.isSafeInteger(id) && id > 0)) ids = parsedIds;
      } catch { /* Per-crew checks explain the missing/invalid saved matrix. */ }
      const rows = (await db.execute(sql`SELECT c.id AS "companyTrainingId",m.tm_uuid AS "courseUuid",
        c.company_id AS "companyId",c.training_label AS name,
        CASE WHEN nullif(c.group_code,'') IS NULL THEN 'Unassigned'
          ELSE c.group_code||'. '||coalesce(g.label,c.group_code) END AS category
        FROM adm_company_trainings_v2 c JOIN adm_training_master_v2 m ON m.id=c.training_master_id
        LEFT JOIN adm_company_training_groups_v2 g ON g.code=c.group_code AND NOT g.is_deleted
        WHERE c.id=ANY(${sql.param(ids)}::integer[]) AND NOT c.is_deleted AND NOT m.is_deleted
        ORDER BY nullif(c.group_code,'') COLLATE "C" ASC NULLS LAST,coalesce(c.sort_order,0),c.id`)).rows;
      return { referenceDate, twoMonthDate: contractEndDate(referenceDate, 2),
        matrixRevision: saved?.revision ?? null, rows, crew };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.setHeader("Cache-Control", "no-store");
    return res.json(result);
  } catch (error) {
    const status = error instanceof AttachmentAccessError ? error.status : 500;
    return res.status(status).json({ message: status === 403
      ? "You do not have permission to view this vessel's training. Ask your administrator to review your access."
      : status === 404 ? "This vessel is no longer available. Choose a vessel and try again."
      : "The Training Matrix could not load. Retry it; if it fails again, contact your office." });
  }
}
