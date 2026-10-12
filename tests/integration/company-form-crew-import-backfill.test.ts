import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { retainFixtureReferences } from "../helpers/fixture-retention";

const state = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../server/v2/db", () => ({ getDb: () => state.db }));
import { importCrewAssignments } from "../../server/v2/vessel/services/vesselCrewListImportService";

const namespace = `cf_crew_import_${randomUUID().slice(0, 8)}`;
const root = new Pool({ connectionString: process.env.DATABASE_URL });
const pool = new Pool({ connectionString: process.env.DATABASE_URL,
  options: `-c search_path=${namespace},public` });
let rank: any;
beforeAll(async () => {
  await root.query(`CREATE SCHEMA "${namespace}"`);
  for (const table of ["crew_members_v2", "crew_assignments", "vessel_planning_v2",
    "master_vessels", "crew_sea_service", "crew_assignment_rule_context"]) {
    await pool.query(`CREATE TABLE "${table}" (LIKE public."${table}" INCLUDING ALL)`);
  }
  rank = (await pool.query("SELECT ar_uuid,name FROM adm_available_ranks_v2 WHERE NOT is_deleted ORDER BY ar_uuid LIMIT 1")).rows[0];
  state.db = drizzle(pool);
  retainFixtureReferences(`crew-import/${namespace}/schema`, [namespace, rank.ar_uuid]);
});
afterAll(async () => { await pool.end(); await root.end(); });

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
