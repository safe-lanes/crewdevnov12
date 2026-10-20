import { randomUUID } from "node:crypto";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "../../db";

type Connection = ReturnType<typeof getDb>;
export type EquivalentLink = { requiredCourseUuid: string; acceptedCourseUuid: string };
type Master = { courseUuid: string; name: string; code: string };
type Requirement = { companyTrainingId: number; courseUuid: string; name: string };
type PolicySource = { kind: "draft" | "revision" | "none"; uuid: string | null; revision: string | null };
export class MatrixPolicyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function matrixRows<T>(db: Connection, query: SQL): Promise<T[]> {
  return (await db.execute(query)).rows as T[];
}
export async function withMatrixLock<T>(vesselId: string, work: (tx: Connection) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx: Connection) => {
    const vessel = await matrixRows(tx, sql`SELECT vessel_uuid FROM master_vessels
      WHERE vessel_uuid=${vesselId} AND NOT is_deleted FOR UPDATE`);
    if (vessel.length !== 1) throw new MatrixPolicyError(404, "This vessel is unavailable or ambiguous. Select an active vessel and try again.");
    return work(tx);
  });
}
async function catalogue(db: Connection) {
  const courses = await matrixRows<Master>(db, sql`SELECT tm_uuid AS "courseUuid",
    training_name AS name,training_id AS code FROM adm_training_master_v2
    WHERE NOT is_deleted ORDER BY training_name,tm_uuid`);
  const requirements = await matrixRows<Requirement>(db, sql`SELECT c.id AS "companyTrainingId",
    m.tm_uuid AS "courseUuid",m.training_name AS name FROM adm_company_trainings_v2 c
    JOIN adm_training_master_v2 m ON m.id=c.training_master_id
    WHERE NOT c.is_deleted AND NOT m.is_deleted ORDER BY c.sort_order,c.id`);
  return { courses, requirements };
}
export async function readMatrixEquivalents(vesselId: string, revisionUuid?: string, db = getDb()) {
  const vessels = await matrixRows(db, sql`SELECT vessel_uuid FROM master_vessels
    WHERE vessel_uuid=${vesselId} AND NOT is_deleted`);
  if (vessels.length !== 1) throw new MatrixPolicyError(404, "This vessel is unavailable or ambiguous.");
  const revisions = await matrixRows<{ uuid: string; revision: string }>(db, sql`
    SELECT tmvr_uuid AS uuid,revision FROM adm_training_matrix_vessel_revisions_v2
    WHERE vessel_id=${vesselId} AND NOT is_deleted ORDER BY id DESC`);
  const drafts = await matrixRows<{ uuid: string; revision: string }>(db, sql`
    SELECT tmvd_uuid AS uuid,revision FROM adm_training_matrix_vessel_drafts_v2
    WHERE vessel_id=${vesselId} AND NOT is_deleted ORDER BY updated_at DESC,id DESC LIMIT 1`);
  let source: PolicySource;
  if (revisionUuid) {
    const chosen = revisions.find(r => r.uuid === revisionUuid);
    if (!chosen) throw new MatrixPolicyError(404, "That matrix revision is unavailable for this vessel.");
    source = { kind: "revision", ...chosen };
  } else if (drafts[0]) source = { kind: "draft", ...drafts[0] };
  else if (revisions[0]) source = { kind: "revision", ...revisions[0] };
  else source = { kind: "none", uuid: null, revision: null };
  const links = await matrixRows<EquivalentLink>(db, sql`SELECT
    required_course_uuid AS "requiredCourseUuid",accepted_course_uuid AS "acceptedCourseUuid"
    FROM adm_training_matrix_equivalents_v2 WHERE vessel_uuid=${vesselId}
      AND (${source.kind === "draft"} AND draft_uuid=${source.uuid}
        OR ${source.kind === "revision"} AND revision_uuid=${source.uuid})
    ORDER BY required_course_uuid,accepted_course_uuid`);
  return { vesselId, source, latestRevisionUuid: revisions[0]?.uuid ?? null,
    links, ...await catalogue(db), revisions };
}

