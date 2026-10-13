import { openHarnessStages, captureHarnessContractRank } from "../../helpers/company-form-stage-fixtures";
let signingFixtureRankId = "";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "node:crypto";
import { grantCompanyFormFixture, clearCompanyFormFixtures } from "../../helpers/companyFormGrants";
import type { Server } from "node:http";
import routes from "@server/v2/company-forms/routes";
import { fileStorageService } from "@server/v2/shared/fileStorageService";

const id = () => randomUUID();
const suffix = id();
const secret = "company-form-void-race-test-secret";
const db = new Client({ connectionString: process.env.DATABASE_URL });
const formUuid = id(), versionUuid = id(), partUuid = id(), sectionUuid = id(), questionUuid = id();
const crewUuid = id(), vesselUuid = id(), officeRole = id(), masterRole = id();
const assignments: string[] = [], submissions: string[] = [], users: number[] = [];
let officeId = 0, masterId = 0, server: Server;
const previousSecret = process.env.JWT_SECRET;
const previousBypass = process.env.AUTH_BYPASS;
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";

function api(actor: number, method: "post" | "put", path: string, body: object) {
  const token = jwt.sign({ id: actor, domain: "test", userType: actor === masterId ? "Ship" : "Office" }, secret);
  return request(server)[method](`/api/v2/company-form-submissions${path}`)
    .set("Authorization", `Bearer ${token}`).send(body);
}

async function waitForBlocked(blockerPid: number, count: number) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    const rows = await db.query<{ pid: number }>(
      `SELECT pid FROM pg_stat_activity WHERE wait_event_type = 'Lock'
       AND $1 = ANY(pg_blocking_pids(pid))`, [blockerPid],
    );
    if (rows.rowCount! >= count) return rows.rows;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw Error(`Expected ${count} requests blocked by PID ${blockerPid}`);
}

