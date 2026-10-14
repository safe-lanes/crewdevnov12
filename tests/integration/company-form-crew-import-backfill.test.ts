import { bootstrapMissingTestTables } from "../helpers/private-schema";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { retainFixtureReferences } from "../helpers/fixture-retention";

const state = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../server/v2/db", () => ({ getDb: () => state.db }));
import { importCrewAssignments } from "../../server/v2/vessel/services/vesselCrewListImportService";
import { backfillCurrentAssignmentHistory } from "../../server/v2/company-forms/subjects/crewAssignmentHistoryBackfill";
import { recordResolution } from "../../server/v2/company-forms/requirementsRepository";
import { createCrewAssignmentSubject } from "../../server/v2/company-forms/subjects/crewAssignmentSubject";

const namespace = `cf_crew_import_${randomUUID().slice(0, 8)}`;
const root = new Pool({ connectionString: process.env.DATABASE_URL });
const pool = new Pool({ connectionString: process.env.DATABASE_URL,
  options: `-c search_path=${namespace}` });
let rank: any;
beforeAll(async () => {
  await root.query(`CREATE SCHEMA "${namespace}"`);
  for (const table of ["crew_members_v2", "crew_assignments", "vessel_planning_v2",
    "master_vessels", "crew_sea_service", "crew_assignment_rule_context", "adm_forms_v2",
    "adm_form_versions_v2", "frm_version_applicability", "frm_applicability_sets",
    "frm_resolution_runs", "frm_requirements", "adm_available_ranks_v2", "adm_company_ranks_v2"]) {
    await pool.query(`CREATE TABLE "${table}" (LIKE public."${table}" INCLUDING ALL)`);
    if (table.startsWith("adm_") && table.includes("ranks"))
      await pool.query(`INSERT INTO "${table}" SELECT * FROM public."${table}"`);
  }
  await bootstrapMissingTestTables(root, namespace);
  rank = (await pool.query("SELECT ar_uuid,name FROM adm_available_ranks_v2 WHERE NOT is_deleted ORDER BY ar_uuid LIMIT 1")).rows[0];
  state.db = drizzle(pool);
  // Install only the new scoped backfill guards/audit in this retained schema.
  await pool.query(readFileSync("migrations/0250_rerunnable_verified_service_history.sql", "utf8"));
  retainFixtureReferences(`crew-import/${namespace}/schema`, [namespace, rank.ar_uuid]);
}, 60000);
afterAll(async () => {
  await pool.end();
  await root.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
  await root.end();
});