function validateLinks(links: EquivalentLink[], courses: Master[], requirements: Requirement[]) {
  const masters = new Map(courses.map(c => [c.courseUuid, c]));
  const required = new Set(requirements.map(r => r.courseUuid));
  const pairs = new Set<string>();
  for (const link of links) {
    if (!required.has(link.requiredCourseUuid) || !masters.has(link.acceptedCourseUuid))
      throw new MatrixPolicyError(400, "Choose existing, active master courses. A selected course is missing, deleted or not a company requirement.");
    if (link.requiredCourseUuid === link.acceptedCourseUuid)
      throw new MatrixPolicyError(400, "A course cannot be its own accepted alternative.");
    const pair = `${link.requiredCourseUuid}:${link.acceptedCourseUuid}`;
    if (pairs.has(pair)) throw new MatrixPolicyError(400, "An accepted alternative is listed twice. Remove the duplicate.");
    pairs.add(pair);
  }
  return masters;
}
async function insertLinks(db: Connection, vesselId: string, scope: { draftUuid?: string; revisionUuid?: string },
  links: EquivalentLink[], masters: Map<string, Master>, actor: string) {
  for (const link of links) await db.execute(sql`INSERT INTO adm_training_matrix_equivalents_v2
    (link_uuid,vessel_uuid,draft_uuid,revision_uuid,required_course_uuid,accepted_course_uuid,
      required_course_label,accepted_course_label,recorded_by)
    VALUES (${randomUUID()},${vesselId},${scope.draftUuid ?? null},${scope.revisionUuid ?? null},
      ${link.requiredCourseUuid},${link.acceptedCourseUuid},${masters.get(link.requiredCourseUuid)!.name},
      ${masters.get(link.acceptedCourseUuid)!.name},${actor})`);
}
async function event(db: Connection, vesselId: string, actor: string, kind: string,
  scope: { draftUuid?: string; revisionUuid?: string }, before: EquivalentLink[], after: EquivalentLink[]) {
  await db.execute(sql`INSERT INTO adm_training_matrix_equivalent_events_v2
    (event_uuid,vessel_uuid,draft_uuid,revision_uuid,event,actor_id,before_value,after_value)
    VALUES (${randomUUID()},${vesselId},${scope.draftUuid ?? null},${scope.revisionUuid ?? null},
      ${kind},${actor},${JSON.stringify(before)}::jsonb,${JSON.stringify(after)}::jsonb)`);
}
export async function nextMatrixRevision(db: Connection, vesselId: string) {
  const [row] = await matrixRows<{ next: number }>(db, sql`SELECT
    coalesce(max(substring(revision FROM '^R([0-9]+)$')::int),-1)+1 AS next
    FROM adm_training_matrix_vessel_revisions_v2 WHERE vessel_id=${vesselId} AND NOT is_deleted`);
  return `R${row.next}`;
}
export async function writeMatrixEquivalents(vesselId: string, input: {
  links: EquivalentLink[]; expectedDraftUuid: string | null; expectedRevisionUuid: string | null;
  draftData?: { applicableTrainingIds: number[] };
}, actor: string) {
  if (!actor) throw new MatrixPolicyError(401, "Sign in before changing the matrix.");
  return withMatrixLock(vesselId, async db => {
    const current = await readMatrixEquivalents(vesselId, undefined, db);
    const draftUuid = current.source.kind === "draft" ? current.source.uuid : null;
    if (input.expectedDraftUuid !== draftUuid || input.expectedRevisionUuid !== current.latestRevisionUuid)
      throw new MatrixPolicyError(409, "The matrix changed while you were editing. Reload it before saving again.");
    const masters = validateLinks(input.links, current.courses, current.requirements);
    let target = draftUuid;
    if (!target) {
      target = randomUUID();
      const latest = await matrixRows<{ data: string }>(db, sql`SELECT revision_data AS data
        FROM adm_training_matrix_vessel_revisions_v2 WHERE tmvr_uuid=${current.latestRevisionUuid}`);
      await db.execute(sql`INSERT INTO adm_training_matrix_vessel_drafts_v2
        (tmvd_uuid,vessel_id,revision,draft_data,created_by_uuid,updated_by_uuid)
        VALUES (${target},${vesselId},${await nextMatrixRevision(db, vesselId)},
          ${latest[0]?.data ?? '{"applicableTrainingIds":[]}'},${actor},${actor})`);
    }
    await db.execute(sql`DELETE FROM adm_training_matrix_equivalents_v2 WHERE draft_uuid=${target}`);
    await insertLinks(db, vesselId, { draftUuid: target }, input.links, masters, actor);
    await db.execute(sql`UPDATE adm_training_matrix_vessel_drafts_v2 SET updated_at=now(),
      updated_by_uuid=${actor} WHERE tmvd_uuid=${target}`);
    if (input.draftData) await db.execute(sql`UPDATE adm_training_matrix_vessel_drafts_v2
      SET draft_data=${JSON.stringify(input.draftData)} WHERE tmvd_uuid=${target}`);
    await event(db, vesselId, actor, "draft_saved", { draftUuid: target }, current.links, input.links);
    return readMatrixEquivalents(vesselId, undefined, db);
  });
}

