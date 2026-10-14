import type { Request } from "express";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "../db";
import { resolveCompanyFormPrincipal } from "./trustedPrincipalService";
import { assertCompanyFormPermission } from "./operationalPermissions";
import { CompanyFormPermissionError } from "./errors";
import { humanFormFactReason } from "./checklistGate";

export const outstandingFilters = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  seafarer: z.string().max(200).optional(), rank: z.string().max(200).optional(),
  vessel: z.string().max(200).optional(), stage: z.string().max(100).optional(),
  form: z.string().max(200).optional(), obligation: z.string().max(60).optional(),
  status: z.string().max(100).optional(), assignmentState: z.string().max(60).optional(),
  sinceFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sinceTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).strict();

/** Operational report: never use the caller's vessel filter as authorization. */
export async function outstandingCompanyForms(req: Request) {
  const filters = outstandingFilters.parse(req.query);
  const principal = await resolveCompanyFormPrincipal(req);
  await assertCompanyFormPermission(principal, "view");
  if (principal.kind === "seafarer")
    throw new CompanyFormPermissionError("Outstanding forms reporting is available to permitted office and vessel users.");
  const scope = principal.kind === "vessel"
    ? sql`a.vessel_uuid IN (${sql.join(principal.vesselUuids.map(id => sql`${id}`), sql`,`)})`
    : sql`true`;
  const source = sql`
    WITH eligible_assignments AS (
      SELECT a.assign_uuid,
        CASE WHEN NULLIF(a.sign_off_date,'') IS NOT NULL THEN 'Signed off' ELSE a.assignment_type END AS assignment_type,
        concat_ws(' ',nullif(c.first_name,''),nullif(c.middle_name,''),nullif(c.family_name,'')) AS seafarer,
        CASE WHEN rc.contract_rank_uuid IS NOT NULL THEN coalesce(rc.contract_rank_label,'Not recorded')
          ELSE 'Not recorded' END AS rank,
        coalesce(v.vessel,'Not recorded') AS vessel
      FROM crew_assignments a JOIN crew_members_v2 c ON c.crew_uuid=a.crew_uuid
      LEFT JOIN master_vessels v ON v.vessel_uuid=a.vessel_uuid
      LEFT JOIN crew_assignment_rule_context rc ON rc.assign_uuid=a.assign_uuid
      WHERE NOT a.is_deleted AND a.assignment_type<>'Cancelled' AND ${scope}
    ), report_rows AS (
      SELECT a.seafarer,a.rank,a.vessel,
        CASE r.stage_key WHEN 'before_joining' THEN 'Before joining'
          WHEN 'on_board' THEN 'On board' WHEN 'at_sign_off' THEN 'At sign-off' ELSE 'Other' END AS stage,
        f.name AS form,CASE WHEN r.mandatory THEN 'Mandatory' ELSE 'Optional' END AS obligation,
        r.status,r.created_at AS outstanding_since,a.assignment_type AS assignment_state,
        'requirement' AS row_kind,a.assign_uuid AS subject_ref,r.stage_key,r.requirement_uuid,
        NULL::text AS event_uuid,r.current_submission_uuid AS submission_uuid,r.form_version_uuid,r.unresolved_reason AS reason
      FROM eligible_assignments a JOIN frm_requirements r ON r.subject_ref=a.assign_uuid
        AND r.subject_type='crew_assignment'
      JOIN adm_forms_v2 f ON f.form_uuid=r.form_uuid
      WHERE r.status IN('OUTSTANDING','STARTED','UNRESOLVED')
      UNION ALL
      SELECT a.seafarer,a.rank,a.vessel,
        CASE cy.stage_key WHEN 'before_joining' THEN 'Before joining'
          WHEN 'on_board' THEN 'On board' WHEN 'at_sign_off' THEN 'At sign-off' ELSE 'Other' END,
        'Rules check','Not yet determined',
        CASE WHEN attempt.outcome='FAILED' THEN 'Rules check failed' ELSE 'Rules check pending' END,
        e.recorded_at,a.assignment_type,'check',a.assign_uuid,cy.stage_key,
        NULL::text,e.event_uuid,NULL::text,NULL::text,
        CASE WHEN attempt.outcome='FAILED' THEN 'The recorded rules check failed. Retry it using the original recorded facts.'
          ELSE 'The recorded rules check is pending. Retry it using the original recorded facts.' END
      FROM eligible_assignments a JOIN frm_stage_cycles cy ON cy.subject_ref=a.assign_uuid AND NOT cy.deferred
      JOIN frm_stage_events e ON e.subject_ref=cy.subject_ref AND e.stage_key=cy.stage_key AND e.cycle_uuid=cy.cycle_uuid
      LEFT JOIN LATERAL (SELECT outcome FROM frm_stage_attempts at WHERE at.event_uuid=e.event_uuid
        ORDER BY at.recorded_at DESC,at.attempt_uuid DESC LIMIT 1) attempt ON true
      WHERE coalesce(attempt.outcome,'PENDING') IN('PENDING','FAILED')
      UNION ALL
      SELECT a.seafarer,a.rank,a.vessel,
        CASE failure.stage_key WHEN 'before_joining' THEN 'Before joining'
          WHEN 'on_board' THEN 'On board' WHEN 'at_sign_off' THEN 'At sign-off' ELSE 'Other' END,
        'Rules check','Not yet determined','Rules check failed',failure.recorded_at,
        a.assignment_type,'check',a.assign_uuid,failure.stage_key,NULL::text,failure.audit_uuid,NULL::text,NULL::text,
        'The check could not record its original facts. Open the stage to retry without using changed facts.'
      FROM eligible_assignments a JOIN (
        SELECT DISTINCT ON(subject_ref,stage_key) audit_uuid,subject_ref,stage_key,recorded_at
          FROM frm_stage_audit WHERE event='CAPTURE_FAILED'
          ORDER BY subject_ref,stage_key,recorded_at DESC
      ) failure ON failure.subject_ref=a.assign_uuid
      WHERE NOT EXISTS(SELECT 1 FROM frm_stage_events e WHERE e.subject_ref=a.assign_uuid
        AND e.stage_key=failure.stage_key AND e.recorded_at>=failure.recorded_at)
      AND NOT EXISTS(SELECT 1 FROM frm_stage_audit d WHERE d.subject_ref=a.assign_uuid
        AND d.stage_key=failure.stage_key AND d.event='DEFERRED' AND d.recorded_at>=failure.recorded_at)
    ) SELECT * FROM report_rows`;
  const conditions = [sql`true`];
  for (const [key, column] of Object.entries({
    seafarer: "seafarer", rank: "rank", vessel: "vessel", stage: "stage", form: "form",
    obligation: "obligation", status: "status", assignmentState: "assignment_state",
  })) {
    const value = filters[key as keyof typeof filters];
    if (value) conditions.push(sql`${sql.identifier(column)} ILIKE ${`%${String(value)}%`}`);
  }
  if (filters.sinceFrom) conditions.push(sql`outstanding_since>=${filters.sinceFrom}::date`);
  if (filters.sinceTo) conditions.push(sql`outstanding_since<${filters.sinceTo}::date+interval '1 day'`);
  const predicate = sql.join(conditions, sql` AND `);
  const db = getDb();
  const total = Number((await db.execute(sql`SELECT count(*) AS total FROM(${source}) report WHERE ${predicate}`)).rows[0].total);
  const records = (await db.execute(sql`SELECT * FROM(${source}) report WHERE ${predicate}
    ORDER BY outstanding_since,subject_ref,row_kind,coalesce(requirement_uuid,event_uuid,'')
    LIMIT ${filters.pageSize} OFFSET ${(filters.page - 1) * filters.pageSize}`)).rows;
  return { total, page: filters.page, pageSize: filters.pageSize,
    rows: records.map((r: any) => ({
      seafarer: r.seafarer, rank: r.rank, vessel: r.vessel, stage: r.stage, form: r.form,
      obligation: r.obligation, status: r.status,
      outstandingSince: new Date(r.outstanding_since).toISOString().slice(0, 10),
      assignmentState: r.assignment_state, rowKind: r.row_kind, subjectRef: r.subject_ref,
      stageKey: r.stage_key, requirementUuid: r.requirement_uuid, eventUuid: r.event_uuid,
      submissionUuid: r.submission_uuid, formVersionUuid: r.form_version_uuid,
      reason: r.row_kind === "requirement" ? r.reason ? humanFormFactReason(r.reason) : null : r.reason,
    })) };
}
