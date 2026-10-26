import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { v4 as uuidv4 } from "uuid";
import { readFileSync } from "node:fs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function withTransaction(run: (client: PoolClient) => Promise<void>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await run(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

async function expectRejected(
  client: PoolClient,
  query: string,
  params: Array<string | number | null> = [],
) {
  await client.query("SAVEPOINT expected_rejection");
  let rejected = false;
  try {
    await client.query(query, params);
  } catch {
    rejected = true;
  }
  await client.query("ROLLBACK TO SAVEPOINT expected_rejection");
  await client.query("RELEASE SAVEPOINT expected_rejection");
  expect(rejected).toBe(true);
}

async function createForm(
  client: PoolClient,
  subjectType: string | null,
  category = "dynamic",
) {
  const formUuid = uuidv4();
  const versionUuid = uuidv4();
  const form = await client.query<{ id: number }>(`
    INSERT INTO adm_forms_v2(
      form_uuid, name, category, subject_type, rank_group, version_no,
      version_date, is_lock_form
    ) VALUES ($1, $2, $3, $4, 'persistence test', '01', '09-Sep-2026', false)
    RETURNING id
  `, [formUuid, `Stage persistence ${formUuid}`, category, subjectType]);
  await client.query(`
    INSERT INTO adm_form_versions_v2(
      fv_uuid, form_id, version_no, version_date, status
    ) VALUES ($1, $2, '01', '09-Sep-2026', 'draft')
  `, [versionUuid, form.rows[0].id]);
  return { formUuid, formId: form.rows[0].id, versionUuid };
}

async function createCrewAssignment(client: PoolClient) {
  const assignUuid = uuidv4();
  await client.query(`
    INSERT INTO crew_assignments(assign_uuid, crew_uuid, assignment_type)
    VALUES ($1, $2, 'Planned')
  `, [assignUuid, uuidv4()]);
  return assignUuid;
}

