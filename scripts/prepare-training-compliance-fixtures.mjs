// One-time main-preview setup. Ordinary reruns only verify/reuse registered rows.
import "./verification-guard.mjs";
import pg from "pg";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { PDFDocument, StandardFonts } from "pdf-lib";

const manifestPath = "docs/training-compliance-slice-4-fixtures.json";
const prior = await fs.readFile(manifestPath, "utf8").then(JSON.parse).catch(() => null);
const bootstrap = process.argv.includes("--bootstrap");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const vessel = "a4120000-0000-4000-8000-000000000001";
const crew = "a4120000-0000-4000-8000-000000000004";
const role = "408d9fe9-1d0f-11f1-925d-5419ffd80f01";
const uuid = n => `a4240000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let browser;
try {
  assert.equal((await db.query("SELECT vessel FROM master_vessels WHERE vessel_uuid=$1 AND NOT is_deleted", [vessel])).rows[0]?.vessel,
    "TEST ONLY PDF layout review");
  assert.equal((await db.query("SELECT emp_no FROM crew_members_v2 WHERE crew_uuid=$1 AND NOT is_deleted", [crew])).rows[0]?.emp_no,
    "PDF-LAYOUT-412");
  if (prior) {
    const row = (await db.query(`SELECT 1 FROM vessel_planning_v2 p JOIN crew_assignments a ON a.assign_uuid=p.reliever_assign_uuid
      WHERE p.plan_uuid=$1 AND a.assign_uuid=$2 AND a.crew_uuid=$3 AND a.vessel_uuid=$4
        AND NOT p.is_deleted AND NOT a.is_deleted`, [prior.planUuid, prior.assignmentUuid, crew, vessel])).rows;
    assert.equal(row.length, 1, "Retained fixture link changed; inspect, never create a replacement.");
    if (process.argv.includes("--reset-dates")) {
      // Explicit scenario reset only. Not run by ordinary setup/verification.
      const reset = await db.query(`UPDATE vessel_planning_v2 SET reliever_sign_on_date=NULL,
        reliever_contract_end_range_end_months=NULL,updated_at=now(),updated_by_uuid='fixture-scenario-setup'
        WHERE plan_uuid=$1 AND reliever_assign_uuid=$2 AND reliever_crew_uuid=$3 AND vessel_uuid=$4
          AND NOT is_deleted`, [prior.planUuid, prior.assignmentUuid, crew, vessel]);
      assert.equal(reset.rowCount, 1);
    }
    console.log(JSON.stringify({ reused: true, ...prior }));
  } else {
    assert.ok(bootstrap, "Initial setup needs --bootstrap; a normal rerun never creates fixtures.");
    const allowed = new Set(["adm_vessel_revisions_v2", "rotation_drafts_v2", "rotation_entries_v2",
      "crew_training_courses", "crew_training_attachments"]);
    const ident = name => { assert.match(name, /^[a-z][a-z0-9_]*$/); return `"${name}"`; };
    async function insert(table, data, key) {
      assert.ok(allowed.has(table));
      if ((await db.query(`SELECT 1 FROM ${ident(table)} WHERE ${ident(key)}=$1`, [data[key]])).rows.length) return;
      const fields = Object.keys(data);
      await db.query(`INSERT INTO ${ident(table)} (${fields.map(ident).join(",")})
        VALUES (${fields.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(data));
    }
    const rank = (await db.query("SELECT cr_uuid,rank,rank_id FROM adm_company_ranks_v2 WHERE cr_uuid=$1 AND NOT is_deleted",
      ["414d0943-53d8-4d17-a086-8031ac1a4517"])).rows[0];
    assert.equal(rank.rank_id, "R002");
    // Rank configuration only, no new rank or vessel. Existing PDF fixture had no vessel rank revision.
    const rankData = [{ id: rank.cr_uuid, rank: rank.rank, rankId: rank.rank_id, officer: true,
      deckOfficer: true, seniorOfficer: true, actualManningFlag: true, actualManning: [], sortOrder: 2 }];
    await insert("adm_vessel_revisions_v2", { vr_uuid: uuid(10), vessel_id: vessel, revision: "TEST-S4",
      revision_date: "21-Oct-2026", revision_data: JSON.stringify(rankData), created_by_uuid: "3" }, "vr_uuid");
    await insert("rotation_drafts_v2", { draft_uuid: uuid(11), draft_id: "TEST ONLY TRAINING S4",
      plan_from_date: "2027-01-01", plan_to_date: "2028-12-31",
      created_by_uuid: "3" }, "draft_uuid");
    await insert("rotation_entries_v2", { entry_uuid: uuid(12), draft_uuid: uuid(11), vessel_uuid: vessel,
      rank_id: rank.cr_uuid, rank: rank.rank, crew_uuid: crew, proposal_status: "Proposed",
      proposed_by_uuid: "3", sign_on_date: null }, "entry_uuid");
    browser = await chromium.launchPersistentContext("generated-artifacts/attachment-display/browser-profile-office", {
      executablePath: execFileSync("which", ["chromium"], { encoding: "utf8" }).trim(),
      headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    await browser.addInitScript(() => {
      const persona = { personaKey: "crewing-manager", masterUserId: 3, role: "Crewing Manager",
        roleId: "408d9fe9-1d0f-11f1-925d-5419ffd80f01", userType: "Office" };
      localStorage.setItem("devPersona", JSON.stringify(persona));
      localStorage.setItem("userProfile", JSON.stringify({ role: persona.role, roleId: persona.roleId, userId: "3", userType: "Office", myVessels: [] }));
    });
    const page = await browser.newPage();
    await page.goto(`https://${process.env.REPLIT_DEV_DOMAIN}/vessel`, { waitUntil: "networkidle" });
    let deployed = (await db.query("SELECT deployed_to_plan_uuid FROM rotation_entries_v2 WHERE entry_uuid=$1", [uuid(12)])).rows[0];
    if (!deployed.deployed_to_plan_uuid) {
      const response = await page.evaluate(async entry => {
        const { apiRequest } = await import("/src/lib/queryClient.ts");
        return await (await apiRequest("POST", `/api/v2/rotation/entries/${entry}/deploy`, {})).json();
      }, uuid(12));
      assert.ok(response.planUuid, JSON.stringify(response));
    }
    const plan = (await db.query("SELECT p.plan_uuid,p.reliever_assign_uuid FROM vessel_planning_v2 p JOIN rotation_entries_v2 e ON e.deployed_to_plan_uuid=p.plan_uuid WHERE e.entry_uuid=$1",
      [uuid(12)])).rows[0];
    assert.ok(plan?.reliever_assign_uuid);
    const captured = (await db.query("SELECT contract_rank_uuid FROM crew_assignment_rule_context WHERE assign_uuid=$1", [plan.reliever_assign_uuid])).rows[0];
    assert.equal(captured?.contract_rank_uuid, "bf7efd7a-1d61-4405-aebb-370c4605228f");
    const courses = [
      { train_uuid: uuid(20), crew_uuid: crew, course_id: "18", training_course: "Advanced Fire Fighting (AFF)",
        certificate_no: "TEST-S4-A-LONG", issued: "bad-date", expiry: "2027-11-30" },
      { train_uuid: uuid(21), crew_uuid: crew, course_id: "18", training_course: "Advanced Fire Fighting (AFF)",
        certificate_no: "TEST-S4-A-SHORT", issued: "2026-01-01", expiry: "2027-06-30" },
      { train_uuid: uuid(22), crew_uuid: crew, course_id: "22", training_course: "Advanced Training for Chemical Tanker Cargo Operations",
        certificate_no: "TEST-S4-B-PERMANENT", issued: "2028-01-01", expiry: null },
    ];
    for (const course of courses) await insert("crew_training_courses", { ...course, created_by_uuid: "3" }, "train_uuid");
    const document = await PDFDocument.create(), p = document.addPage([595, 350]);
    const font = await document.embedFont(StandardFonts.Helvetica);
    p.drawText("TEST ONLY TRAINING CERTIFICATE", { x: 45, y: 260, size: 20, font });
    p.drawText("TEST-S4-A-LONG - registered fixture, not a real qualification", { x: 45, y: 215, size: 12, font });
    await insert("crew_training_attachments", { att_uuid: uuid(23), train_uuid: uuid(20),
      file_name: "TEST-ONLY-training-certificate.pdf", file_type: "application/pdf",
      file_data: `data:application/pdf;base64,${Buffer.from(await document.save()).toString("base64")}`,
      uploaded_by_uuid: "3" }, "att_uuid");
    const grants = (await db.query(`SELECT m.name,g.canview,g.canedit FROM adm_roleaccess_ac g
      JOIN adm_menumaster_ac m ON m.muid=g.menu_id WHERE g.role_id=$1 AND NOT g.is_deleted
      AND m.name IN ('Vessel','Crew Database','Rotation','Planning')`, [role])).rows;
    const revision = (await db.query(`SELECT tmvr_uuid FROM adm_training_matrix_vessel_revisions_v2
      WHERE vessel_id=$1 AND NOT is_deleted ORDER BY id DESC LIMIT 1`, [vessel])).rows[0];
    assert.ok(revision?.tmvr_uuid, "Reuse the registered saved matrix; never create a guessed revision.");
    const manifest = { registeredAt: new Date().toISOString(), vesselUuid: vessel, crewUuid: crew,
      planUuid: plan.plan_uuid, assignmentUuid: plan.reliever_assign_uuid, rankRevisionUuid: uuid(10),
      rotationDraftUuid: uuid(11), rotationEntryUuid: uuid(12), certificateUuids: courses.map(c => c.train_uuid),
      attachmentUuid: uuid(23), matrixRevisionUuid: revision.tmvr_uuid,
      persona: { masterUserId: 3, role: "Crewing Manager", roleUuid: role, grants, grantsAdded: [] },
      descendants: "All Company Form lifecycle events, runs and requirements for this assignment are retained acceptance fixtures.",
      retention: "Reuse these exact records. Never delete. No new vessel, crew, role, grant or global training policy.",
      scenarios: "Saved joining absent => incomplete; joining 01-May-2027 with end absent => warning; 6 months => Valid/Not held; 01-Oct-2027 => Expires during contract; 01-Dec-2027 => Expired at joining; 01-Jan-2028 => Valid, no expiry and equivalent. UI replay restores 01-May-2027/6 months." };
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    await fs.appendFile("docs/company-form-regression-fixtures.md", `\n### Read-only training compliance UI (21-Oct-2026)\n\nReuses fixture-only vessel ${vessel} and dedicated fixture seafarer ${crew}; no protected vessel-02 records touched. Exact retained records are in [the slice 4 manifest](training-compliance-slice-4-fixtures.json): planning ${manifest.planUuid}, assignment ${manifest.assignmentUuid}, rank revision ${uuid(10)}, rotation draft ${uuid(11)}, entry ${uuid(12)}, certificates ${courses.map(c => c.train_uuid).join(", ")}, attachment ${uuid(23)}. Their assignment-scoped lifecycle descendants are retained. No grants or real/global policy changed. Normal setup reruns only verify/reuse; UI replay changes only this fixture's saved reliever dates.\n`);
    console.log(JSON.stringify(manifest));
  }
} finally { await browser?.close(); await db.end(); }
