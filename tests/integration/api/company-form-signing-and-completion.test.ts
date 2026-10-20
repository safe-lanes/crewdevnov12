import { clearCompanyFormDocumentFixtures } from "../../helpers/companyFormDocumentCleanup";
import { openHarnessStages, captureHarnessContractRank } from "../../helpers/company-form-stage-fixtures";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "crypto";
import { grantCompanyFormFixture, clearCompanyFormFixtures } from "../../helpers/companyFormGrants";
import type { Server } from "http";
import companyFormSubmissionsRoutes from "@server/v2/company-forms/routes";
import { fileStorageService } from "@server/v2/shared/fileStorageService";
import { sailDate } from "@shared/v2/forms-engine/displayFormatting";

const TEST_SECRET = "company-form-signing-integration-test-secret";
const SUFFIX = randomUUID().replaceAll("-", "").slice(0, 12);
const uuid = () => randomUUID();
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL5RwAAAABJRU5ErkJggg==";

type User = { id: number; roleUuid: string; roleName: string };
type VersionFixture = {
  versionUuid: string;
  signSectionUuid: string;
  otherSectionUuid: string;
  racingSectionUuid: string;
  infoSectionUuid: string;
  answerQuestionUuid: string;
  otherQuestionUuid: string;
  systemQuestionUuids: string[];
};

let db: Client;
let server: Server;
let office: User;
let readonlyOffice: User;
let deniedOffice: User;
let shipUser: User;
let subjectUuid = "";
let subjectVesselUuid = "";
let wrongVesselUuid = "";
let assignmentUuids: string[] = [];
let testAssignments: string[] = [];
let formUuid = "";
let versions: VersionFixture[] = [];
let formBUuid = "";
let formBVersion: VersionFixture;
let userIds: number[] = [];
let roleUuids: string[] = [];
let attachmentPaths: string[] = [];
let submissionUuids: string[] = [];
let primarySubmissionUuid = "";
let masterRankId = "";
let changedRankId = "";
const previousJwtSecret = process.env.JWT_SECRET;
const previousAuthBypass = process.env.AUTH_BYPASS;

function token(user: User, userType = user.roleName === "ship" ? "Ship" : "Office"): string {
  return jwt.sign({ id: user.id, domain: "test", userType }, TEST_SECRET, { expiresIn: "1h" });
}

function call(
  method: string,
  path: string,
  options: { user?: User; userType?: string; body?: unknown } = {},
) {
  let req = (request(server) as any)[method.toLowerCase()](path);
  if (options.user) {
    req = req.set("Authorization", `Bearer ${token(options.user, options.userType)}`);
  }
  if (options.body !== undefined) req = req.send(options.body);
  return req;
}

async function createOffice(roleName: string, grants: "crew" | "readonly" | "none"): Promise<User> {
  const roleUuid = uuid();
  await db.query(
    `INSERT INTO adm_rolemaster_ac (ruid, assigned_role, roletype, is_active, is_deleted)
     VALUES ($1, $2, 'Office', true, false)`,
    [roleUuid, roleName],
  );
  roleUuids.push(roleUuid);
  const userResult = await db.query(
    `INSERT INTO master_users
       (user_type, role, fullname, designation)
     VALUES ('Office', $1, $2, 'Marine Superintendent') RETURNING id`,
    [roleName, `${roleName} ${SUFFIX}`],
  );
  const user = { id: Number(userResult.rows[0].id), roleUuid, roleName };
  userIds.push(user.id);
  if (grants === "none") return user;
  await grantCompanyFormFixture(db, roleUuid, grants === "crew" ? "office" : "view");

  const menu = await db.query(
    `SELECT muid FROM adm_menumaster_ac
     WHERE name = 'Crew Database' AND is_active = true AND is_deleted = false`,
  );
  if (menu.rowCount !== 1) {
    throw new Error("Expected exactly one active Crew Database menu for the Company Form integration test.");
  }
  await db.query(
    `INSERT INTO adm_roleaccess_ac
       (rauid, role_id, menu_id, canview, cancreate, canedit, candelete, is_deleted)
     VALUES ($1, $2, $3, true, $4, $5, false, false)`,
    [uuid(), roleUuid, menu.rows[0].muid, grants === "crew", grants === "crew"],
  );
  return user;
}

async function createShipUser(roleName: string, vesselId: number): Promise<User> {
  const roleUuid = uuid();
  await db.query(
    `INSERT INTO adm_rolemaster_ac (ruid, assigned_role, roletype, is_active, is_deleted)
     VALUES ($1, $2, 'Ship', true, false)`,
    [roleUuid, roleName],
  );
  roleUuids.push(roleUuid);
  const userResult = await db.query(
    `INSERT INTO master_users (user_type, role, vessel_ids, fullname)
     VALUES ('Ship', $1, $2, $3) RETURNING id`,
    [roleName, String(vesselId), `${roleName} ${SUFFIX}`],
  );
  await grantCompanyFormFixture(db, roleUuid, "vessel");
  const user = { id: Number(userResult.rows[0].id), roleUuid, roleName: "ship" };
  userIds.push(user.id);
  return user;
}

async function createVersion(input: {
  formUuid: string;
  formId: number;
  versionNo: string;
}): Promise<VersionFixture> {
  const versionUuid = uuid();
  await db.query(
    `INSERT INTO adm_form_versions_v2
       (fv_uuid, form_id, version_no, version_date, status, stage_key, is_deleted, released_at)
     VALUES ($1, $2, $3, '2026-01-01', 'released', 'before_joining', false, NOW())`,
    [versionUuid, input.formId, input.versionNo],
  );

  const partUuid = uuid();
  const signSectionUuid = uuid();
  const otherSectionUuid = uuid();
  const racingSectionUuid = uuid();
  const infoSectionUuid = uuid();
  await db.query(
    `INSERT INTO frm_form_parts
       (form_part_uuid, form_uuid, form_version_uuid, part_code, part_title,
        part_type, is_office_only, sort_order, is_deleted)
     VALUES ($1, $2, $3, 'PART', $4, 'configurable', false, 0, false)`,
    [partUuid, input.formUuid, versionUuid, `Signing test ${input.versionNo} ${SUFFIX}`],
  );
  await db.query(
    `INSERT INTO frm_sections
       (section_uuid, form_version_uuid, form_part_uuid, section_code, section_title,
        responsible_mode, responsible_role_uuid, responsible_department,
        comment_box_required, signature_officer_required, signature_seafarer_required,
        layout_preference, sort_order, is_deleted)
     VALUES
       ($1, $4, $3, 'SIGN', 'Required answers and signatures',
        'seafarer', NULL, NULL, true, true, true, 'list', 0, false),
       ($2, $4, $3, 'OTHER', 'Second answerable section',
        'seafarer', NULL, NULL, false, false, false, 'list', 1, false),
       ($5, $4, $3, 'INFO', 'Informational system fields only',
        'not_applicable', NULL, NULL, false, false, false, 'list', 2, false),
       ($6, $4, $3, 'RACING', 'Concurrent section declaration',
        'seafarer', NULL, NULL, false, false, false, 'list', 3, false)`,
    [signSectionUuid, otherSectionUuid, partUuid, versionUuid, infoSectionUuid, racingSectionUuid],
  );

  const answerQuestionUuid = uuid();
  const otherQuestionUuid = uuid();
  const systemQuestionUuids = [uuid(), uuid(), uuid(), uuid()];
  const contentQuestionUuid = uuid();
  const infoQuestionUuid = uuid();
  const racingQuestionUuid = uuid();
  await db.query(
    `INSERT INTO frm_questions
       (question_uuid, section_uuid, question_code, question_text, system_field_key,
        response_type, is_mandatory, comment_enabled, sort_order, is_deleted)
     VALUES
       ($1, $2, 'ANSWER', 'Mandatory signing answer', NULL, 'free_text', true, true, 0, false),
       ($3, $4, 'OTHER', 'Second answerable point', NULL, 'free_text', false, true, 0, false),
       ($5, $11, 'NAME', 'Seafarer name', 'seafarer_name', 'system_field', false, false, 0, false),
       ($6, $11, 'RANK', 'Rank', 'rank', 'system_field', false, false, 1, false),
       ($7, $11, 'NATIONALITY', 'Nationality', 'nationality', 'system_field', false, false, 2, false),
       ($8, $11, 'DECLARATION_DATE', 'Declaration date', 'date_of_declaration', 'system_field', false, false, 3, false),
       ($9, $11, 'CONTENT', 'Instructions', NULL, 'content', true, false, 4, false),
       ($10, $11, 'INFO', 'Informational text', NULL, 'info_only', true, false, 5, false),
       ($12, $13, 'RACE', 'Concurrent optional point', NULL, 'free_text', false, true, 0, false)`,
    [
      answerQuestionUuid, signSectionUuid, otherQuestionUuid, otherSectionUuid,
      ...systemQuestionUuids, contentQuestionUuid, infoQuestionUuid, infoSectionUuid,
      racingQuestionUuid, racingSectionUuid,
    ],
  );
  return {
    versionUuid,
    signSectionUuid,
    otherSectionUuid,
    racingSectionUuid,
    infoSectionUuid,
    answerQuestionUuid,
    otherQuestionUuid,
    systemQuestionUuids,
  };
}

