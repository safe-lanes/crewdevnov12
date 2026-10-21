import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import type { CheckIssue, TrainingCertificate, TrainingMatrix, TrainingRequirement } from "./types";

type Connection = ReturnType<typeof getDb>;
async function rows<T>(db: Connection, query: ReturnType<typeof sql>): Promise<T[]> {
  return (await db.execute(query)).rows as T[];
}
export type RelieverCheckRequest = { planUuid: string; assignmentUuid: string; matrixRevisionUuid?: string };
export type CanonicalReliever = {
  assignmentUuid: string; crewUuid: string; vesselUuid: string; contractRankUuid: string | null;
  plannedJoiningDate: string | null; contractRangeEndMonths: number | null; rankRowId: number | null;
};
export async function readCanonicalReliever(db: Connection, request: RelieverCheckRequest) {
  const result = await rows<CanonicalReliever>(db, sql`SELECT
    a.assign_uuid AS "assignmentUuid",a.crew_uuid AS "crewUuid",a.vessel_uuid AS "vesselUuid",
    c.contract_rank_uuid AS "contractRankUuid",r.id AS "rankRowId",
    p.reliever_sign_on_date AS "plannedJoiningDate",
    p.reliever_contract_end_range_end_months AS "contractRangeEndMonths"
    FROM vessel_planning_v2 p
    JOIN crew_assignments a ON a.assign_uuid=p.reliever_assign_uuid
      AND a.crew_uuid=p.reliever_crew_uuid AND a.vessel_uuid=p.vessel_uuid AND NOT a.is_deleted
      AND a.assignment_type IN ('Planned','OnBoard')
    JOIN crew_members_v2 crew ON crew.crew_uuid=a.crew_uuid AND NOT crew.is_deleted
    JOIN master_vessels v ON v.vessel_uuid=a.vessel_uuid AND NOT v.is_deleted
    LEFT JOIN crew_assignment_rule_context c ON c.assign_uuid=a.assign_uuid
    LEFT JOIN adm_available_ranks_v2 r ON r.ar_uuid=c.contract_rank_uuid AND NOT r.is_deleted
    WHERE p.plan_uuid=${request.planUuid} AND p.reliever_assign_uuid=${request.assignmentUuid}
      AND NOT p.is_deleted`);
  return result.length === 1 ? result[0] : null;
}

