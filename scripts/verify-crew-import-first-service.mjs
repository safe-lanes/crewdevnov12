/** Main-workspace retained fixtures. No production data or fixture deletion. */
import pg from "pg";
import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
const dir = ".local/verification/crew-import-first-service";
await fs.mkdir(dir, { recursive: true });
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const register = async (name, ids) => fs.appendFile("docs/company-form-regression-fixtures.md",
  `\n- Crew import first-service evidence — ${name}: ${ids.map(id => `\`${id}\``).join(", ")}. Retained; never hard-delete.\n`);
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const actor = (await db.query("SELECT id,user_type FROM master_users WHERE id=24")).rows[0];
const token = `${encode({ alg: "none", typ: "JWT" })}.${encode({ id: actor.id, userType: actor.user_type, domain: "test" })}.devsig`;
const request = async (path, data) => {
  const r = await fetch(`https://${process.env.REPLIT_DEV_DOMAIN}${path}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(body)}`);
  return body;
};
const rank = (await db.query("SELECT ar_uuid,name FROM adm_available_ranks_v2 WHERE NOT is_deleted ORDER BY ar_uuid LIMIT 1")).rows[0];
const report = { head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), fixtures: [], passed: false };
const book = new ExcelJS.Workbook(), sheet = book.addWorksheet("Assignments");
sheet.addRow(["Employee ID", "Vessel Name", "IMO", "Rank", "Position", "Sign On Date",
  "Contract Period (Months)", "Relief Due Date", "Port of Joining", "Assignment Type", "Joining Status", "Reliever Rank"]);
