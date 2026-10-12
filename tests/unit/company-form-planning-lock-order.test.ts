import { openHarnessStages, captureHarnessContractRank } from "../helpers/company-form-stage-fixtures";
// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

const state = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../server/v2/db", () => ({ getDb: () => state.db }));
import { vesselPlanningService } from "../../server/v2/vessel/services/vesselPlanningService";
import { CompanyFormSubmissionsService } from "../../server/v2/company-forms/submissionsService";
import { CompanyFormSubjectRegistry } from "../../server/v2/company-forms/subjectRegistry";
import { createCrewAssignmentSubject } from "../../server/v2/company-forms/subjects/crewAssignmentSubject";
import { grantCompanyFormFixture } from "../helpers/companyFormGrants";

const namespace = `cf_lock_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
  options: `-c search_path=${namespace},public -c statement_timeout=10000`,
  application_name: namespace });
const tables = ["crew_assignments", "vessel_planning_v2", "crew_members_v2", "crew_sea_service",
  "frm_company_submissions", "frm_company_submission_assignments",
  "frm_company_submission_system_snapshots", "frm_section_states", "frm_section_signatures",
  "frm_signature_attachments", "frm_answers", "master_users", "adm_rolemaster_ac", "adm_resource_action_grants",
  "adm_forms_v2", "adm_form_versions_v2", "frm_form_parts", "frm_sections", "frm_questions"];
let fixture: any, crew: any, assignment: string, plan: string, req: any;
const service = new CompanyFormSubmissionsService({}, new CompanyFormSubjectRegistry([createCrewAssignmentSubject()]));
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
const proofs: any[] = [];
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}
async function create() {
  const form = fixture.forms.find((f: any) => f.key === "aboard");
  return service.create({ req, subjectType: "crew_assignment", subjectRef: assignment,
    formUuid: form.formUuid, formVersionUuid: form.versionUuid });
}

beforeAll(async () => {
  // Self-contained private fixtures: public retained rows may no longer exist
  // after parent master-data synchronization. Never mutate public operations.
  fixture = { actors: { master: { id: 99, userUuid: randomUUID(), roleUuid: randomUUID(), role: namespace } },
    crews: [{ key: "viewers", crewUuid: randomUUID(), vesselUuid: "7440571a-841a-11ed-aa7c-7003bca91a86" }],
    forms: [{ key: "aboard", formUuid: randomUUID(), versionUuid: randomUUID(),
      partUuid: randomUUID(), sectionUuid: randomUUID() }] };
  crew = fixture.crews.find((c: any) => c.key === "viewers");
  if (!crew) throw Error("Private aboard fixture is required");
  await admin.query(`CREATE SCHEMA "${namespace}"`);
  // The signing authority belongs to this private assignment, not public
  // operations. Retain context rows between cases rather than truncating them.
  await admin.query(`CREATE TABLE "${namespace}"."crew_assignment_rule_context"
    (LIKE public."crew_assignment_rule_context" INCLUDING ALL)`);
  // Private schema: real PostgreSQL locks, no public operational row writes,
  // no new vessel, no public Planning position and no protected record edits.
  for (const table of tables) {
    await admin.query(`CREATE TABLE "${namespace}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    if (table === "adm_resource_action_grants") continue; // Composite key, no serial id.
    await admin.query(`CREATE SEQUENCE "${namespace}"."${table}_local_seq"`);
    await admin.query(`ALTER TABLE "${namespace}"."${table}" ALTER COLUMN id SET DEFAULT nextval('"${namespace}"."${table}_local_seq"')`);
  }
  state.db = drizzle(pool);
}, 30000);

