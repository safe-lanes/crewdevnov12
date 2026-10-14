import { beforeAll, afterAll, it, expect } from "vitest";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { retainFixtureReferences } from "../helpers/fixture-retention";

const schema = `cf_verified_history_${randomUUID().slice(0, 8)}`;
const root = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
const crews = [randomUUID(), randomUUID(), randomUUID()];
const assignments = [randomUUID(), randomUUID(), randomUUID()];
const sea = Array.from({ length: 4 }, () => randomUUID());
beforeAll(async () => {
  retainFixtureReferences(`verified-history/${schema}`, [...crews, ...assignments, ...sea]);
  await root.query(`CREATE SCHEMA "${schema}"`);
  for (const table of ["crew_assignments", "crew_assignment_rule_context", "crew_sea_service",
    "adm_available_ranks_v2", "adm_company_ranks_v2"]) {
    await db.query(`CREATE TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
  }
  for (const table of ["adm_available_ranks_v2", "adm_company_ranks_v2"])
    await db.query(`INSERT INTO ${table} SELECT * FROM public.${table}`);
  const rank = (await db.query("SELECT ar_uuid,name FROM adm_available_ranks_v2 WHERE NOT is_deleted LIMIT 1")).rows[0];
  const vessel = (await root.query("SELECT vessel_uuid FROM master_vessels WHERE NOT is_deleted LIMIT 1")).rows[0].vessel_uuid;
  for (let i = 0; i < crews.length; i++) {
    await db.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,sign_on_date)
      VALUES($1,$2,$3,'OnBoard',true,'2026-10-01')`, [assignments[i], crews[i], vessel]);
    await db.query(`INSERT INTO crew_assignment_rule_context(assign_uuid,contract_rank_uuid,contract_rank_label,rank_source)
      VALUES($1,$2,$3,'{"method":"fixture_exact_rank"}')`, [assignments[i], rank.ar_uuid, rank.name]);
  }
  for (const [id, crew, day] of [[sea[0], crews[0], "2026-01-01"], [sea[1], crews[0], "2026-10-01"],
    [sea[2], crews[1], "2026-10-01"], [sea[3], crews[1], "2026-10-01"]]) {
    await db.query(`INSERT INTO crew_sea_service(sea_uuid,crew_uuid,vessel_uuid,service_type,rank,from_date,period_months)
      VALUES($1,$2,$3,'company',$4,$5,'0.03')`, [id, crew, vessel, rank.ar_uuid, day]);
  }
  await db.query(readFileSync("migrations/0244_current_assignment_verified_history.sql", "utf8"));
});
afterAll(async () => {
  await db.end();
  await root.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await root.end();
});
it("excludes the one exact contract row, includes relief and records verified provenance", async () => {
  const row = (await db.query("SELECT * FROM crew_rule_history_backfill_report WHERE assign_uuid=$1", [assignments[0]])).rows[0];
  expect(row.first_ever).toBe(false); expect(row.first_in_rank).toBe(false);
  expect(row.evidence.excludedCurrentSeaServiceUuid).toBe(sea[1]);
  expect(row.evidence.source).toBe("verified_current_contract_backfill");
  expect(row.evidence.sourceSeaServiceUuids).toContain(sea[0]);
});
it("keeps no-match and ambiguous exact matches unresolved without guessing", async () => {
  const rows = (await db.query("SELECT * FROM crew_rule_history_backfill_report WHERE assign_uuid=ANY($1)", [assignments.slice(1)])).rows;
  expect(rows.map(r => r.matching_rows).sort()).toEqual([0, 2]);
  for (const r of rows) { expect(r.first_ever).toBeNull(); expect(r.first_in_rank).toBeNull(); expect(r.reason).toBeTruthy(); }
});
it("is idempotent and refuses changes to verified facts", async () => {
  await db.query(readFileSync("migrations/0244_current_assignment_verified_history.sql", "utf8"));
  expect((await db.query("SELECT count(*)::int n FROM crew_rule_history_backfill_report")).rows[0].n).toBe(3);
  await expect(db.query("UPDATE crew_assignment_rule_context SET joining_history_backfill='{}' WHERE assign_uuid=$1",
    [assignments[0]])).rejects.toMatchObject({ code: "23514" });
});
