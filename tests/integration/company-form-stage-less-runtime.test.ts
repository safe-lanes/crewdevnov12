import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import type { Server } from "http";
import { fileStorageService } from "@server/v2/shared/fileStorageService";
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
const raceSubjectRef = uuid();
const failedSubjectRef = uuid();
const legacySubjectRef = uuid();
const assetFailureSubjectRef = uuid();
const homeRef = uuid();
const formUuid = uuid();
const formVersionUuid = uuid();
const partUuid = uuid();
const sectionUuid = uuid();
const questionUuid = uuid();
const secondRequiredSectionUuid = uuid();
const secondRequiredQuestionUuid = uuid();
const thirdRequiredSectionUuid = uuid();
const thirdRequiredQuestionUuid = uuid();
const infoSectionUuid = uuid();
const infoContentQuestionUuid = uuid();
const infoSystemQuestionUuid = uuid();
const infoNullSystemQuestionUuid = uuid();
const secondInfoSectionUuid = uuid();
const secondInfoSystemQuestionUuid = uuid();
const subjectLabelSystemFieldKey = "stage_less_subject_label";
const declarationDateSystemFieldKey = "date_of_declaration";
const nullSystemFieldKey = "stage_less_nullable_value";
const subjectRefs = new Set([
  subjectRef,
  raceSubjectRef,
  failedSubjectRef,
  legacySubjectRef,
  assetFailureSubjectRef,
]);
const client = new Client({ connectionString: process.env.DATABASE_URL });
let server: Server;
let officeUserId = 0;
let officeRoleUuid = "";
const submissionUuids: string[] = [];
let lifecycleSchemaReady = false;
const currentSubjectLabels = new Map([
  [subjectRef, "Stage-less record at start"],
  [raceSubjectRef, "Race subject at start"],
  [failedSubjectRef, "Failed-attempt subject"],
  [legacySubjectRef, "Legacy subject"],
  [assetFailureSubjectRef, "Asset failure subject"],
]);
const comparisonFailureSubjectRefs = new Set<string>();
const declarationDateDriftSubjectRefs = new Set<string>();
const snapshotFailureSubjectRefs = new Set<string>();
let expectedAttachmentCountDuringSnapshotFailure = 0;
let snapshotFailureObservedInsertedAttachment = false;
let previousJwtSecret: string | undefined;
let previousAuthBypass: string | undefined;

type RuntimeSubject = { subjectId: string };

function stageLessAdapter(): CompanyFormSubjectAdapter<RuntimeSubject> {
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
      "submit_section",
      "save_signature",
      "remove_signature",
    ],
    vessel: [],
    seafarer: [],
  };
  return {
    subjectType,
    label: "Stage-less runtime test subject",
    loadStages: (executor) => loadPersistedSubjectStages(subjectType, executor),
    lookup: async (ref) => subjectRefs.has(ref)
      ? { subjectRef: ref, context: { subjectId: ref } }
      : undefined,
    lockForStart: async (ref) => {
      return subjectRefs.has(ref) ? { subjectRef: ref, context: { subjectId: ref } } : undefined;
    },
    loadHomeSubjects: async (ref) =>
      ref === homeRef ? [{ subjectRef, context: { subjectId: subjectRef } }] : undefined,
    groupingIdentifier: (_record, ref) => ref,
    isOutstanding: () => true,
    canStart: (record) => subjectRefs.has(record.subjectId),
    linkSubmission: async () => undefined,
    systemFields: [
      { key: subjectLabelSystemFieldKey, label: "Subject label", source: "subject" },
      { key: declarationDateSystemFieldKey, label: "Date of declaration", source: "submission" },
      { key: nullSystemFieldKey, label: "Optional value", source: "subject" },
    ],
    resolveSystemField: async (key, record, context) => {
      if (snapshotFailureSubjectRefs.has(record.subjectId) && key === subjectLabelSystemFieldKey) {
        const executor = context.executor as { execute(query: unknown): Promise<{ rows: Array<{ count: string }> }> };
        const inserted = await executor.execute(sql`
          SELECT COUNT(*)::text AS count
          FROM frm_signature_attachments WHERE created_by_uuid = ${String(officeUserId)}
        `);
        snapshotFailureObservedInsertedAttachment =
          Number(inserted.rows[0]?.count) === expectedAttachmentCountDuringSnapshotFailure;
        throw new Error("Injected System-field failure during declaration snapshot.");
      }
      if (key === subjectLabelSystemFieldKey && comparisonFailureSubjectRefs.has(record.subjectId)) {
        throw new Error("The current subject source is unavailable for comparison.");
      }
      return key === declarationDateSystemFieldKey
        ? declarationDateDriftSubjectRefs.has(record.subjectId)
          ? "1900-01-01"
          : context.submission.dateOfDeclaration
        : key === subjectLabelSystemFieldKey ? currentSubjectLabels.get(record.subjectId) ?? null : null;
    },
    allowedActions,
    authorize: async (principal, action, record) =>
      principal.kind === "office" &&
      subjectRefs.has(record.subjectId) &&
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
    signatories: [{
      signatureType: "officer",
      displayLabel: "Company Representative",
      allowedActors: ["office"],
      methods: ["officer"],
    }],
  };
}

