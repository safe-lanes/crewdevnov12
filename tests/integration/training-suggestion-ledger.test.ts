import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { calculateTrainingCompliance } from "../../server/v2/shared/training-compliance/calculator";
import { reconcileSuggestionResult } from "../../server/v2/training-needs/complianceSuggestions";
import type { ComplianceInput } from "../../server/v2/shared/training-compliance/types";

const schema = `training_suggestions_${randomUUID().slice(0, 8)}`;
const root = new Pool({ connectionString: process.env.DATABASE_URL });
const local = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}` });
const tx = drizzle(local), crew = randomUUID(), assignment = randomUUID(), plan = randomUUID();
const required = randomUUID(), equivalent = randomUUID(), certificate = randomUUID();
let vessel: string, rank: string;
const request = { assignmentUuid: assignment, planUuid: plan };
const calculate = (expiry?: string, course = required) => calculateTrainingCompliance({
  assignmentUuid: assignment, vesselUuid: vessel, contractRankUuid: rank,
  plannedJoiningDate: "2027-01-31", contractRangeEndMonths: 3,
  matrix: { revisionUuid: "revision", revision: "R0",
    requirements: [{ courseUuid: required, name: "Required fixture course", obligation: "mandatory" }],
    equivalents: [{ requiredCourseUuid: required, acceptedCourseUuid: equivalent }] },
  certificates: expiry ? [{ certificateUuid: certificate, courseUuid: course,
    name: "Fixture certificate", number: "TEST", issued: "2026-01-01", expiry }] : [],
} satisfies ComplianceInput);
const reconcile = (expiry?: string, course?: string) => reconcileSuggestionResult(tx, request, calculate(expiry, course));

describe("durable training suggestion ledger in isolated schema", () => {
  beforeAll(async () => {
    await root.query(`CREATE SCHEMA "${schema}"`);
    for (const table of ["crew_assignments", "vessel_planning_v2", "crew_members_v2",
      "master_vessels", "crew_assignment_rule_context", "adm_available_ranks_v2", "adm_training_master_v2",
      "training_needs_other_v2"])
      await local.query(`CREATE TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
    await local.query("INSERT INTO master_vessels SELECT * FROM public.master_vessels WHERE NOT is_deleted LIMIT 1");
    await local.query("INSERT INTO adm_available_ranks_v2 SELECT * FROM public.adm_available_ranks_v2 WHERE NOT is_deleted LIMIT 1");
    vessel = (await local.query("SELECT vessel_uuid FROM master_vessels LIMIT 1")).rows[0].vessel_uuid;
    rank = (await local.query("SELECT ar_uuid FROM adm_available_ranks_v2 LIMIT 1")).rows[0].ar_uuid;
    for (const uuid of [required, equivalent])
      await local.query("INSERT INTO adm_training_master_v2(tm_uuid,training_id,training_name,category,training_group) VALUES($1,$2,'TEST ONLY course','S','A')", [uuid, uuid]);
    await local.query("INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name) VALUES($1,$2,'TEST ONLY','Suggestion')", [crew, crew]);
    await local.query("INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current) VALUES($1,$2,$3,'Planned',false)", [assignment, crew, vessel]);
    await local.query("INSERT INTO vessel_planning_v2(plan_uuid,vessel_uuid,reliever_crew_uuid,reliever_assign_uuid,reliever_sign_on_date,rank_id,rank) VALUES($1,$2,$3,$4,'2027-01-31',$5,'Fixture rank')", [plan, vessel, crew, assignment, rank]);
    await local.query("INSERT INTO crew_assignment_rule_context(assign_uuid,contract_rank_uuid,contract_rank_label,rank_source) VALUES($1,$2,'Fixture rank','{}')", [assignment, rank]);
    await local.query("INSERT INTO training_needs_other_v2(tno_uuid,source_label,training,status) VALUES($1,'Others','Manual fixture need','Pending')", [randomUUID()]);
    for (const migration of ["0264_training_compliance_suggestions.sql", "0265_training_suggestion_lifecycle.sql"])
      await local.query(await readFile(`migrations/${migration}`, "utf8"));
  });
  afterAll(async () => {
    await local.end();
    await root.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await root.end();
  });
  it("repeated checks create exactly one slot and one event for identical evidence", async () => {
    await reconcile(); await reconcile(); await reconcile();
    expect((await local.query("SELECT * FROM training_compliance_suggestions")).rows).toHaveLength(1);
    expect((await local.query("SELECT * FROM training_compliance_suggestion_history")).rows).toHaveLength(1);
  });
  it("a confirmed need closes on a qualifying equivalent, retaining the certificate", async () => {
    await local.query("UPDATE training_compliance_suggestions SET status='CONFIRMED',confirmed_at=now(),confirmed_by='server-user'");
    const [closed] = await reconcile("2027-04-30", equivalent);
    expect(closed.status).toBe("CLOSED");
    expect(closed.closed_certificate_uuid).toBe(certificate);
    const history = (await local.query("SELECT * FROM training_compliance_suggestion_history ORDER BY id DESC LIMIT 1")).rows[0];
    expect(history.actor).toBe("system:pre-joining-compliance");
    expect(history.certificate_uuid).toBe(certificate);
    expect(history.reason).toContain("accepted equivalent");
    expect((await local.query("SELECT status FROM training_needs_other_v2")).rows[0].status).toBe("Pending");
  });
  it("a fresh gap reuses its slot, with the target strictly before expiry", async () => {
    const [row] = await reconcile("2027-03-01");
    expect(row.status).toBe("SUGGESTED");
    expect(row.target_date).toBe("2027-02-28");
    expect((await local.query("SELECT count(*)::int AS n FROM training_compliance_suggestions")).rows[0].n).toBe(1);
  });
  it("dismissal survives repeated checks and is not automatically re-created", async () => {
    await local.query("UPDATE training_compliance_suggestions SET status='DISMISSED'");
    await reconcile(); await reconcile();
    expect((await local.query("SELECT status FROM training_compliance_suggestions")).rows[0].status).toBe("DISMISSED");
  });
  it("deferral withdraws active suggestions, replanning reuses the slot", async () => {
    await local.query("UPDATE training_compliance_suggestions SET status='SUGGESTED'");
    await local.query("UPDATE vessel_planning_v2 SET relief_status='Deferred'");
    expect((await reconcile())[0].status).toBe("WITHDRAWN");
    await local.query("UPDATE vessel_planning_v2 SET relief_status='Planned'");
    expect((await reconcile())[0].status).toBe("SUGGESTED");
  });
  it("every cancellation path withdraws and preserves append-only history", async () => {
    await local.query("UPDATE crew_assignments SET assignment_type='Cancelled'");
    expect((await local.query("SELECT status FROM training_compliance_suggestions")).rows[0].status).toBe("WITHDRAWN");
    await expect(local.query("DELETE FROM training_compliance_suggestion_history")).rejects.toMatchObject({ code: "23514" });
    await expect(local.query("UPDATE training_compliance_suggestion_history SET actor='forged'")).rejects.toMatchObject({ code: "23514" });
  });
});
