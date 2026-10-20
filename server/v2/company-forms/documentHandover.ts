import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { archivedFile } from "./documentArchive";
import { CompanyFormConflictError, CompanyFormPermissionError } from "./errors";

export async function handoversFor(db: any, submissions: string[]) {
  if (!submissions.length) return [];
  return (await db.execute(sql`SELECT submission_uuid AS "submissionUuid",actor_name AS "actorName",
    recorded_at AS "recordedAt",file_sha256 AS "fileSha256"
    FROM frm_document_handovers WHERE submission_uuid IN (${sql.join(submissions.map(id => sql`${id}`), sql`, `)})
    ORDER BY recorded_at,handover_uuid`)).rows as any[];
}
export async function recordHandover(req: Request, submissionUuid: string, fingerprint: string) {
  const { authorizeCopy } = await import("./documentCopyService");
  const context = await authorizeCopy(req, submissionUuid, true);
  await getDb().transaction(async (tx: any) => {
    await tx.execute(sql`SELECT assign_uuid FROM crew_assignments WHERE assign_uuid=${context.subject.subjectRef} FOR UPDATE`);
    const row = (await tx.execute(sql`SELECT status FROM frm_company_submissions WHERE submission_uuid=${submissionUuid} FOR UPDATE`)).rows[0];
    if (row?.status !== "completed") throw new CompanyFormConflictError("A copy can be handed over only for a completed, non-voided form.");
    // Re-evaluate Fill in under the subject lock rather than trusting a UI flag.
    const locked = await context.adapter.lockForStart(context.subject.subjectRef, tx);
    if (!locked || !await context.adapter.authorize(context.principal, "edit_draft", locked.context, tx)) {
      throw new CompanyFormPermissionError("Company Forms Fill in is required on this assignment.");
    }
    const file = await archivedFile(tx, submissionUuid);
    if (!file || file.file_sha256 !== fingerprint) throw new CompanyFormConflictError(
      "The selected copy no longer matches the stored file. Refresh the form and use its current stored copy.");
    const users = (await tx.execute(sql`SELECT user_uuid,fullname,firstname,lastname,display_name
      FROM master_users WHERE id=${context.principal.userId}`)).rows;
    const user = users[0];
    const name = user?.fullname?.trim() || user?.display_name?.trim() ||
      [user?.firstname, user?.lastname].filter(Boolean).join(" ").trim();
    if (!name) throw new CompanyFormConflictError("Your recorded name is unavailable. Ask the office to update your user record, then try again.");
    await tx.execute(sql`INSERT INTO frm_document_handovers
      (handover_uuid,submission_uuid,file_uuid,file_sha256,actor_uuid,actor_name,actor_role_uuid)
      VALUES(${randomUUID()},${submissionUuid},${file.file_uuid},${file.file_sha256},
        ${user.user_uuid ?? String(context.principal.userId)},${name},
        ${context.principal.kind === "seafarer" ? null : context.principal.roleId})`);
  });
  return handoversFor(getDb(), [submissionUuid]);
}