beforeEach(async () => {
  vi.restoreAllMocks();
  for (const table of tables) await pool.query(`TRUNCATE "${table}"`);
  const actor = fixture.actors.master;
  const vessel = (await admin.query("SELECT id FROM public.master_vessels WHERE vessel_uuid=$1", [crew.vesselUuid])).rows[0];
  await pool.query(`INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,is_active,is_deleted)
    VALUES ($1,$2,'Ship',true,false)`, [actor.roleUuid, actor.role]);
  await pool.query(`INSERT INTO master_users(id,user_uuid,user_type,role,fullname,designation,vessel_ids)
    VALUES ($1,$2,'Ship',$3,'Private Test Master','Master',$4)`,
  [actor.id, actor.userUuid, actor.role, String(vessel.id)]);
  await grantCompanyFormFixture(pool, actor.roleUuid, "vessel");
  assignment = randomUUID(); plan = randomUUID();
  await pool.query(`INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name,present_rank,is_deleted)
    VALUES ($1,$2,'Private','Test','R001',false)`, [crew.crewUuid, namespace]);
  await pool.query(`INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current,sign_on_date,is_deleted)
    VALUES ($1,$2,$3,'OnBoard',true,'2026-01-01',false)`, [assignment, crew.crewUuid, crew.vesselUuid]);
  await openHarnessStages(pool, assignment);
  await captureHarnessContractRank(pool, assignment, "R001");
  await pool.query(`INSERT INTO vessel_planning_v2(plan_uuid,crew_uuid,vessel_uuid,crew_assign_uuid,rank_id,rank,is_deleted)
    VALUES ($1,$2,$3,$4,'R001','Master',false)`, [plan, crew.crewUuid, crew.vesselUuid, assignment]);
  const form = fixture.forms[0];
  const created = await pool.query(`INSERT INTO adm_forms_v2(form_uuid,name,category,subject_type,rank_group,version_no,version_date,is_deleted)
    VALUES ($1,$2,'dynamic','crew_assignment','All','1','2026-01-01',false) RETURNING id`, [form.formUuid, namespace]);
  await pool.query(`INSERT INTO adm_form_versions_v2(fv_uuid,form_id,version_no,version_date,status,stage_key,stage_subject_type,released_at,is_deleted)
    VALUES ($1,$2,'1','2026-01-01','released','on_board','crew_assignment',now(),false)`, [form.versionUuid, created.rows[0].id]);
  await pool.query(`INSERT INTO frm_form_parts(form_uuid,form_version_uuid,form_part_uuid,part_code,part_title,part_type,is_office_only,is_deleted)
    VALUES ($1,$2,$3,'P1','Private part','configurable',false,false)`, [form.formUuid, form.versionUuid, form.partUuid]);
  await pool.query(`INSERT INTO frm_sections(section_uuid,form_version_uuid,form_part_uuid,section_code,section_title,responsible_mode,
    signature_seafarer_required,vessel_signature_role_uuids,is_deleted)
    VALUES ($1,$2,$3,'S1','Private section','seafarer',true,$4,false)`, [form.sectionUuid, form.versionUuid, form.partUuid, [actor.roleUuid]]);
  req = { user: { id: actor.id, role: actor.role, roleId: actor.roleUuid, userType: "Ship" },
    query: { planUuid: plan, crewUuid: crew.crewUuid, vesselUuid: crew.vesselUuid }, headers: {} };
});

afterAll(async () => {
  vi.restoreAllMocks();
  await fs.mkdir(".local/verification", { recursive: true });
  await fs.writeFile(".local/verification/signoff-planning-lock-races.json",
    JSON.stringify({ privateSchema: namespace, protectedPublicRowsWritten: false, proofs }, null, 2));
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
  await admin.end();
});

