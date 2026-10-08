import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "crypto";
import { grantCompanyFormFixture, clearCompanyFormFixtures } from "../../helpers/companyFormGrants";
import type { Server } from "http";
import type { CompanyFormSubmissionRenderContract } from "../../../shared/v2/forms-engine/submissionRenderContract";
import companyFormSubmissionsRoutes from "@server/v2/company-forms/routes";

const TEST_SECRET = "company-form-start-test-secret";
const SUFFIX = randomUUID().replaceAll("-", "").slice(0, 12);
const u = () => randomUUID();

let db: Client;
let server: Server;
let renderServer: Server;
let officeUserId = 0;
let deniedUserId = 0;
let viewOnlyUserId = 0;
let roleMismatchUserId = 0;
let shipUserId = 0;
let unlinkedSeafarerUserId = 0;
let officeRoleUuid = "";
let deniedRoleUuid = "";
let viewOnlyRoleUuid = "";
let roleMismatchUuid = "";
let shipRoleUuid = "";
let crewUuid = "";
let assignmentUuid = "";
let cancelledAssignmentUuid = "";
let archivedFormAssignmentUuid = "";
let historyAssignmentUuid = "";
let writeAssignmentUuid = "";
let formUuid = "";
let formBoardUuid = "";
let archivedFormUuid = "";
let versionOneUuid = "";
let versionTwoUuid = "";
let invalidReleasedVersionUuid = "";
let boardVersionUuid = "";
let archivedVersionUuid = "";
let primarySubmissionUuid = "";
let replacementSubmissionUuid = "";
let historySubmissionUuid = "";
let writeSubmissionUuid = "";
let historyAssetUuid = "";
let foreignAssetUuid = "";
let orphanSubmissionUuid = "";
let signatureFilePath = "";
let renderPartUuids: string[] = [];
let renderSectionUuids: string[] = [];
let renderOptionSetUuids: string[] = [];
let renderVesselTypeUuid = "";
let targetVesselUuid = "";
let shipScopeVesselUuid = "";
let shipScopeVesselId = 0;
const previousJwtSecret = process.env.JWT_SECRET;
const previousAuthBypass = process.env.AUTH_BYPASS;

