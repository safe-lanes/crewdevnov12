import type { Request, Response } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../../db";
import { AttachmentAccessError, authorizeAttachmentMenu, authorizeAttachmentSubject } from "../../shared/attachmentAccess";
import { readCanonicalReliever, readSavedTrainingMatrix, readTrainingCertificates } from "../../shared/training-compliance/reader";
import { readRelieverTrainingCompliance } from "../../shared/training-compliance/service";

const ids = z.object({ planUuid: z.string().uuid(), assignUuid: z.string().uuid() });

/** Read-only operational display. No browser-supplied facts/revision or enforcement. */
export async function getRelieverTrainingCompliance(req: Request, res: Response) {
  const parsed = ids.safeParse(req.params);
  if (!parsed.success || Object.keys(req.query ?? {}).length) {
    return res.status(400).json({ message: "Reload Planning and choose a linked reliever to check his training." });
  }
  try {
    await authorizeAttachmentMenu(req, "Vessel");
    await authorizeAttachmentMenu(req, "Crew Database");
    const request = { planUuid: parsed.data.planUuid, assignmentUuid: parsed.data.assignUuid };
    const result = await getDb().transaction(async (db: ReturnType<typeof getDb>) => {
      const canonical = await readCanonicalReliever(db, request);
      if (!canonical) throw new AttachmentAccessError(404);
      await authorizeAttachmentSubject(req, "Vessel", canonical.vesselUuid, "vessel");
      await authorizeAttachmentSubject(req, "Crew Database", canonical.crewUuid);
      const check = await readRelieverTrainingCompliance(db, request);
      const { matrix } = await readSavedTrainingMatrix(db, canonical);
      const certificates = await readTrainingCertificates(db, canonical.crewUuid);
      const context = (await db.execute(sql`SELECT
        c.crew_uuid AS "crewUuid",
        btrim(concat_ws(' ',nullif(c.first_name,''),nullif(c.middle_name,''),nullif(c.family_name,''))) AS "crewName",
        CASE WHEN x.contract_rank_uuid IS NULL THEN 'Not recorded'
          ELSE coalesce(nullif(x.contract_rank_label,''),'Not recorded') END AS "contractRankLabel",
        v.vessel AS "vesselName"
        FROM crew_assignments a JOIN crew_members_v2 c ON c.crew_uuid=a.crew_uuid
        JOIN master_vessels v ON v.vessel_uuid=a.vessel_uuid
        LEFT JOIN crew_assignment_rule_context x ON x.assign_uuid=a.assign_uuid
        WHERE a.assign_uuid=${canonical.assignmentUuid}`)).rows[0];
      const attachments = (await db.execute(sql`SELECT t.att_uuid AS uuid,t.train_uuid AS "certificateUuid",
        coalesce(nullif(t.file_name,''),'Training certificate') AS "fileName"
        FROM crew_training_attachments t JOIN crew_training_courses c ON c.train_uuid=t.train_uuid
        WHERE c.crew_uuid=${canonical.crewUuid} AND NOT coalesce(c.is_deleted,false)
          AND NOT coalesce(t.is_deleted,false) ORDER BY t.att_uuid`)).rows as {
          uuid: string; certificateUuid: string; fileName: string }[];
      return { ...check, context, courses: check.courses.map(course => {
        const accepted = new Set(matrix?.equivalents.filter(l => l.requiredCourseUuid === course.courseUuid)
          .map(l => l.acceptedCourseUuid));
        return { ...course, certificates: certificates.filter(c => c.courseUuid
          && (c.courseUuid === course.courseUuid || accepted.has(c.courseUuid))).map(c => {
            const flags = course.issues.filter(i => i.certificateUuid === c.certificateUuid);
            const selected = c.certificateUuid === course.chosenCertificate?.certificateUuid;
            return { certificate: c, isEquivalent: c.courseUuid !== course.courseUuid, selected,
              disposition: selected ? "selected" : flags.some(i => i.code === "INVALID_CERTIFICATE_DATES")
                ? "invalid_expiry" : course.futureIssuedCertificateUuids.includes(c.certificateUuid)
                  ? "future_issued" : "not_selected",
              flags: flags.map(i => i.message),
              attachments: attachments.filter(a => a.certificateUuid === c.certificateUuid)
                .map(a => ({ uuid: a.uuid, fileName: a.fileName,
                  url: `/api/v2/crew-pool/training/attachments/${encodeURIComponent(a.uuid)}/raw` })) };
          }) };
      }) };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
    res.setHeader("Cache-Control", "no-store");
    return res.json(result);
  } catch (error) {
    const status = error instanceof AttachmentAccessError ? error.status : 500;
    return res.status(status).json({ message: status === 403
      ? "You do not have permission to view this reliever's training. Ask your administrator to review your access."
      : status === 404 ? "This linked reliever is no longer available. Reload Planning and try again."
      : "The training check could not load. Retry it; if it fails again, contact your office." });
  }
}