describe("real Planning assignment-first concurrency", () => {
  for (const operation of ["start", "signature", "sign-off"] as const) {
    it(`contract/relief-due update serializes with context-bound ${operation} without deadlock`, async () => {
      const initial = operation === "signature" ? await create() : null;
      const entered = deferred(), release = deferred();
      const transaction = state.db.transaction.bind(state.db);
      let gate = true;
      vi.spyOn(state.db, "transaction").mockImplementation((callback: any) =>
        transaction(async (tx: any) => {
          if (gate) {
            gate = false;
            // Deterministic pause at the first lock common to all three
            // genuine operation callbacks; no fake query/transaction results.
            await tx.execute(sql`SELECT assign_uuid FROM crew_assignments WHERE assign_uuid=${assignment} FOR UPDATE`);
            entered.resolve();
            await release.promise;
          }
          return callback(tx);
        }));
      const first = operation === "start" ? create() :
        operation === "signature" ? service.saveSignature({
          req, submissionUuid: initial!.submissionUuid,
          sectionUuid: fixture.forms.find((f: any) => f.key === "aboard").sectionUuid,
          signatureType: "seafarer", method: "witnessed", seafarerPresent: true, data: png,
        }) : vesselPlanningService.signOffCrew(plan, { signOffDate: "2026-10-04" });
      // Attach rejection handling before waiting on the second connection.
      const firstResult = first.then(value => ({ value }), error => ({ error }));
      await entered.promise;
      const second = vesselPlanningService.update(plan, {
        contractPeriodMonths: 2, reliefDue: "2027-01-01",
      } as any).then(value => ({ value }), error => ({ error }));
      let waiter: any;
      try {
        for (let i = 0; i < 150; i++) {
          const result = await admin.query(`SELECT pid FROM pg_stat_activity
            WHERE application_name=$1 AND wait_event_type='Lock'`, [namespace]);
          if (result.rows.length) { waiter = result.rows[0]; break; }
          await new Promise(r => setTimeout(r, 10));
        }
        expect(waiter, "Update must actually wait on the held assignment").toBeTruthy();
        const held = await admin.query(`SELECT 1 FROM pg_locks l JOIN pg_class c ON c.oid=l.relation
          WHERE l.pid=$1 AND c.relnamespace=$2::regnamespace AND c.relname='vessel_planning_v2'`,
        [waiter.pid, namespace]);
        expect(held.rowCount, "Waiting update must not hold Planning before assignment").toBe(0);
      } finally { release.resolve(); }
      const results = await Promise.all([firstResult, second]);
      if (operation === "sign-off") {
        // Sign-off wins this ordering: the now-stale edit must refuse,
        // rather than edit a historical assignment or raise a deadlock.
        expect(results[0]).not.toHaveProperty("error");
        expect(results[1]).toHaveProperty("error");
        expect(String((results[1] as any).error)).toMatch(/inconsistent|changed/);
      } else {
        expect(results[0]).not.toHaveProperty("error");
        expect(results[1]).not.toHaveProperty("error");
        const row = (await pool.query("SELECT contract_period,relief_due FROM crew_assignments")).rows[0];
        expect(row.contract_period).toBe("2");
        expect(String(row.relief_due)).toContain("2027-01-01");
      }
      expect(JSON.stringify(results, (_, value) => value instanceof Error ? String(value) : value)).not.toMatch(/deadlock|40P01/i);
      proofs.push({ operation, results, waitingUpdateHadPlanningLock: false });
    });
  }
  it("a valid contract/relief-due update followed by concurrent sign-off both succeed", async () => {
    const entered = deferred(), release = deferred();
    const transaction = state.db.transaction.bind(state.db);
    let gate = true;
    vi.spyOn(state.db, "transaction").mockImplementation((callback: any) =>
      transaction(async (tx: any) => {
        if (gate) {
          gate = false;
          await tx.execute(sql`SELECT assign_uuid FROM crew_assignments WHERE assign_uuid=${assignment} FOR UPDATE`);
          entered.resolve(); await release.promise;
        }
        return callback(tx);
      }));
    const update = vesselPlanningService.update(plan, { contractPeriodMonths: 2, reliefDue: "2027-01-01" } as any);
    await entered.promise;
    const departure = vesselPlanningService.signOffCrew(plan, { signOffDate: "2026-10-04" });
    await new Promise(r => setTimeout(r, 100));
    release.resolve();
    const results = await Promise.all([update, departure]);
    const row = (await pool.query("SELECT contract_period,relief_due,is_current,sign_off_date FROM crew_assignments")).rows[0];
    expect(row.contract_period).toBe("2");
    expect(String(row.relief_due)).toContain("2027-01-01");
    expect(row.is_current).toBe(false);
    expect(String(row.sign_off_date)).toContain("2026-10-04");
    proofs.push({ operation: "update-first-signoff", results, persisted: row });
  });
});