function bearer(): string {
  return jwt.sign(
    { id: officeUserId, domain: "test", userType: "Office" },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

function api(method: "get" | "post" | "put" | "delete", path: string, body?: unknown) {
  let query = (request(server) as any)[method](path)
    .set("Authorization", `Bearer ${bearer()}`);
  if (body !== undefined) query = query.send(body);
  return query;
}

async function startSubmission(subjectRef: string): Promise<string> {
  const created = await api(
    "post",
    `/api/v2/company-form-submissions/subjects/${subjectType}/${subjectRef}/submissions`,
    { formUuid, formVersionUuid },
  );
  expect(created.status).toBe(201);
  const id = created.body.submissionUuid as string;
  submissionUuids.push(id);
  return id;
}

function signAsOfficer(submissionRef: string, targetSectionUuid: string, data = "data:image/png;base64,iVBORw0KGgo=") {
  return api(
    "post",
    `/api/v2/company-form-submissions/${submissionRef}/sections/${targetSectionUuid}/signatures`,
    { signatureType: "officer", method: "officer", data },
  );
}

describe.sequential("stage-less Company Form submission service", () => {
  beforeAll(async () => {
    previousJwtSecret = process.env.JWT_SECRET;
    previousAuthBypass = process.env.AUTH_BYPASS;
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.AUTH_BYPASS;
    await client.connect();
    lifecycleSchemaReady = (await client.query(
      "SELECT to_regclass('frm_company_submission_system_snapshots') IS NOT NULL AS ready",
    )).rows[0].ready;

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
      "INSERT INTO master_users(user_type, role, firstname) VALUES ('Office', $1, 'Stage-less Office Tester') RETURNING id",
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
        'seafarer', false, false, false, 'list', 0, false)
    `, [sectionUuid, formVersionUuid, partUuid]);
    await client.query(`
      INSERT INTO frm_questions(
        question_uuid, section_uuid, question_code, question_text,
        response_type, is_mandatory, comment_enabled, sort_order, is_deleted
      ) VALUES ($1, $2, 'ANSWER', 'Stage-less answer',
                'free_text', false, true, 0, false)
    `, [questionUuid, sectionUuid]);
    await client.query(`
      INSERT INTO frm_sections(
        section_uuid, form_version_uuid, form_part_uuid, section_code, section_title,
        responsible_mode, comment_box_required, signature_officer_required,
        signature_seafarer_required, layout_preference, sort_order, is_deleted
      ) VALUES ($1, $2, $3, 'SECTION2', 'Second required section',
        'seafarer', false, true, false, 'list', 1, false)
    `, [secondRequiredSectionUuid, formVersionUuid, partUuid]);
    await client.query(`
      INSERT INTO frm_questions(
        question_uuid, section_uuid, question_code, question_text,
        response_type, is_mandatory, comment_enabled, sort_order, is_deleted
      ) VALUES ($1, $2, 'ANSWER2', 'Second stage-less answer',
                'free_text', false, true, 0, false)
    `, [secondRequiredQuestionUuid, secondRequiredSectionUuid]);
    await client.query(`
      INSERT INTO frm_sections(
        section_uuid, form_version_uuid, form_part_uuid, section_code, section_title,
        responsible_mode, comment_box_required, signature_officer_required,
        signature_seafarer_required, layout_preference, sort_order, is_deleted
      ) VALUES ($1, $2, $3, 'SECTION3', 'Third required section',
        'seafarer', false, true, false, 'list', 2, false)
    `, [thirdRequiredSectionUuid, formVersionUuid, partUuid]);
    await client.query(`
      INSERT INTO frm_questions(
        question_uuid, section_uuid, question_code, question_text,
        response_type, is_mandatory, comment_enabled, sort_order, is_deleted
      ) VALUES ($1, $2, 'ANSWER3', 'Third stage-less answer',
                'free_text', false, true, 0, false)
    `, [thirdRequiredQuestionUuid, thirdRequiredSectionUuid]);
    await client.query(`
      INSERT INTO frm_sections(
        section_uuid, form_version_uuid, form_part_uuid, section_code, section_title,
        responsible_mode, signature_officer_required, signature_seafarer_required,
        layout_preference, sort_order, is_deleted
      ) VALUES
         ($1, $2, $3, 'INFO', 'Informational system values', 'not_applicable',
          false, false, 'list', 3, false),
         ($4, $2, $3, 'INFO2', 'Second informational system value', 'not_applicable',
          false, false, 'list', 4, false)
    `, [infoSectionUuid, formVersionUuid, partUuid, secondInfoSectionUuid]);
    await client.query(`
      INSERT INTO frm_questions(
        question_uuid, section_uuid, question_code, question_text, content_html,
        response_type, is_mandatory, comment_enabled, sort_order, is_deleted
      ) VALUES ($1, $2, 'INFO_CONTENT', 'Information', '<p>Read-only information.</p>',
                'content', false, false, 0, false)
    `, [infoContentQuestionUuid, infoSectionUuid]);
    await client.query(`
      INSERT INTO frm_questions(
        question_uuid, section_uuid, question_code, question_text, system_field_key,
        response_type, is_mandatory, comment_enabled, sort_order, is_deleted
      ) VALUES
        ($1, $2, 'INFO_SYSTEM', 'Subject label', $3, 'system_field', false, false, 1, false),
        ($7, $2, 'INFO_NULL', 'Optional value', $8, 'system_field', false, false, 2, false),
        ($4, $5, 'INFO_DATE', 'Date of declaration', $6, 'system_field', false, false, 0, false)
    `, [
      infoSystemQuestionUuid,
      infoSectionUuid,
      subjectLabelSystemFieldKey,
      secondInfoSystemQuestionUuid,
      secondInfoSectionUuid,
      declarationDateSystemFieldKey,
      infoNullSystemQuestionUuid,
      nullSystemFieldKey,
    ]);

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
      await client.query("BEGIN");
      if (lifecycleSchemaReady && submissionUuids.length > 0) {
        // Production rows are immutable. Disable only the database-enforced
        // snapshot DELETE guard while this fixture removes its own private test
        // submissions; no application write path has access to this teardown.
        await client.query(
          "ALTER TABLE frm_company_submission_system_snapshots DISABLE TRIGGER trg_prevent_company_system_snapshot_update",
        );
        await client.query(
          "DELETE FROM frm_company_submission_system_snapshots WHERE submission_uuid = ANY($1::text[])",
          [submissionUuids],
        );
        const attachments = await client.query<{ sig_att_uuid: string; file_path: string }>(
          `SELECT sig_att_uuid, file_path
           FROM frm_signature_attachments WHERE created_by_uuid = $1`,
          [String(officeUserId)],
        );
        await client.query(
          `DELETE FROM frm_section_signatures
           WHERE section_state_uuid IN (
             SELECT section_state_uuid FROM frm_section_states WHERE submission_uuid = ANY($1::text[])
           )`,
          [submissionUuids],
        );
        for (const attachment of attachments.rows) {
          await fileStorageService.deleteAttachment(attachment.file_path);
        }
        await client.query(
          "DELETE FROM frm_answers WHERE submission_uuid = ANY($1::text[])",
          [submissionUuids],
        );
        await client.query(
          "DELETE FROM frm_section_states WHERE submission_uuid = ANY($1::text[])",
          [submissionUuids],
        );
        await client.query(
          "DELETE FROM frm_company_submissions WHERE submission_uuid = ANY($1::text[])",
          [submissionUuids],
        );
        await client.query(
          `DELETE FROM frm_signature_attachments
           WHERE sig_att_uuid = ANY($1::text[])`,
          [attachments.rows.map((attachment) => attachment.sig_att_uuid)],
        );
        await client.query(
          "ALTER TABLE frm_company_submission_system_snapshots ENABLE TRIGGER trg_prevent_company_system_snapshot_update",
        );
      }
      await client.query(
        "DELETE FROM frm_questions WHERE question_uuid = ANY($1::text[])",
        [[
          questionUuid,
          secondRequiredQuestionUuid,
          thirdRequiredQuestionUuid,
          infoContentQuestionUuid,
          infoSystemQuestionUuid,
          infoNullSystemQuestionUuid,
          secondInfoSystemQuestionUuid,
        ]],
      );
      await client.query(
        "DELETE FROM frm_sections WHERE section_uuid = ANY($1::text[])",
        [[
          sectionUuid,
          secondRequiredSectionUuid,
          thirdRequiredSectionUuid,
          infoSectionUuid,
          secondInfoSectionUuid,
        ]],
      );
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
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
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
    const submissionUuid = created.body.submissionUuid as string;
    submissionUuids.push(submissionUuid);
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
    expect(render.body.parts[0].sections).toHaveLength(5);
    expect(render.body.parts[0].sections.map((section: any) => section.requiresSubmission)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(render.body.parts[0].sections.map((section: any) => section.isApplicable)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(render.body.parts[0].sections.find((section: any) => section.sectionUuid === infoSectionUuid)
      .questions.find((question: any) => question.questionUuid === infoSystemQuestionUuid)
      .systemField.value).toBe("Stage-less record at start");
    expect(render.body.parts[0].sections.find((section: any) => section.sectionUuid === infoSectionUuid)
      .questions.find((question: any) => question.questionUuid === infoNullSystemQuestionUuid)
      .systemField.value).toBeNull();
    expect(render.body.parts[0].sections.find((section: any) => section.sectionUuid === secondInfoSectionUuid)
      .questions.find((question: any) => question.questionUuid === secondInfoSystemQuestionUuid)
      .systemField.value).toBe(render.body.systemFields
      .find((field: any) => field.key === declarationDateSystemFieldKey).value);

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

    const secondAnswer = await api(
      "put",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${secondRequiredSectionUuid}/answers`,
      { answers: [{ questionUuid: secondRequiredQuestionUuid, value: "second stage-less answer" }] },
    );
    expect(secondAnswer.status).toBe(204);

    const firstSectionSubmitted = await api(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${sectionUuid}/submit`,
      {},
    );
    expect(firstSectionSubmitted.status).toBe(200);
    expect(firstSectionSubmitted.body.completed).toBe(false);
    const submittedFirstRender = await api("get", `/api/v2/company-form-submissions/${submissionUuid}/form`);
    expect(submittedFirstRender.body.systemSnapshotEvent).toBe("section_submission");
    expect(submittedFirstRender.body.systemSnapshotAt).toBeTruthy();
    expect(submittedFirstRender.body.submission.status).toBe("in_progress");
    currentSubjectLabels.set(subjectRef, "Stage-less record changed after first section submission");

    const missingSignature = await api(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${secondRequiredSectionUuid}/submit`,
      {},
    );
    expect(missingSignature.status).toBe(400);
    const invalidSignature = await api(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${secondRequiredSectionUuid}/signatures`,
      { signatureType: "officer", method: "officer", data: "not-a-data-url" },
    );
    expect(invalidSignature.status).toBe(400);
    const snapshotsBeforeSignatureEdit = await client.query(
      `SELECT field_key, section_uuid, question_uuid, value
       FROM frm_company_submission_system_snapshots
       WHERE submission_uuid = $1 AND is_deleted = false
       ORDER BY question_uuid`,
      [submissionUuid],
    );
    const snapshotBoundaryBeforeSignatureEdit = await client.query(
      `SELECT system_snapshot_at, system_snapshot_event
       FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    expect(snapshotsBeforeSignatureEdit.rows).toHaveLength(3);
    expect(snapshotsBeforeSignatureEdit.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field_key: nullSystemFieldKey,
        section_uuid: infoSectionUuid,
        question_uuid: infoNullSystemQuestionUuid,
        value: null,
      }),
    ]));

    const genuineSignatureWrite = vi.spyOn(fileStorageService, "writeAttachment");
    try {
      const officerSignature = await signAsOfficer(submissionUuid, secondRequiredSectionUuid);
      expect(officerSignature.status).toBe(201);
      expect(officerSignature.body).toMatchObject({
        signatureType: "officer",
        signerName: "Stage-less Office Tester",
        signatureMethod: "officer",
      });
      expect(genuineSignatureWrite).toHaveBeenCalledOnce();
    } finally {
      genuineSignatureWrite.mockRestore();
    }
    const optionalSignature = await signAsOfficer(submissionUuid, thirdRequiredSectionUuid);
    expect(optionalSignature.status).toBe(201);
    const signatureDetail = await api("get", `/api/v2/company-form-submissions/${submissionUuid}`);
    const signatureStateBeforeReplacementFailure = signatureDetail.body.states
      .find((state: any) => state.sectionUuid === thirdRequiredSectionUuid);
    expect(signatureStateBeforeReplacementFailure.signatures).toHaveLength(1);
    const visibleSignatureBeforeReplacementFailure = signatureStateBeforeReplacementFailure.signatures[0];
    const failedReplacementWrite = vi.spyOn(fileStorageService, "writeAttachment")
      .mockRejectedValueOnce(new Error("Injected signature asset persistence failure."));
    try {
      const failedReplacement = await signAsOfficer(submissionUuid, thirdRequiredSectionUuid);
      expect(failedReplacement.status).toBe(500);
    } finally {
      failedReplacementWrite.mockRestore();
    }
    const signatureDetailAfterReplacementFailure = await api(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}`,
    );
    const visibleSignaturesAfterReplacementFailure = signatureDetailAfterReplacementFailure.body.states
      .find((state: any) => state.sectionUuid === thirdRequiredSectionUuid).signatures;
    expect(visibleSignaturesAfterReplacementFailure).toHaveLength(1);
    expect(visibleSignaturesAfterReplacementFailure[0]).toMatchObject({
      sectionSignatureUuid: visibleSignatureBeforeReplacementFailure.sectionSignatureUuid,
      signatureType: "officer",
      signerName: visibleSignatureBeforeReplacementFailure.signerName,
      signatureMethod: "officer",
      attachment: { assetUuid: visibleSignatureBeforeReplacementFailure.attachment.assetUuid },
    });
    const sectionSignatureUuid = signatureDetail.body.states
      .find((state: any) => state.sectionUuid === thirdRequiredSectionUuid)
      .signatures[0].sectionSignatureUuid;
    const replacementSignature = await signAsOfficer(submissionUuid, thirdRequiredSectionUuid);
    expect(replacementSignature.status).toBe(201);
    const removedSignature = await api(
      "delete",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${thirdRequiredSectionUuid}/signatures/${sectionSignatureUuid}`,
    );
    expect(removedSignature.status).toBe(204);
    const snapshotsAfterSignatureRemoval = await client.query(
      `SELECT question_uuid, value
       FROM frm_company_submission_system_snapshots
       WHERE submission_uuid = $1 AND is_deleted = false`,
      [submissionUuid],
    );
    expect(snapshotsAfterSignatureRemoval.rows).toHaveLength(3);
    expect(snapshotsAfterSignatureRemoval.rows).toEqual(expect.arrayContaining(
      snapshotsBeforeSignatureEdit.rows.map((row: any) =>
        expect.objectContaining({ question_uuid: row.question_uuid, value: row.value })),
    ));
    const snapshotBoundaryAfterSignatureRemoval = await client.query(
      `SELECT system_snapshot_at, system_snapshot_event
       FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    expect(snapshotBoundaryAfterSignatureRemoval.rows).toEqual(snapshotBoundaryBeforeSignatureEdit.rows);
    const reSignedAfterRemoval = await signAsOfficer(submissionUuid, thirdRequiredSectionUuid);
    expect(reSignedAfterRemoval.status).toBe(201);
    const snapshotsAfterResign = await client.query(
      `SELECT question_uuid, value
       FROM frm_company_submission_system_snapshots
       WHERE submission_uuid = $1 AND is_deleted = false`,
      [submissionUuid],
    );
    expect(snapshotsAfterResign.rows).toHaveLength(3);
    expect(snapshotsAfterResign.rows).toEqual(expect.arrayContaining(
      snapshotsBeforeSignatureEdit.rows.map((row: any) =>
        expect.objectContaining({ question_uuid: row.question_uuid, value: row.value })),
    ));
    const snapshotBoundaryAfterResign = await client.query(
      `SELECT system_snapshot_at, system_snapshot_event
       FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    expect(snapshotBoundaryAfterResign.rows).toEqual(snapshotBoundaryBeforeSignatureEdit.rows);
    const submitted = await api(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${secondRequiredSectionUuid}/submit`,
      {},
    );
    expect(submitted.status).toBe(200);
    expect(submitted.body.completed).toBe(false);
    const thirdSectionSubmitted = await api(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${thirdRequiredSectionUuid}/submit`,
      {},
    );
    expect(thirdSectionSubmitted.status).toBe(200);
    expect(thirdSectionSubmitted.body.completed).toBe(true);

    const frozenRender = await api("get", `/api/v2/company-form-submissions/${submissionUuid}/form`);
    expect(frozenRender.status).toBe(200);
    expect(frozenRender.body.submission.status).toBe("completed");
    expect(frozenRender.body.systemSnapshotEvent).toBe("section_submission");
    expect(frozenRender.body.systemSnapshotAt).toBeTruthy();
    expect(frozenRender.body.systemValuesChanged).toBe(true);
    expect(frozenRender.body.systemValuesChangedNotice).toBe(
      "The record has changed since signing began. This declaration shows the values at the time of first signature.",
    );
    const frozenSubjectPoint = frozenRender.body.parts.flatMap((part: any) => part.sections)
      .flatMap((section: any) => section.questions)
      .find((question: any) => question.questionUuid === infoSystemQuestionUuid);
    expect(frozenSubjectPoint.systemField).toMatchObject({
      value: "Stage-less record at start",
      valueOrigin: "frozen_snapshot",
    });
    const frozenDatePoint = frozenRender.body.parts.flatMap((part: any) => part.sections)
      .flatMap((section: any) => section.questions)
      .find((question: any) => question.questionUuid === secondInfoSystemQuestionUuid);
    expect(frozenDatePoint.systemField).toMatchObject({
      value: frozenRender.body.systemFields.find((field: any) => field.key === declarationDateSystemFieldKey).value,
      valueOrigin: "frozen_snapshot",
    });
    const frozenNullPoint = frozenRender.body.parts.flatMap((part: any) => part.sections)
      .flatMap((section: any) => section.questions)
      .find((question: any) => question.questionUuid === infoNullSystemQuestionUuid);
    expect(frozenNullPoint.systemField).toMatchObject({
      value: null,
      valueOrigin: "frozen_snapshot",
    });
    const snapshots = await client.query(
      `SELECT field_key, section_uuid, question_uuid, value
       FROM frm_company_submission_system_snapshots
       WHERE submission_uuid = $1 AND is_deleted = false
       ORDER BY question_uuid`,
      [submissionUuid],
    );
    expect(snapshots.rows).toHaveLength(3);
    expect(snapshots.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field_key: subjectLabelSystemFieldKey,
        section_uuid: infoSectionUuid,
        question_uuid: infoSystemQuestionUuid,
        value: "Stage-less record at start",
      }),
      expect.objectContaining({
        field_key: declarationDateSystemFieldKey,
        section_uuid: secondInfoSectionUuid,
        question_uuid: secondInfoSystemQuestionUuid,
        value: frozenDatePoint.systemField.value,
      }),
      expect.objectContaining({
        field_key: nullSystemFieldKey,
        section_uuid: infoSectionUuid,
        question_uuid: infoNullSystemQuestionUuid,
        value: null,
      }),
    ]));

    comparisonFailureSubjectRefs.add(subjectRef);
    declarationDateDriftSubjectRefs.add(subjectRef);
    const comparisonUnavailable = await api("get", `/api/v2/company-form-submissions/${submissionUuid}/form`);
    expect(comparisonUnavailable.status).toBe(200);
    expect(comparisonUnavailable.body.systemValuesComparisonError).toBe(true);
    expect(comparisonUnavailable.body.systemValuesChanged).toBe(true);
    expect(comparisonUnavailable.body.systemValuesChangedNotice).toBe(
      "The record has changed since signing began. This declaration shows the values at the time of first signature.",
    );
    comparisonFailureSubjectRefs.delete(subjectRef);
    declarationDateDriftSubjectRefs.delete(subjectRef);

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

  it("freezes one complete snapshot when submit and sign race on different required sections", async () => {
    const racedSubmissionUuid = await startSubmission(raceSubjectRef);
    const [submitted, signed] = await Promise.all([
      api(
        "post",
        `/api/v2/company-form-submissions/${racedSubmissionUuid}/sections/${sectionUuid}/submit`,
        {},
      ),
      signAsOfficer(racedSubmissionUuid, secondRequiredSectionUuid),
    ]);
    expect(submitted.status).toBe(200);
    expect(signed.status).toBe(201);

    const submission = await client.query(
      `SELECT system_snapshot_at, system_snapshot_event
       FROM frm_company_submissions WHERE submission_uuid = $1`,
      [racedSubmissionUuid],
    );
    expect(submission.rows[0].system_snapshot_at).toBeTruthy();
    expect(["section_submission", "signature"]).toContain(submission.rows[0].system_snapshot_event);
    const snapshots = await client.query(
      `SELECT field_key, section_uuid, question_uuid, value
       FROM frm_company_submission_system_snapshots
       WHERE submission_uuid = $1 AND is_deleted = false
       ORDER BY question_uuid`,
      [racedSubmissionUuid],
    );
    expect(snapshots.rows).toHaveLength(3);
    expect(snapshots.rows.map((row: any) => row.question_uuid).sort()).toEqual([
      infoNullSystemQuestionUuid,
      infoSystemQuestionUuid,
      secondInfoSystemQuestionUuid,
    ].sort());
    expect(snapshots.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        field_key: subjectLabelSystemFieldKey,
        section_uuid: infoSectionUuid,
        question_uuid: infoSystemQuestionUuid,
        value: "Race subject at start",
      }),
      expect.objectContaining({
        field_key: declarationDateSystemFieldKey,
        section_uuid: secondInfoSectionUuid,
        question_uuid: secondInfoSystemQuestionUuid,
        value: expect.any(String),
      }),
      expect.objectContaining({
        field_key: nullSystemFieldKey,
        section_uuid: infoSectionUuid,
        question_uuid: infoNullSystemQuestionUuid,
        value: null,
      }),
    ]));
    expect(snapshots.rows.find((row: any) => row.question_uuid === infoNullSystemQuestionUuid).value).toBeNull();
    const rendered = await api("get", `/api/v2/company-form-submissions/${racedSubmissionUuid}/form`);
    expect(rendered.status).toBe(200);
    expect(rendered.body.systemSnapshotEvent).toBe(submission.rows[0].system_snapshot_event);
    expect(rendered.body.systemSnapshotAt).toBeTruthy();
  });

  it("does not freeze System values after failed validation or invalid signature data", async () => {
    const failedSubmissionUuid = await startSubmission(failedSubjectRef);
    const invalidSubmit = await api(
      "post",
      `/api/v2/company-form-submissions/${failedSubmissionUuid}/sections/${secondRequiredSectionUuid}/submit`,
      {},
    );
    expect(invalidSubmit.status).toBe(400);
    const invalidSignature = await signAsOfficer(
      failedSubmissionUuid,
      secondRequiredSectionUuid,
      "data:image/png;base64,not-an-image",
    );
    expect(invalidSignature.status).toBe(400);

    const parent = await client.query(
      `SELECT system_snapshot_at, system_snapshot_event
       FROM frm_company_submissions WHERE submission_uuid = $1`,
      [failedSubmissionUuid],
    );
    expect(parent.rows[0]).toEqual({ system_snapshot_at: null, system_snapshot_event: null });
    const snapshots = await client.query(
      `SELECT question_uuid FROM frm_company_submission_system_snapshots
       WHERE submission_uuid = $1 AND is_deleted = false`,
      [failedSubmissionUuid],
    );
    expect(snapshots.rows).toEqual([]);
    const form = await api("get", `/api/v2/company-form-submissions/${failedSubmissionUuid}/form`);
    expect(form.status).toBe(200);
    expect(form.body.systemSnapshotAt).toBeNull();
    expect(form.body.systemSnapshotEvent).toBeNull();
    expect(form.body.systemValuesChanged).toBeNull();
    expect(form.body.systemValuesComparisonError).toBe(false);
  });

  it("rolls back a signature when asset persistence or the first snapshot fails", async () => {
    const failedPersistenceSubmissionUuid = await startSubmission(assetFailureSubjectRef);
    const editableAnswer = await api(
      "put",
      `/api/v2/company-form-submissions/${failedPersistenceSubmissionUuid}/sections/${sectionUuid}/answers`,
      { answers: [{ questionUuid, value: "preserve this editable answer", comment: "before signature failure" }] },
    );
    expect(editableAnswer.status).toBe(204);

    const lifecycleState = async () => {
      const [parent, states, answers, signatures, snapshots] = await Promise.all([
        client.query(
          `SELECT status, completed_at, system_snapshot_at, system_snapshot_event
           FROM frm_company_submissions WHERE submission_uuid = $1`,
          [failedPersistenceSubmissionUuid],
        ),
        client.query(
          `SELECT section_uuid, status, section_comment, submitted_by_uuid, submitted_at
           FROM frm_section_states WHERE submission_uuid = $1 AND is_deleted = false
           ORDER BY section_uuid`,
          [failedPersistenceSubmissionUuid],
        ),
        client.query(
          `SELECT question_uuid, answer_value, answer_comment
           FROM frm_answers WHERE submission_uuid = $1 AND is_deleted = false
           ORDER BY question_uuid`,
          [failedPersistenceSubmissionUuid],
        ),
        client.query(
          `SELECT signature.signature_type, signature.signer_name,
                  signature.signature_method, signature.is_deleted
           FROM frm_section_signatures AS signature
           JOIN frm_section_states AS state ON state.section_state_uuid = signature.section_state_uuid
           WHERE state.submission_uuid = $1
           ORDER BY signature.section_signature_uuid`,
          [failedPersistenceSubmissionUuid],
        ),
        client.query(
          `SELECT field_key, section_uuid, question_uuid, value
           FROM frm_company_submission_system_snapshots
           WHERE submission_uuid = $1 AND is_deleted = false
           ORDER BY question_uuid`,
          [failedPersistenceSubmissionUuid],
        ),
      ]);
      return {
        parent: parent.rows,
        states: states.rows,
        answers: answers.rows,
        signatures: signatures.rows,
        snapshots: snapshots.rows,
      };
    };
    const beforeFailure = await lifecycleState();
    expect(beforeFailure.parent[0]).toMatchObject({
      status: "in_progress",
      completed_at: null,
      system_snapshot_at: null,
      system_snapshot_event: null,
    });
    expect(beforeFailure.signatures).toEqual([]);
    expect(beforeFailure.snapshots).toEqual([]);

    const unconfiguredWrite = vi.spyOn(fileStorageService, "writeAttachment");
    try {
      const unconfiguredRequests = await Promise.all([
        api(
          "post",
          `/api/v2/company-form-submissions/${failedPersistenceSubmissionUuid}/sections/${infoSectionUuid}/signatures`,
          { signatureType: "officer", method: "officer", data: "data:image/png;base64,iVBORw0KGgo=" },
        ),
        api(
          "post",
          `/api/v2/company-form-submissions/${failedPersistenceSubmissionUuid}/sections/${infoSectionUuid}/signatures`,
          { signatureType: "seafarer", method: "authenticated", data: "data:image/png;base64,iVBORw0KGgo=" },
        ),
        api(
          "post",
          `/api/v2/company-form-submissions/${failedPersistenceSubmissionUuid}/sections/${sectionUuid}/signatures`,
          { signatureType: "officer", method: "officer", data: "data:image/png;base64,iVBORw0KGgo=" },
        ),
      ]);
      expect(unconfiguredRequests.map((response) => response.status)).toEqual([400, 400, 400]);
      expect(unconfiguredRequests.map((response) => response.body.message)).toEqual([
        "Company Representative signing is not configured for this section.",
        "Seafarer signing is not configured for this section.",
        "Company Representative signing is not configured for this section.",
      ]);
      expect(unconfiguredWrite).not.toHaveBeenCalled();
    } finally {
      unconfiguredWrite.mockRestore();
    }
    expect(await lifecycleState()).toEqual(beforeFailure);

    const persistenceFailure = vi.spyOn(fileStorageService, "writeAttachment")
      .mockRejectedValueOnce(new Error("Injected attachment persistence failure."));
    try {
      const failedSign = await signAsOfficer(failedPersistenceSubmissionUuid, secondRequiredSectionUuid);
      expect(failedSign.status).toBe(500);
    } finally {
      persistenceFailure.mockRestore();
    }
    expect(await lifecycleState()).toEqual(beforeFailure);

    const originalWriteAttachment = fileStorageService.writeAttachment.bind(fileStorageService);
    let writtenSignaturePath: string | undefined;
    const attachmentCountBeforeSnapshotFailure = await client.query(
      "SELECT COUNT(*)::text AS count FROM frm_signature_attachments WHERE created_by_uuid = $1",
      [String(officeUserId)],
    );
    expectedAttachmentCountDuringSnapshotFailure =
      Number(attachmentCountBeforeSnapshotFailure.rows[0].count) + 1;
    snapshotFailureObservedInsertedAttachment = false;
    const trackedWrite = vi.spyOn(fileStorageService, "writeAttachment")
      .mockImplementationOnce(async (...args) => {
        writtenSignaturePath = await originalWriteAttachment(...args);
        return writtenSignaturePath;
      });
    snapshotFailureSubjectRefs.add(assetFailureSubjectRef);
    try {
      const failedFreeze = await signAsOfficer(failedPersistenceSubmissionUuid, secondRequiredSectionUuid);
      expect(failedFreeze.status).toBe(500);
    } finally {
      snapshotFailureSubjectRefs.delete(assetFailureSubjectRef);
      trackedWrite.mockRestore();
    }
    expect(snapshotFailureObservedInsertedAttachment).toBe(true);
    expect(writtenSignaturePath).toBeTruthy();
    const filePath = path.resolve(".private", writtenSignaturePath!);
    try {
      await expect(access(filePath)).rejects.toThrow();
    } finally {
      await fileStorageService.deleteAttachment(writtenSignaturePath!);
    }
    expect((await client.query(
      "SELECT sig_att_uuid FROM frm_signature_attachments WHERE file_path = $1",
      [writtenSignaturePath],
    )).rows).toEqual([]);
    expect(await lifecycleState()).toEqual(beforeFailure);
  });

  it("does not backfill a legacy declaration without snapshot rows and distinguishes it from a frozen null value", async () => {
    const legacySubmissionUuid = await startSubmission(legacySubjectRef);
    await client.query(
      `INSERT INTO frm_section_states(
         section_state_uuid, submission_uuid, section_uuid, status,
         section_comment, submitted_by_uuid, submitted_by_name, submitted_at, is_deleted
       ) VALUES ($1, $2, $3, 'submitted', 'Legacy declaration', $4, 'Stage-less Office Tester', NOW(), false)`,
      [uuid(), legacySubmissionUuid, sectionUuid, String(officeUserId)],
    );

    const legacySignature = await signAsOfficer(legacySubmissionUuid, secondRequiredSectionUuid);
    expect(legacySignature.status).toBe(201);
    const parent = await client.query(
      `SELECT system_snapshot_at, system_snapshot_event
       FROM frm_company_submissions WHERE submission_uuid = $1`,
      [legacySubmissionUuid],
    );
    expect(parent.rows[0]).toEqual({ system_snapshot_at: null, system_snapshot_event: null });
    const snapshots = await client.query(
      `SELECT question_uuid, value FROM frm_company_submission_system_snapshots
       WHERE submission_uuid = $1 AND is_deleted = false`,
      [legacySubmissionUuid],
    );
    expect(snapshots.rows).toEqual([]);

    const form = await api("get", `/api/v2/company-form-submissions/${legacySubmissionUuid}/form`);
    expect(form.status).toBe(200);
    expect(form.body.systemSnapshotAt).toBeNull();
    expect(form.body.systemSnapshotEvent).toBeNull();
    expect(form.body.systemValuesComparisonError).toBe(true);
    expect(form.body.systemValuesChanged).toBeNull();
    const oldNullPoint = form.body.parts.flatMap((part: any) => part.sections)
      .flatMap((section: any) => section.questions)
      .find((question: any) => question.questionUuid === infoNullSystemQuestionUuid);
    expect(oldNullPoint.systemField).toMatchObject({
      value: null,
      valueOrigin: "persisted_snapshot_unavailable",
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