async function createSubmission(
  owner: User,
  assignmentUuid: string,
  versionUuid: string,
  selectedFormUuid = formUuid,
): Promise<string> {
  const response = await call(
    "post",
    `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/submissions`,
    { user: owner, body: { formUuid: selectedFormUuid, formVersionUuid: versionUuid } },
  );
  expect(response.status).toBe(201);
  const submissionUuid = response.body.submissionUuid ?? response.body.submission?.submissionUuid;
  expect(submissionUuid).toEqual(expect.any(String));
  submissionUuids.push(submissionUuid);
  return submissionUuid;
}

async function createForm(formName: string): Promise<{ formUuid: string; formId: number }> {
  const formUuid = uuid();
  const formId = await db.query(
    `INSERT INTO adm_forms_v2
       (form_uuid, name, category, rank_group, version_no, version_date, subject_type, is_deleted)
     VALUES ($1, $2, 'dynamic', 'Company Form lifecycle test', '01', '2026-01-01',
             'crew_assignment', false)
     RETURNING id`,
    [formUuid, formName],
  );
  return { formUuid, formId: Number(formId.rows[0].id) };
}

async function createCrewAssignment(assignmentType: string, vesselUuid = subjectVesselUuid): Promise<string> {
  const assignUuid = uuid();
  await db.query(
    `INSERT INTO crew_assignments
       (assign_uuid, crew_uuid, vessel_uuid, assignment_type, is_current, is_deleted)
     VALUES ($1, $2, $3, $4, false, false)`,
    [assignUuid, subjectUuid, vesselUuid, assignmentType],
  );
  await openHarnessStages(db, assignUuid);
  await captureHarnessContractRank(db, assignUuid, masterRankId);
  assignmentUuids.push(assignUuid);
  return assignUuid;
}

