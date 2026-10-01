import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "crypto";
import type { Server } from "http";
import companyFormSubmissionsRoutes from "@server/v2/company-forms/routes";

const TEST_SECRET = "company-form-races-test-secret";
const SUFFIX = randomUUID().replaceAll("-", "").slice(0, 12);
const uuid = () => randomUUID();
const db = new Client({ connectionString: process.env.DATABASE_URL });
let server: Server;
let userId = 0;
let roleUuid = "";
let assignmentUuid = "";
let cancelRaceAssignmentUuid = "";
let archiveRaceAssignmentUuid = "";
let completedRaceAssignmentUuid = "";
let submittedRaceAssignmentUuid = "";
let crewUuid = "";
let formUuid = "";
let versionUuid = "";
let partUuid = "";
let sectionUuid = "";
let questionUuid = "";
const submissionUuids: string[] = [];
const previousJwtSecret = process.env.JWT_SECRET;
const previousAuthBypass = process.env.AUTH_BYPASS;

function bearer(user: number): string {
  return jwt.sign(
    { id: user, domain: "test", userType: "Office" },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

function api(method: "get" | "post" | "put", path: string, body?: unknown) {
  let query = (request(server) as any)[method](path)
    .set("Authorization", `Bearer ${bearer(userId)}`);
  if (body !== undefined) query = query.send(body);
  return query;
}

async function waitUntilBlockedBy(blockingPid: number, description: string): Promise<void> {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const blocked = await db.query<{ blocked: boolean }>(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_stat_activity waiting
        WHERE waiting.wait_event_type = 'Lock'
          AND $1 = ANY(pg_blocking_pids(waiting.pid))
      ) AS blocked
    `, [blockingPid]);
    if (blocked.rows[0]?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`The Company Form request never blocked on the ${description} row lock.`);
}

async function createAssignment(assignUuid: string): Promise<void> {
  await db.query(`
    INSERT INTO crew_assignments(
      assign_uuid, crew_uuid, assignment_type, is_current, is_deleted
    ) VALUES ($1, $2, 'Planned', true, false)
  `, [assignUuid, crewUuid]);
}

async function start(assignUuid: string, formId = formUuid, versionId = versionUuid) {
  return api("post", `/api/v2/company-form-submissions/subjects/crew_assignment/${assignUuid}/submissions`, {
    formUuid: formId,
    formVersionUuid: versionId,
  });
}

async function createSubmission(assignUuid: string): Promise<string> {
  const result = await start(assignUuid);
  expect(result.status).toBe(201);
  submissionUuids.push(result.body.submissionUuid);
  return result.body.submissionUuid as string;
}

async function createHeldRowClient(): Promise<{ client: Client; pid: number }> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("BEGIN");
  const result = await client.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
  return { client, pid: Number(result.rows[0].pid) };
}

describe.sequential("Company Form submission concurrency boundaries", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.AUTH_BYPASS;
    await db.connect();

    const [{ authMiddleware }] = await Promise.all([
      import("@server/middleware/authMiddleware"),
    ]);
    const app = express();
    app.use(express.json());
    app.use(authMiddleware);
    app.use("/api/v2/company-form-submissions", companyFormSubmissionsRoutes);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });

    roleUuid = uuid();
    const roleName = `Forms race office ${SUFFIX}`;
    await db.query(`
      INSERT INTO adm_rolemaster_ac(ruid, assigned_role, roletype, is_active, is_deleted)
      VALUES ($1, $2, 'Office', true, false)
    `, [roleUuid, roleName]);
    const user = await db.query(
      "INSERT INTO master_users(user_type, role) VALUES ('Office', $1) RETURNING id",
      [roleName],
    );
    userId = Number(user.rows[0].id);
    const menus = await db.query(`
      SELECT muid FROM adm_menumaster_ac
      WHERE name = 'Crew Database' AND is_active = true AND is_deleted = false
    `);
    if (menus.rowCount !== 1) throw new Error("Expected the active Crew Database menu for race tests.");
    await db.query(`
      INSERT INTO adm_roleaccess_ac(
        rauid, role_id, menu_id, canview, cancreate, canedit, candelete, is_deleted
      ) VALUES ($1, $2, $3, true, true, true, false, false)
    `, [uuid(), roleUuid, menus.rows[0].muid]);

    crewUuid = uuid();
    assignmentUuid = uuid();
    cancelRaceAssignmentUuid = uuid();
    archiveRaceAssignmentUuid = uuid();
    completedRaceAssignmentUuid = uuid();
    submittedRaceAssignmentUuid = uuid();
    for (const assignUuid of [
      assignmentUuid,
      cancelRaceAssignmentUuid,
      archiveRaceAssignmentUuid,
      completedRaceAssignmentUuid,
      submittedRaceAssignmentUuid,
    ]) await createAssignment(assignUuid);

    formUuid = uuid();
    versionUuid = uuid();
    await db.query(`
      INSERT INTO adm_forms_v2(
        form_uuid, name, category, rank_group, version_no, version_date,
        subject_type, is_deleted
      ) VALUES ($1, $2, 'dynamic', 'Company Form race fixture', '01',
                '2026-01-01', 'crew_assignment', false)
    `, [formUuid, `Company Form concurrency ${SUFFIX}`]);
    await db.query(`
      INSERT INTO adm_form_versions_v2(
        fv_uuid, form_id, version_no, version_date, status, stage_key, is_deleted, released_at
      )
      SELECT $1, id, '01', '2026-01-01', 'released', 'before_joining', false, NOW()
      FROM adm_forms_v2 WHERE form_uuid = $2
    `, [versionUuid, formUuid]);

    partUuid = uuid();
    sectionUuid = uuid();
    questionUuid = uuid();
    await db.query(`
      INSERT INTO frm_form_parts(
        form_part_uuid, form_uuid, form_version_uuid, part_code, part_title,
        part_type, is_office_only, sort_order, is_deleted
      ) VALUES ($1, $2, $3, 'RACE', 'Race test part', 'configurable', false, 0, false)
    `, [partUuid, formUuid, versionUuid]);
    await db.query(`
      INSERT INTO frm_sections(
        section_uuid, form_version_uuid, form_part_uuid, section_code, section_title,
        responsible_mode, comment_box_required, signature_officer_required,
        signature_seafarer_required, layout_preference, sort_order, is_deleted
      ) VALUES ($1, $2, $3, 'RACE-SECTION', 'Race test section',
                'not_applicable', true, false, false, 'list', 0, false)
    `, [sectionUuid, versionUuid, partUuid]);
    await db.query(`
      INSERT INTO frm_questions(
        question_uuid, section_uuid, question_code, question_text,
        response_type, is_mandatory, comment_enabled, sort_order, is_deleted
      ) VALUES ($1, $2, 'RACE-QUESTION', 'Race test answer',
                'free_text', false, true, 0, false)
    `, [questionUuid, sectionUuid]);
  }, 30000);

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((error) => error ? reject(error) : resolve());
    });
    try {
      if (submissionUuids.length) {
        await db.query("DELETE FROM frm_answers WHERE submission_uuid = ANY($1::text[])", [submissionUuids]);
        await db.query("DELETE FROM frm_section_states WHERE submission_uuid = ANY($1::text[])", [submissionUuids]);
        await db.query("DELETE FROM frm_company_submission_assignments WHERE submission_uuid = ANY($1::text[])", [submissionUuids]);
        await db.query("DELETE FROM frm_company_submissions WHERE submission_uuid = ANY($1::text[])", [submissionUuids]);
      }
      const assignUuids = [
        assignmentUuid,
        cancelRaceAssignmentUuid,
        archiveRaceAssignmentUuid,
        completedRaceAssignmentUuid,
        submittedRaceAssignmentUuid,
      ].filter(Boolean);
      if (assignUuids.length) await db.query(
        "DELETE FROM crew_assignments WHERE assign_uuid = ANY($1::text[])", [assignUuids],
      );
      if (questionUuid) await db.query("DELETE FROM frm_questions WHERE question_uuid = $1", [questionUuid]);
      if (sectionUuid) await db.query("DELETE FROM frm_sections WHERE section_uuid = $1", [sectionUuid]);
      if (partUuid) await db.query("DELETE FROM frm_form_parts WHERE form_part_uuid = $1", [partUuid]);
      if (versionUuid) await db.query("DELETE FROM adm_form_versions_v2 WHERE fv_uuid = $1", [versionUuid]);
      if (formUuid) await db.query("DELETE FROM adm_forms_v2 WHERE form_uuid = $1", [formUuid]);
      if (userId) await db.query("DELETE FROM master_users WHERE id = $1", [userId]);
      if (roleUuid) {
        await db.query("DELETE FROM adm_roleaccess_ac WHERE role_id = $1", [roleUuid]);
        await db.query("DELETE FROM adm_rolemaster_ac WHERE ruid = $1", [roleUuid]);
      }
    } finally {
      await db.end();
      if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousJwtSecret;
      if (previousAuthBypass === undefined) delete process.env.AUTH_BYPASS;
      else process.env.AUTH_BYPASS = previousAuthBypass;
    }
  });

  it("serializes simultaneous starts so only one pinned submission and one subject link commit", async () => {
    const responses = await Promise.all([
      start(assignmentUuid),
      start(assignmentUuid),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const created = responses.find((response) => response.status === 201)!;
    submissionUuids.push(created.body.submissionUuid);

    const persisted = await db.query(`
      SELECT s.submission_uuid, s.form_version_uuid, s.stage_key, l.assign_uuid
      FROM frm_company_submissions s
      LEFT JOIN frm_company_submission_assignments l USING (submission_uuid)
      WHERE s.subject_type = 'crew_assignment' AND s.subject_ref = $1
    `, [assignmentUuid]);
    expect(persisted.rows).toEqual([{
      submission_uuid: created.body.submissionUuid,
      form_version_uuid: versionUuid,
      stage_key: "before_joining",
      assign_uuid: assignmentUuid,
    }]);
  });

  it("waits for assignment cancellation and refuses a start against the committed cancelled row", async () => {
    const held = await createHeldRowClient();
    try {
      await held.client.query(
        "SELECT assign_uuid FROM crew_assignments WHERE assign_uuid = $1 FOR UPDATE",
        [cancelRaceAssignmentUuid],
      );
      const pending = start(cancelRaceAssignmentUuid);
      const responsePromise = pending.then((response: any) => response);
      await waitUntilBlockedBy(held.pid, "crew assignment");
      await held.client.query(`
        UPDATE crew_assignments
        SET assignment_type = 'Cancelled', is_current = false
        WHERE assign_uuid = $1
      `, [cancelRaceAssignmentUuid]);
      await held.client.query("COMMIT");

      const response = await responsePromise;
      expect(response.status).toBe(409);
      const stored = await db.query(
        "SELECT submission_uuid FROM frm_company_submissions WHERE subject_ref = $1",
        [cancelRaceAssignmentUuid],
      );
      expect(stored.rowCount).toBe(0);
    } finally {
      await held.client.query("ROLLBACK").catch(() => undefined);
      await held.client.end();
    }
  });

  it("waits for archive and refuses a start against the committed archived form", async () => {
    const held = await createHeldRowClient();
    try {
      await held.client.query(
        "SELECT id FROM adm_forms_v2 WHERE form_uuid = $1 FOR UPDATE",
        [formUuid],
      );
      const responsePromise = start(archiveRaceAssignmentUuid).then((response: any) => response);
      await waitUntilBlockedBy(held.pid, "Company Form");
      await held.client.query(
        "UPDATE adm_forms_v2 SET archived_at = NOW() WHERE form_uuid = $1",
        [formUuid],
      );
      await held.client.query("COMMIT");

      const response = await responsePromise;
      expect(response.status).toBe(409);
      const stored = await db.query(
        "SELECT submission_uuid FROM frm_company_submissions WHERE subject_ref = $1",
        [archiveRaceAssignmentUuid],
      );
      expect(stored.rowCount).toBe(0);
      // Leave the shared race fixture available to the later write-lock tests.
      await db.query("UPDATE adm_forms_v2 SET archived_at = NULL WHERE form_uuid = $1", [formUuid]);
    } finally {
      await held.client.query("ROLLBACK").catch(() => undefined);
      await held.client.end();
    }
  });

  it("takes the generic submission lock before section state and refuses an edit if the parent completes while it waits", async () => {
    const submissionUuid = await createSubmission(completedRaceAssignmentUuid);
    const held = await createHeldRowClient();
    try {
      await held.client.query(
        "SELECT submission_uuid FROM frm_company_submissions WHERE submission_uuid = $1 FOR UPDATE",
        [submissionUuid],
      );
      const writePromise = api(
        "put",
        `/api/v2/company-form-submissions/${submissionUuid}/sections/${sectionUuid}/answers`,
        { answers: [{ questionUuid, value: "must not be saved" }] },
      ).then((response: any) => response);
      await waitUntilBlockedBy(held.pid, "generic submission");
      await held.client.query(`
        UPDATE frm_company_submissions
        SET status = 'completed', completed_at = NOW()
        WHERE submission_uuid = $1
      `, [submissionUuid]);
      await held.client.query("COMMIT");

      const response = await writePromise;
      expect(response.status).toBe(409);
      const answers = await db.query(
        "SELECT answer_uuid FROM frm_answers WHERE submission_uuid = $1",
        [submissionUuid],
      );
      expect(answers.rowCount).toBe(0);
    } finally {
      await held.client.query("ROLLBACK").catch(() => undefined);
      await held.client.end();
    }
  });

  it("takes the generic parent lock before observing a newly submitted section state", async () => {
    const submissionUuid = await createSubmission(submittedRaceAssignmentUuid);
    const stateUuid = uuid();
    const held = await createHeldRowClient();
    try {
      await held.client.query(
        "SELECT submission_uuid FROM frm_company_submissions WHERE submission_uuid = $1 FOR UPDATE",
        [submissionUuid],
      );
      const writePromise = api(
        "put",
        `/api/v2/company-form-submissions/${submissionUuid}/sections/${sectionUuid}/answers`,
        { answers: [{ questionUuid, value: "must not be saved" }] },
      ).then((response: any) => response);
      await waitUntilBlockedBy(held.pid, "generic submission");
      await held.client.query(`
        INSERT INTO frm_section_states(
          section_state_uuid, submission_uuid, section_uuid, status, submitted_at,
          created_by_uuid, updated_by_uuid, is_deleted, is_sync
        ) VALUES ($1, $2, $3, 'submitted', NOW(), 'race-test', 'race-test', false, false)
      `, [stateUuid, submissionUuid, sectionUuid]);
      await held.client.query("COMMIT");

      const response = await writePromise;
      expect(response.status).toBe(409);
      const answers = await db.query(
        "SELECT answer_uuid FROM frm_answers WHERE submission_uuid = $1",
        [submissionUuid],
      );
      expect(answers.rowCount).toBe(0);
    } finally {
      await held.client.query("ROLLBACK").catch(() => undefined);
      await held.client.end();
    }
  });
});