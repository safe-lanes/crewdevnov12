import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "crypto";
import type { Server } from "http";
import type {
  CompanyFormAction,
  CompanyFormPrincipal,
  CompanyFormSubjectAdapter,
} from "@server/v2/company-forms/contracts";
import { companyFormSubjectRegistry } from "@server/v2/company-forms/registry";
import { loadPersistedSubjectStages } from "@server/v2/company-forms/subjectStageRepository";
import companyFormSubmissionsRoutes from "@server/v2/company-forms/routes";

const TEST_SECRET = "company-form-stage-less-test-secret";
const SUFFIX = randomUUID().replaceAll("-", "").slice(0, 14);
const uuid = () => randomUUID();
const subjectType = `stage_less_runtime_${SUFFIX}`;
const subjectRef = uuid();
const homeRef = uuid();
const formUuid = uuid();
const formVersionUuid = uuid();
const partUuid = uuid();
const sectionUuid = uuid();
const questionUuid = uuid();
const client = new Client({ connectionString: process.env.DATABASE_URL });
let server: Server;
let officeUserId = 0;
let officeRoleUuid = "";
let submissionUuid = "";
let previousJwtSecret: string | undefined;
let previousAuthBypass: string | undefined;

type RuntimeSubject = { subjectId: string };

function stageLessAdapter(): CompanyFormSubjectAdapter<RuntimeSubject> {
  const subject = { subjectId: subjectRef };
  const allowedActions: Readonly<Record<"office" | "vessel" | "seafarer", readonly CompanyFormAction[]>> = {
    office: [
      "read_eligible_forms",
      "list_submissions",
      "count_submissions",
      "read_submission",
      "read_definition",
      "read_asset",
      "create_submission",
      "edit_draft",
    ],
    vessel: [],
    seafarer: [],
  };
  return {
    subjectType,
    label: "Stage-less runtime test subject",
    loadStages: (executor) => loadPersistedSubjectStages(subjectType, executor),
    lookup: async (ref) => ref === subjectRef ? { subjectRef: subject.subjectId, context: subject } : undefined,
    lockForStart: async (ref) => {
      return ref === subjectRef ? { subjectRef: subject.subjectId, context: subject } : undefined;
    },
    loadHomeSubjects: async (ref) =>
      ref === homeRef ? [{ subjectRef: subject.subjectId, context: subject }] : undefined,
    groupingIdentifier: (_record, ref) => ref,
    isOutstanding: () => true,
    canStart: (record) => record.subjectId === subjectRef,
    linkSubmission: async () => undefined,
    systemFields: [],
    resolveSystemField: async () => null,
    allowedActions,
    authorize: async (principal, action, record) =>
      principal.kind === "office" &&
      record.subjectId === subjectRef &&
      allowedActions.office.includes(action),
    authorizeHome: async (principal, action, ref, subjects) =>
      principal.kind === "office" &&
      ref === homeRef &&
      subjects.every((candidate) => candidate.context.subjectId === subjectRef) &&
      allowedActions.office.includes(action),
    entryPoints: [],
    entryLists: [],
    home: {
      location: "Runtime fixture",
      groupingKey: "subject_id",
      groupLabel: "Subject",
      expandable: true,
      includesCancelledHistory: true,
      outstandingExcludesCancelled: true,
    },
    signatories: [],
  };
}

