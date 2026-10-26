import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { archivedFile } from "./documentArchive";
import { CompanyFormConflictError, CompanyFormPermissionError } from "./errors";

export async function handoversFor(db: any, submissions: string[]) {
  if (!submissions.length) return [];
  return (await db.execute(sql`SELECT submission_uuid AS "submissionUuid",actor_name AS "actorName",
    recorded_at AS "recordedAt",file_sha256 AS "fileSha256",'original' AS "copyKind",true AS "currentNotice"
    FROM frm_document_handovers WHERE submission_uuid IN (${sql.join(submissions.map(id => sql`${id}`), sql`, `)})
    UNION ALL
    SELECT h.submission_uuid,h.actor_name,h.recorded_at,h.file_sha256,'void_notice',
      n.revision=(SELECT max(revision) FROM frm_document_void_notices WHERE submission_uuid=h.submission_uuid)
    FROM frm_document_void_handovers h JOIN frm_document_void_files f USING(file_uuid)
      JOIN frm_document_void_notices n USING(notice_uuid)
    WHERE h.submission_uuid IN (${sql.join(submissions.map(id => sql`${id}`), sql`, `)})
    ORDER BY "recordedAt"`)).rows as any[];
}
export async function recordHandover(req: Request, submissionUuid: string, fingerprint: string, voidNotice = false) {
  const { authorizeCopy, lockedCopy } = await import("./documentCopyService");
  const context = await authorizeCopy(req, submissionUuid, true);
  await getDb().transaction(async (tx: any) => {
    await tx.execute(sql`SELECT assign_uuid FROM crew_assignments WHERE assign_uuid=${context.subject.subjectRef} FOR UPDATE`);
    const row = (await tx.execute(sql`SELECT status FROM frm_company_submissions WHERE submission_uuid=${submissionUuid} FOR UPDATE`)).rows[0];
    if (row?.status !== (voidNotice ? "voided" : "completed")) throw new CompanyFormConflictError(
      voidNotice ? "Void this form before recording its void-notice handover." : "This form is void. Record the void-notice handover instead.");
    // Re-evaluate Fill in under the subject lock rather than trusting a UI flag.
    const locked = await context.adapter.lockForStart(context.subject.subjectRef, tx);
    if (!locked || !await context.adapter.authorize(context.principal, "edit_draft", locked.context, tx)) {
      throw new CompanyFormPermissionError("Company Forms Fill in is required on this assignment.");
    }
    const file = voidNotice ? await lockedCopy(tx, context.subject.subjectRef, submissionUuid) : await archivedFile(tx, submissionUuid);
    if (!file || file.file_sha256 !== fingerprint) throw new CompanyFormConflictError(
      "The selected copy no longer matches the stored file. Refresh the form and use its current stored copy.");
    const users = (await tx.execute(sql`SELECT user_uuid,fullname,firstname,lastname,display_name
      FROM master_users WHERE id=${context.principal.userId}`)).rows;
    const user = users[0];
    const name = user?.fullname?.trim() || user?.display_name?.trim() ||
      [user?.firstname, user?.lastname].filter(Boolean).join(" ").trim();
    if (!name) throw new CompanyFormConflictError("Your recorded name is unavailable. Ask the office to update your user record, then try again.");
    const table = voidNotice ? sql`frm_document_void_handovers` : sql`frm_document_handovers`;
    await tx.execute(sql`INSERT INTO ${table}
      (handover_uuid,submission_uuid,file_uuid,file_sha256,actor_uuid,actor_name,actor_role_uuid)
      VALUES(${randomUUID()},${submissionUuid},${file.file_uuid},${file.file_sha256},
        ${user.user_uuid ?? String(context.principal.userId)},${name},
        ${context.principal.kind === "seafarer" ? null : context.principal.roleId})`);
  });
  return handoversFor(getDb(), [submissionUuid]);
}