/** Called inside the revision publisher's vessel-locked transaction. */
export async function freezeMatrixEquivalents(db: Connection, vesselId: string, revisionUuid: string, actor: string) {
  if (!actor) throw new MatrixPolicyError(401, "Sign in before publishing the matrix.");
  const draft = await matrixRows<{ uuid: string }>(db, sql`SELECT tmvd_uuid AS uuid
    FROM adm_training_matrix_vessel_drafts_v2 WHERE vessel_id=${vesselId} AND NOT is_deleted
    ORDER BY updated_at DESC,id DESC LIMIT 1`);
  const previous = await matrixRows<{ uuid: string }>(db, sql`SELECT tmvr_uuid AS uuid
    FROM adm_training_matrix_vessel_revisions_v2 WHERE vessel_id=${vesselId} AND NOT is_deleted
      AND tmvr_uuid<>${revisionUuid} ORDER BY id DESC LIMIT 1`);
  const links = await matrixRows<EquivalentLink>(db, sql`SELECT
    required_course_uuid AS "requiredCourseUuid",accepted_course_uuid AS "acceptedCourseUuid"
    FROM adm_training_matrix_equivalents_v2 WHERE vessel_uuid=${vesselId}
      AND (${!!draft[0]} AND draft_uuid=${draft[0]?.uuid ?? null}
        OR ${!draft[0]} AND revision_uuid=${previous[0]?.uuid ?? null})
    ORDER BY required_course_uuid,accepted_course_uuid`);
  const { courses, requirements } = await catalogue(db);
  const masters = validateLinks(links, courses, requirements);
  await insertLinks(db, vesselId, { revisionUuid }, links, masters, actor);
  await event(db, vesselId, actor, "revision_frozen", { revisionUuid }, [], links);
}

/** A normal matrix Save Draft must inherit, not silently discard, alternatives. */
export async function inheritMatrixEquivalents(db: Connection, vesselId: string, draftUuid: string, actor: string) {
  if (!actor) throw new MatrixPolicyError(401, "Sign in before saving the matrix.");
  const [latest] = await matrixRows<{ uuid: string }>(db, sql`SELECT tmvr_uuid AS uuid
    FROM adm_training_matrix_vessel_revisions_v2 WHERE vessel_id=${vesselId} AND NOT is_deleted
    ORDER BY id DESC LIMIT 1`);
  const originals = await matrixRows<{ link_uuid: string } & EquivalentLink>(db, sql`SELECT link_uuid,
    required_course_uuid AS "requiredCourseUuid",accepted_course_uuid AS "acceptedCourseUuid"
    FROM adm_training_matrix_equivalents_v2 WHERE revision_uuid=${latest?.uuid ?? null}`);
  for (const link of originals) await db.execute(sql`INSERT INTO adm_training_matrix_equivalents_v2
    (link_uuid,vessel_uuid,draft_uuid,required_course_uuid,accepted_course_uuid,
      required_course_label,accepted_course_label,recorded_by)
    SELECT ${randomUUID()},vessel_uuid,${draftUuid},required_course_uuid,accepted_course_uuid,
      required_course_label,accepted_course_label,${actor}
    FROM adm_training_matrix_equivalents_v2 WHERE link_uuid=${link.link_uuid}`);
  await event(db, vesselId, actor, "draft_saved", { draftUuid }, [], originals.map(
    ({ requiredCourseUuid, acceptedCourseUuid }) => ({ requiredCourseUuid, acceptedCourseUuid })));
}
