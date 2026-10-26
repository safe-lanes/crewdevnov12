import type { Request } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { attachmentGuard, AttachmentAccessError, authorizeAttachmentSubject } from "./attachmentAccess";
import { resolveRequestRole } from "../auth/roleResolutionService";

export const standardSignatureParents = {
  briefings: { table: "crew_briefing_submissions", key: "briefing_submission_uuid", menu: "Crew Database", candidate: false },
  debriefings: { table: "crew_debriefing_submissions", key: "debriefing_submission_uuid", menu: "Crew Database", candidate: false },
  interviews: { table: "crew_interview_submissions", key: "interview_submission_uuid", menu: "Recruitment", candidate: true },
} as const;
export type SignatureFamily = keyof typeof standardSignatureParents;

async function authorizeParent(req: Request, family: SignatureFamily, row: any) {
  const config = standardSignatureParents[family];
  await authorizeAttachmentSubject(req, config.menu, String(row.subject), config.candidate ? "candidate" : "crew");
  const role = await resolveRequestRole(req);
  if (!role.ok) throw new AttachmentAccessError(403);
  if (family === "briefings" && ["ship", "vessel"].includes(role.role.roleType.trim().toLowerCase())) {
    if (!row.vessel_uuid) throw new AttachmentAccessError(403);
    await authorizeAttachmentSubject(req, config.menu, row.vessel_uuid, "vessel");
  }
}

export async function authorizeStandardSignature(req: Request, family: SignatureFamily, attUuid: string) {
  const config = standardSignatureParents[family];
  const subject = sql.raw(config.candidate ? "p.rec_can_uuid" : "p.crew_uuid");
  const rows = (await getDb().execute(sql`SELECT ${subject} AS subject,
    ${family === "briefings" ? sql`p.vessel_uuid` : sql`NULL`} AS vessel_uuid
    FROM frm_signature_attachments a
    JOIN frm_section_signatures sig ON sig.signature_att_uuid=a.sig_att_uuid
    JOIN frm_section_states st ON st.section_state_uuid=sig.section_state_uuid
    JOIN ${sql.raw(config.table)} p ON p.${sql.raw(config.key)}=st.submission_uuid
    WHERE a.sig_att_uuid=${attUuid} AND NOT coalesce(a.is_deleted,false)
      AND NOT coalesce(sig.is_deleted,false) AND NOT coalesce(st.is_deleted,false)
      AND NOT coalesce(p.is_deleted,false)`)).rows;
  if (rows.length !== 1) throw new AttachmentAccessError(404);
  await authorizeParent(req, family, rows[0]);
}

export function standardSignatureAccess(family: SignatureFamily) {
  return attachmentGuard(async req => {
    if (!["GET", "HEAD"].includes(req.method)) return;
    const raw = req.path.match(/^\/signatures\/([^/]+)\/raw\/?$/i);
    if (raw) { await authorizeStandardSignature(req, family, decodeURIComponent(raw[1])); return; }
    // Detail responses also expose signature attachment metadata.
    const detail = req.path.match(/^\/submissions\/([^/]+)\/?$/i);
    if (detail) {
      const config = standardSignatureParents[family];
      const rows = (await getDb().execute(sql`SELECT
        ${sql.raw(config.candidate ? "rec_can_uuid" : "crew_uuid")} AS subject,
        ${family === "briefings" ? sql`vessel_uuid` : sql`NULL`} AS vessel_uuid
        FROM ${sql.raw(config.table)} WHERE ${sql.raw(config.key)}=${decodeURIComponent(detail[1])}
        AND NOT coalesce(is_deleted,false)`)).rows;
      if (rows.length !== 1) throw new AttachmentAccessError(404);
      await authorizeParent(req, family, rows[0]);
    }
  });
}