describe.sequential("Office void versus trusted Master writes", () => {
  beforeAll(async () => {
    await db.connect();
    process.env.JWT_SECRET = secret;
    delete process.env.AUTH_BYPASS;
    const { authMiddleware } = await import("@server/middleware/authMiddleware");
    const app = express();
    app.use(express.json(), authMiddleware);
    app.use("/api/v2/company-form-submissions", routes);
    server = await new Promise<Server>(resolve => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    await db.query(
      `INSERT INTO adm_rolemaster_ac (ruid, assigned_role, roletype, is_active, is_deleted)
       VALUES ($1, $3, 'Office', true, false), ($2, $4, 'Ship', true, false)`,
      [officeRole, masterRole, `Void Race Office ${suffix}`, `Void Race Master ${suffix}`],
    );
    const vessel = await db.query(
      `INSERT INTO master_vessels (vessel_uuid, vessel, is_active, is_deleted)
       VALUES ($1, $2, true, false) RETURNING id`, [vesselUuid, `Void Race ${suffix}`],
    );
    const rank = await db.query(
      `SELECT rank_id FROM adm_company_ranks_v2 WHERE rank = 'Master'
       AND is_deleted = false AND is_role_row = false`,
    );
    expect(rank.rows).toHaveLength(1);
    const actors = await db.query(
      `INSERT INTO master_users (user_type, role, fullname, designation, vessel_ids)
       VALUES ('Office', $1, 'Test Office Void Actor', 'Crewing', NULL),
              ('Ship', $2, 'Test Master Witness', $3, $4) RETURNING id, user_type`,
      [`Void Race Office ${suffix}`, `Void Race Master ${suffix}`, rank.rows[0].rank_id, String(vessel.rows[0].id)],
    );
    users.push(...actors.rows.map(row => Number(row.id)));
    officeId = Number(actors.rows.find(row => row.user_type === "Office")!.id);
    masterId = Number(actors.rows.find(row => row.user_type === "Ship")!.id);
    const menus = await db.query(
      "SELECT muid FROM adm_menumaster_ac WHERE name = 'Crew Database' AND is_active = true AND is_deleted = false",
    );
    expect(menus.rows).toHaveLength(1);
    await db.query(
      `INSERT INTO adm_roleaccess_ac (rauid, role_id, menu_id, canview, cancreate, canedit, candelete, is_deleted)
       VALUES ($1, $2, $3, true, true, true, false, false)`, [id(), officeRole, menus.rows[0].muid],
    );
    await grantCompanyFormFixture(db, officeRole, "office");
    await grantCompanyFormFixture(db, masterRole, "vessel");
    await db.query(
      `INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, present_rank, is_deleted)
       VALUES ($1, $2, 'Test', 'Seafarer', $3, false)`, [crewUuid, suffix, rank.rows[0].rank_id],
    );
    signingFixtureRankId = rank.rows[0].rank_id;
    const form = await db.query(
      `INSERT INTO adm_forms_v2 (form_uuid, name, category, subject_type, rank_group, version_no, version_date, is_deleted)
       VALUES ($1, $2, 'dynamic', 'crew_assignment', '', '01', '2026-10-03', false) RETURNING id`,
      [formUuid, `Void Race Company Form ${suffix}`],
    );
    await db.query(
      `INSERT INTO adm_form_versions_v2 (fv_uuid, form_id, version_no, version_date, status, stage_key, is_deleted, released_at)
       VALUES ($1, $2, '01', '2026-10-03', 'released', 'on_board', false, NOW())`,
      [versionUuid, form.rows[0].id],
    );
    await db.query(
      `INSERT INTO frm_form_parts (form_part_uuid, form_uuid, form_version_uuid, part_code, part_title, part_type, is_deleted)
       VALUES ($1, $2, $3, 'RACE', 'Race', 'configurable', false)`, [partUuid, formUuid, versionUuid],
    );
    await db.query(
      `INSERT INTO frm_sections (section_uuid, form_version_uuid, form_part_uuid, section_code, section_title,
        responsible_mode, vessel_signature_role_uuids, signature_seafarer_required, is_deleted)
       VALUES ($1, $2, $3, 'RACE', 'Master witnessed declaration', 'seafarer', $4, true, false)`,
      [sectionUuid, versionUuid, partUuid, [masterRole]],
    );
    await db.query(
      `INSERT INTO frm_questions (question_uuid, section_uuid, question_code, question_text, response_type, is_deleted)
       VALUES ($1, $2, 'RACE', 'Notes', 'free_text', false)`, [questionUuid, sectionUuid],
    );
  });

  it.each(["draft", "signature"] as const)(
    "serializes an Office void against a permitted Master %s with no deadlock or HTTP 500",
    async operation => {
      const assignment = id();
      assignments.push(assignment);
      await db.query(
        `INSERT INTO crew_assignments (assign_uuid, crew_uuid, vessel_uuid, assignment_type, is_current, is_deleted)
         VALUES ($1, $2, $3, 'OnBoard', true, false)`, [assignment, crewUuid, vesselUuid],
      );
      await openHarnessStages(db, assignment);
      await captureHarnessContractRank(db, assignment, signingFixtureRankId);
      const started = await api(officeId, "post", `/subjects/crew_assignment/${assignment}/submissions`, { formUuid, formVersionUuid: versionUuid });
      expect(started.status).toBe(201);
      const submission = started.body.submissionUuid;
      submissions.push(submission);
      const holder = new Client({ connectionString: process.env.DATABASE_URL });
      await holder.connect();
      let write: Promise<any> | undefined, voiding: Promise<any> | undefined;
      try {
        await holder.query("BEGIN");
        const heldPid = Number((await holder.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
        await holder.query("SELECT submission_uuid FROM frm_company_submissions WHERE submission_uuid = $1 FOR UPDATE", [submission]);
        // Hold the submission and queue the Master writer first. Under the old
        // inverted order, void then holds the subject while queued behind that
        // writer, creating a deterministic cycle when this holder releases.
        write = (operation === "draft"
          ? api(masterId, "put", `/${submission}/sections/${sectionUuid}/answers`, { answers: [{ questionUuid, value: "Saved before void" }] })
          : api(masterId, "post", `/${submission}/sections/${sectionUuid}/signatures`, {
            signatureType: "seafarer", method: "witnessed", data: png, seafarerPresent: true,
          })).then(response => response);
        const [writer] = await waitForBlocked(heldPid, 1);
        voiding = api(officeId, "post", `/${submission}/void`, { reason: "Isolated concurrency regression" }).then(response => response);
        await waitForBlocked(writer.pid, 1);
        await holder.query("COMMIT");
        const [saved, voided] = await Promise.all([write, voiding]);
        expect(saved.status, JSON.stringify(saved.body)).toBe(operation === "draft" ? 204 : 201);
        expect(voided.status, JSON.stringify(voided.body)).toBe(204);
        const persisted = await db.query(
          "SELECT status, voided_by_uuid, voided_by_name FROM frm_company_submissions WHERE submission_uuid = $1", [submission],
        );
        expect(persisted.rows[0]).toMatchObject({
          status: "voided", voided_by_uuid: String(officeId), voided_by_name: "Test Office Void Actor",
        });
        if (operation === "draft") {
          const answers = await db.query("SELECT answer_value FROM frm_answers WHERE submission_uuid = $1", [submission]);
          expect(answers.rows[0].answer_value).toBe("Saved before void");
        } else {
          expect(saved.body).toMatchObject({ signerName: "Test Seafarer", signatureMethod: "witnessed" });
          const signatures = await db.query(
            `SELECT signature.signer_name, signature.witness_name, signature.signed_by_uuid
             FROM frm_section_signatures signature JOIN frm_section_states state
             ON state.section_state_uuid = signature.section_state_uuid
             WHERE state.submission_uuid = $1 AND signature.is_deleted = false`, [submission],
          );
          expect(signatures.rows).toEqual([{
            signer_name: "Test Seafarer", witness_name: "Test Master Witness", signed_by_uuid: String(masterId),
          }]);
        }
      } finally {
        await holder.query("ROLLBACK").catch(() => undefined);
        await holder.end();
        await Promise.allSettled([write, voiding].filter(Boolean));
      }
    },
  );

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    const assets = await db.query("SELECT file_path FROM frm_signature_attachments WHERE created_by_uuid = ANY($1::text[])", [users.map(String)]);
    await db.query("BEGIN");
    try {
      await db.query("DELETE FROM frm_section_signatures WHERE section_state_uuid IN (SELECT section_state_uuid FROM frm_section_states WHERE submission_uuid = ANY($1::text[]))", [submissions]);
      for (const table of ["frm_answers", "frm_company_submission_system_snapshots", "frm_section_states", "frm_company_submission_assignments", "frm_company_submissions"]) {
        await db.query(`DELETE FROM ${table} WHERE submission_uuid = ANY($1::text[])`, [submissions]);
      }
      await db.query("DELETE FROM frm_signature_attachments WHERE created_by_uuid = ANY($1::text[])", [users.map(String)]);
      await db.query("DELETE FROM frm_questions WHERE question_uuid = $1", [questionUuid]);
      await db.query("DELETE FROM frm_sections WHERE section_uuid = $1", [sectionUuid]);
      await db.query("DELETE FROM frm_form_parts WHERE form_part_uuid = $1", [partUuid]);
      await db.query("DELETE FROM adm_form_versions_v2 WHERE fv_uuid = $1", [versionUuid]);
      await db.query("DELETE FROM adm_forms_v2 WHERE form_uuid = $1", [formUuid]);
      await db.query("DELETE FROM crew_assignment_rule_context WHERE assign_uuid = ANY($1::text[])", [assignments]);
      await db.query("DELETE FROM crew_assignments WHERE assign_uuid = ANY($1::text[])", [assignments]);
      await db.query("DELETE FROM crew_members_v2 WHERE crew_uuid = $1", [crewUuid]);
      await clearCompanyFormFixtures(db, [officeRole, masterRole]);
      await db.query("DELETE FROM adm_roleaccess_ac WHERE role_id = $1", [officeRole]);
      await db.query("DELETE FROM master_users WHERE id = ANY($1::int[])", [users]);
      await db.query("DELETE FROM adm_rolemaster_ac WHERE ruid = ANY($1::text[])", [[officeRole, masterRole]]);
      await db.query("DELETE FROM master_vessels WHERE vessel_uuid = $1", [vesselUuid]);
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      await db.end();
      for (const asset of assets.rows) await fileStorageService.deleteAttachment(asset.file_path);
      if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
      if (previousBypass === undefined) delete process.env.AUTH_BYPASS; else process.env.AUTH_BYPASS = previousBypass;
    }
  });
  it.each([
    { voidGrant: true, completedGrant: false, expected: 403 },
    { voidGrant: false, completedGrant: true, expected: 204 },
  ])("uses the locked completed status rather than pre-lock in-progress status ($expected)", async scenario => {
    const assignment = id();
    assignments.push(assignment);
    await db.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,is_deleted)
      VALUES ($1,$2,$3,'OnBoard',true,false)`, [assignment, crewUuid, vesselUuid]);
    await openHarnessStages(db, assignment);
    const started = await api(officeId, "post", `/subjects/crew_assignment/${assignment}/submissions`, { formUuid, formVersionUuid: versionUuid });
    expect(started.status).toBe(201);
    const submission = started.body.submissionUuid;
    submissions.push(submission);
    await db.query(`UPDATE adm_resource_action_grants SET allowed=CASE action
      WHEN 'void' THEN $2 WHEN 'void_completed' THEN $3 ELSE allowed END
      WHERE role_id=$1 AND resource='company_forms'`, [officeRole, scenario.voidGrant, scenario.completedGrant]);
    const holder = new Client({ connectionString: process.env.DATABASE_URL });
    await holder.connect();
    try {
      await holder.query("BEGIN");
      const pid = Number((await holder.query("SELECT pg_backend_pid() AS pid")).rows[0].pid);
      await holder.query("SELECT submission_uuid FROM frm_company_submissions WHERE submission_uuid=$1 FOR UPDATE", [submission]);
      const voiding = api(officeId, "post", `/${submission}/void`, { reason: "Test-owned locked status transition" }).then(response => response);
      await waitForBlocked(pid, 1);
      await holder.query("UPDATE frm_company_submissions SET status='completed',completed_at=now() WHERE submission_uuid=$1", [submission]);
      await holder.query("COMMIT");
      const result = await voiding;
      expect(result.status, JSON.stringify(result.body)).toBe(scenario.expected);
      if (scenario.expected === 403) expect(JSON.stringify(result.body)).toContain("Void completed");
      const actual = (await db.query("SELECT status FROM frm_company_submissions WHERE submission_uuid=$1", [submission])).rows[0];
      expect(actual.status).toBe(scenario.expected === 204 ? "voided" : "completed");
    } finally {
      await holder.query("ROLLBACK").catch(() => {});
      await holder.end();
      await grantCompanyFormFixture(db, officeRole, "office");
    }
  });
});