function token(userId: number, userType = "Office"): string {
  return jwt.sign(
    { id: userId, domain: "test", userType },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

function call(method: string, path: string, opts: { userId?: number; userType?: string; body?: unknown } = {}) {
  return callOn(server, method, path, opts);
}

function callOn(
  target: Server,
  method: string,
  path: string,
  opts: { userId?: number; userType?: string; body?: unknown } = {},
) {
  let req = (request(target) as any)[method.toLowerCase()](path);
  if (opts.userId) req = req.set("Authorization", `Bearer ${token(opts.userId, opts.userType)}`);
  if (opts.body !== undefined) req = req.send(opts.body);
  return req;
}

async function createRole(roleName: string, grantCrewDatabase: boolean): Promise<{
  roleUuid: string;
  userId: number;
}> {
  const roleUuid = u();
  await db.query(
    `INSERT INTO adm_rolemaster_ac (ruid, assigned_role, roletype, is_active, is_deleted)
     VALUES ($1, $2, 'Office', true, false)`,
    [roleUuid, roleName],
  );
  const user = await db.query(
    "INSERT INTO master_users (user_type, role) VALUES ('Office', $1) RETURNING id",
    [roleName],
  );
  const userId = Number(user.rows[0].id);
  if (grantCrewDatabase) {
    const menu = await db.query(
      `SELECT muid FROM adm_menumaster_ac
       WHERE name = 'Crew Database' AND is_active = true AND is_deleted = false`,
    );
    if (menu.rowCount !== 1) throw new Error("Expected one active Crew Database menu for the integration test.");
    await db.query(
      `INSERT INTO adm_roleaccess_ac
         (rauid, role_id, menu_id, canview, cancreate, canedit, candelete, is_deleted)
       VALUES ($1, $2, $3, true, true, true, false, false)`,
      [u(), roleUuid, menu.rows[0].muid],
    );
    await grantCompanyFormFixture(db, roleUuid, "office");
  }
  return { roleUuid, userId };
}

async function createShipUser(roleName: string, vesselIds: number[]): Promise<{
  roleUuid: string;
  userId: number;
}> {
  const roleUuid = u();
  await db.query(
    `INSERT INTO adm_rolemaster_ac (ruid, assigned_role, roletype, is_active, is_deleted)
     VALUES ($1, $2, 'Ship', true, false)`,
    [roleUuid, roleName],
  );
  const user = await db.query(
    `INSERT INTO master_users (user_type, role, vessel_ids)
     VALUES ('Ship', $1, $2) RETURNING id`,
    [roleName, vesselIds.join(",")],
  );
  await grantCompanyFormFixture(db, roleUuid, "vessel");
  return { roleUuid, userId: Number(user.rows[0].id) };
}

async function createForm(input: {
  formName: string;
  formUuid: string;
  versions: Array<{ versionUuid: string; versionNo: string; stageKey: string }>;
}) {
  const form = await db.query(
    `INSERT INTO adm_forms_v2
       (form_uuid, name, category, rank_group, version_no, version_date, subject_type, is_deleted)
     VALUES ($1, $2, 'dynamic', 'Company Form test', '01', '2026-01-01', 'crew_assignment', false)
     RETURNING id`,
    [input.formUuid, input.formName],
  );
  for (const version of input.versions) {
    await db.query(
      `INSERT INTO adm_form_versions_v2
         (fv_uuid, form_id, version_no, version_date, status, stage_key, is_deleted, released_at)
       VALUES ($1, $2, $3, '2026-01-01', 'released', $4, false, NOW())`,
      [version.versionUuid, form.rows[0].id, version.versionNo, version.stageKey],
    );
  }
}

async function createAssignment(assignUuid: string, assignmentType: string) {
  await db.query(
    `INSERT INTO crew_assignments
       (assign_uuid, crew_uuid, assignment_type, is_current, is_deleted)
     VALUES ($1, $2, $3, false, false)`,
    [assignUuid, crewUuid, assignmentType],
  );
}

async function createRenderStructure(versionUuid: string, versionMarker: string, ownerFormUuid = formUuid): Promise<{
  partUuid: string;
  sectionUuid: string;
  optionSetUuid: string;
  questionUuids: string[];
}> {
  const partUuid = u();
  const sectionUuid = u();
  const optionSetUuid = u();
  const choiceQuestionUuid = u();
  const contentQuestionUuid = u();
  const systemQuestionUuid = u();
  const infoQuestionUuid = u();
  await db.query(
    `INSERT INTO frm_form_parts
       (form_part_uuid, form_uuid, form_version_uuid, part_code, part_title, part_type, is_office_only, sort_order, is_deleted)
     VALUES ($1, $2, $3, 'PART', $4, 'configurable', false, 0, false)`,
    [partUuid, ownerFormUuid, versionUuid, `Pinned part ${versionMarker}`],
  );
  if (!renderVesselTypeUuid) {
    const vesselType = await db.query(
      `INSERT INTO master_vessel_types (vt_uuid, vessel_type, is_active, is_deleted)
       VALUES ($1, $2, true, false) RETURNING vt_uuid`,
      [u(), `Render vessel type ${SUFFIX}`],
    );
    renderVesselTypeUuid = vesselType.rows[0].vt_uuid;
  }
  await db.query(
    `INSERT INTO frm_option_sets
       (option_set_uuid, form_version_uuid, set_name, low_end_label, high_end_label, sort_order, is_deleted)
     VALUES ($1, $2, $3, 'Low', 'High', 0, false)`,
    [optionSetUuid, versionUuid, `Named choices ${versionMarker}`],
  );
  await db.query(
    `INSERT INTO frm_options
       (option_uuid, option_set_uuid, option_label, option_value, sort_order, is_deleted)
     VALUES ($1, $2, 'Choice label', 'choice-value', 0, false)`,
    [u(), optionSetUuid],
  );
  await db.query(
    `INSERT INTO frm_sections
       (section_uuid, form_version_uuid, form_part_uuid, section_code, section_title,
        applicable_vessel_types, responsible_mode, responsible_role_uuid,
        comment_box_required, signature_officer_required, signature_seafarer_required,
        default_option_set_uuid, layout_preference, sort_order, is_deleted)
     VALUES ($1, $2, $3, 'SEC', $4, $5, 'role', $6, true, true, false, $7, 'auto', 0, false)`,
    [
      sectionUuid,
      versionUuid,
      partUuid,
      `Pinned section ${versionMarker}`,
      JSON.stringify([renderVesselTypeUuid]),
      officeRoleUuid,
      optionSetUuid,
    ],
  );
  await db.query(
    `INSERT INTO frm_questions
       (question_uuid, section_uuid, question_code, question_text, content_html, system_field_key,
        response_type, is_mandatory, comment_enabled, option_set_uuid, sort_order, is_deleted)
     VALUES
        ($1, $5, 'CHOICE', 'Choose one', NULL, NULL, 'single_select', true, true, NULL, 0, false),
        ($2, $5, 'CONTENT', 'Instructions', '<p>Version-owned content ${versionMarker}</p>', NULL, 'content', false, false, NULL, 1, false),
        ($3, $5, 'SYSTEM', 'Seafarer name', NULL, 'seafarer_name', 'system_field', false, false, NULL, 2, false),
        ($4, $5, 'INFO', 'Informational point', NULL, NULL, 'info_only', false, false, NULL, 3, false)`,
    [choiceQuestionUuid, contentQuestionUuid, systemQuestionUuid, infoQuestionUuid, sectionUuid],
  );
  renderPartUuids.push(partUuid);
  renderSectionUuids.push(sectionUuid);
  renderOptionSetUuids.push(optionSetUuid);
  return {
    partUuid,
    sectionUuid,
    optionSetUuid,
    questionUuids: [choiceQuestionUuid, contentQuestionUuid, systemQuestionUuid, infoQuestionUuid],
  };
}

describe("Company Form subject-scoped starts and lists", () => {
  beforeAll(async () => {
    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.AUTH_BYPASS;

    const [{ authMiddleware }, { default: adminRoutes }] = await Promise.all([
      import("@server/middleware/authMiddleware"),
      import("@server/v2/admin/routes"),
    ]);
    const app = express();
    app.use(express.json());
    app.use(authMiddleware);
    app.use("/api/v2/company-form-submissions", companyFormSubmissionsRoutes);
    app.use("/api/v2/admin", adminRoutes);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });
    const renderApp = express();
    renderApp.use(express.json());
    renderApp.use(authMiddleware);
    renderApp.use("/api/v2/company-form-submissions", companyFormSubmissionsRoutes);
    await new Promise<void>((resolve) => {
      renderServer = renderApp.listen(0, "127.0.0.1", resolve);
    });

    const allowedRole = await createRole(`CF Start Allowed ${SUFFIX}`, true);
    officeRoleUuid = allowedRole.roleUuid;
    officeUserId = allowedRole.userId;
    const deniedRole = await createRole(`CF Start Denied ${SUFFIX}`, false);
    deniedRoleUuid = deniedRole.roleUuid;
    deniedUserId = deniedRole.userId;
    const viewOnlyRole = await createRole(`CF Start Read Only ${SUFFIX}`, true);
    viewOnlyRoleUuid = viewOnlyRole.roleUuid;
    viewOnlyUserId = viewOnlyRole.userId;
    await db.query(
      `UPDATE adm_roleaccess_ac
       SET cancreate = false, canedit = false
       WHERE role_id = $1`,
      [viewOnlyRoleUuid],
    );
    await grantCompanyFormFixture(db, viewOnlyRoleUuid, "view");
    const roleMismatch = await createRole(`CF Start Different Role ${SUFFIX}`, true);
    roleMismatchUuid = roleMismatch.roleUuid;
    roleMismatchUserId = roleMismatch.userId;

    const targetVessel = await db.query(
      `INSERT INTO master_vessels (vessel_uuid, vessel, is_active, is_deleted)
       VALUES ($1, $2, true, false) RETURNING id, vessel_uuid`,
      [u(), `Target vessel ${SUFFIX}`],
    );
    targetVesselUuid = targetVessel.rows[0].vessel_uuid;
    const scopeVessel = await db.query(
      `INSERT INTO master_vessels (vessel_uuid, vessel, is_active, is_deleted)
       VALUES ($1, $2, true, false) RETURNING id, vessel_uuid`,
      [u(), `Scoped vessel ${SUFFIX}`],
    );
    shipScopeVesselUuid = scopeVessel.rows[0].vessel_uuid;
    shipScopeVesselId = Number(scopeVessel.rows[0].id);
    const shipRole = await createShipUser(`CF Start Vessel ${SUFFIX}`, [shipScopeVesselId]);
    shipRoleUuid = shipRole.roleUuid;
    shipUserId = shipRole.userId;
    const seafarer = await db.query(
      `INSERT INTO master_users (user_type, role)
       VALUES ('Seafarer', $1) RETURNING id`,
      [`Unlinked ${SUFFIX}`],
    );
    unlinkedSeafarerUserId = Number(seafarer.rows[0].id);

    crewUuid = u();
    await db.query(
      `INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, is_deleted)
       VALUES ($1, $2, 'Current', 'Source', false)`,
      [crewUuid, `CF-${SUFFIX}`],
    );
    assignmentUuid = u();
    cancelledAssignmentUuid = u();
    archivedFormAssignmentUuid = u();
    historyAssignmentUuid = u();
    writeAssignmentUuid = u();
    await createAssignment(assignmentUuid, "Planned");
    await createAssignment(cancelledAssignmentUuid, "Cancelled");
    await createAssignment(archivedFormAssignmentUuid, "Planned");
    await createAssignment(historyAssignmentUuid, "Planned");
    await createAssignment(writeAssignmentUuid, "Planned");

    formUuid = u();
    versionOneUuid = u();
    versionTwoUuid = u();
    await createForm({
      formUuid,
      formName: `CF eligible ${SUFFIX}`,
      versions: [
        { versionUuid: versionOneUuid, versionNo: "01", stageKey: "before_joining" },
        { versionUuid: versionTwoUuid, versionNo: "02", stageKey: "before_joining" },
      ],
    });
    invalidReleasedVersionUuid = u();
    await db.query(
      `INSERT INTO adm_form_versions_v2
         (fv_uuid, form_id, version_no, version_date, status, stage_key, is_deleted, released_at)
       SELECT $1, id, '99', '2026-01-01', 'released', 'before_joining', false, NOW()
       FROM adm_forms_v2 WHERE form_uuid = $2`,
      [invalidReleasedVersionUuid, formUuid],
    );
    await createRenderStructure(versionOneUuid, "one");
    await createRenderStructure(versionTwoUuid, "two");
    formBoardUuid = u();
    boardVersionUuid = u();
    await createForm({
      formUuid: formBoardUuid,
      formName: `CF board ${SUFFIX}`,
      versions: [{ versionUuid: boardVersionUuid, versionNo: "01", stageKey: "on_board" }],
    });
    await createRenderStructure(boardVersionUuid, "board", formBoardUuid);
    archivedFormUuid = u();
    archivedVersionUuid = u();
    await createForm({
      formUuid: archivedFormUuid,
      formName: `CF archived ${SUFFIX}`,
      versions: [{ versionUuid: archivedVersionUuid, versionNo: "01", stageKey: "before_joining" }],
    });
    await createRenderStructure(archivedVersionUuid, "archive", archivedFormUuid);
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()));
    if (renderServer) await new Promise<void>((resolve, reject) =>
      renderServer.close((error) => error ? reject(error) : resolve()));
    if (db) {
      const subjectRefs = [
        assignmentUuid,
        cancelledAssignmentUuid,
        archivedFormAssignmentUuid,
        historyAssignmentUuid,
        writeAssignmentUuid,
      ].filter(Boolean);
      const submissionUuids = [
        primarySubmissionUuid, replacementSubmissionUuid, historySubmissionUuid, writeSubmissionUuid,
      ].filter(Boolean);
      const assetUuids = [historyAssetUuid, foreignAssetUuid].filter(Boolean);
      if (assetUuids.length) {
        await db.query(
          "DELETE FROM frm_section_signatures WHERE signature_att_uuid = ANY($1::text[])",
          [assetUuids],
        );
        await db.query(
          "DELETE FROM frm_signature_attachments WHERE sig_att_uuid = ANY($1::text[])",
          [assetUuids],
        );
      }
      if (submissionUuids.length) {
        await db.query(
          "DELETE FROM frm_answers WHERE submission_uuid = ANY($1::text[])",
          [submissionUuids],
        );
        await db.query(
          "DELETE FROM frm_section_states WHERE submission_uuid = ANY($1::text[])",
          [submissionUuids],
        );
      }
      if (orphanSubmissionUuid) {
        await db.query("DELETE FROM frm_answers WHERE submission_uuid = $1", [orphanSubmissionUuid]);
        await db.query("DELETE FROM frm_section_states WHERE submission_uuid = $1", [orphanSubmissionUuid]);
      }
      if (subjectRefs.length) {
        await db.query(
          "DELETE FROM frm_company_submission_assignments WHERE assign_uuid = ANY($1::text[])",
          [subjectRefs],
        );
        await db.query(
          "DELETE FROM frm_company_submissions WHERE subject_ref = ANY($1::text[])",
          [subjectRefs],
        );
        await db.query("DELETE FROM crew_assignments WHERE assign_uuid = ANY($1::text[])", [subjectRefs]);
      }
      if (crewUuid) await db.query("DELETE FROM crew_members_v2 WHERE crew_uuid = $1", [crewUuid]);
      if (renderSectionUuids.length) {
        await db.query("DELETE FROM frm_questions WHERE section_uuid = ANY($1::text[])", [renderSectionUuids]);
        await db.query("DELETE FROM frm_sections WHERE section_uuid = ANY($1::text[])", [renderSectionUuids]);
      }
      if (renderOptionSetUuids.length) {
        await db.query("DELETE FROM frm_options WHERE option_set_uuid = ANY($1::text[])", [renderOptionSetUuids]);
        await db.query("DELETE FROM frm_option_sets WHERE option_set_uuid = ANY($1::text[])", [renderOptionSetUuids]);
      }
      if (renderPartUuids.length) {
        await db.query("DELETE FROM frm_form_parts WHERE form_part_uuid = ANY($1::text[])", [renderPartUuids]);
      }
      if (renderVesselTypeUuid) {
        await db.query("DELETE FROM master_vessel_types WHERE vt_uuid = $1", [renderVesselTypeUuid]);
      }
      const versions = [
        versionOneUuid, versionTwoUuid, invalidReleasedVersionUuid, boardVersionUuid, archivedVersionUuid,
      ].filter(Boolean);
      if (versions.length) {
        await db.query("DELETE FROM adm_form_versions_v2 WHERE fv_uuid = ANY($1::text[])", [versions]);
      }
      const forms = [formUuid, formBoardUuid, archivedFormUuid].filter(Boolean);
      if (forms.length) await db.query("DELETE FROM adm_forms_v2 WHERE form_uuid = ANY($1::text[])", [forms]);
      const roles = [officeRoleUuid, deniedRoleUuid, viewOnlyRoleUuid, roleMismatchUuid, shipRoleUuid].filter(Boolean);
      if (roles.length) {
        await clearCompanyFormFixtures(db, roles);
        await db.query("DELETE FROM adm_roleaccess_ac WHERE role_id = ANY($1::text[])", [roles]);
        await db.query("DELETE FROM adm_rolemaster_ac WHERE ruid = ANY($1::text[])", [roles]);
      }
      const users = [
        officeUserId,
        deniedUserId,
        viewOnlyUserId,
        roleMismatchUserId,
        shipUserId,
        unlinkedSeafarerUserId,
      ].filter(Boolean);
      if (users.length) await db.query("DELETE FROM master_users WHERE id = ANY($1::int[])", [users]);
      if (targetVesselUuid) await db.query("DELETE FROM master_vessels WHERE vessel_uuid = $1", [targetVesselUuid]);
      if (shipScopeVesselUuid) await db.query("DELETE FROM master_vessels WHERE vessel_uuid = $1", [shipScopeVesselUuid]);
      await db.end();
    }
    if (signatureFilePath) {
      const { fileStorageService } = await import("@server/v2/shared/fileStorageService");
      await fileStorageService.deleteAttachment(signatureFilePath);
    }
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
    if (previousAuthBypass === undefined) delete process.env.AUTH_BYPASS;
    else process.env.AUTH_BYPASS = previousAuthBypass;
  });

  it("authorizes replacement reads without Forms grants and returns a pinned, stage-matched eligible version", async () => {
    const eligible = await call(
      "get",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/eligible-forms?stageKey=before_joining`,
      { userId: officeUserId },
    );
    expect(eligible.status).toBe(200);
    const primary = eligible.body.find((form: any) => form.formUuid === formUuid);
    const archiveCandidate = eligible.body.find((form: any) => form.formUuid === archivedFormUuid);
    expect(primary.formVersionUuid).toBe(versionTwoUuid);
    expect(eligible.body.some((form: any) => form.formVersionUuid === invalidReleasedVersionUuid)).toBe(false);
    expect(archiveCandidate.formVersionUuid).toBe(archivedVersionUuid);
    expect(eligible.body.length).toBeGreaterThanOrEqual(2);
    expect(eligible.body.every((form: any) => form.stageKey === "before_joining")).toBe(true);
    expect(primary.stageKey).toBe("before_joining");
    expect(eligible.body.some((form: any) => form.formUuid === formBoardUuid)).toBe(false);

    const grants = await db.query(
      `SELECT count(*)::int AS total
       FROM adm_roleaccess_ac r
       JOIN adm_menumaster_ac m ON m.muid = r.menu_id
       WHERE r.role_id = $1 AND m.name = 'Forms' AND r.is_deleted = false`,
      [officeRoleUuid],
    );
    expect(grants.rows[0].total).toBe(0);

    const unauthenticated = await call(
      "get",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/eligible-forms?stageKey=before_joining`,
    );
    expect(unauthenticated.status).toBe(401);

    const denied = await call(
      "get",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/eligible-forms?stageKey=before_joining`,
      { userId: deniedUserId },
    );
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe("forbidden");
    expect(denied.body.message).toMatch(/permission/i);
  });

  it("creates once, rejects client-owned identity fields and duplicates, and keeps cancelled assignment history", async () => {
    const path = `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/submissions`;
    const invalid = await call("post", path, {
      userId: officeUserId,
      body: {
        formUuid,
        formVersionUuid: versionTwoUuid,
        subjectRef: cancelledAssignmentUuid,
        stageKey: "on_board",
        createdByUuid: "client-controlled",
      },
    });
    expect(invalid.status).toBe(400);

    const invalidReleasedVersionStart = await call("post", path, {
      userId: officeUserId,
      body: { formUuid, formVersionUuid: invalidReleasedVersionUuid },
    });
    expect(invalidReleasedVersionStart.status).toBe(409);
    expect(invalidReleasedVersionStart.body.message).toContain("cannot be completed");

    const staleReleasedVersionStart = await call("post", path, {
      userId: officeUserId,
      body: { formUuid, formVersionUuid: versionOneUuid },
    });
    expect(staleReleasedVersionStart.status).toBe(409);
    expect(staleReleasedVersionStart.body.message).toContain("Refresh the form list");

    const created = await call("post", path, {
      userId: officeUserId,
      body: { formUuid, formVersionUuid: versionTwoUuid },
    });
    expect(created.status).toBe(201);
    primarySubmissionUuid = created.body.submissionUuid;
    expect(created.body.subjectRef).toBe(assignmentUuid);
    expect(created.body.formVersionUuid).toBe(versionTwoUuid);
    expect(created.body.stageKey).toBe("before_joining");
    const duplicate = await call("post", path, {
      userId: officeUserId,
      body: { formUuid, formVersionUuid: versionTwoUuid },
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toBe("conflict");

    await db.query(
      `UPDATE frm_company_submissions
       SET status = 'voided', voided_at = NOW(), voided_by_uuid = $2,
           voided_by_name = 'Integration fixture',
           void_reason = 'Integration replacement fixture',
           voided_previous_status = 'in_progress'
       WHERE submission_uuid = $1`,
      [primarySubmissionUuid, String(officeUserId)],
    );
    const replacement = await call("post", path, {
      userId: officeUserId,
      body: { formUuid, formVersionUuid: versionTwoUuid },
    });
    expect(replacement.status).toBe(201);
    replacementSubmissionUuid = replacement.body.submissionUuid;
    expect(replacement.body.formVersionUuid).toBe(versionTwoUuid);
    const replacementLinks = await db.query(
      `SELECT old.replaced_by_submission_uuid, newer.replaces_submission_uuid,
              newer.form_version_uuid
       FROM frm_company_submissions old
       JOIN frm_company_submissions newer
         ON newer.submission_uuid = old.replaced_by_submission_uuid
       WHERE old.submission_uuid = $1`,
      [primarySubmissionUuid],
    );
    expect(replacementLinks.rows).toEqual([{
      replaced_by_submission_uuid: replacementSubmissionUuid,
      replaces_submission_uuid: primarySubmissionUuid,
      form_version_uuid: versionTwoUuid,
    }]);
    const duplicateReplacement = await call("post", path, {
      userId: officeUserId,
      body: { formUuid, formVersionUuid: versionTwoUuid },
    });
    expect(duplicateReplacement.status).toBe(409);

    // Only this test-owned assignment becomes on-board; do not bypass the
    // current on-board requirement when testing concurrent starts.
    await db.query(
      "UPDATE crew_assignments SET assignment_type = 'OnBoard', is_current = true WHERE assign_uuid = $1",
      [archivedFormAssignmentUuid],
    );
    const competingStarts = await Promise.all([
      call("post", `/api/v2/company-form-submissions/subjects/crew_assignment/${archivedFormAssignmentUuid}/submissions`, {
        userId: officeUserId,
        body: { formUuid: formBoardUuid, formVersionUuid: boardVersionUuid },
      }),
      call("post", `/api/v2/company-form-submissions/subjects/crew_assignment/${archivedFormAssignmentUuid}/submissions`, {
        userId: officeUserId,
        body: { formUuid: formBoardUuid, formVersionUuid: boardVersionUuid },
      }),
    ]);
    expect(competingStarts.map((result) => result.status).sort()).toEqual([201, 409]);

    const link = await db.query(
      "SELECT assign_uuid FROM frm_company_submission_assignments WHERE submission_uuid = $1",
      [created.body.submissionUuid],
    );
    expect(link.rows[0].assign_uuid).toBe(assignmentUuid);

    const list = await call(
      "get",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/submissions`,
      { userId: officeUserId },
    );
    expect(list.status).toBe(200);
    expect(list.body.totalCount).toBe(2);
    expect(list.body.outstandingCount).toBe(1);

    const count = await call(
      "get",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/submissions/count`,
      { userId: officeUserId },
    );
    expect(count.status).toBe(200);
    expect(count.body.totalCount).toBe(2);

    await db.query(
      "UPDATE crew_assignments SET assignment_type = 'Cancelled', is_current = false WHERE assign_uuid = $1",
      [assignmentUuid],
    );
    const cancelledStart = await call("post", path, {
      userId: officeUserId,
      body: { formUuid: formBoardUuid, formVersionUuid: boardVersionUuid },
    });
    expect(cancelledStart.status).toBe(409);

    const noLongerEligible = await call(
      "get",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/eligible-forms?stageKey=before_joining`,
      { userId: officeUserId },
    );
    expect(noLongerEligible.status).toBe(200);
    expect(noLongerEligible.body).toEqual([]);

    const home = await call(
      "get",
      `/api/v2/company-form-submissions/subjects/crew_assignment/home/${crewUuid}/submissions`,
      { userId: officeUserId },
    );
    expect(home.status).toBe(200);
    expect(home.body.groups).toHaveLength(5);
    expect(home.body.groups.map((group: any) => group.groupId)).toContain(assignmentUuid);
    expect(home.body.totalCount).toBe(3);
    expect(home.body.outstandingCount).toBe(1);
    expect(home.body.historyCount).toBe(2);
    expect(home.body.groups.find((group: any) => group.subjectRef === assignmentUuid).submissions)
      .toHaveLength(2);
  });

  it("rechecks archived state on start and retires the old Admin eligible endpoint as JSON 410", async () => {
    await db.query(
      "UPDATE adm_forms_v2 SET archived_at = NOW() WHERE form_uuid = $1",
      [archivedFormUuid],
    );

    const eligible = await call(
      "get",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${archivedFormAssignmentUuid}/eligible-forms?stageKey=before_joining`,
      { userId: officeUserId },
    );
    expect(eligible.status).toBe(200);
    expect(eligible.body.some((form: any) => form.formUuid === archivedFormUuid)).toBe(false);

    const archivedStart = await call(
      "post",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${archivedFormAssignmentUuid}/submissions`,
      {
        userId: officeUserId,
        body: { formUuid: archivedFormUuid, formVersionUuid: archivedVersionUuid },
      },
    );
    expect(archivedStart.status).toBe(409);

    const retired = await call("get", "/api/v2/admin/forms/eligible-submissions", {
      userId: officeUserId,
    });
    expect(retired.status).toBe(410);
    expect(retired.headers["content-type"]).toMatch(/application\/json/);
    expect(retired.body.error).toBe("endpoint_retired");
  });

  it("serializes guarded pinned draft edits and enforces subject, section, point, and audit policy", async () => {
    await db.query("UPDATE crew_assignments SET vessel_uuid = $2 WHERE assign_uuid = $1", [
      writeAssignmentUuid,
      targetVesselUuid,
    ]);
    const started = await callOn(
      renderServer,
      "post",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${writeAssignmentUuid}/submissions`,
      { userId: officeUserId, body: { formUuid, formVersionUuid: versionTwoUuid } },
    );
    expect(started.status).toBe(201);
    writeSubmissionUuid = started.body.submissionUuid;

    const sectionUuid = renderSectionUuids[1];
    const partUuid = renderPartUuids[1];
    const questions = (await db.query(
      "SELECT question_uuid, question_code FROM frm_questions WHERE section_uuid = $1 AND is_deleted = false",
      [sectionUuid],
    )).rows as Array<{ question_uuid: string; question_code: string }>;
    const question = (code: string) => {
      const found = questions.find((row) => row.question_code === code);
      if (!found) throw new Error(`Missing test question ${code}.`);
      return found.question_uuid;
    };
    const choiceUuid = question("CHOICE");
    const contentUuid = question("CONTENT");
    const systemUuid = question("SYSTEM");
    const infoUuid = question("INFO");
    const editPath = `/api/v2/company-form-submissions/${writeSubmissionUuid}/sections/${sectionUuid}/answers`;
    const answer = { questionUuid: choiceUuid, value: "choice-value", comment: "Checked by crewing" };

    const unauthenticated = await callOn(renderServer, "put", editPath, { body: { answers: [answer] } });
    expect(unauthenticated.status).toBe(401);
    const readOnly = await callOn(renderServer, "put", editPath, {
      userId: viewOnlyUserId,
      body: { answers: [answer] },
    });
    expect(readOnly.status).toBe(403);
    const denied = await callOn(renderServer, "put", editPath, {
      userId: deniedUserId,
      body: { answers: [answer] },
    });
    expect(denied.status).toBe(403);
    const wrongVessel = await callOn(renderServer, "put", editPath, {
      userId: shipUserId,
      userType: "Ship",
      body: { answers: [answer] },
    });
    expect(wrongVessel.status).toBe(403);
    const unlinkedSeafarer = await callOn(renderServer, "put", editPath, {
      userId: unlinkedSeafarerUserId,
      userType: "Seafarer",
      body: { answers: [answer] },
    });
    expect(unlinkedSeafarer.status).toBe(403);
    const wrongRole = await callOn(renderServer, "put", editPath, {
      userId: roleMismatchUserId,
      body: { answers: [answer] },
    });
    expect(wrongRole.status).toBe(403);

    await db.query("UPDATE master_users SET department = 'Crewing' WHERE id = $1", [officeUserId]);
    await db.query(
      `UPDATE frm_sections
       SET responsible_mode = 'department', responsible_role_uuid = NULL, responsible_department = 'Crewing'
       WHERE section_uuid = $1`,
      [sectionUuid],
    );
    const wrongDepartment = await callOn(renderServer, "put", editPath, {
      userId: roleMismatchUserId,
      body: { answers: [answer] },
    });
    expect(wrongDepartment.status).toBe(403);
    const clientDepartmentClaim = await callOn(renderServer, "put", editPath, {
      userId: roleMismatchUserId,
      body: { answers: [answer], department: "Crewing" },
    });
    expect(clientDepartmentClaim.status).toBe(400);
    const departmentEditor = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [], sectionComment: "Trusted department edit" },
    });
    expect(departmentEditor.status).toBe(204);

    await db.query(
      `UPDATE frm_sections
       SET responsible_mode = 'not_applicable', responsible_role_uuid = NULL, responsible_department = NULL
       WHERE section_uuid = $1`,
      [sectionUuid],
    );
    const stillWrongVessel = await callOn(renderServer, "put", editPath, {
      userId: shipUserId,
      userType: "Ship",
      body: { answers: [], sectionComment: "Must not be accepted" },
    });
    expect(stillWrongVessel.status).toBe(403);
    await db.query("UPDATE crew_assignments SET vessel_uuid = $2 WHERE assign_uuid = $1", [
      writeAssignmentUuid,
      shipScopeVesselUuid,
    ]);
    const ownVesselEditor = await callOn(renderServer, "put", editPath, {
      userId: shipUserId,
      userType: "Ship",
      body: { answers: [], sectionComment: "Own vessel edit" },
    });
    // Vessel membership does not confer before-joining write rights.
    expect(ownVesselEditor.status).toBe(403);

    await db.query("UPDATE frm_form_parts SET is_office_only = true WHERE form_part_uuid = $1", [partUuid]);
    const officeOnlyDenied = await callOn(renderServer, "put", editPath, {
      userId: shipUserId,
      userType: "Ship",
      body: { answers: [], sectionComment: "Office-only bypass attempt" },
    });
    expect(officeOnlyDenied.status).toBe(403);
    await db.query("UPDATE frm_form_parts SET is_office_only = false WHERE form_part_uuid = $1", [partUuid]);

    await db.query(
      "UPDATE frm_sections SET responsible_mode = 'seafarer' WHERE section_uuid = $1",
      [sectionUuid],
    );
    const wrongSectionActor = await callOn(renderServer, "put", editPath, {
      userId: shipUserId,
      userType: "Ship",
      body: { answers: [answer] },
    });
    expect(wrongSectionActor.status).toBe(403);
    await db.query(
      `UPDATE frm_sections
       SET responsible_mode = 'role', responsible_role_uuid = $2, responsible_department = NULL
       WHERE section_uuid = $1`,
      [sectionUuid, officeRoleUuid],
    );

    for (const pointUuid of [contentUuid, systemUuid, infoUuid]) {
      const forbiddenPoint = await callOn(renderServer, "put", editPath, {
        userId: officeUserId,
        body: {
          answers: [{ questionUuid: pointUuid, value: null, comment: "Not a writable point" }],
        },
      });
      expect(forbiddenPoint.status).toBe(400);
    }
    const invalidOption = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [{ questionUuid: choiceUuid, value: "foreign-option" }] },
    });
    expect(invalidOption.status).toBe(400);
    const invalidShape = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [{ questionUuid: choiceUuid, value: true }] },
    });
    expect(invalidShape.status).toBe(400);
    const foreignQuestion = (await db.query(
      "SELECT question_uuid FROM frm_questions WHERE section_uuid = $1 AND question_code = 'CHOICE'",
      [renderSectionUuids[0]],
    )).rows[0].question_uuid as string;
    const invalidQuestion = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [{ questionUuid: foreignQuestion, value: "choice-value" }] },
    });
    expect(invalidQuestion.status).toBe(400);
    const foreignSection = await callOn(
      renderServer,
      "put",
      `/api/v2/company-form-submissions/${writeSubmissionUuid}/sections/${renderSectionUuids[0]}/answers`,
      { userId: officeUserId, body: { answers: [answer] } },
    );
    expect(foreignSection.status).toBe(400);

    await db.query("UPDATE frm_questions SET comment_enabled = false WHERE question_uuid = $1", [choiceUuid]);
    const disabledComment = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [answer] },
    });
    expect(disabledComment.status).toBe(400);
    await db.query("UPDATE frm_questions SET comment_enabled = true WHERE question_uuid = $1", [choiceUuid]);

    const duplicateQuestion = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [answer, answer] },
    });
    expect(duplicateQuestion.status).toBe(400);
    const immutableIdentity = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [answer], subjectRef: cancelledAssignmentUuid, formVersionUuid: versionTwoUuid },
    });
    expect(immutableIdentity.status).toBe(400);
    const unauthorizedTransition = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [answer], sectionStatus: "submitted", signature: { type: "officer" } },
    });
    expect(unauthorizedTransition.status).toBe(400);
    const atomicInvalidBatch = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: {
        answers: [
          answer,
          { questionUuid: contentUuid, value: null },
        ],
      },
    });
    expect(atomicInvalidBatch.status).toBe(400);
    const noPartialAnswer = await db.query(
      "SELECT count(*)::int AS total FROM frm_answers WHERE submission_uuid = $1 AND question_uuid = $2 AND is_deleted = false",
      [writeSubmissionUuid, choiceUuid],
    );
    expect(noPartialAnswer.rows[0].total).toBe(0);

    const originalPin = (await db.query(
      `SELECT subject_type, subject_ref, form_uuid, form_version_uuid, stage_key
       FROM frm_company_submissions WHERE submission_uuid = $1`,
      [writeSubmissionUuid],
    )).rows[0];
    const saved = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [answer], sectionComment: "Role-owned section comment" },
    });
    expect(saved.status).toBe(204);
    const savedAnswer = await db.query(
      `SELECT answer_value, answer_comment, created_by_uuid, updated_by_uuid
       FROM frm_answers
       WHERE submission_uuid = $1 AND question_uuid = $2 AND is_deleted = false`,
      [writeSubmissionUuid, choiceUuid],
    );
    expect(savedAnswer.rowCount).toBe(1);
    expect(savedAnswer.rows[0]).toMatchObject({
      answer_value: "choice-value",
      answer_comment: "Checked by crewing",
      created_by_uuid: String(officeUserId),
      updated_by_uuid: String(officeUserId),
    });
    const savedState = await db.query(
      `SELECT status, section_comment, created_by_uuid, updated_by_uuid
       FROM frm_section_states
       WHERE submission_uuid = $1 AND section_uuid = $2 AND is_deleted = false`,
      [writeSubmissionUuid, sectionUuid],
    );
    expect(savedState.rowCount).toBe(1);
    expect(savedState.rows[0]).toMatchObject({
      status: "not_started",
      section_comment: "Role-owned section comment",
      created_by_uuid: String(officeUserId),
      updated_by_uuid: String(officeUserId),
    });
    const pinAfterSave = (await db.query(
      `SELECT subject_type, subject_ref, form_uuid, form_version_uuid, stage_key
       FROM frm_company_submissions WHERE submission_uuid = $1`,
      [writeSubmissionUuid],
    )).rows[0];
    expect(pinAfterSave).toEqual(originalPin);
    const valueOnlySave = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [{ questionUuid: choiceUuid, value: "choice-value" }] },
    });
    expect(valueOnlySave.status).toBe(204);
    const preservedComment = await db.query(
      `SELECT answer_comment FROM frm_answers
       WHERE submission_uuid = $1 AND question_uuid = $2 AND is_deleted = false`,
      [writeSubmissionUuid, choiceUuid],
    );
    expect(preservedComment.rows[0].answer_comment).toBe("Checked by crewing");

    const clearAnswer = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: {
        answers: [{ questionUuid: choiceUuid, value: null, comment: null }],
        sectionComment: null,
      },
    });
    expect(clearAnswer.status).toBe(204);
    const cleared = await db.query(
      `SELECT answer_value, answer_comment FROM frm_answers
       WHERE submission_uuid = $1 AND question_uuid = $2 AND is_deleted = false`,
      [writeSubmissionUuid, choiceUuid],
    );
    expect(cleared.rowCount).toBe(1);
    expect(cleared.rows[0]).toEqual({ answer_value: null, answer_comment: null });

    orphanSubmissionUuid = u();
    await db.query(
      `INSERT INTO frm_answers (answer_uuid, submission_uuid, question_uuid, answer_value, is_deleted)
       VALUES ($1, $2, $3, 'orphan', false)`,
      [u(), orphanSubmissionUuid, choiceUuid],
    );
    await db.query(
      `INSERT INTO frm_section_states
         (section_state_uuid, submission_uuid, section_uuid, status, is_deleted)
       VALUES ($1, $2, $3, 'not_started', false)`,
      [u(), orphanSubmissionUuid, sectionUuid],
    );
    const orphanWrite = await callOn(
      renderServer,
      "put",
      `/api/v2/company-form-submissions/${orphanSubmissionUuid}/sections/${sectionUuid}/answers`,
      { userId: officeUserId, body: { answers: [answer] } },
    );
    expect(orphanWrite.status).toBe(404);
    const nonexistentWrite = await callOn(
      renderServer,
      "put",
      `/api/v2/company-form-submissions/${u()}/sections/${sectionUuid}/answers`,
      { userId: officeUserId, body: { answers: [answer] } },
    );
    expect(nonexistentWrite.status).toBe(404);

    await db.query(
      "UPDATE crew_assignments SET assignment_type = 'Cancelled' WHERE assign_uuid = $1",
      [writeAssignmentUuid],
    );
    const cancelledWrite = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [answer] },
    });
    expect(cancelledWrite.status).toBe(409);
    await db.query(
      "UPDATE crew_assignments SET assignment_type = 'Planned' WHERE assign_uuid = $1",
      [writeAssignmentUuid],
    );
    await db.query(
      `UPDATE frm_section_states SET status = 'submitted'
       WHERE submission_uuid = $1 AND section_uuid = $2`,
      [writeSubmissionUuid, sectionUuid],
    );
    const lockedSectionWrite = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [answer] },
    });
    expect(lockedSectionWrite.status).toBe(409);
    await db.query(
      "UPDATE frm_company_submissions SET status = 'completed', completed_at = NOW() WHERE submission_uuid = $1",
      [writeSubmissionUuid],
    );
    const completedWrite = await callOn(renderServer, "put", editPath, {
      userId: officeUserId,
      body: { answers: [answer] },
    });
    expect(completedWrite.status).toBe(409);
  });

  it("renders the authorized persisted pin without Admin routes and serves only submission-owned historical assets", async () => {
    // This is a legacy, already-created submission pinned to v01 while v02 is
    // now the eligible release. New starts must select v02, but existing pins
    // must continue rendering v01 content.
    historySubmissionUuid = u();
    await db.query(
      `INSERT INTO frm_company_submissions
         (submission_uuid, subject_type, subject_ref, form_uuid, form_version_uuid,
          stage_key, status, created_by_uuid, is_deleted, is_sync)
       VALUES ($1, 'crew_assignment', $2, $3, $4, 'before_joining',
               'in_progress', $5, false, false)`,
      [historySubmissionUuid, historyAssignmentUuid, formUuid, versionOneUuid, String(officeUserId)],
    );
    await db.query(
      `INSERT INTO frm_company_submission_assignments
         (submission_uuid, assign_uuid, created_by_uuid, updated_by_uuid, is_deleted, is_sync)
       VALUES ($1, $2, $3, $3, false, false)`,
      [historySubmissionUuid, historyAssignmentUuid, String(officeUserId)],
    );

    const historyStateUuid = u();
    const historySectionUuid = renderSectionUuids[0];
    const historyQuestionUuid = (await db.query(
      `SELECT question_uuid FROM frm_questions
       WHERE section_uuid = $1 AND question_code = 'CHOICE'`,
      [historySectionUuid],
    )).rows[0].question_uuid;
    const { fileStorageService } = await import("@server/v2/shared/fileStorageService");
    signatureFilePath = await fileStorageService.writeAttachment(
      "company-forms/signatures",
      `company-form-${SUFFIX}.png`,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    historyAssetUuid = u();
    await db.query(
      `INSERT INTO frm_section_states
         (section_state_uuid, submission_uuid, section_uuid, status, section_comment, submitted_by_uuid, submitted_by_name, submitted_at, is_deleted)
       VALUES ($1, $2, $3, 'submitted', 'Persisted section comment', $4, 'Test reader', NOW(), false)`,
      [historyStateUuid, historySubmissionUuid, historySectionUuid, String(officeUserId)],
    );
    await db.query(
      `INSERT INTO frm_answers
         (answer_uuid, submission_uuid, question_uuid, answer_value, answer_comment, is_deleted)
       VALUES ($1, $2, $3, 'choice-value', 'Persisted answer comment', false)`,
      [u(), historySubmissionUuid, historyQuestionUuid],
    );
    await db.query(
      `INSERT INTO frm_signature_attachments
         (sig_att_uuid, file_name, file_type, file_size, file_path, is_deleted)
       VALUES ($1, 'historical.png', 'image/png', '8', $2, false)`,
      [historyAssetUuid, signatureFilePath],
    );
    await db.query(
      `INSERT INTO frm_section_signatures
         (section_signature_uuid, section_state_uuid, signature_type, signature_att_uuid,
          signer_name, signer_rank, signed_at, signed_by_uuid, signature_method, is_deleted)
       VALUES ($1, $2, 'officer', $3, 'Test Officer', 'Master', NOW(), $4, 'officer', false)`,
      [u(), historyStateUuid, historyAssetUuid, String(officeUserId)],
    );

    const inProgressForm = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${historySubmissionUuid}/form`,
      { userId: officeUserId },
    );
    expect(inProgressForm.status).toBe(200);
    expect(inProgressForm.body.version.formVersionUuid).toBe(versionOneUuid);
    expect(inProgressForm.body.submission.canEdit).toBe(true);
    expect(inProgressForm.body.version.versionNo).toBe("01");
    expect(inProgressForm.body.parts[0].sections[0].sectionTitle).toBe("Pinned section one");
    const nameField = inProgressForm.body.parts[0].sections[0].questions
      .find((question: any) => question.systemFieldKey === "seafarer_name");
    expect(nameField.systemField.value).toBeNull();
    expect(nameField.systemField.valueOrigin).toBe("persisted_snapshot_unavailable");
    expect(inProgressForm.body.parts[0].sections[0].applicableVesselTypes[0].vesselType)
      .toBe(`Render vessel type ${SUFFIX}`);
    expect(inProgressForm.body.parts[0].sections[0].responsibleRole.roleUuid).toBe(officeRoleUuid);
    expect(inProgressForm.body.optionSets.some((set: any) => set.setName === "Named choices one")).toBe(true);
    expect(inProgressForm.body.parts[0].sections[0].questions
      .some((question: any) => question.contentHtml?.includes("Version-owned content one"))).toBe(true);
    expect(inProgressForm.body.states[0].sectionComment).toBe("Persisted section comment");
    expect(inProgressForm.body.answers[0].answerComment).toBe("Persisted answer comment");
    expect(inProgressForm.body.states[0].signatures[0].attachment.rawUrl)
      .toBe(`/api/v2/company-form-submissions/${historySubmissionUuid}/attachments/${historyAssetUuid}/raw`);
    expect(JSON.stringify(inProgressForm.body)).not.toContain(signatureFilePath);

    const readOnlyForm = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${historySubmissionUuid}/form`,
      { userId: viewOnlyUserId },
    );
    expect(readOnlyForm.status).toBe(200);
    expect(readOnlyForm.body.submission.canEdit).toBe(false);
    expect(readOnlyForm.body.parts).toHaveLength(1);
    const readOnlyDetail = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${historySubmissionUuid}`,
      { userId: viewOnlyUserId },
    );
    expect(readOnlyDetail.status).toBe(200);
    expect(readOnlyDetail.body.submission.canEdit).toBe(false);

    const foreignStateUuid = u();
    const foreignSectionUuid = renderSectionUuids[1];
    await db.query(
      `INSERT INTO frm_section_states
         (section_state_uuid, submission_uuid, section_uuid, status, is_deleted)
       VALUES ($1, $2, $3, 'not_started', false)`,
      [foreignStateUuid, primarySubmissionUuid, foreignSectionUuid],
    );
    foreignAssetUuid = u();
    await db.query(
      `INSERT INTO frm_signature_attachments
         (sig_att_uuid, file_name, file_type, file_size, file_path, is_deleted)
       VALUES ($1, 'other-submission.png', 'image/png', '8', $2, false)`,
      [foreignAssetUuid, signatureFilePath],
    );
    await db.query(
      `INSERT INTO frm_section_signatures
         (section_signature_uuid, section_state_uuid, signature_type, signature_att_uuid,
          signer_name, signed_at, signed_by_uuid, signature_method, is_deleted)
       VALUES ($1, $2, 'officer', $3, 'Other submission', NOW(), $4, 'officer', false)`,
      [u(), foreignStateUuid, foreignAssetUuid, String(officeUserId)],
    );

    await db.query(
      "UPDATE crew_assignments SET assignment_type = 'Cancelled', is_current = false WHERE assign_uuid = $1",
      [historyAssignmentUuid],
    );
    const cancelledDraft = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${historySubmissionUuid}/form`,
      { userId: officeUserId },
    );
    expect(cancelledDraft.status).toBe(200);
    expect(cancelledDraft.body.submission.status).toBe("in_progress");
    expect(cancelledDraft.body.submission.canEdit).toBe(false);
    await db.query("UPDATE adm_forms_v2 SET archived_at = NOW() WHERE form_uuid = $1", [formUuid]);
    await db.query(
      `UPDATE frm_company_submissions
       SET status = 'completed', completed_at = NOW()
       WHERE submission_uuid = $1`,
      [historySubmissionUuid],
    );
    await db.query(
      "UPDATE crew_members_v2 SET first_name = 'Changed', family_name = 'After completion' WHERE crew_uuid = $1",
      [crewUuid],
    );

    const detail = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${historySubmissionUuid}`,
      { userId: officeUserId },
    );
    expect(detail.status).toBe(200);
    expect(detail.body.submission.status).toBe("completed");
    expect(detail.body.submission.canEdit).toBe(false);
    expect(detail.body.states[0].sectionComment).toBe("Persisted section comment");
    expect(detail.body.answers[0].answerValue).toBe("choice-value");
    expect(detail.body.answers[0].answerComment).toBe("Persisted answer comment");
    expect(JSON.stringify(detail.body)).not.toContain(signatureFilePath);

    const historicalForm = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${historySubmissionUuid}/form`,
      { userId: officeUserId },
    );
    const contract: CompanyFormSubmissionRenderContract = historicalForm.body;
    expect(historicalForm.status).toBe(200);
    expect(contract.submission.formVersionUuid).toBe(versionOneUuid);
    expect(contract.submission.canEdit).toBe(false);
    expect(contract.form.archivedAt).not.toBeNull();
    expect(contract.version.versionNo).toBe("01");
    expect(contract.parts[0].sections[0].sectionTitle).toBe("Pinned section one");
    const completedNameField = contract.parts[0].sections[0].questions
      .find((question) => question.systemFieldKey === "seafarer_name");
    expect(completedNameField?.systemField?.value).toBeNull();
    expect(completedNameField?.systemField?.valueOrigin).toBe("persisted_snapshot_unavailable");

    const rawAsset = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${historySubmissionUuid}/attachments/${historyAssetUuid}/raw`,
      { userId: officeUserId },
    );
    expect(rawAsset.status).toBe(200);
    expect(rawAsset.headers["content-type"]).toMatch(/image\/png/);

    const forbiddenForm = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${historySubmissionUuid}/form`,
      { userId: deniedUserId },
    );
    expect(forbiddenForm.status).toBe(403);
    expect(forbiddenForm.body.message).toMatch(/permission/i);
    const forbiddenAsset = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${historySubmissionUuid}/attachments/${historyAssetUuid}/raw`,
      { userId: deniedUserId },
    );
    expect(forbiddenAsset.status).toBe(403);

    const foreignAsset = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${historySubmissionUuid}/attachments/${foreignAssetUuid}/raw`,
      { userId: officeUserId },
    );
    expect(foreignAsset.status).toBe(404);
    const missingAsset = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${historySubmissionUuid}/attachments/${u()}/raw`,
      { userId: officeUserId },
    );
    expect(missingAsset.status).toBe(404);
    const missingSubmission = await callOn(
      renderServer,
      "get",
      `/api/v2/company-form-submissions/${u()}/form`,
      { userId: officeUserId },
    );
    expect(missingSubmission.status).toBe(404);
  });
});