export async function readSavedTrainingMatrix(db: Connection, canonical: CanonicalReliever,
  requestedUuid?: string): Promise<{ matrix: TrainingMatrix | null; issues: CheckIssue[] }> {
  const [saved] = await rows<{ uuid: string; revision: string; data: string }>(db, sql`SELECT
    tmvr_uuid AS uuid,revision,revision_data AS data FROM adm_training_matrix_vessel_revisions_v2
    WHERE vessel_id=${canonical.vesselUuid} AND NOT is_deleted
      ${requestedUuid === undefined ? sql`` : sql`AND tmvr_uuid=${requestedUuid}`}
    ORDER BY id DESC LIMIT 1`);
  if (!saved) return { matrix: null, issues: [] };
  let ids: number[];
  try {
    const parsed = JSON.parse(saved.data);
    if (!Array.isArray(parsed.applicableTrainingIds)
      || parsed.applicableTrainingIds.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) < 1))
      throw Error("Invalid saved applicability");
    ids = [...new Set<number>(parsed.applicableTrainingIds)];
  } catch {
    return { matrix: null, issues: [{ code: "INVALID_MATRIX",
      message: "The saved training matrix cannot be read. Ask the office to correct it, then retry the check." }] };
  }
  const issues: CheckIssue[] = [];
  // Matrix rank cells use the available-rank numeric row ID, not its R001-style
  // parent code. Resolve that row ONLY through the captured ar_uuid.
  const requirements = await rows<{ id: number; courseUuid: string | null; name: string;
    companyDeleted: boolean; masterDeleted: boolean | null; status: string | null }>(db, sql`SELECT
    c.id,m.tm_uuid AS "courseUuid",c.training_label AS name,
    c.is_deleted AS "companyDeleted",m.is_deleted AS "masterDeleted",r.status
    FROM adm_company_trainings_v2 c
    LEFT JOIN adm_training_master_v2 m ON m.id=c.training_master_id
    LEFT JOIN adm_company_training_requirements_v2 r ON r.company_training_id=c.id
      AND r.rank_id=${canonical.rankRowId} AND NOT r.is_deleted
    WHERE c.id=ANY(${sql.param(ids)}::integer[]) ORDER BY c.id`);
  if (ids.some(id => !requirements.some(r => r.id === id))
    || requirements.some(r => !r.courseUuid || r.companyDeleted || r.masterDeleted))
    issues.push({ code: "MATRIX_COURSE_UNAVAILABLE",
      message: "A course in this saved matrix is missing or archived. Ask the office to review the matrix and retry." });
  const byCourse = new Map<string, TrainingRequirement>();
  for (const row of requirements) {
    if (!row.status) continue; // A deliberately empty rank cell is not a requirement.
    if (!["M", "R"].includes(row.status)) {
      issues.push({ code: "INVALID_REQUIREMENT", message: "A training requirement has an unknown Mandatory or Recommended value. Ask the office to correct it." });
      continue;
    }
    if (!row.courseUuid) continue;
    const previous = byCourse.get(row.courseUuid);
    byCourse.set(row.courseUuid, { courseUuid: row.courseUuid, name: row.name,
      obligation: row.status === "M" || previous?.obligation === "mandatory" ? "mandatory" : "recommended" });
  }
  const equivalents = await rows<{ requiredCourseUuid: string; acceptedCourseUuid: string }>(db, sql`SELECT
    required_course_uuid AS "requiredCourseUuid",accepted_course_uuid AS "acceptedCourseUuid"
    FROM adm_training_matrix_equivalents_v2 WHERE vessel_uuid=${canonical.vesselUuid}
      AND revision_uuid=${saved.uuid} ORDER BY required_course_uuid,accepted_course_uuid`);
  return { matrix: { revisionUuid: saved.uuid, revision: saved.revision,
    requirements: [...byCourse.values()], equivalents }, issues };
}

export async function readTrainingCertificates(db: Connection, crewUuid: string): Promise<TrainingCertificate[]> {
  const masters = await rows<{ uuid: string; code: string; name: string; certificateExpires: boolean }>(db, sql`SELECT
    tm_uuid AS uuid,training_id AS code,training_name AS name,certificate_expires AS "certificateExpires"
    FROM adm_training_master_v2`);
  const company = await rows<{ id: number; uuid: string; code: string; masterUuid: string }>(db, sql`SELECT
    c.id,c.ct_uuid AS uuid,c.company_id AS code,m.tm_uuid AS "masterUuid"
    FROM adm_company_trainings_v2 c JOIN adm_training_master_v2 m ON m.id=c.training_master_id`);
  const aliases = new Map<string, Set<string>>();
  const add = (alias: string | null, uuid: string) => {
    if (!alias) return;
    const values = aliases.get(alias) ?? new Set<string>();
    values.add(uuid); aliases.set(alias, values);
  };
  for (const m of masters) { add(m.uuid, m.uuid); add(m.code, m.uuid); }
  for (const c of company) for (const alias of [String(c.id), c.uuid, c.code]) add(alias, c.masterUuid);
  const certificates = await rows<{ certificateUuid: string; reference: string | null; name: string | null;
    number: string | null; issued: string | null; expiry: string | null }>(db, sql`SELECT
    train_uuid AS "certificateUuid",course_id AS reference,training_course AS name,
    certificate_no AS number,issued,expiry FROM crew_training_courses
    WHERE crew_uuid=${crewUuid} AND NOT is_deleted ORDER BY train_uuid`);
  return certificates.map(c => {
    const matches = c.reference ? aliases.get(c.reference) : undefined;
    const courseUuid = matches?.size === 1 ? [...matches][0] : null;
    return { certificateUuid: c.certificateUuid, courseUuid,
      name: c.name || masters.find(m => m.uuid === courseUuid)?.name || "Unlinked training certificate",
      number: c.number, issued: c.issued, expiry: c.expiry,
      certificateExpires: masters.find(m => m.uuid === courseUuid)?.certificateExpires !== false };
  });
}
