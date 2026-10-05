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

const namespace = `cf_lock_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
  options: `-c search_path=${namespace},public -c statement_timeout=10000`,
  application_name: namespace });
const tables = ["crew_assignments", "vessel_planning_v2", "crew_members_v2", "crew_sea_service",
  "frm_company_submissions", "frm_company_submission_assignments",
  "frm_company_submission_system_snapshots", "frm_section_states", "frm_section_signatures",
  "frm_signature_attachments", "frm_answers"];
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
  fixture = JSON.parse(await fs.readFile(".local/verification/signoff/fixtures.json", "utf8"));
  crew = fixture.crews.find((c: any) => c.key === "viewers");
  if (!crew) throw Error("Retained approved test-owned aboard fixture is required");
  await admin.query(`CREATE SCHEMA "${namespace}"`);
  // Private schema: real PostgreSQL locks, no public operational row writes,
  // no new vessel, no public Planning position and no protected record edits.
  for (const table of tables) {
    await admin.query(`CREATE TABLE "${namespace}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    await admin.query(`CREATE SEQUENCE "${namespace}"."${table}_local_seq"`);
    await admin.query(`ALTER TABLE "${namespace}"."${table}" ALTER COLUMN id SET DEFAULT nextval('"${namespace}"."${table}_local_seq"')`);
  }
  state.db = drizzle(pool);
}, 30000);

beforeEach(async () => {
  vi.restoreAllMocks();
  for (const table of tables) await pool.query(`TRUNCATE "${table}"`);
  assignment = randomUUID(); plan = randomUUID();
  await pool.query(`INSERT INTO crew_members_v2 SELECT * FROM public.crew_members_v2 WHERE crew_uuid=$1`, [crew.crewUuid]);
  await pool.query(`INSERT INTO crew_assignments SELECT * FROM public.crew_assignments WHERE assign_uuid=$1`, [crew.assignmentUuid]);
  await pool.query(`UPDATE crew_assignments SET assign_uuid=$1`, [assignment]);
  await pool.query(`INSERT INTO vessel_planning_v2 SELECT * FROM public.vessel_planning_v2 WHERE plan_uuid=$1`, [crew.planUuid]);
  await pool.query(`UPDATE vessel_planning_v2 SET plan_uuid=$1,crew_assign_uuid=$2`, [plan, assignment]);
  const actor = fixture.actors.master;
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