try {
  for (const type of ["new", "exact", "overlap"]) {
    const crew = randomUUID(), vessel = randomUUID(), plan = randomUUID(), sea = randomUUID();
    const employee = `TEST-SERVICE-${crew}`, vesselName = `TEST ONLY SERVICE ${vessel}`;
    await register(type, [crew, vessel, plan, ...(type === "new" ? [] : [sea])]);
    await db.query("INSERT INTO master_vessels(vessel_uuid,vessel,is_deleted) VALUES($1,$2,false)", [vessel, vesselName]);
    await db.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank,is_deleted)
      VALUES($1,$2,'TEST ONLY','FIRST SERVICE',$3,false)`, [crew, employee, rank.ar_uuid]);
    await db.query(`INSERT INTO vessel_planning_v2(plan_uuid,vessel_uuid,rank_id,rank,is_deleted)
      VALUES($1,$2,$3,$4,false)`, [plan, vessel, rank.ar_uuid, rank.name]);
    if (type !== "new") await db.query(`INSERT INTO crew_sea_service
      (sea_uuid,crew_uuid,vessel_uuid,service_type,rank,from_date,to_date,is_deleted)
      VALUES($1,$2,$3,'company',$4,$5,NULL,false)`,
    [sea, crew, vessel, rank.ar_uuid, type === "exact" ? "2026-10-01" : "2026-09-01"]);
    sheet.addRow([employee, vesselName, "", rank.name, rank.name, "2026-10-01", 6, "", "", "Primary", "Signed On", ""]);
    report.fixtures.push({ type, crew, vessel, plan });
  }
  const workbook = Buffer.from(await book.xlsx.writeBuffer());
  await fs.writeFile(`${dir}/retained-import.xlsx`, workbook);
  const initial = await request("/api/v2/vessel/import/assignments", { fileData: workbook.toString("base64") });
  report.initial = initial;
  await register("imported assignment and service descendants", [
    ...initial.importedAssignmentUuids, ...initial.seaService.flatMap(r => r.seaServiceUuids),
  ]);
  const counts = initial.seaService.map(r => r.status).sort();
  if (JSON.stringify(counts) !== JSON.stringify(["ALREADY_PRESENT", "CREATED", "REVIEW"])) throw Error("Wrong import outcomes");
  const f = report.fixtures[0];
  const assignment = (await db.query("SELECT assign_uuid FROM crew_assignments WHERE crew_uuid=$1 AND is_current", [f.crew])).rows[0].assign_uuid;
  const before = (await db.query("SELECT joining_history_backfill FROM crew_assignment_rule_context WHERE assign_uuid=$1", [assignment])).rows[0].joining_history_backfill;
  if (before.firstEver !== true || before.firstInRank !== true) throw Error("Initial no-history facts not Yes");
  const prior = randomUUID();
  await register("later company relief history", [prior, assignment]);
  await db.query(`INSERT INTO crew_sea_service(sea_uuid,crew_uuid,vessel_uuid,service_type,rank,from_date,to_date,sign_off_reason,is_deleted)
    VALUES($1,$2,$3,'company',$4,'2024-01-01','2024-07-01','Relief',false)`, [prior, f.crew, f.vessel, rank.ar_uuid]);
  const rerun = await request("/api/v2/vessel/import/first-service-backfill", { assignmentUuids: [assignment] });
  report.rerun = rerun;
  if (rerun.firstServiceBackfill[0].firstEver !== false || rerun.firstServiceBackfill[0].firstInRank !== false) throw Error("Later history did not produce No");
  const repeated = await request("/api/v2/vessel/import/assignments", { fileData: workbook.toString("base64") });
  report.repeated = repeated;
  if (repeated.seaService.some(r => r.status === "CREATED")) throw Error("Repeat import created another current contract row");
  report.currentContractRowCounts = [];
  for (const fixture of report.fixtures) {
    const count = Number((await db.query(`SELECT count(*) FROM crew_sea_service
      WHERE crew_uuid=$1 AND vessel_uuid=$2 AND service_type='company' AND from_date='2026-10-01' AND NOT is_deleted`,
    [fixture.crew, fixture.vessel])).rows[0].count);
    if (count !== (fixture.type === "overlap" ? 0 : 1)) throw Error("Duplicate or unexpected contract row");
    report.currentContractRowCounts.push({ type: fixture.type, count });
  }
  const history = (await db.query("SELECT * FROM crew_rule_history_backfill_history WHERE assign_uuid=$1 ORDER BY id", [assignment])).rows;
  report.history = history;
  if (history.length !== 3 || history[1].before_value.firstEver !== true || history[1].after_value.firstEver !== false
    || history.some(r => r.actor_id !== String(actor.id))) throw Error("Audit chronology/identity not verified");
  const spoof = await fetch(`https://${process.env.REPLIT_DEV_DOMAIN}/api/v2/vessel/import/first-service-backfill`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ assignmentUuids: [assignment], actorId: "browser-spoof" }),
  });
  report.browserAuditIdentityRefused = spoof.status === 400;
  if (!report.browserAuditIdentityRefused) throw Error("Browser identity was accepted");
  // Register earlier failed/private test attempts too, without deleting anything.
  const schemas = (await db.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'cf_crew_import_%'")).rows;
  for (const { schema_name: namespace } of schemas) {
    for (const [table, column] of [["crew_members_v2", "crew_uuid"], ["master_vessels", "vessel_uuid"],
      ["vessel_planning_v2", "plan_uuid"], ["crew_assignments", "assign_uuid"], ["crew_sea_service", "sea_uuid"]]) {
      const rows = (await db.query(`SELECT "${column}" AS id FROM "${namespace}"."${table}"`)).rows;
      if (rows.length) await register(`retained private schema ${namespace}/${table}`, rows.map(r => r.id));
    }
  }
  report.passed = true;
} finally {
  await fs.writeFile(`${dir}/main-api-evidence.json`, JSON.stringify(report, null, 2));
  await db.end();
}
console.log(JSON.stringify({ passed: report.passed, outcomes: report.initial?.seaService.map(r => r.status),
  rerun: report.rerun?.firstServiceBackfill, auditRows: report.history?.length }, null, 2));