describe.sequential("Company Form stage and submission persistence", () => {
  afterAll(async () => pool.end());

  it("preserves the approved historical mapping and leaves new crew drafts unclassified", async () => {
    await withTransaction(async (client) => {
      // Fresh tenants contain no historical MARPOL release. Verify the
      // immutable mapping contract, then exercise it with synthetic data.
      const migration = readFileSync("migrations/0226_company_form_stages_and_submissions.sql", "utf8");
      expect(migration).toContain("3a0ded43-41a4-4460-a6b1-2cc59b0409ba");
      expect(migration).toMatch(/SET stage_key = 'before_joining'\s*WHERE fv_uuid = '3a0ded43-41a4-4460-a6b1-2cc59b0409ba'/);
      expect(migration).toContain("does not identify a released dynamic crew_assignment version 01");
      const synthetic = await createForm(client, "crew_assignment");
      await client.query(`UPDATE adm_form_versions_v2 SET stage_key='before_joining',
        stage_subject_type='crew_assignment',status='released',released_at=now() WHERE fv_uuid=$1`,
        [synthetic.versionUuid]);
      const approved = await client.query<{
        status: string;
        version_no: string;
        stage_key: string | null;
        subject_type: string | null;
      }>(`
        SELECT v.status, v.version_no, v.stage_key, f.subject_type
        FROM adm_form_versions_v2 v
        JOIN adm_forms_v2 f ON f.id = v.form_id
        WHERE v.fv_uuid = $1
      `, [synthetic.versionUuid]);
      expect(approved.rows).toHaveLength(1);
      expect(approved.rows[0]).toMatchObject({
        status: "released",
        version_no: "01",
        stage_key: "before_joining",
        subject_type: "crew_assignment",
      });

      // Do not assert a global draft count: retained authoring/acceptance
      // fixtures legitimately add drafts and classified versions over time.
      const draftVersionUuids = [];
      for (let index = 0; index < 6; index++) {
        draftVersionUuids.push((await createForm(client, "crew_assignment")).versionUuid);
      }
      const drafts = await client.query<{ count: string; unclassified: string }>(`
        SELECT count(*)::text AS count,
               count(*) FILTER (WHERE v.stage_key IS NULL)::text AS unclassified
        FROM adm_form_versions_v2 v
        JOIN adm_forms_v2 f ON f.id = v.form_id
        WHERE v.status = 'draft' AND f.subject_type = 'crew_assignment'
          AND v.fv_uuid = ANY($1::text[])
      `, [draftVersionUuids]);
      expect(drafts.rows[0]).toEqual({ count: "6", unclassified: "6" });
    });
  });

  it("allows NULL drafts, rejects unknown/mismatched stages, and enforces release immutability", async () => {
    await withTransaction(async (client) => {
      const crewForm = await createForm(client, "crew_assignment");
      const draft = await client.query<{ stage_key: string | null; stage_subject_type: string }>(`
        SELECT stage_key, stage_subject_type
        FROM adm_form_versions_v2 WHERE fv_uuid = $1
      `, [crewForm.versionUuid]);
      expect(draft.rows[0]).toEqual({ stage_key: null, stage_subject_type: "crew_assignment" });

      await expectRejected(client, `
        UPDATE adm_form_versions_v2 SET stage_key = 'not_a_stage' WHERE fv_uuid = $1
      `, [crewForm.versionUuid]);
      await expectRejected(client, `
        UPDATE adm_form_versions_v2
        SET stage_subject_type = 'not_the_form_subject'
        WHERE fv_uuid = $1
      `, [crewForm.versionUuid]);
      await expectRejected(client, `
        UPDATE adm_form_versions_v2 SET status = 'released' WHERE fv_uuid = $1
      `, [crewForm.versionUuid]);

      await client.query(`
        UPDATE adm_form_versions_v2
        SET stage_key = 'on_board', status = 'released'
        WHERE fv_uuid = $1
      `, [crewForm.versionUuid]);
      await expectRejected(client, `
        UPDATE adm_form_versions_v2 SET stage_key = 'at_sign_off' WHERE fv_uuid = $1
      `, [crewForm.versionUuid]);
      await expectRejected(client, `
        UPDATE adm_form_versions_v2 SET status = 'draft' WHERE fv_uuid = $1
      `, [crewForm.versionUuid]);
      await expectRejected(client, `
        UPDATE adm_form_versions_v2 SET form_id = form_id + 1 WHERE fv_uuid = $1
      `, [crewForm.versionUuid]);
    });
  });

  it("allows stage-less releases but refuses to add a first stage after an unstaged release", async () => {
    await withTransaction(async (client) => {
      const subjectType = `test_stage_less_${uuidv4().replaceAll("-", "")}`;
      await client.query(
        "INSERT INTO frm_subject_types(subject_type, label) VALUES ($1, 'Test stage-less subject')",
        [subjectType],
      );
      const companyForm = await createForm(client, subjectType);
      await client.query(
        "UPDATE adm_form_versions_v2 SET status = 'released' WHERE fv_uuid = $1",
        [companyForm.versionUuid],
      );

      const standardForm = await createForm(client, null, "briefing");
      await client.query(
        "UPDATE adm_form_versions_v2 SET status = 'released' WHERE fv_uuid = $1",
        [standardForm.versionUuid],
      );
      const standard = await client.query<{ stage_key: string | null; stage_subject_type: string | null }>(
        "SELECT stage_key, stage_subject_type FROM adm_form_versions_v2 WHERE fv_uuid = $1",
        [standardForm.versionUuid],
      );
      expect(standard.rows[0]).toEqual({ stage_key: null, stage_subject_type: null });

      // A first stage cannot be introduced after a NULL-stage version has
      // already been released for that subject.
      await expectRejected(client, `
        INSERT INTO frm_subject_stages(subject_type, stage_key, label, sort_order)
        VALUES ($1, 'initial', 'Initial', 0)
      `, [subjectType]);
      await client.query(
        "UPDATE adm_form_versions_v2 SET updated_by_uuid = 'test' WHERE fv_uuid = $1",
        [companyForm.versionUuid],
      );
      const stillNull = await client.query<{ status: string; stage_key: string | null }>(
        "SELECT status, stage_key FROM adm_form_versions_v2 WHERE fv_uuid = $1",
        [companyForm.versionUuid],
      );
      expect(stillNull.rows[0]).toEqual({ status: "released", stage_key: null });

      const freshSubjectType = `test_fresh_stage_${uuidv4().replaceAll("-", "")}`;
      await client.query(
        "INSERT INTO frm_subject_types(subject_type, label) VALUES ($1, 'Fresh staged subject')",
        [freshSubjectType],
      );
      await client.query(`
        INSERT INTO frm_subject_stages(subject_type, stage_key, label, sort_order)
        VALUES ($1, 'initial', 'Initial', 0)
      `, [freshSubjectType]);
    });
  });

  it("pins submissions to a released same-form version and protects crew-assignment links", async () => {
    await withTransaction(async (client) => {
      const form = await createForm(client, "crew_assignment");
      const secondVersionUuid = uuidv4();
      await client.query(`
        INSERT INTO adm_form_versions_v2(
          fv_uuid, form_id, version_no, version_date, status, stage_key
        ) VALUES ($1, $2, '02', '09-Sep-2026', 'draft', 'before_joining')
      `, [secondVersionUuid, form.formId]);
      await client.query("UPDATE adm_form_versions_v2 SET status='released' WHERE fv_uuid=$1", [secondVersionUuid]);
      await client.query(`
        UPDATE adm_form_versions_v2
        SET stage_key = 'before_joining', status = 'released'
        WHERE fv_uuid = $1
      `, [form.versionUuid]);
      const otherForm = await createForm(client, "crew_assignment");
      const unreleasedVersionUuid = uuidv4();
      await client.query(`
        INSERT INTO adm_form_versions_v2(
          fv_uuid, form_id, version_no, version_date, status, stage_key
        ) VALUES ($1, $2, '02', '09-Sep-2026', 'draft', 'before_joining')
      `, [unreleasedVersionUuid, otherForm.formId]);
      await client.query(`
        UPDATE adm_form_versions_v2
        SET stage_key = 'before_joining', status = 'released'
        WHERE fv_uuid = $1
      `, [otherForm.versionUuid]);

      const assignmentUuid = await createCrewAssignment(client);
      const submissionUuid = uuidv4();
      await client.query(`
        INSERT INTO frm_company_submissions(
          submission_uuid, subject_type, subject_ref, form_uuid,
          form_version_uuid, stage_key
        ) VALUES ($1, 'crew_assignment', $2, $3, $4, 'before_joining')
      `, [submissionUuid, assignmentUuid, form.formUuid, form.versionUuid]);
      await client.query(`
        INSERT INTO frm_company_submissions(
          submission_uuid, subject_type, subject_ref, form_uuid,
          form_version_uuid, stage_key
        ) VALUES ($1, 'crew_assignment', $2, $3, $4, 'before_joining')
      `, [uuidv4(), uuidv4(), form.formUuid, secondVersionUuid]);
      await expectRejected(client, `
        INSERT INTO frm_company_submissions(
          submission_uuid, subject_type, subject_ref, form_uuid,
          form_version_uuid, stage_key
        ) VALUES ($1, 'crew_assignment', $2, $3, $4, 'before_joining')
      `, [uuidv4(), assignmentUuid, form.formUuid, form.versionUuid]);
      await expectRejected(client, `
        INSERT INTO frm_company_submissions(
          submission_uuid, subject_type, subject_ref, form_uuid,
          form_version_uuid, stage_key
        ) VALUES ($1, 'crew_assignment', $2, $3, $4, 'on_board')
      `, [uuidv4(), assignmentUuid, form.formUuid, form.versionUuid]);
      await expectRejected(client, `
        INSERT INTO frm_company_submissions(
          submission_uuid, subject_type, subject_ref, form_uuid,
          form_version_uuid, stage_key
        ) VALUES ($1, 'crew_assignment', $2, $3, $4, 'before_joining')
      `, [uuidv4(), uuidv4(), otherForm.formUuid, form.versionUuid]);
      await expectRejected(client, `
        INSERT INTO frm_company_submissions(
          submission_uuid, subject_type, subject_ref, form_uuid,
          form_version_uuid, stage_key
        ) VALUES ($1, 'crew_assignment', $2, $3, $4, 'before_joining')
      `, [uuidv4(), assignmentUuid, uuidv4(), form.versionUuid]);
      await expectRejected(client, `
        INSERT INTO frm_company_submissions(
          submission_uuid, subject_type, subject_ref, form_uuid,
          form_version_uuid, stage_key, status
        ) VALUES ($1, 'crew_assignment', $2, $3, $4, 'before_joining', 'completed')
      `, [uuidv4(), assignmentUuid, form.formUuid, form.versionUuid]);
      await expectRejected(client, `
        INSERT INTO frm_company_submissions(
          submission_uuid, subject_type, subject_ref, form_uuid,
          form_version_uuid, stage_key
        ) VALUES ($1, 'crew_assignment', $2, $3, $4, 'before_joining')
      `, [uuidv4(), uuidv4(), otherForm.formUuid, unreleasedVersionUuid]);

      await expectRejected(client, `
        UPDATE frm_company_submissions
        SET stage_key = 'on_board'
        WHERE submission_uuid = $1
      `, [submissionUuid]);
      await expectRejected(client, `
        INSERT INTO frm_company_submission_assignments(submission_uuid, assign_uuid)
        VALUES ($1, $2)
      `, [submissionUuid, uuidv4()]);
      await client.query(`
        INSERT INTO frm_company_submission_assignments(submission_uuid, assign_uuid)
        VALUES ($1, $2)
      `, [submissionUuid, assignmentUuid]);

      const secondFormSubmissionUuid = uuidv4();
      await client.query(`
        INSERT INTO frm_company_submissions(
          submission_uuid, subject_type, subject_ref, form_uuid,
          form_version_uuid, stage_key
        ) VALUES ($1, 'crew_assignment', $2, $3, $4, 'before_joining')
      `, [secondFormSubmissionUuid, assignmentUuid, otherForm.formUuid, otherForm.versionUuid]);
      await client.query(`
        INSERT INTO frm_company_submission_assignments(submission_uuid, assign_uuid)
        VALUES ($1, $2)
      `, [secondFormSubmissionUuid, assignmentUuid]);

      const assignmentLinks = await client.query<{ count: string }>(`
        SELECT count(*)::text AS count
        FROM frm_company_submission_assignments
        WHERE assign_uuid = $1
      `, [assignmentUuid]);
      expect(assignmentLinks.rows[0].count).toBe("2");
      await expectRejected(client, `
        DELETE FROM crew_assignments WHERE assign_uuid = $1
      `, [assignmentUuid]);
    });
  });
});