function bearer(): string {
  return jwt.sign(
    { id: officeUserId, domain: "test", userType: "Office" },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

function api(method: "get" | "post" | "put", path: string, body?: unknown) {
  let query = (request(server) as any)[method](path)
    .set("Authorization", `Bearer ${bearer()}`);
  if (body !== undefined) query = query.send(body);
  return query;
}

describe.sequential("stage-less Company Form submission service", () => {
  beforeAll(async () => {
    previousJwtSecret = process.env.JWT_SECRET;
    previousAuthBypass = process.env.AUTH_BYPASS;
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.AUTH_BYPASS;
    await client.connect();

    await client.query(
      "INSERT INTO frm_subject_types(subject_type, label) VALUES ($1, $2)",
      [subjectType, "Stage-less runtime test subject"],
    );
    expect((await client.query(
      "SELECT stage_key FROM frm_subject_stages WHERE subject_type = $1",
      [subjectType],
    )).rowCount).toBe(0);

    officeRoleUuid = uuid();
    const roleName = `Stage-less form office ${SUFFIX}`;
    await client.query(`
      INSERT INTO adm_rolemaster_ac(ruid, assigned_role, roletype, is_active, is_deleted)
      VALUES ($1, $2, 'Office', true, false)
    `, [officeRoleUuid, roleName]);
    const user = await client.query(
      "INSERT INTO master_users(user_type, role) VALUES ('Office', $1) RETURNING id",
      [roleName],
    );
    officeUserId = Number(user.rows[0].id);
    const menus = await client.query(`
      SELECT muid FROM adm_menumaster_ac
      WHERE name = 'Crew Database' AND is_active = true AND is_deleted = false
    `);
    if (menus.rowCount !== 1) throw new Error("Expected one active Crew Database menu.");
    await client.query(`
      INSERT INTO adm_roleaccess_ac(
        rauid, role_id, menu_id, canview, cancreate, canedit, candelete, is_deleted
      ) VALUES ($1, $2, $3, true, true, true, false, false)
    `, [uuid(), officeRoleUuid, menus.rows[0].muid]);

    await client.query(`
      INSERT INTO adm_forms_v2(
        form_uuid, name, category, rank_group, version_no, version_date,
        subject_type, is_deleted
      ) VALUES ($1, $2, 'dynamic', 'Stage-less test', '01', '2026-01-01', $3, false)
    `, [formUuid, `Stage-less Company Form ${SUFFIX}`, subjectType]);
    await client.query(`
      INSERT INTO adm_form_versions_v2(
        fv_uuid, form_id, version_no, version_date, status, stage_key, is_deleted, released_at
      )
      SELECT $1, id, '01', '2026-01-01', 'released', NULL, false, NOW()
      FROM adm_forms_v2 WHERE form_uuid = $2
    `, [formVersionUuid, formUuid]);

    await client.query(`
      INSERT INTO frm_form_parts(
        form_part_uuid, form_uuid, form_version_uuid, part_code, part_title,
        part_type, is_office_only, sort_order, is_deleted
      ) VALUES ($1, $2, $3, 'PART', 'Stage-less part', 'configurable', false, 0, false)
    `, [partUuid, formUuid, formVersionUuid]);
    await client.query(`
      INSERT INTO frm_sections(
        section_uuid, form_version_uuid, form_part_uuid, section_code, section_title,
        responsible_mode, comment_box_required, signature_officer_required,
        signature_seafarer_required, layout_preference, sort_order, is_deleted
      ) VALUES ($1, $2, $3, 'SECTION', 'Stage-less section',
                'not_applicable', true, false, false, 'list', 0, false)
    `, [sectionUuid, formVersionUuid, partUuid]);
    await client.query(`
      INSERT INTO frm_questions(
        question_uuid, section_uuid, question_code, question_text,
        response_type, is_mandatory, comment_enabled, sort_order, is_deleted
      ) VALUES ($1, $2, 'ANSWER', 'Stage-less answer',
                'free_text', false, true, 0, false)
    `, [questionUuid, sectionUuid]);

    companyFormSubjectRegistry.register(stageLessAdapter());
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
  }, 30000);

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((error) => error ? reject(error) : resolve());
    });
    try {
      if (submissionUuid) {
        await client.query("DELETE FROM frm_answers WHERE submission_uuid = $1", [submissionUuid]);
        await client.query("DELETE FROM frm_section_states WHERE submission_uuid = $1", [submissionUuid]);
        await client.query("DELETE FROM frm_company_submissions WHERE submission_uuid = $1", [submissionUuid]);
      }
      if (questionUuid) await client.query("DELETE FROM frm_questions WHERE question_uuid = $1", [questionUuid]);
      if (sectionUuid) await client.query("DELETE FROM frm_sections WHERE section_uuid = $1", [sectionUuid]);
      if (partUuid) await client.query("DELETE FROM frm_form_parts WHERE form_part_uuid = $1", [partUuid]);
      if (formVersionUuid) await client.query(
        "DELETE FROM adm_form_versions_v2 WHERE fv_uuid = $1", [formVersionUuid],
      );
      if (formUuid) await client.query("DELETE FROM adm_forms_v2 WHERE form_uuid = $1", [formUuid]);
      if (officeUserId) await client.query("DELETE FROM master_users WHERE id = $1", [officeUserId]);
      if (officeRoleUuid) {
        await client.query("DELETE FROM adm_roleaccess_ac WHERE role_id = $1", [officeRoleUuid]);
        await client.query("DELETE FROM adm_rolemaster_ac WHERE ruid = $1", [officeRoleUuid]);
      }
      await client.query("DELETE FROM frm_subject_types WHERE subject_type = $1", [subjectType]);
    } finally {
      await client.end();
      if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousJwtSecret;
      if (previousAuthBypass === undefined) delete process.env.AUTH_BYPASS;
      else process.env.AUTH_BYPASS = previousAuthBypass;
    }
  });

  it("runs eligible, create, list/count, home, pinned reads, and draft edits with no crew or vessel records", async () => {
    expect(companyFormSubjectRegistry.get(subjectType).entryLists).toEqual([]);

    const eligible = await api(
      "get",
      `/api/v2/company-form-submissions/subjects/${subjectType}/${subjectRef}/eligible-forms`,
    );
    expect(eligible.status).toBe(200);
    expect(eligible.body).toHaveLength(1);
    expect(eligible.body[0]).toMatchObject({
      formUuid,
      formVersionUuid,
      stageKey: null,
    });

    const invalidStage = await api(
      "get",
      `/api/v2/company-form-submissions/subjects/${subjectType}/${subjectRef}/eligible-forms?stageKey=before_joining`,
    );
    expect(invalidStage.status).toBe(400);

    const created = await api(
      "post",
      `/api/v2/company-form-submissions/subjects/${subjectType}/${subjectRef}/submissions`,
      { formUuid, formVersionUuid },
    );
    expect(created.status).toBe(201);
    submissionUuid = created.body.submissionUuid;
    expect(created.body).toMatchObject({
      subjectType,
      subjectRef,
      formUuid,
      formVersionUuid,
      stageKey: null,
      status: "in_progress",
    });
    const pin = await client.query(
      `SELECT subject_type, subject_ref, form_uuid, form_version_uuid, stage_key
       FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    expect(pin.rows[0]).toEqual({
      subject_type: subjectType,
      subject_ref: subjectRef,
      form_uuid: formUuid,
      form_version_uuid: formVersionUuid,
      stage_key: null,
    });

    const list = await api(
      "get",
      `/api/v2/company-form-submissions/subjects/${subjectType}/${subjectRef}/submissions`,
    );
    expect(list.status).toBe(200);
    expect(list.body.totalCount).toBe(1);
    expect(list.body.outstandingCount).toBe(1);
    expect(list.body.submissions[0].stageKey).toBeNull();

    const count = await api(
      "get",
      `/api/v2/company-form-submissions/subjects/${subjectType}/${subjectRef}/submissions/count`,
    );
    expect(count.status).toBe(200);
    expect(count.body.totalCount).toBe(1);

    const home = await api(
      "get",
      `/api/v2/company-form-submissions/subjects/${subjectType}/home/${homeRef}/submissions`,
    );
    expect(home.status).toBe(200);
    expect(home.body.groups).toHaveLength(1);
    expect(home.body.groups[0].subjectRef).toBe(subjectRef);

    const detail = await api("get", `/api/v2/company-form-submissions/${submissionUuid}`);
    expect(detail.status).toBe(200);
    expect(detail.body.submission.stageKey).toBeNull();
    expect(detail.body.submission.subjectType).toBe(subjectType);

    const render = await api("get", `/api/v2/company-form-submissions/${submissionUuid}/form`);
    expect(render.status).toBe(200);
    expect(render.body.submission.formVersionUuid).toBe(formVersionUuid);
    expect(render.body.version.stageKey).toBeNull();
    expect(render.body.parts[0].formPartUuid).toBe(partUuid);
    expect(render.body.parts[0].sections[0].sectionUuid).toBe(sectionUuid);

    const saved = await api(
      "put",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${sectionUuid}/answers`,
      { answers: [{ questionUuid, value: "stage-less answer", comment: "saved without subject-specific tables" }] },
    );
    expect(saved.status).toBe(204);
    const answer = await client.query(
      `SELECT answer_value, answer_comment
       FROM frm_answers WHERE submission_uuid = $1 AND question_uuid = $2`,
      [submissionUuid, questionUuid],
    );
    expect(answer.rows).toEqual([{
      answer_value: "stage-less answer",
      answer_comment: "saved without subject-specific tables",
    }]);

    const subjectSpecificRecords = await client.query(`
      SELECT
        (SELECT count(*) FROM crew_assignments WHERE assign_uuid = $1) AS assignments,
        (SELECT count(*) FROM frm_company_submission_assignments WHERE submission_uuid = $2) AS crew_links,
        (SELECT count(*) FROM master_vessels WHERE vessel_uuid = $3) AS vessels,
        (SELECT count(*) FROM crew_members_v2 WHERE crew_uuid = $3) AS crew
    `, [subjectRef, submissionUuid, subjectRef]);
    expect(subjectSpecificRecords.rows[0]).toEqual({
      assignments: "0",
      crew_links: "0",
      vessels: "0",
      crew: "0",
    });
  });

  it("rejects an unknown subject type instead of falling back to crew assignment behavior", async () => {
    const response = await api(
      "get",
      `/api/v2/company-form-submissions/subjects/not_registered/${subjectRef}/eligible-forms?stageKey=before_joining`,
    );
    expect(response.status).toBe(400);
    expect(response.body.error).toBe("unsupported_subject_type");
  });
});