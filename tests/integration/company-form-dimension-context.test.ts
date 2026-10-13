import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { captureDeployRank } from "../../server/v2/company-forms/subjects/crewAssignmentRuleContext";
import { captureJoiningHistory } from "../../server/v2/company-forms/subjects/crewAssignmentHistory";
import { readCrewRuleDimensions } from "../../server/v2/company-forms/subjects/crewAssignmentDimensions";
import { retainFixtureReferences } from "../helpers/fixture-retention";

const schema = `cf_dimensions_${randomUUID().slice(0, 8)}`;
const root = new Pool({ connectionString: process.env.DATABASE_URL });
const local = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
const tx = drizzle(local);
const crewUuid = randomUUID(), assignUuid = randomUUID(), planUuid = randomUUID(), priorUuid = randomUUID();
let vesselUuid: string, rank: any;
const tables = ["crew_assignments", "vessel_planning_v2", "crew_members_v2", "crew_personal_details",
  "crew_assignment_rule_context", "crew_sea_service", "adm_available_ranks_v2", "adm_company_ranks_v2",
  "master_vessels", "master_vessel_types", "master_nationalities", "master_manning_agents", "master_crew_pools",
  "master_fleet_groups", "master_additional_groups"];
describe("retained assignment deciding context", () => {
  beforeAll(async () => {
    retainFixtureReferences(`dimension context ${schema}`, [schema, crewUuid, assignUuid, planUuid, priorUuid]);
    await root.query(`CREATE SCHEMA "${schema}"`);
    for (const table of tables) {
      await local.query(`CREATE TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
      if (table.startsWith("master_") || table.startsWith("adm_"))
        retainFixtureReferences(`${schema}.${table} canonical master copies`,
          (await local.query(`INSERT INTO ${table} SELECT * FROM public.${table} RETURNING *`)).rows);
    }
    await local.query("CREATE TRIGGER freeze_context BEFORE UPDATE ON crew_assignment_rule_context FOR EACH ROW EXECUTE FUNCTION public.crew_rule_context_frozen()");
    rank = (await local.query(`SELECT r.ar_uuid,r.name,r.rank_id,c.cr_uuid alias FROM adm_available_ranks_v2 r
      JOIN adm_company_ranks_v2 c ON coalesce(c.original_rank_id,c.rank_id) IN(r.rank_id,r.ar_uuid)
      WHERE NOT r.is_deleted AND NOT c.is_deleted ORDER BY r.id LIMIT 1`)).rows[0];
    expect(rank).toBeTruthy();
    vesselUuid = (await local.query("SELECT vessel_uuid FROM master_vessels WHERE NOT is_deleted AND is_active ORDER BY id LIMIT 1")).rows[0].vessel_uuid;
    await local.query("INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank) VALUES($1,$2,'TEST ONLY','Dimensions','deliberately different')", [crewUuid, `TEST-${crewUuid.slice(0, 8)}`]);
    await local.query("INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,sign_on_date) VALUES($1,$2,$3,'Planned',false,'2026-10-11')", [assignUuid, crewUuid, vesselUuid]);
    await local.query("INSERT INTO vessel_planning_v2(plan_uuid,vessel_uuid,rank_id,rank,reliever_crew_uuid,reliever_assign_uuid) VALUES($1,$2,$3,$6,$4,$5)", [planUuid, vesselUuid, rank.alias, crewUuid, assignUuid, rank.name]);
    // A one-day relief service is company service; no duration threshold.
    await local.query("INSERT INTO crew_sea_service(sea_uuid,crew_uuid,service_type,rank,from_date,to_date,vessel_uuid) VALUES($1,$2,'company',$3,'2026-09-01','2026-09-01',$4)", [priorUuid, crewUuid, rank.rank_id, vesselUuid]);
    retainFixtureReferences(`canonical master copies ${schema}`, [rank.ar_uuid, vesselUuid]);
  });
  afterAll(async () => {
    await local.end();
    await root.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await root.end();
  });
  it("captures the persisted planning alias's canonical rank, never present rank", async () => {
    await captureDeployRank(assignUuid, planUuid, tx);
    const context = (await local.query("SELECT * FROM crew_assignment_rule_context WHERE assign_uuid=$1", [assignUuid])).rows[0];
    expect(context.contract_rank_uuid).toBe(rank.ar_uuid);
    expect(context.rank_source.planningUuids).toEqual([planUuid]);
  });
  it("captures relief-inclusive history before E1, then remains frozen", async () => {
    await captureJoiningHistory(assignUuid, "2026-10-11", tx);
    const context = (await local.query("SELECT * FROM crew_assignment_rule_context WHERE assign_uuid=$1", [assignUuid])).rows[0];
    expect(context.joining_history.firstEver).toBe(false);
    expect(context.joining_history.firstInRank).toBe(false);
    expect(context.joining_history.sourceSeaServiceUuids).toEqual([priorUuid]);
    await expect(local.query("UPDATE crew_assignment_rule_context SET joining_history='{}' WHERE assign_uuid=$1", [assignUuid])).rejects.toMatchObject({ code: "23514" });
    await expect(local.query("UPDATE crew_assignment_rule_context SET contract_rank_uuid='invented' WHERE assign_uuid=$1", [assignUuid])).rejects.toMatchObject({ code: "23514" });
  });
  it("returns every dimension explicitly and keeps owner/flag unavailable", async () => {
    const report = await readCrewRuleDimensions({ assignUuid, crewUuid, vesselUuid, assignmentType: "Planned", signOnDate: "2026-10-11" } as any, tx);
    expect(report.dimensions).toHaveLength(12);
    expect(report.dimensions.find(d => d.key === "rank")?.value).toBe(rank.ar_uuid);
    expect(report.dimensions.find(d => d.key === "nationality")?.status).toBe("unresolved");
    expect(report.dimensions.filter(d => ["owner", "flag"].includes(d.key)).every(d => d.status === "not_yet_available")).toBe(true);
  });
});