describe("Company Form signing, section submission, completion, and void history", () => {
  beforeAll(async () => {
    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.AUTH_BYPASS;
    const { authMiddleware } = await import("@server/middleware/authMiddleware");
    const app = express();
    app.use(express.json());
    app.use(authMiddleware);
    app.use("/api/v2/company-form-submissions", companyFormSubmissionsRoutes);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });

    office = await createOffice(`CF Life Cycle Editor ${SUFFIX}`, "crew");
    readonlyOffice = await createOffice(`CF Life Cycle Read Only ${SUFFIX}`, "readonly");
    deniedOffice = await createOffice(`CF Life Cycle Denied ${SUFFIX}`, "none");
    for (const user of [office, readonlyOffice]) {
      const grants = await db.query(
        `SELECT menu.name FROM adm_roleaccess_ac access
         JOIN adm_menumaster_ac menu ON menu.muid = access.menu_id
         WHERE access.role_id = $1 AND access.is_deleted = false`,
        [user.roleUuid],
      );
      expect(grants.rows.map((row) => row.name)).toEqual(["Crew Database"]);
      expect(grants.rows.some((row) => /forms/i.test(row.name))).toBe(false);
    }

    const targetVessel = await db.query(
      `INSERT INTO master_vessels (vessel_uuid, vessel, is_active, is_deleted)
       VALUES ($1, $2, true, false) RETURNING id, vessel_uuid`,
      [uuid(), `Company Form signing vessel ${SUFFIX}`],
    );
    subjectVesselUuid = targetVessel.rows[0].vessel_uuid;
    const wrongVessel = await db.query(
      `INSERT INTO master_vessels (vessel_uuid, vessel, is_active, is_deleted)
       VALUES ($1, $2, true, false) RETURNING id, vessel_uuid`,
      [uuid(), `Company Form foreign vessel ${SUFFIX}`],
    );
    wrongVesselUuid = wrongVessel.rows[0].vessel_uuid;
    shipUser = await createShipUser(`CF Life Cycle Ship ${SUFFIX}`, Number(wrongVessel.rows[0].id));

    // The profile uses an ID here; signing uses the independently captured contract UUID.
    const ranks = await db.query(
      `SELECT rank_id, MIN(rank) AS rank FROM adm_company_ranks_v2
       WHERE is_deleted = false AND is_role_row = false AND rank_id IS NOT NULL AND rank IS NOT NULL
       GROUP BY rank_id HAVING count(*) = 1
       ORDER BY (MIN(rank) = 'Master') DESC, rank_id LIMIT 2`,
    );
    expect(ranks.rows.filter(row => row.rank === "Master")).toHaveLength(1);
    expect(ranks.rows.filter(row => row.rank !== "Master")).toHaveLength(1);
    masterRankId = ranks.rows.find(row => row.rank === "Master")!.rank_id;
    changedRankId = ranks.rows.find(row => row.rank !== "Master")!.rank_id;
    subjectUuid = uuid();
    await db.query(
      `INSERT INTO crew_members_v2
         (crew_uuid, emp_no, first_name, family_name, present_rank, nationality_uuid, is_deleted)
       VALUES ($1, $2, 'Frozen', 'Name', $3, NULL, false)`,
      [subjectUuid, `CF-LIFE-${SUFFIX}`, masterRankId],
    );

    const primaryAssignment = await createCrewAssignment("Planned");
    const inProgressVoidAssignment = await createCrewAssignment("Planned");
    const completedVoidAssignment = await createCrewAssignment("Planned", wrongVesselUuid);
    const cancelledAssignment = await createCrewAssignment("Cancelled");
    testAssignments = [
      primaryAssignment,
      inProgressVoidAssignment,
      completedVoidAssignment,
      cancelledAssignment,
    ];

    const primaryForm = await createForm(`CF lifecycle signing ${SUFFIX}`);
    formUuid = primaryForm.formUuid;
    versions.push(await createVersion({
      formUuid,
      formId: primaryForm.formId,
      versionNo: "01",
    }));
    versions.push(await createVersion({
      formUuid,
      formId: primaryForm.formId,
      versionNo: "02",
    }));

    const secondaryForm = await createForm(`CF lifecycle void completion ${SUFFIX}`);
    formBUuid = secondaryForm.formUuid;
    formBVersion = await createVersion({
      formUuid: formBUuid,
      formId: secondaryForm.formId,
      versionNo: "01",
    });

  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
    }
    if (db) {
      const fixtureForms = [formUuid, formBUuid].filter(Boolean);
      const ownedSubmissions = await db.query(
        `SELECT submission_uuid FROM frm_company_submissions
         WHERE form_uuid = ANY($1::text[]) AND subject_ref = ANY($2::text[])`,
        [fixtureForms, assignmentUuids],
      );
      submissionUuids = [...new Set([
        ...submissionUuids,
        ...ownedSubmissions.rows.map((row) => row.submission_uuid),
      ])];
      const allFixtureVersions = await db.query(
        `SELECT version.fv_uuid FROM adm_form_versions_v2 version
         JOIN adm_forms_v2 form ON form.id = version.form_id
         WHERE form.form_uuid = ANY($1::text[])`,
        [fixtureForms],
      );
      const cleanupVersionUuids = [...new Set([
        ...versions.map((version) => version.versionUuid),
        ...(formBVersion?.versionUuid ? [formBVersion.versionUuid] : []),
        ...allFixtureVersions.rows.map((row) => row.fv_uuid),
      ])];
      const fileRows = await db.query(
        `SELECT sig_att_uuid, file_path FROM frm_signature_attachments
         WHERE created_by_uuid = ANY($1::text[])`,
        [userIds.map(String)],
      ).catch(() => ({ rows: [] }));
      attachmentPaths = fileRows.rows.map((row) => row.file_path);
      const attachmentUuids = fileRows.rows.map((row) => row.sig_att_uuid);

      await db.query("BEGIN");
      try {
        await clearCompanyFormDocumentFixtures(db, submissionUuids);
        await db.query(
          "ALTER TABLE frm_company_submission_system_snapshots DISABLE TRIGGER USER",
        );
        await db.query(
          "ALTER TABLE frm_company_submissions DISABLE TRIGGER USER",
        );
        await db.query(
          `UPDATE frm_company_submissions
           SET replaced_by_submission_uuid = NULL, replaces_submission_uuid = NULL
           WHERE submission_uuid = ANY($1::text[])`,
          [submissionUuids],
        );
        await db.query(
          `DELETE FROM frm_section_signatures
           WHERE section_state_uuid IN
             (SELECT section_state_uuid FROM frm_section_states
              WHERE submission_uuid = ANY($1::text[]))`,
          [submissionUuids],
        );
        await db.query(
          `DELETE FROM frm_signature_attachments
           WHERE sig_att_uuid = ANY($1::text[])`,
          [attachmentUuids],
        );
        await db.query(
          `DELETE FROM frm_company_submission_system_snapshots
           WHERE submission_uuid = ANY($1::text[])`,
          [submissionUuids],
        );
        await db.query(
          `DELETE FROM frm_answers WHERE submission_uuid = ANY($1::text[])`,
          [submissionUuids],
        );
        await db.query(
          `DELETE FROM frm_section_states WHERE submission_uuid = ANY($1::text[])`,
          [submissionUuids],
        );
        await db.query(
          `DELETE FROM frm_company_submission_assignments
           WHERE submission_uuid = ANY($1::text[])`,
          [submissionUuids],
        );
        await db.query(
          `DELETE FROM frm_company_submissions WHERE submission_uuid = ANY($1::text[])`,
          [submissionUuids],
        );
        await db.query(
          "ALTER TABLE frm_company_submissions ENABLE TRIGGER USER",
        );
        await db.query(
          "ALTER TABLE frm_company_submission_system_snapshots ENABLE TRIGGER USER",
        );
        await db.query(
          `DELETE FROM frm_questions WHERE section_uuid IN
             (SELECT section_uuid FROM frm_sections WHERE form_version_uuid = ANY($1::text[]))`,
          [cleanupVersionUuids],
        );
        await db.query(
          `DELETE FROM frm_sections WHERE form_version_uuid = ANY($1::text[])`,
          [cleanupVersionUuids],
        );
        await db.query(
          `DELETE FROM frm_form_parts WHERE form_version_uuid = ANY($1::text[])`,
          [cleanupVersionUuids],
        );
        await db.query(
          `DELETE FROM adm_form_versions_v2 WHERE fv_uuid = ANY($1::text[])`,
          [cleanupVersionUuids],
        );
        const formUuids = [formUuid, formBUuid].filter(Boolean);
        await db.query("DELETE FROM adm_forms_v2 WHERE form_uuid = ANY($1::text[])", [formUuids]);
        await db.query("DELETE FROM crew_assignment_rule_context WHERE assign_uuid = ANY($1::text[])", [assignmentUuids]);
        await db.query("DELETE FROM crew_assignments WHERE assign_uuid = ANY($1::text[])", [assignmentUuids]);
        if (subjectUuid) {
          await db.query("DELETE FROM crew_members_v2 WHERE crew_uuid = $1", [subjectUuid]);
        }
        if (subjectVesselUuid) {
          await db.query("DELETE FROM master_vessels WHERE vessel_uuid = $1", [subjectVesselUuid]);
        }
        if (wrongVesselUuid) {
          await db.query("DELETE FROM master_vessels WHERE vessel_uuid = $1", [wrongVesselUuid]);
        }
        await db.query("COMMIT");
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      }

      for (const path of attachmentPaths) await fileStorageService.deleteAttachment(path);
      await clearCompanyFormFixtures(db, roleUuids);
      await db.query("DELETE FROM adm_roleaccess_ac WHERE role_id = ANY($1::text[])", [roleUuids]);
      await db.query("DELETE FROM master_users WHERE id = ANY($1::int[])", [userIds]);
      await db.query("DELETE FROM adm_rolemaster_ac WHERE ruid = ANY($1::text[])", [roleUuids]);
      const remainingFixtures = await db.query(
        `SELECT
           (SELECT count(*)::int FROM frm_company_submissions
            WHERE form_uuid = ANY($1::text[])) AS submissions,
           (SELECT count(*)::int FROM frm_section_states
            WHERE submission_uuid = ANY($2::text[])) AS section_states,
           (SELECT count(*)::int FROM frm_answers
            WHERE submission_uuid = ANY($2::text[])) AS answers,
           (SELECT count(*)::int FROM frm_company_submission_system_snapshots
            WHERE submission_uuid = ANY($2::text[])) AS snapshots,
           (SELECT count(*)::int FROM frm_signature_attachments
            WHERE created_by_uuid = ANY($3::text[])) AS signature_attachments,
           (SELECT count(*)::int FROM crew_assignments
            WHERE assign_uuid = ANY($4::text[])) AS assignments`,
        [
          fixtureForms,
          submissionUuids,
          userIds.map(String),
          assignmentUuids,
        ],
      );
      for (const value of Object.values(remainingFixtures.rows[0]))
        expect(value, "Disposable signing fixtures must be removed by normal teardown").toBe(0);
      await db.end();
    }
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
    if (previousAuthBypass === undefined) delete process.env.AUTH_BYPASS;
    else process.env.AUTH_BYPASS = previousAuthBypass;
  });

  it("freezes every pinned System point exactly once, enforces required answers/signatures, and auto-completes", async () => {
    const [primaryAssignment, , , cancelledAssignment] = testAssignments;
    const cancelledStart = await call(
      "post",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${cancelledAssignment}/submissions`,
      { user: office, body: { formUuid, formVersionUuid: versions[1].versionUuid } },
    );
    expect(cancelledStart.status).toBe(409);
    const cancelledRows = await db.query(
      `SELECT count(*)::int AS count FROM frm_company_submissions
       WHERE subject_ref = $1`,
      [cancelledAssignment],
    );
    expect(cancelledRows.rows[0].count).toBe(0);
    const submissionUuid = await createSubmission(office, primaryAssignment, versions[1].versionUuid);
    primarySubmissionUuid = submissionUuid;
    const sectionPath = `/api/v2/company-form-submissions/${submissionUuid}/sections`;
    expect((await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/submit`,
      { body: {} },
    )).status).toBe(401);
    const detail = await call("get", `/api/v2/company-form-submissions/${submissionUuid}`, { user: office });
    expect(detail.status).toBe(200);
    expect(detail.body.submission.formVersionUuid).toBe(versions[1].versionUuid);
    expect(detail.body.submission.status).toBe("in_progress");

    const signatureSideEffects = async () => {
      const result = await db.query(
        `SELECT
           (SELECT system_snapshot_at FROM frm_company_submissions
            WHERE submission_uuid = $1) AS system_snapshot_at,
           (SELECT count(*)::int FROM frm_company_submission_system_snapshots
            WHERE submission_uuid = $1) AS snapshot_count,
           (SELECT count(*)::int FROM frm_section_states
            WHERE submission_uuid = $1) AS state_count,
           (SELECT count(*)::int FROM frm_section_signatures signature
            JOIN frm_section_states state
              ON state.section_state_uuid = signature.section_state_uuid
            WHERE state.submission_uuid = $1) AS signature_count`,
        [submissionUuid],
      );
      return result.rows[0];
    };
    const beforeUnconfiguredSignatures = await signatureSideEffects();
    expect(beforeUnconfiguredSignatures).toMatchObject({
      system_snapshot_at: null,
      snapshot_count: 0,
      state_count: 0,
      signature_count: 0,
    });
    const writeAttachment = vi.spyOn(fileStorageService, "writeAttachment");
    try {
      const officerOnInformationalSection = await call(
        "post",
        `${sectionPath}/${versions[1].infoSectionUuid}/signatures`,
        { user: office, body: { signatureType: "officer", method: "officer", data: PNG } },
      );
      expect(officerOnInformationalSection.status).toBe(400);
      expect(officerOnInformationalSection.body.message)
        .toMatch(/company representative|officer/i);

      const seafarerOnInformationalSection = await call(
        "post",
        `${sectionPath}/${versions[1].infoSectionUuid}/signatures`,
        {
          user: office,
          body: {
            signatureType: "seafarer",
            method: "witnessed",
            data: PNG,
            seafarerPresent: true,
          },
        },
      );
      expect(seafarerOnInformationalSection.status).toBe(400);
      expect(seafarerOnInformationalSection.body.message).toMatch(/seafarer/i);

      const officerOnUnsignedSection = await call(
        "post",
        `${sectionPath}/${versions[1].otherSectionUuid}/signatures`,
        { user: office, body: { signatureType: "officer", method: "officer", data: PNG } },
      );
      expect(officerOnUnsignedSection.status).toBe(400);
      expect(officerOnUnsignedSection.body.message)
        .toMatch(/company representative|officer/i);

      expect(await signatureSideEffects()).toEqual(beforeUnconfiguredSignatures);
      expect(writeAttachment).not.toHaveBeenCalled();
    } finally {
      writeAttachment.mockRestore();
    }

    const emptySubmit = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/submit`,
      { user: office, body: {} },
    );
    expect(emptySubmit.status).toBe(400);
    expect(emptySubmit.body.message).toMatch(/mandatory|answer|required/i);
    const untouchedSnapshot = await db.query(
      `SELECT system_snapshot_at FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    expect(untouchedSnapshot.rows[0].system_snapshot_at).toBeNull();

    expect((await call("post", `${sectionPath}/${versions[1].infoSectionUuid}/submit`, {
      user: office, body: {},
    })).status).toBe(400);

    const infoAnswer = await call(
      "put",
      `${sectionPath}/${versions[1].signSectionUuid}/answers`,
      { user: office, body: { answers: [{ questionUuid: versions[1].systemQuestionUuids[0], value: "forged" }] } },
    );
    expect(infoAnswer.status).toBe(400);
    const emptyDraft = await call(
      "put",
      `${sectionPath}/${versions[1].signSectionUuid}/answers`,
      { user: office, body: { answers: [] } },
    );
    expect(emptyDraft.status).toBe(400);

    const forgedSignature = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/signatures`,
      {
        user: office,
        body: {
          signatureType: "officer", method: "officer", data: PNG,
          signerName: "Forged name", signerRank: "Forged rank",
        },
      },
    );
    expect(forgedSignature.status).toBe(400);
    expect(forgedSignature.body.error).toBe("invalid_request");
    const noSignatureAfterForgedIdentity = await db.query(
      `SELECT count(*)::int AS count FROM frm_section_signatures ss
       JOIN frm_section_states st ON st.section_state_uuid = ss.section_state_uuid
       WHERE st.submission_uuid = $1`,
      [submissionUuid],
    );
    expect(noSignatureAfterForgedIdentity.rows[0].count).toBe(0);

    const noDesignation = await db.query(
      `UPDATE master_users SET designation = NULL WHERE id = $1`,
      [office.id],
    );
    expect(noDesignation.rowCount).toBe(1);
    const rejectedIdentity = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/signatures`,
      { user: office, body: { signatureType: "officer", method: "officer", data: PNG } },
    );
    expect([400, 422]).toContain(rejectedIdentity.status);
    expect(rejectedIdentity.body.message).toMatch(/designation/i);
    await db.query(
      `UPDATE master_users SET designation = 'Marine Superintendent' WHERE id = $1`,
      [office.id],
    );
    const noSnapshotAfterRejectedSaves = await db.query(
      `SELECT system_snapshot_at FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    expect(noSnapshotAfterRejectedSaves.rows[0].system_snapshot_at).toBeNull();

    expect((await call(
      "put",
      `${sectionPath}/${versions[1].signSectionUuid}/answers`,
      { user: office, body: { answers: [], sectionComment: "Crew reviewed the instructions." } },
    )).status).toBe(204);
    const stillMissingAnswer = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/submit`,
      { user: office, body: {} },
    );
    expect(stillMissingAnswer.status).toBe(400);
    const noSnapshotAfterMissingAnswer = await db.query(
      `SELECT system_snapshot_at FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    expect(noSnapshotAfterMissingAnswer.rows[0].system_snapshot_at).toBeNull();
    expect((await call(
      "put",
      `${sectionPath}/${versions[1].signSectionUuid}/answers`,
      {
        user: office,
        body: {
          answers: [{
            questionUuid: versions[1].answerQuestionUuid,
            value: "Confirmed",
            comment: "Answer comment retained in the draft",
          }],
          sectionComment: "Crew reviewed the instructions.",
        },
      },
    )).status).toBe(204);

    expect((await call(
      "put",
      `${sectionPath}/${versions[1].signSectionUuid}/answers`,
      {
        user: office,
        body: {
          answers: [{
            questionUuid: versions[1].answerQuestionUuid,
            value: "Confirmed",
            comment: "Answer comment retained in the draft",
          }],
          sectionComment: null,
        },
      },
    )).status).toBe(204);
    const missingRequiredComment = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/submit`,
      { user: office, body: {} },
    );
    expect(missingRequiredComment.status).toBe(400);
    expect(missingRequiredComment.body.message).toMatch(/section comment/i);
    const noSnapshotAfterMissingComment = await db.query(
      `SELECT system_snapshot_at FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    expect(noSnapshotAfterMissingComment.rows[0].system_snapshot_at).toBeNull();

    expect((await call(
      "put",
      `${sectionPath}/${versions[1].signSectionUuid}/answers`,
      {
        user: office,
        body: {
          answers: [{
            questionUuid: versions[1].answerQuestionUuid,
            value: "Confirmed",
            comment: "Answer comment retained in the draft",
          }],
          sectionComment: "Crew reviewed the instructions.",
        },
      },
    )).status).toBe(204);
    const missingRequiredSignatures = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/submit`,
      { user: office, body: {} },
    );
    expect(missingRequiredSignatures.status).toBe(400);
    expect(missingRequiredSignatures.body.message).toMatch(/signature/i);
    const noSnapshotAfterMissingSignatures = await db.query(
      `SELECT system_snapshot_at FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    expect(noSnapshotAfterMissingSignatures.rows[0].system_snapshot_at).toBeNull();

    const deniedSignature = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/signatures`,
      { user: deniedOffice, body: { signatureType: "officer", method: "officer", data: PNG } },
    );
    expect(deniedSignature.status).toBe(403);
    const deniedSignDoesNotFreeze = await db.query(
      `SELECT system_snapshot_at FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    expect(deniedSignDoesNotFreeze.rows[0].system_snapshot_at).toBeNull();

    // Section 2 is also answerable even though it has no required signature.
    // Run it against the first real signature to exercise the submission-level
    // row lock and prove the two concurrent declarations create one snapshot.
    const [sectionSubmit, signatureSave] = await Promise.all([
      call("post", `${sectionPath}/${versions[1].racingSectionUuid}/submit`, {
        user: office, body: {},
      }),
      call("post", `${sectionPath}/${versions[1].signSectionUuid}/signatures`, {
        user: office, body: { signatureType: "officer", method: "officer", data: PNG },
      }),
    ]);
    expect(sectionSubmit.status).toBe(200);
    expect(sectionSubmit.body).toHaveProperty("completed", false);
    expect(signatureSave.status).toBe(201);
    expect(signatureSave.body.signerName).toBe(`${office.roleName} ${SUFFIX}`);
    expect(signatureSave.body.signatureMethod).toBe("officer");
    const firstSignature = await db.query(
      `SELECT ss.section_signature_uuid, ss.signer_name, ss.signer_rank, ss.signed_by_uuid,
              ss.signature_method, ss.signed_at, ss.signature_att_uuid,
              a.file_name, a.file_type, a.file_size, a.file_path
       FROM frm_section_signatures ss
       JOIN frm_section_states st ON st.section_state_uuid = ss.section_state_uuid
       JOIN frm_signature_attachments a ON a.sig_att_uuid = ss.signature_att_uuid
       WHERE st.submission_uuid = $1 AND ss.signature_type = 'officer' AND ss.is_deleted = false`,
      [submissionUuid],
    );
    expect(firstSignature.rowCount).toBe(1);
    expect(firstSignature.rows[0].signer_name).toBe(`${office.roleName} ${SUFFIX}`);
    expect(firstSignature.rows[0].signer_rank).toBe("Marine Superintendent");
    expect(firstSignature.rows[0].signed_by_uuid).toBe(String(office.id));
    attachmentPaths.push(firstSignature.rows[0].file_path);

    const snapshot = await db.query(
      `SELECT s.field_key, s.question_uuid, s.section_uuid, s.value, s.created_at, s.created_by_uuid,
              sub.system_snapshot_at, sub.system_snapshot_event
       FROM frm_company_submission_system_snapshots s
       JOIN frm_company_submissions sub ON sub.submission_uuid = s.submission_uuid
       WHERE s.submission_uuid = $1 ORDER BY s.field_key`,
      [submissionUuid],
    );
    expect(snapshot.rowCount).toBe(4);
    expect(new Set(snapshot.rows.map((row) => row.question_uuid)).size).toBe(4);
    expect(snapshot.rows.every((row) => row.section_uuid === versions[1].infoSectionUuid)).toBe(true);
    expect(snapshot.rows.find((row) => row.field_key === "seafarer_name")?.value).toBe("Frozen Name");
    expect(snapshot.rows.find((row) => row.field_key === "rank")?.value).toBe("Master");
    expect(snapshot.rows.find((row) => row.field_key === "nationality")?.value).toBeNull();
    expect(snapshot.rows.find((row) => row.field_key === "date_of_declaration")?.value)
      .toBe(sailDate(snapshot.rows[0].system_snapshot_at));
    expect(snapshot.rows.every((row) => row.created_by_uuid === String(office.id))).toBe(true);
    const firstSnapshotAt = snapshot.rows[0].system_snapshot_at as Date;
    expect(["section_submission", "signature"]).toContain(snapshot.rows[0].system_snapshot_event);
    expect(snapshot.rows.every(
      (row) => new Date(row.system_snapshot_at).getTime() === firstSnapshotAt.getTime(),
    )).toBe(true);
    const untouchedInfoState = await db.query(
      `SELECT count(*)::int AS count FROM frm_section_states
       WHERE submission_uuid = $1 AND section_uuid = $2`,
      [submissionUuid, versions[1].infoSectionUuid],
    );
    expect(untouchedInfoState.rows[0].count).toBe(0);

    // The witness body carries no signer identity. The server derives both
    // seafarer name/rank from this assignment and records who witnessed it.
    const invalidWitness = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/signatures`,
      {
        user: office,
        body: { signatureType: "seafarer", method: "witnessed", data: PNG, seafarerPresent: false },
      },
    );
    expect([400, 422]).toContain(invalidWitness.status);
    const foreignWitness = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/signatures`,
      {
        user: shipUser,
        body: { signatureType: "seafarer", method: "witnessed", data: PNG, seafarerPresent: true },
      },
    );
    expect(foreignWitness.status).toBe(403);
    const witnessedSignature = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/signatures`,
      {
        user: office,
        body: { signatureType: "seafarer", method: "witnessed", data: PNG, seafarerPresent: true },
      },
    );
    expect(witnessedSignature.status).toBe(201);
    expect(witnessedSignature.body.signerName).toBe("Frozen Name");
    expect(witnessedSignature.body.signatureMethod).toBe("witnessed");
    const seafarerSignature = await db.query(
      `SELECT ss.section_signature_uuid, ss.signer_name, ss.signer_rank, ss.witness_name,
              ss.signed_by_uuid, ss.signature_method, ss.signed_at, a.file_path
       FROM frm_section_signatures ss
       JOIN frm_section_states st ON st.section_state_uuid = ss.section_state_uuid
       JOIN frm_signature_attachments a ON a.sig_att_uuid = ss.signature_att_uuid
       WHERE st.submission_uuid = $1 AND ss.signature_type = 'seafarer' AND ss.is_deleted = false`,
      [submissionUuid],
    );
    expect(seafarerSignature.rowCount).toBe(1);
    expect(seafarerSignature.rows[0].signer_name).toBe("Frozen Name");
    expect(seafarerSignature.rows[0].signer_rank).toBe("Master");
    expect(seafarerSignature.rows[0].witness_name).toBe(`${office.roleName} ${SUFFIX}`);
    expect(seafarerSignature.rows[0].signature_method).toBe("witnessed");
    attachmentPaths.push(seafarerSignature.rows[0].file_path);

    // System values change after the first successful signature. The original
    // declaration stays readable and shows the first frozen values, not a
    // refreshed master record.
    await db.query(
      `UPDATE crew_members_v2 SET first_name = 'Changed', family_name = 'Source',
              present_rank = $2 WHERE crew_uuid = $1`,
      [subjectUuid, changedRankId],
    );
    const formAfterSourceChange = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}/form`,
      { user: office },
    );
    expect(formAfterSourceChange.status).toBe(200);
    expect(formAfterSourceChange.body.systemSnapshotEvent).toBe(snapshot.rows[0].system_snapshot_event);
    expect(formAfterSourceChange.body.systemValuesChanged).toBe(true);
    expect(formAfterSourceChange.body.systemValuesChangedNotice).toMatch(/changed since signing began/i);
    const renderedQuestions = formAfterSourceChange.body.parts.flatMap((part: any) =>
      part.sections.flatMap((section: any) => section.questions));
    expect(renderedQuestions.find(
      (question: any) => question.questionUuid === versions[1].systemQuestionUuids[0],
    ).systemField).toMatchObject({ value: "Frozen Name", valueOrigin: "frozen_snapshot" });
    expect(renderedQuestions.find(
      (question: any) => question.questionUuid === versions[1].systemQuestionUuids[1],
    ).systemField).toMatchObject({ value: "Master", valueOrigin: "frozen_snapshot" });
    const renderedSeafarerSignature = formAfterSourceChange.body.states
      .flatMap((state: any) => state.signatures)
      .find((signature: any) => signature.signatureType === "seafarer");
    expect(renderedSeafarerSignature).toMatchObject({
      signerName: "Frozen Name",
      signerRank: "Master",
      witnessName: `${office.roleName} ${SUFFIX}`,
      signatureMethod: "witnessed",
    });
    expect(new Date(renderedSeafarerSignature.signedAt).getTime())
      .toBe(seafarerSignature.rows[0].signed_at.getTime());

    // Explicit removal remains an editing action before section submission.
    // Signing again in the same slot exercises the soft-deleted signature
    // uniqueness constraint and records trusted identity afresh.
    const removeStartedSignature = await call(
      "delete",
      `${sectionPath}/${versions[1].signSectionUuid}/signatures/${firstSignature.rows[0].section_signature_uuid}`,
      { user: office },
    );
    expect(removeStartedSignature.status).toBe(204);
    const removedFirstSignature = await db.query(
      `SELECT is_deleted, signer_name, signer_rank, signature_method, signed_at
       FROM frm_section_signatures WHERE section_signature_uuid = $1`,
      [firstSignature.rows[0].section_signature_uuid],
    );
    expect(removedFirstSignature.rows[0]).toMatchObject({
      is_deleted: true,
      signer_name: `${office.roleName} ${SUFFIX}`,
      signer_rank: "Marine Superintendent",
      signature_method: "officer",
    });
    await db.query(
      `UPDATE master_users SET designation = 'Port Captain' WHERE id = $1`,
      [office.id],
    );
    const replacementOfficerSignature = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/signatures`,
      { user: office, body: { signatureType: "officer", method: "officer", data: PNG } },
    );
    expect(replacementOfficerSignature.status).toBe(201);
    expect(replacementOfficerSignature.body.signerName).toBe(`${office.roleName} ${SUFFIX}`);
    const officerSignatureHistory = await db.query(
      `SELECT ss.section_signature_uuid, ss.signature_att_uuid, ss.is_deleted,
              ss.signer_name, ss.signer_rank, ss.signature_method, ss.signed_at,
              a.file_name, a.file_type, a.file_size, a.file_path
       FROM frm_section_signatures ss
       JOIN frm_signature_attachments a ON a.sig_att_uuid = ss.signature_att_uuid
       WHERE ss.section_state_uuid IN
         (SELECT section_state_uuid FROM frm_section_states WHERE submission_uuid = $1)
         AND ss.signature_type = 'officer'`,
      [submissionUuid],
    );
    expect(officerSignatureHistory.rowCount).toBeGreaterThanOrEqual(1);
    const activeOfficerSignatures = officerSignatureHistory.rows.filter(
      (signature) => !signature.is_deleted,
    );
    const reSignedOfficer = activeOfficerSignatures[0];
    const retainedSignatureSlot = officerSignatureHistory.rows.find(
      (signature) => signature.section_signature_uuid === firstSignature.rows[0].section_signature_uuid,
    );
    if (activeOfficerSignatures.length !== 1 || !reSignedOfficer || !retainedSignatureSlot) {
      throw new Error("Expected exactly one active officer signature in the re-signed slot.");
    }
    expect(reSignedOfficer).toMatchObject({
      is_deleted: false,
      signer_name: `${office.roleName} ${SUFFIX}`,
      signer_rank: "Port Captain",
      signature_method: "officer",
    });
    if (retainedSignatureSlot.section_signature_uuid === reSignedOfficer.section_signature_uuid) {
      expect(retainedSignatureSlot).toMatchObject({
        is_deleted: false,
        signer_rank: "Port Captain",
      });
    } else {
      expect(retainedSignatureSlot).toMatchObject({
        is_deleted: true,
        signer_rank: "Marine Superintendent",
      });
    }
    const retiredAttachment = await db.query(
      `SELECT sig_att_uuid, file_name, file_type, file_size, file_path, is_deleted
       FROM frm_signature_attachments WHERE sig_att_uuid = $1`,
      [firstSignature.rows[0].signature_att_uuid],
    );
    expect(retiredAttachment.rows[0]).toEqual({
      sig_att_uuid: firstSignature.rows[0].signature_att_uuid,
      file_name: firstSignature.rows[0].file_name,
      file_type: firstSignature.rows[0].file_type,
      file_size: firstSignature.rows[0].file_size,
      file_path: firstSignature.rows[0].file_path,
      is_deleted: true,
    });
    try {
      const { stream: retiredAsset } = await fileStorageService.readAttachment(
        firstSignature.rows[0].file_path,
      );
      const oldAssetChunks: Buffer[] = [];
      for await (const chunk of retiredAsset as any) oldAssetChunks.push(Buffer.from(chunk));
      expect(Buffer.concat(oldAssetChunks)).toEqual(
        Buffer.from(PNG.replace(/^data:image\/png;base64,/, ""), "base64"),
      );
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "File not found") throw error;
    }
    const currentOfficerSignature = await db.query(
      `SELECT a.file_path FROM frm_section_signatures ss
       JOIN frm_signature_attachments a ON a.sig_att_uuid = ss.signature_att_uuid
       WHERE ss.section_signature_uuid = $1`,
      [reSignedOfficer.section_signature_uuid],
    );
    attachmentPaths.push(currentOfficerSignature.rows[0].file_path);
    const snapshotAfterResign = await db.query(
      `SELECT field_key, question_uuid, value, created_at FROM frm_company_submission_system_snapshots
       WHERE submission_uuid = $1 ORDER BY field_key`,
      [submissionUuid],
    );
    expect(snapshotAfterResign.rows).toEqual(
      snapshot.rows.map(({ field_key, question_uuid, value, created_at }) => ({
        field_key, question_uuid, value, created_at,
      })),
    );

    const signSectionSubmit = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/submit`,
      { user: office, body: {} },
    );
    expect(signSectionSubmit.status).toBe(200);
    expect(signSectionSubmit.body).toHaveProperty("completed", false);
    const dbReadOnly = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}`,
      { user: deniedOffice },
    );
    expect(dbReadOnly.status).toBe(403);
    const readOnlyEdit = await call(
      "put",
      `${sectionPath}/${versions[1].signSectionUuid}/answers`,
      { user: readonlyOffice, body: { answers: [], sectionComment: "unauthorized edit" } },
    );
    expect(readOnlyEdit.status).toBe(403);

    const finalRequiredSectionSubmit = await call(
      "post",
      `${sectionPath}/${versions[1].otherSectionUuid}/submit`,
      { user: office, body: {} },
    );
    expect(finalRequiredSectionSubmit.status).toBe(200);
    expect(finalRequiredSectionSubmit.body).toHaveProperty("completed", true);
    const finalDetail = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}`,
      { user: office },
    );
    expect(finalDetail.body.submission.status).toBe("completed");
    expect(finalDetail.body.submission.completedAt).toEqual(expect.any(String));
    expect(finalDetail.body.states).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sectionUuid: versions[1].signSectionUuid,
        status: "submitted",
        submittedByUuid: String(office.id),
        submittedByName: `${office.roleName} ${SUFFIX}`,
      }),
      expect.objectContaining({
        sectionUuid: versions[1].otherSectionUuid,
        status: "submitted",
      }),
      expect.objectContaining({
        sectionUuid: versions[1].racingSectionUuid,
        status: "submitted",
      }),
    ]));
    expect(finalDetail.body.answers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        questionUuid: versions[1].answerQuestionUuid,
        answerValue: "Confirmed",
        answerComment: "Answer comment retained in the draft",
      }),
    ]));
    const officerSignature = finalDetail.body.states
      .flatMap((state: any) => state.signatures)
      .find((signature: any) => signature.signatureType === "officer");
    expect(officerSignature.attachment.assetUuid).toEqual(expect.any(String));
    const signatureAsset = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}/attachments/${officerSignature.attachment.assetUuid}/raw`,
      { user: office },
    );
    expect(signatureAsset.status).toBe(200);
    expect(signatureAsset.headers["content-type"]).toMatch(/image\/png/i);
    expect(Buffer.isBuffer(signatureAsset.body)).toBe(true);
    const foreignVesselAsset = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}/attachments/${officerSignature.attachment.assetUuid}/raw`,
      { user: shipUser },
    );
    expect(foreignVesselAsset.status).toBe(403);
    const replay = await call(
      "post",
      `${sectionPath}/${versions[1].signSectionUuid}/submit`,
      { user: office, body: {} },
    );
    expect(replay.status).toBe(409);
    const immutableSignatures = await db.query(
      `SELECT signature_type, signer_name, signer_rank, witness_name, signature_method,
              signed_by_uuid, signed_at, ss.is_deleted
       FROM frm_section_signatures ss
       JOIN frm_section_states st ON st.section_state_uuid = ss.section_state_uuid
       WHERE st.submission_uuid = $1 AND ss.is_deleted = false ORDER BY signature_type`,
      [submissionUuid],
    );
    expect(immutableSignatures.rowCount).toBe(2);
    expect(immutableSignatures.rows.every((row) => !row.is_deleted)).toBe(true);
    expect(immutableSignatures.rows.find((row) => row.signature_type === "officer"))
      .toMatchObject({ signer_rank: "Port Captain", is_deleted: false });
    const completionSnapshot = await db.query(
      `SELECT created_at, value, field_key, question_uuid
       FROM frm_company_submission_system_snapshots
       WHERE submission_uuid = $1 ORDER BY field_key`,
      [submissionUuid],
    );
    expect(completionSnapshot.rows).toEqual(snapshotAfterResign.rows);
  });

  it("voids an in-progress submission with server-audited identity and preserves immutable replacement history", async () => {
    const [, assignmentUuid] = testAssignments;
    const oldVersion = versions[1];
    const submissionUuid = await createSubmission(office, assignmentUuid, oldVersion.versionUuid);
    const sectionPath = `/api/v2/company-form-submissions/${submissionUuid}/sections`;
    const draft = await call(
      "put",
      `${sectionPath}/${oldVersion.signSectionUuid}/answers`,
      {
        user: office,
        body: {
          answers: [{
            questionUuid: oldVersion.answerQuestionUuid,
            value: "An answer retained when voided",
          }],
          sectionComment: "Draft retained as history.",
        },
      },
    );
    expect(draft.status).toBe(204);
    const retainedSignature = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${oldVersion.signSectionUuid}/signatures`,
      { user: office, body: { signatureType: "officer", method: "officer", data: PNG } },
    );
    expect(retainedSignature.status).toBe(201);
    const originalSignatureRows = await db.query(
      `SELECT ss.section_signature_uuid, ss.signature_att_uuid, ss.signer_name,
              ss.signer_rank, ss.signature_method, ss.signed_at, ss.signed_by_uuid,
              a.file_path
       FROM frm_section_signatures ss
       JOIN frm_section_states st ON st.section_state_uuid = ss.section_state_uuid
       JOIN frm_signature_attachments a ON a.sig_att_uuid = ss.signature_att_uuid
       WHERE st.submission_uuid = $1 AND ss.signature_type = 'officer'`,
      [submissionUuid],
    );
    expect(originalSignatureRows.rowCount).toBe(1);
    expect(originalSignatureRows.rows[0].signer_name).toBe(`${office.roleName} ${SUFFIX}`);
    attachmentPaths.push(originalSignatureRows.rows[0].file_path);
    const crossSubmissionAsset = await call(
      "get",
      `/api/v2/company-form-submissions/${primarySubmissionUuid}/attachments/${originalSignatureRows.rows[0].signature_att_uuid}/raw`,
      { user: office },
    );
    expect(crossSubmissionAsset.status).toBe(404);
    const blankReason = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/void`,
      { user: office, body: { reason: "  " } },
    );
    expect(blankReason.status).toBe(400);
    const missingReason = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/void`,
      { user: office, body: {} },
    );
    expect(missingReason.status).toBe(400);
    const noGrantVoid = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/void`,
      { user: deniedOffice, body: { reason: "Access denied must not mutate history." } },
    );
    expect(noGrantVoid.status).toBe(403);
    const wrongVesselVoid = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/void`,
      { user: shipUser, body: { reason: "The vessel user is not linked to this assignment." } },
    );
    expect(wrongVesselVoid.status).toBe(403);
    const beforeVoid = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}`,
      { user: office },
    );
    expect(beforeVoid.body.submission.status).toBe("in_progress");

    const voidResponse = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/void`,
      { user: office, body: { reason: "Correct the crew-assignment record before resubmission." } },
    );
    expect(voidResponse.status).toBe(204);
    const firstVoid = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}`,
      { user: office },
    );
    expect(firstVoid.status).toBe(200);
    expect(firstVoid.body.submission).toMatchObject({
      status: "voided",
      voidedByUuid: String(office.id),
      voidedByName: `${office.roleName} ${SUFFIX}`,
      voidReason: "Correct the crew-assignment record before resubmission.",
      voidedPreviousStatus: "in_progress",
      systemSnapshotEvent: "signature",
    });
    expect(firstVoid.body.submission.voidedAt).toEqual(expect.any(String));
    expect(firstVoid.body.answers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        questionUuid: oldVersion.answerQuestionUuid,
        answerValue: "An answer retained when voided",
      }),
    ]));
    expect(firstVoid.body.states).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sectionUuid: oldVersion.signSectionUuid,
        signatures: expect.arrayContaining([
          expect.objectContaining({
            sectionSignatureUuid: originalSignatureRows.rows[0].section_signature_uuid,
            signerName: originalSignatureRows.rows[0].signer_name,
            signerRank: originalSignatureRows.rows[0].signer_rank,
            signatureMethod: "officer",
            signedByUuid: originalSignatureRows.rows[0].signed_by_uuid,
          }),
        ]),
      }),
    ]));
    const duplicateVoid = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/void`,
      { user: office, body: { reason: "Second void must conflict." } },
    );
    expect(duplicateVoid.status).toBe(409);

    const nextVersion = await createVersion({
      formUuid,
      formId: Number((await db.query(
        "SELECT id FROM adm_forms_v2 WHERE form_uuid = $1",
        [formUuid],
      )).rows[0].id),
      versionNo: "03",
    });
    versions.push(nextVersion);
    const replacementUuid = await createSubmission(office, assignmentUuid, nextVersion.versionUuid);
    const replacement = await call(
      "get",
      `/api/v2/company-form-submissions/${replacementUuid}`,
      { user: office },
    );
    expect(replacement.body.submission).toMatchObject({
      status: "in_progress",
      formVersionUuid: nextVersion.versionUuid,
      replacesSubmissionUuid: submissionUuid,
    });
    const updatedOld = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}/form`,
      { user: office },
    );
    expect(updatedOld.body.submission).toMatchObject({
      status: "voided",
      formVersionUuid: oldVersion.versionUuid,
      replacedBySubmissionUuid: replacementUuid,
      voidReason: "Correct the crew-assignment record before resubmission.",
    });
    expect(updatedOld.body.voidedReplacement).toEqual({
      label: "Voided — replaced by",
      submissionUuid: replacementUuid,
    });
    const triedToAlterVoidedSignature = await call(
      "delete",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${oldVersion.signSectionUuid}/signatures/${originalSignatureRows.rows[0].section_signature_uuid}`,
      { user: office },
    );
    expect(triedToAlterVoidedSignature.status).toBe(409);
    expect(replacement.body.replacementHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({
        direction: "replaces",
        label: "Replaces a voided submission",
        submissionUuid,
        targetLabel: expect.stringContaining(`CF lifecycle signing ${SUFFIX} — Form `),
      }),
    ]));
    expect(replacement.body.replacementHistory[0].targetLabel)
      .toContain(`Voided by ${firstVoid.body.submission.voidedByName}`);
    expect(replacement.body.replacementHistory[0].targetLabel)
      .toContain(`Voided ${sailDate(firstVoid.body.submission.voidedAt)}`);
    const oldSubmissionSnapshot = await db.query(
      `SELECT status, form_version_uuid, void_reason, voided_at, voided_by_uuid,
              replaced_by_submission_uuid
       FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    const oldAudit = oldSubmissionSnapshot.rows[0];
    const readAfterReplacement = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}`,
      { user: office },
    );
    expect(readAfterReplacement.body.submission).toMatchObject({
      status: "voided",
      formVersionUuid: oldAudit.form_version_uuid,
      voidReason: oldAudit.void_reason,
      voidedByUuid: oldAudit.voided_by_uuid,
      replacedBySubmissionUuid: replacementUuid,
    });
    expect(new Date(readAfterReplacement.body.submission.voidedAt).getTime())
      .toBe(new Date(oldAudit.voided_at).getTime());
    const preservedSignatureAfterReplacement = await db.query(
      `SELECT section_signature_uuid, signer_name, signer_rank, signature_method,
              signed_at, signed_by_uuid, is_deleted
       FROM frm_section_signatures WHERE section_signature_uuid = $1`,
      [originalSignatureRows.rows[0].section_signature_uuid],
    );
    expect(preservedSignatureAfterReplacement.rows).toMatchObject([{
      section_signature_uuid: originalSignatureRows.rows[0].section_signature_uuid,
      signer_name: originalSignatureRows.rows[0].signer_name,
      signer_rank: originalSignatureRows.rows[0].signer_rank,
      signature_method: "officer",
      signed_at: originalSignatureRows.rows[0].signed_at,
      signed_by_uuid: originalSignatureRows.rows[0].signed_by_uuid,
      is_deleted: false,
    }]);

    const replacementCannotSignUsingUnreleasedOrForeignSection = await call(
      "post",
      `/api/v2/company-form-submissions/${replacementUuid}/sections/${oldVersion.signSectionUuid}/signatures`,
      { user: office, body: { signatureType: "officer", method: "officer", data: PNG } },
    );
    expect(replacementCannotSignUsingUnreleasedOrForeignSection.status).toBe(400);
    const afterForeignWrite = await call(
      "get",
      `/api/v2/company-form-submissions/${replacementUuid}`,
      { user: office },
    );
    expect(afterForeignWrite.body.states).toHaveLength(0);
    expect(afterForeignWrite.body.submission.status).toBe("in_progress");
  });

  it("voids a completed declaration without changing its completion and permits one live replacement", async () => {
    const [, , assignmentUuid] = testAssignments;
    const submissionUuid = await createSubmission(
      office, assignmentUuid, formBVersion.versionUuid, formBUuid,
    );
    const firstSection = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${formBVersion.otherSectionUuid}/submit`,
      { user: office, body: {} },
    );
    expect(firstSection.status).toBe(200);
    expect(firstSection.body.completed).toBe(false);
    const racingSection = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${formBVersion.racingSectionUuid}/submit`,
      { user: office, body: {} },
    );
    expect(racingSection.status).toBe(200);
    expect(racingSection.body.completed).toBe(false);
    const validAnswer = await call(
      "put",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${formBVersion.signSectionUuid}/answers`,
      {
        user: office,
        body: {
          answers: [{
            questionUuid: formBVersion.answerQuestionUuid,
            value: "Completed before voiding.",
            comment: "A retained answer comment.",
          }],
          sectionComment: "Required section comment retained in history.",
        },
      },
    );
    expect(validAnswer.status).toBe(204);
    const officerSignature = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${formBVersion.signSectionUuid}/signatures`,
      { user: office, body: { signatureType: "officer", method: "officer", data: PNG } },
    );
    expect(officerSignature.status).toBe(201);
    const seafarerSignature = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${formBVersion.signSectionUuid}/signatures`,
      {
        user: office,
        body: {
          signatureType: "seafarer",
          method: "witnessed",
          data: PNG,
          seafarerPresent: true,
        },
      },
    );
    expect(seafarerSignature.status).toBe(201);
    const submit = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${formBVersion.signSectionUuid}/submit`,
      { user: office, body: {} },
    );
    expect(submit.status).toBe(200);
    expect(submit.body.completed).toBe(true);
    const completedBeforeVoid = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}`,
      { user: office },
    );
    expect(completedBeforeVoid.body.submission.status).toBe("completed");
    expect(completedBeforeVoid.body.submission.completedAt).toEqual(expect.any(String));
    const auditBefore = await db.query(
      `SELECT completed_at, form_version_uuid FROM frm_company_submissions
       WHERE submission_uuid = $1`,
      [submissionUuid],
    );

    const noDeletePermission = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/void`,
      { user: readonlyOffice, body: { reason: "View-only roles cannot void." } },
    );
    expect(noDeletePermission.status).toBe(403);
    const deniedState = await db.query(
      `SELECT status, voided_at FROM frm_company_submissions WHERE submission_uuid = $1`,
      [submissionUuid],
    );
    expect(deniedState.rows[0]).toMatchObject({ status: "completed", voided_at: null });

    const voidResponse = await call(
      "post",
      `/api/v2/company-form-submissions/${submissionUuid}/void`,
      { user: office, body: { reason: "Completed against an obsolete assignment declaration." } },
    );
    expect(voidResponse.status).toBe(204);
    const oldForm = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}/form`,
      { user: office },
    );
    expect(oldForm.body.submission).toMatchObject({
      status: "voided",
      voidedPreviousStatus: "completed",
      voidReason: "Completed against an obsolete assignment declaration.",
      formVersionUuid: auditBefore.rows[0].form_version_uuid,
    });
    expect(new Date(oldForm.body.submission.completedAt).getTime())
      .toBe(new Date(auditBefore.rows[0].completed_at).getTime());

    const replacementUuid = await createSubmission(
      office, assignmentUuid, formBVersion.versionUuid, formBUuid,
    );
    expect(replacementUuid).not.toBe(submissionUuid);
    const activeSubmissions = await db.query(
      `SELECT count(*)::int AS count FROM frm_company_submissions
       WHERE form_uuid = $1 AND subject_ref = $2 AND status <> 'voided' AND is_deleted = false`,
      [formBUuid, assignmentUuid],
    );
    expect(activeSubmissions.rows[0].count).toBe(1);
    const existingReplacement = await call(
      "post",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/submissions`,
      { user: office, body: { formUuid: formBUuid, formVersionUuid: formBVersion.versionUuid } },
    );
    expect(existingReplacement.status).toBe(409);

    const newDetail = await call(
      "get",
      `/api/v2/company-form-submissions/${replacementUuid}`,
      { user: office },
    );
    expect(newDetail.body.submission).toMatchObject({
      replacesSubmissionUuid: submissionUuid,
      formVersionUuid: formBVersion.versionUuid,
    });
    const oldDetail = await call(
      "get",
      `/api/v2/company-form-submissions/${submissionUuid}`,
      { user: office },
    );
    expect(oldDetail.body.submission).toMatchObject({
      replacedBySubmissionUuid: replacementUuid,
      status: "voided",
      voidedPreviousStatus: "completed",
    });
  });
});