async function fixture(history?: "exact" | "overlap") {
  const crew = randomUUID(), vessel = randomUUID(), plan = randomUUID(), sea = randomUUID();
  retainFixtureReferences(`crew-import/${namespace}/retained`, [crew, vessel, plan, ...(history ? [sea] : [])]);
  const employee = `TEST-IMPORT-${crew}`, vesselName = `TEST ONLY IMPORT ${vessel}`;
  await pool.query(`INSERT INTO master_vessels(vessel_uuid,vessel,is_deleted) VALUES($1,$2,false)`, [vessel, vesselName]);
  await pool.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank,is_deleted)
    VALUES($1,$2,'TEST ONLY','IMPORT',$3,false)`, [crew, employee, rank.ar_uuid]);
  await pool.query(`INSERT INTO vessel_planning_v2(plan_uuid,vessel_uuid,rank_id,rank,is_deleted)
    VALUES($1,$2,$3,$4,false)`, [plan, vessel, rank.ar_uuid, rank.name]);
  if (history) await pool.query(`INSERT INTO crew_sea_service
    (sea_uuid,crew_uuid,vessel_uuid,service_type,rank,from_date,to_date,is_deleted)
    VALUES($1,$2,$3,'company',$4,$5,NULL,false)`,
  [sea, crew, vessel, rank.ar_uuid, history === "exact" ? "2026-10-01" : "2026-09-01"]);
  const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Assignments");
  sheet.addRow(["Employee ID", "Vessel Name", "IMO", "Rank", "Position", "Sign On Date",
    "Contract Period (Months)", "Relief Due Date", "Port of Joining", "Assignment Type", "Joining Status", "Reliever Rank"]);
  sheet.addRow([employee, vesselName, "", rank.name, rank.name, "2026-10-01", "6", "", "", "Primary", "Signed On", ""]);
  return { crew, vessel, plan, sea, buffer: Buffer.from(await book.xlsx.writeBuffer()) };
}
async function imported(f: Awaited<ReturnType<typeof fixture>>) {
  const result = await importCrewAssignments(f.buffer);
  retainFixtureReferences(`crew-import/${namespace}/result`, [result.importedAssignmentUuids, result.seaService]);
  expect(result.success, JSON.stringify(result.errors)).toBe(true);
  return result;
}

it("writes the current company contract once and never calculates first-service facts inside import", async () => {
  const f = await fixture(), result = await imported(f);
  expect(result.seaService[0].status).toBe("CREATED");
  const row = (await pool.query("SELECT * FROM crew_sea_service WHERE crew_uuid=$1", [f.crew])).rows[0];
  expect(row).toMatchObject({ vessel_uuid: f.vessel, rank: rank.ar_uuid,
    service_type: "company", from_date: "2026-10-01", to_date: null });
  const context = (await pool.query("SELECT * FROM crew_assignment_rule_context WHERE assign_uuid=$1",
    [result.importedAssignmentUuids[0]])).rows[0];
  expect(context.joining_history).toBeNull();
  expect(context.joining_history_backfill).toBeNull();
  expect((await imported(f)).seaService[0].status).toBe("ALREADY_PRESENT");
  expect((await pool.query("SELECT count(*)::int n FROM crew_sea_service WHERE crew_uuid=$1", [f.crew])).rows[0].n).toBe(1);
});
it("skips an exact company contract already imported in history", async () => {
  const f = await fixture("exact"), result = await imported(f);
  expect(result.seaService[0]).toMatchObject({ status: "ALREADY_PRESENT", seaServiceUuids: [f.sea] });
  expect((await pool.query("SELECT count(*)::int n FROM crew_sea_service WHERE crew_uuid=$1", [f.crew])).rows[0].n).toBe(1);
});
it("reports an overlapping company contract for review instead of creating a duplicate", async () => {
  const f = await fixture("overlap"), result = await imported(f);
  expect(result.seaService[0]).toMatchObject({ status: "REVIEW", seaServiceUuids: [f.sea] });
  expect(result.warnings.join(" ")).toContain("overlaps");
  expect((await pool.query("SELECT count(*)::int n FROM crew_sea_service WHERE crew_uuid=$1", [f.crew])).rows[0].n).toBe(1);
});

it("recalculates verified backfill after relief history arrives, while the resolved requirement keeps its original facts", async () => {
  const f = await fixture(), result = await imported(f), assignment = result.importedAssignmentUuids[0];
  const initial = await backfillCurrentAssignmentHistory([assignment], "fixture-office", "post_import", state.db);
  expect(initial[0]).toMatchObject({ status: "RECALCULATED", firstEver: true, firstInRank: true });
  const form = randomUUID(), version = randomUUID(), cycle = randomUUID(), priorSea = randomUUID();
  retainFixtureReferences(`crew-import/${namespace}/frozen-requirement`, [form, version, cycle, priorSea, assignment]);
  const formRow = (await pool.query(`INSERT INTO adm_forms_v2
    (form_uuid,name,category,subject_type,rank_group,version_no,version_date,is_deleted)
    VALUES($1,$2,'dynamic','crew_assignment','All','1','2020-01-01',false) RETURNING id`,
  [form, `TEST ONLY FIRST SERVICE ${form}`])).rows[0];
  await pool.query(`INSERT INTO adm_form_versions_v2(fv_uuid,form_id,version_no,version_date,status,
    stage_key,stage_subject_type,released_at,is_deleted)
    VALUES($1,$2,'1','2020-01-01','released','on_board','crew_assignment','2020-01-01',false)`, [version, formRow.id]);
  await pool.query(`INSERT INTO frm_version_applicability(version_uuid,mode,obligation,effective_kind,effective_from)
    VALUES($1,'all','mandatory','on_release','2020-01-01')`, [version]);
  const resolved = await recordResolution({
    adapter: createCrewAssignmentSubject(), actor: { kind: "office", userId: 99, roleId: "fixture-office", roleName: "Fixture", roleType: "Office" },
    subjectType: "crew_assignment", subjectRef: assignment, stageKey: "on_board",
    cycleUuid: cycle, eventKey: `retained-fixture-${cycle}`, triggerAt: new Date(Date.now() - 1000).toISOString(),
    source: "retained_test_harness", outcome: "COMPLETED", evidence: initial[0],
    decisions: [{ formVersionUuid: version, status: "OUTSTANDING", matchedSetUuids: [],
      values: { firstEver: true, firstInRank: true } }],
  }, state.db);
  retainFixtureReferences(`crew-import/${namespace}/resolution`, [resolved]);
  const frozen = (await pool.query("SELECT * FROM frm_requirements WHERE subject_ref=$1", [assignment])).rows[0];
  expect(frozen.deciding_evidence.values.firstEver).toBe(true);
  await pool.query(`INSERT INTO crew_sea_service
    (sea_uuid,crew_uuid,vessel_uuid,service_type,rank,from_date,to_date,sign_off_reason,is_deleted)
    VALUES($1,$2,$3,'company',$4,'2024-01-01','2024-07-01','Relief',false)`, [priorSea, f.crew, f.vessel, rank.ar_uuid]);
  const rerun = await backfillCurrentAssignmentHistory([assignment], "fixture-office", "rerun", state.db);
  expect(rerun[0]).toMatchObject({ firstEver: false, firstInRank: false, previous: { firstEver: true, firstInRank: true } });
  expect((await pool.query("SELECT * FROM frm_requirements WHERE subject_ref=$1", [assignment])).rows[0]).toEqual(frozen);
  const history = (await pool.query("SELECT * FROM crew_rule_history_backfill_history WHERE assign_uuid=$1 ORDER BY id", [assignment])).rows;
  expect(history).toHaveLength(2);
  expect(history[1]).toMatchObject({ actor_id: "fixture-office", source: "rerun",
    before_value: { firstEver: true }, after_value: { firstEver: false } });
  await backfillCurrentAssignmentHistory([assignment], "fixture-office", "rerun", state.db);
  expect((await pool.query("SELECT count(*)::int n FROM crew_rule_history_backfill_history WHERE assign_uuid=$1", [assignment])).rows[0].n).toBe(3);
  await expect(pool.query("UPDATE crew_rule_history_backfill_history SET source='spoof' WHERE assign_uuid=$1", [assignment])).rejects.toMatchObject({ code: "23514" });
});

it("never recalculates sign-on captures, including unresolved captured values", async () => {
  const f = await fixture(), result = await imported(f), assignment = result.importedAssignmentUuids[0];
  const capture = { source: "before_sign_on_E1", capturedAt: "2026-10-01T00:00:00Z", firstEver: null, firstInRank: false };
  await pool.query("UPDATE crew_assignment_rule_context SET joining_history=$2 WHERE assign_uuid=$1", [assignment, capture]);
  expect((await backfillCurrentAssignmentHistory([assignment], "fixture-office", "rerun", state.db))[0].status).toBe("SKIPPED");
  const context = (await pool.query("SELECT * FROM crew_assignment_rule_context WHERE assign_uuid=$1", [assignment])).rows[0];
  expect(context.joining_history).toEqual(capture);
  expect(context.joining_history_backfill).toBeNull();
});
it("keeps overlapping/current-row ambiguity unresolved, recording the attempted verification", async () => {
  const f = await fixture("overlap"), result = await imported(f), assignment = result.importedAssignmentUuids[0];
  expect((await backfillCurrentAssignmentHistory([assignment], "fixture-office", "rerun", state.db))[0])
    .toMatchObject({ status: "UNRESOLVED", firstEver: null, firstInRank: null });
  expect((await pool.query("SELECT count(*)::int n FROM crew_rule_history_backfill_history WHERE assign_uuid=$1", [assignment])).rows[0].n).toBe(1);
});
