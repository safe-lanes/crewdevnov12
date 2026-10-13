import { openHarnessStages } from "../../helpers/company-form-stage-fixtures";
import express from "express";
import jwt from "jsonwebtoken";
import { Client } from "pg";
import request from "supertest";
import type { Server } from "http";
import { randomUUID } from "node:crypto";
import { grantCompanyFormFixture, clearCompanyFormFixtures } from "../../helpers/companyFormGrants";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CompanyFormSubmissionsService } from "@server/v2/company-forms/submissionsService";
import companyFormSubmissionsRoutes from "@server/v2/company-forms/routes";
import { fileStorageService } from "@server/v2/shared/fileStorageService";

const TEST_SECRET = "company-form-boundary-test-secret";
const SUFFIX = `boundary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Actor = {
  id: number | string;
  userType: string;
  vessels?: string[];
} | null;

type RouteRequest = {
  label: string;
  method: "get" | "post" | "put";
  path: string | (() => string);
  body?: unknown | (() => unknown);
};

let db: Client;
let server: Server;
let officeUserId = 0;
let deniedOfficeUserId = 0;
let viewOnlyUserId = 0;
let shipUserId = 0;
let wrongVesselUserId = 0;
let missingScopeUserId = 0;
let malformedScopeUserId = 0;
let unlinkedSeafarerUserId = 0;
let officeRoleUuid = "";
let deniedOfficeRoleUuid = "";
let viewOnlyRoleUuid = "";
let shipRoleUuid = "";
let wrongVesselRoleUuid = "";
let missingScopeRoleUuid = "";
let malformedScopeRoleUuid = "";
let crewUuid = "";
let assignmentUuid = "";
let createAssignmentUuid = "";
let submissionUuid = "";
let createdByVesselSubmissionUuid = "";
let formUuid = "";
let formVersionUuid = "";
let partUuid = "";
let sectionUuid = "";
let optionSetUuid = "";
let questionUuid = "";
let vesselTypeUuid = "";
let targetVesselUuid = "";
let otherVesselUuid = "";
let targetVesselId = 0;
let otherVesselId = 0;
let assetUuid = "";
let signatureFilePath = "";

function signedToken(actor: Exclude<Actor, null>): string {
  return jwt.sign(
    { id: actor.id, domain: "test", userType: actor.userType, vessels: actor.vessels },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

function call(method: RouteRequest["method"], path: string, actor: Actor, body?: unknown) {
  let req = (request(server) as any)[method](path);
  if (actor) req = req.set("Authorization", `Bearer ${signedToken(actor)}`);
  if (body !== undefined) req = req.send(body);
  return req;
}

async function createOfficeRole(roleName: string, permission: "all" | "view" | "none"): Promise<{
  roleUuid: string;
  userId: number;
}> {
  const roleUuid = uuid();
  await db.query(
    `INSERT INTO adm_rolemaster_ac (ruid, assigned_role, roletype, is_active, is_deleted)
     VALUES ($1, $2, 'Office', true, false)`,
    [roleUuid, roleName],
  );
  const user = await db.query(
    "INSERT INTO master_users (user_type, role) VALUES ('Office', $1) RETURNING id",
    [roleName],
  );
  if (permission !== "none") {
    const menu = await db.query(
      `SELECT muid FROM adm_menumaster_ac
       WHERE name = 'Crew Database' AND is_active = true AND is_deleted = false`,
    );
    if (menu.rowCount !== 1) throw new Error("Expected one active Crew Database menu.");
    await db.query(
      `INSERT INTO adm_roleaccess_ac
         (rauid, role_id, menu_id, canview, cancreate, canedit, candelete, is_deleted)
       VALUES ($1, $2, $3, true, $4, $5, false, false)`,
      [uuid(), roleUuid, menu.rows[0].muid, permission === "all", permission === "all"],
    );
    await grantCompanyFormFixture(db, roleUuid, permission === "all" ? "office" : "view");
  }
  return { roleUuid, userId: Number(user.rows[0].id) };
}

async function createShipRole(roleName: string, vesselIds: number[] | null): Promise<{
  roleUuid: string;
  userId: number;
}> {
  const roleUuid = uuid();
  await db.query(
    `INSERT INTO adm_rolemaster_ac (ruid, assigned_role, roletype, is_active, is_deleted)
     VALUES ($1, $2, 'Ship', true, false)`,
    [roleUuid, roleName],
  );
  const user = await db.query(
    `INSERT INTO master_users (user_type, role, vessel_ids)
     VALUES ('Ship', $1, $2) RETURNING id`,
    [roleName, vesselIds?.join(",") ?? null],
  );
  await grantCompanyFormFixture(db, roleUuid, "vessel");
  return { roleUuid, userId: Number(user.rows[0].id) };
}

function uuid(): string {
  return randomUUID();
}

describe("Company Form relationship boundary", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.AUTH_BYPASS;
    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    const [{ authMiddleware }] = await Promise.all([
      import("@server/middleware/authMiddleware"),
    ]);
    const app = express();
    app.use(express.json());
    app.use(authMiddleware);
    // Deliberately do not mount any Admin routes: successful reads prove the
    // submission API does not depend on the editor surface.
    app.use("/api/v2/company-form-submissions", companyFormSubmissionsRoutes);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });

    const office = await createOfficeRole(`CF Boundary Office ${SUFFIX}`, "all");
    officeRoleUuid = office.roleUuid;
    officeUserId = office.userId;
    const deniedOffice = await createOfficeRole(`CF Boundary Denied ${SUFFIX}`, "none");
    deniedOfficeRoleUuid = deniedOffice.roleUuid;
    deniedOfficeUserId = deniedOffice.userId;
    const viewOnly = await createOfficeRole(`CF Boundary View Only ${SUFFIX}`, "view");
    viewOnlyRoleUuid = viewOnly.roleUuid;
    viewOnlyUserId = viewOnly.userId;

    const targetVessel = await db.query(
      `INSERT INTO master_vessels (vessel_uuid, vessel, is_active, is_deleted)
       VALUES ($1, $2, true, false) RETURNING id, vessel_uuid`,
      [uuid(), `Boundary target vessel ${SUFFIX}`],
    );
    targetVesselUuid = targetVessel.rows[0].vessel_uuid;
    targetVesselId = Number(targetVessel.rows[0].id);
    const otherVessel = await db.query(
      `INSERT INTO master_vessels (vessel_uuid, vessel, is_active, is_deleted)
       VALUES ($1, $2, true, false) RETURNING id, vessel_uuid`,
      [uuid(), `Boundary other vessel ${SUFFIX}`],
    );
    otherVesselUuid = otherVessel.rows[0].vessel_uuid;
    otherVesselId = Number(otherVessel.rows[0].id);

    const ship = await createShipRole(`CF Boundary Ship ${SUFFIX}`, [targetVesselId]);
    shipRoleUuid = ship.roleUuid;
    shipUserId = ship.userId;
    const shipRank = await db.query(
      `SELECT rank_id FROM adm_company_ranks_v2
       WHERE is_deleted = false AND is_role_row = false AND rank_id IS NOT NULL
       ORDER BY id LIMIT 1`,
    );
    expect(shipRank.rows).toHaveLength(1);
    await db.query(
      "UPDATE master_users SET fullname = $2, designation = $3 WHERE id = $1",
      [shipUserId, `Boundary Master ${SUFFIX}`, shipRank.rows[0].rank_id],
    );
    const wrongVessel = await createShipRole(`CF Boundary Wrong Vessel ${SUFFIX}`, [otherVesselId]);
    wrongVesselRoleUuid = wrongVessel.roleUuid;
    wrongVesselUserId = wrongVessel.userId;
    const missingScope = await createShipRole(`CF Boundary Missing Scope ${SUFFIX}`, null);
    missingScopeRoleUuid = missingScope.roleUuid;
    missingScopeUserId = missingScope.userId;
    const malformedScope = await createShipRole(`CF Boundary Malformed Scope ${SUFFIX}`, [targetVesselId]);
    malformedScopeRoleUuid = malformedScope.roleUuid;
    malformedScopeUserId = malformedScope.userId;
    await db.query("UPDATE master_users SET vessel_ids = $2 WHERE id = $1", [
      malformedScopeUserId,
      `${targetVesselId},12junk`,
    ]);
    const unlinked = await db.query(
      `INSERT INTO master_users (user_type, role)
       VALUES ('Seafarer', $1) RETURNING id`,
      [`CF Boundary Unlinked ${SUFFIX}`],
    );
    unlinkedSeafarerUserId = Number(unlinked.rows[0].id);

    crewUuid = uuid();
    await db.query(
      `INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, is_deleted)
       VALUES ($1, $2, 'Boundary', 'Crew', false)`,
      [crewUuid, `CFB-${SUFFIX}`],
    );
    assignmentUuid = uuid();
    createAssignmentUuid = uuid();
    await createAssignment(assignmentUuid);
    await createAssignment(createAssignmentUuid);

    formUuid = uuid();
    formVersionUuid = uuid();
    const form = await db.query(
      `INSERT INTO adm_forms_v2
         (form_uuid, name, category, rank_group, version_no, version_date, subject_type, is_deleted)
       VALUES ($1, $2, 'dynamic', 'Company Form boundary', '01', '2026-01-01', 'crew_assignment', false)
       RETURNING id`,
      [formUuid, `Boundary Form ${SUFFIX}`],
    );
    await db.query(
      `INSERT INTO adm_form_versions_v2
         (fv_uuid, form_id, version_no, version_date, status, stage_key, is_deleted, released_at)
       VALUES ($1, $2, '01', '2026-01-01', 'released', 'on_board', false, NOW())`,
      [formVersionUuid, form.rows[0].id],
    );

    const vesselType = await db.query(
      `INSERT INTO master_vessel_types (vt_uuid, vessel_type, is_active, is_deleted)
       VALUES ($1, $2, true, false) RETURNING vt_uuid`,
      [uuid(), `Boundary vessel type ${SUFFIX}`],
    );
    vesselTypeUuid = vesselType.rows[0].vt_uuid;
    partUuid = uuid();
    sectionUuid = uuid();
    optionSetUuid = uuid();
    questionUuid = uuid();
    await db.query(
      `INSERT INTO frm_form_parts
         (form_part_uuid, form_uuid, form_version_uuid, part_code, part_title, part_type, is_office_only, sort_order, is_deleted)
       VALUES ($1, $2, $3, 'BOUNDARY', 'Boundary part', 'configurable', false, 0, false)`,
      [partUuid, formUuid, formVersionUuid],
    );
    await db.query(
      `INSERT INTO frm_option_sets
         (option_set_uuid, form_version_uuid, set_name, low_end_label, high_end_label, sort_order, is_deleted)
       VALUES ($1, $2, 'Boundary named choices', 'Low', 'High', 0, false)`,
      [optionSetUuid, formVersionUuid],
    );
    await db.query(
      `INSERT INTO frm_options
         (option_uuid, option_set_uuid, option_label, option_value, sort_order, is_deleted)
       VALUES ($1, $2, 'Approved', 'approved', 0, false)`,
      [uuid(), optionSetUuid],
    );
    await db.query(
      `INSERT INTO frm_sections
         (section_uuid, form_version_uuid, form_part_uuid, section_code, section_title,
          applicable_vessel_types, responsible_mode, responsible_role_uuid, comment_box_required,
          signature_officer_required, signature_seafarer_required, default_option_set_uuid,
          layout_preference, sort_order, is_deleted, vessel_signature_role_uuids)
        VALUES ($1, $2, $3, 'BOUNDARY', 'Boundary section', $4, 'role', $6, false,
               false, false, $5, 'auto', 0, false, $7)`,
      [sectionUuid, formVersionUuid, partUuid, JSON.stringify([vesselTypeUuid]), optionSetUuid, shipRoleUuid, [shipRoleUuid]],
    );
    await db.query(
      `INSERT INTO frm_questions
         (question_uuid, section_uuid, question_code, question_text, response_type, is_mandatory,
          comment_enabled, option_set_uuid, sort_order, is_deleted)
       VALUES ($1, $2, 'BOUNDARY', 'Boundary answer', 'single_select', false, true, NULL, 0, false)`,
      [questionUuid, sectionUuid],
    );

    const started = await call(
      "post",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/submissions`,
      { id: officeUserId, userType: "Office" },
      { formUuid, formVersionUuid },
    );
    expect(started.status).toBe(201);
    submissionUuid = started.body.submissionUuid;

    const draftPath = `/api/v2/company-form-submissions/${submissionUuid}/sections/${sectionUuid}/answers`;
    const firstDraft = await call(
      "put",
      draftPath,
      { id: shipUserId, userType: "Ship" },
      { answers: [{ questionUuid, value: "approved", comment: "Reviewed" }] },
    );
    expect(firstDraft.status).toBe(204);

    const submissionRows = await db.query(
      `SELECT section_state_uuid FROM frm_section_states
       WHERE submission_uuid = $1 AND section_uuid = $2 AND is_deleted = false`,
      [submissionUuid, sectionUuid],
    );
    if (submissionRows.rowCount !== 1) throw new Error("Expected the draft to create one section state.");
    signatureFilePath = await fileStorageService.writeAttachment(
      "company-forms/signatures",
      `company-boundary-${SUFFIX}.png`,
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    assetUuid = uuid();
    await db.query(
      `INSERT INTO frm_signature_attachments
         (sig_att_uuid, file_name, file_type, file_size, file_path, is_deleted)
       VALUES ($1, 'boundary.png', 'image/png', '8', $2, false)`,
      [assetUuid, signatureFilePath],
    );
    await db.query(
      `INSERT INTO frm_section_signatures
         (section_signature_uuid, section_state_uuid, signature_type, signature_att_uuid,
          signer_name, signed_at, signed_by_uuid, signature_method, is_deleted)
       VALUES ($1, $2, 'officer', $3, 'Boundary Officer', NOW(), $4, 'officer', false)`,
      [uuid(), submissionRows.rows[0].section_state_uuid, assetUuid, String(officeUserId)],
    );
  });

  async function createAssignment(assignUuid: string): Promise<void> {
    await db.query(
      `INSERT INTO crew_assignments
         (assign_uuid, crew_uuid, vessel_uuid, assignment_type, is_current, is_deleted)
       VALUES ($1, $2, $3, 'OnBoard', true, false)`,
      [assignUuid, crewUuid, targetVesselUuid],
    );
    await openHarnessStages(db, assignUuid);
  }

  const routeMatrix: RouteRequest[] = [
    {
      label: "eligible forms",
      method: "get",
      path: () => `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/eligible-forms?stageKey=on_board`,
    },
    {
      label: "submission list",
      method: "get",
      path: () => `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/submissions`,
    },
    {
      label: "submission count",
      method: "get",
      path: () => `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/submissions/count`,
    },
    {
      label: "crew home submission list",
      method: "get",
      path: () => `/api/v2/company-form-submissions/subjects/crew_assignment/home/${crewUuid}/submissions`,
    },
    {
      label: "submission detail",
      method: "get",
      path: () => `/api/v2/company-form-submissions/${submissionUuid}`,
    },
    {
      label: "pinned form definition",
      method: "get",
      path: () => `/api/v2/company-form-submissions/${submissionUuid}/form`,
    },
    {
      label: "owned attachment",
      method: "get",
      path: () => `/api/v2/company-form-submissions/${submissionUuid}/attachments/${assetUuid}/raw`,
    },
    {
      label: "create submission",
      method: "post",
      path: () => `/api/v2/company-form-submissions/subjects/crew_assignment/${createAssignmentUuid}/submissions`,
      body: () => ({ formUuid, formVersionUuid }),
    },
    {
      label: "edit draft",
      method: "put",
      path: () => `/api/v2/company-form-submissions/${submissionUuid}/sections/${sectionUuid}/answers`,
      body: () => ({ answers: [{ questionUuid, value: "approved" }] }),
    },
  ];

  function routePath(route: RouteRequest): string {
    return typeof route.path === "function" ? route.path() : route.path;
  }

  function routeBody(route: RouteRequest): unknown {
    return typeof route.body === "function" ? route.body() : route.body;
  }

  it("allows a fully scoped vessel actor and a view-only office through every authorized route without Admin routes", async () => {
    for (const route of routeMatrix.filter((candidate) => candidate.method === "get")) {
      const vesselResponse = await call(route.method, routePath(route), { id: shipUserId, userType: "Ship" });
      expect(vesselResponse.status, route.label).toBe(200);
      const viewOnlyResponse = await call(route.method, routePath(route), { id: viewOnlyUserId, userType: "Office" });
      expect(viewOnlyResponse.status, route.label).toBe(200);
    }

    const vesselCreate = await call(
      "post",
      routePath(routeMatrix.find((route) => route.label === "create submission")!),
      { id: shipUserId, userType: "Ship" },
      { formUuid, formVersionUuid },
    );
    expect(vesselCreate.status).toBe(201);
    createdByVesselSubmissionUuid = vesselCreate.body.submissionUuid;

    const vesselDraft = await call(
      "put",
      routePath(routeMatrix.find((route) => route.label === "edit draft")!),
      { id: shipUserId, userType: "Ship" },
      { answers: [{ questionUuid, value: "approved", comment: "Vessel editor" }] },
    );
    expect(vesselDraft.status).toBe(204);

    for (const route of routeMatrix.filter((candidate) => candidate.method !== "get")) {
      const viewOnlyResponse = await call(
        route.method,
        routePath(route),
        { id: viewOnlyUserId, userType: "Office" },
        routeBody(route),
      );
      expect(viewOnlyResponse.status, route.label).toBe(403);
      expect(viewOnlyResponse.body.message).toMatch(/permission/i);
    }
  });

  it("fails closed for every route on untrusted, missing, malformed, or mismatched scope and denied relationships", async () => {
    const deniedActors: Array<{ label: string; actor: Actor }> = [
      { label: "unauthenticated", actor: null },
      { label: "denied office role", actor: { id: deniedOfficeUserId, userType: "Office" } },
      {
        label: "wrong vessel with forged target claim",
        actor: { id: wrongVesselUserId, userType: "Ship", vessels: [targetVesselUuid] },
      },
      {
        label: "missing vessel membership with forged target claim",
        actor: { id: missingScopeUserId, userType: "Ship", vessels: [targetVesselUuid] },
      },
      {
        label: "malformed vessel membership with forged target claim",
        actor: { id: malformedScopeUserId, userType: "Ship", vessels: [targetVesselUuid] },
      },
      {
        label: "integer id and user-type mismatch with forged target claim",
        actor: { id: officeUserId, userType: "Ship", vessels: [targetVesselUuid] },
      },
      {
        label: "noninteger persona id with fallback token scope",
        actor: { id: "dev-persona", userType: "Ship", vessels: [targetVesselUuid] },
      },
      { label: "unlinked seafarer", actor: { id: unlinkedSeafarerUserId, userType: "Seafarer" } },
    ];
    for (const deniedActor of deniedActors) {
      for (const route of routeMatrix) {
        const response = await call(
          route.method,
          routePath(route),
          deniedActor.actor,
          routeBody(route),
        );
        const expectedStatus = deniedActor.actor === null ? 401 : 403;
        expect(response.status, `${deniedActor.label}: ${route.label}`).toBe(expectedStatus);
        if (expectedStatus === 403) {
          expect(response.body.message, `${deniedActor.label}: ${route.label}`).toMatch(/permission/i);
        }
      }
    }
  });

  it("keeps office reads independent of vessel scope and tests injected seafarer linkage at the service boundary", async () => {
    await db.query("UPDATE master_users SET vessel_ids = NULL WHERE id = $1", [officeUserId]);
    const scopeUnavailableService = new CompanyFormSubmissionsService({
      resolveVesselScope: async () => {
        throw new Error("Trusted vessel scope is unavailable.");
      },
    });
    const officeReq = { user: { id: officeUserId, userType: "Office" } } as any;
    const eligible = await scopeUnavailableService.eligibleForms({
      req: officeReq,
      subjectType: "crew_assignment",
      subjectRef: assignmentUuid,
      stageKey: "on_board",
    });
    expect(eligible.some(form => form.formUuid === formUuid)).toBe(true);
    const detail = await scopeUnavailableService.readSubmission({ req: officeReq, submissionUuid });
    expect(detail.submission.submissionUuid).toBe(submissionUuid);

    const linkedService = new CompanyFormSubmissionsService({
      resolveSeafarerCrewUuid: async () => crewUuid,
    });
    const linkedReq = { user: { id: unlinkedSeafarerUserId, userType: "Seafarer" } } as any;
    const ownSubmission = await linkedService.readSubmission({ req: linkedReq, submissionUuid });
    expect(ownSubmission.submission.subjectRef).toBe(assignmentUuid);

    const crossCrewService = new CompanyFormSubmissionsService({
      resolveSeafarerCrewUuid: async () => uuid(),
    });
    await expect(crossCrewService.readSubmission({ req: linkedReq, submissionUuid }))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()));
    }
    if (db) {
      const submissionUuids = [submissionUuid, createdByVesselSubmissionUuid].filter(Boolean);
      const subjectRefs = [assignmentUuid, createAssignmentUuid].filter(Boolean);
      if (submissionUuids.length) {
        await db.query(
          "DELETE FROM frm_section_signatures WHERE section_state_uuid IN (SELECT section_state_uuid FROM frm_section_states WHERE submission_uuid = ANY($1::text[]))",
          [submissionUuids],
        );
        await db.query(
          "DELETE FROM frm_answers WHERE submission_uuid = ANY($1::text[])",
          [submissionUuids],
        );
        await db.query(
          "DELETE FROM frm_section_states WHERE submission_uuid = ANY($1::text[])",
          [submissionUuids],
        );
        await db.query(
          "DELETE FROM frm_company_submission_assignments WHERE submission_uuid = ANY($1::text[])",
          [submissionUuids],
        );
        await db.query(
          "DELETE FROM frm_company_submissions WHERE submission_uuid = ANY($1::text[])",
          [submissionUuids],
        );
      }
      if (assetUuid) await db.query("DELETE FROM frm_signature_attachments WHERE sig_att_uuid = $1", [assetUuid]);
      if (subjectRefs.length) {
        await db.query("DELETE FROM crew_assignments WHERE assign_uuid = ANY($1::text[])", [subjectRefs]);
      }
      if (crewUuid) await db.query("DELETE FROM crew_members_v2 WHERE crew_uuid = $1", [crewUuid]);
      if (questionUuid) await db.query("DELETE FROM frm_questions WHERE question_uuid = $1", [questionUuid]);
      if (sectionUuid) await db.query("DELETE FROM frm_sections WHERE section_uuid = $1", [sectionUuid]);
      if (partUuid) await db.query("DELETE FROM frm_form_parts WHERE form_part_uuid = $1", [partUuid]);
      if (optionSetUuid) {
        await db.query("DELETE FROM frm_options WHERE option_set_uuid = $1", [optionSetUuid]);
        await db.query("DELETE FROM frm_option_sets WHERE option_set_uuid = $1", [optionSetUuid]);
      }
      if (formVersionUuid) await db.query("DELETE FROM adm_form_versions_v2 WHERE fv_uuid = $1", [formVersionUuid]);
      if (formUuid) await db.query("DELETE FROM adm_forms_v2 WHERE form_uuid = $1", [formUuid]);
      const roleIds = [
        officeRoleUuid,
        deniedOfficeRoleUuid,
        viewOnlyRoleUuid,
        shipRoleUuid,
        wrongVesselRoleUuid,
        missingScopeRoleUuid,
        malformedScopeRoleUuid,
      ].filter(Boolean);
      if (roleIds.length) {
        await clearCompanyFormFixtures(db, roleIds);
        await db.query("DELETE FROM adm_roleaccess_ac WHERE role_id = ANY($1::text[])", [roleIds]);
        await db.query("DELETE FROM adm_rolemaster_ac WHERE ruid = ANY($1::text[])", [roleIds]);
      }
      const userIds = [
        officeUserId,
        deniedOfficeUserId,
        viewOnlyUserId,
        shipUserId,
        wrongVesselUserId,
        missingScopeUserId,
        malformedScopeUserId,
        unlinkedSeafarerUserId,
      ].filter(Boolean);
      if (userIds.length) await db.query("DELETE FROM master_users WHERE id = ANY($1::int[])", [userIds]);
      if (targetVesselUuid) await db.query("DELETE FROM master_vessels WHERE vessel_uuid = $1", [targetVesselUuid]);
      if (otherVesselUuid) await db.query("DELETE FROM master_vessels WHERE vessel_uuid = $1", [otherVesselUuid]);
      if (vesselTypeUuid) await db.query("DELETE FROM master_vessel_types WHERE vt_uuid = $1", [vesselTypeUuid]);
      await db.end();
    }
    if (signatureFilePath) await fileStorageService.deleteAttachment(signatureFilePath);
    delete process.env.AUTH_BYPASS;
  });
});