import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { randomUUID, createHash } from "node:crypto";
vi.mock("@server/v2/db", () => ({ getDb: vi.fn() }));
const access = vi.hoisted(() => ({ menu: vi.fn(), subject: vi.fn() }));
vi.mock("@server/v2/shared/attachmentAccess", async original => ({
  ...await original<typeof import("@server/v2/shared/attachmentAccess")>(),
  authorizeAttachmentMenu: access.menu, authorizeAttachmentSubject: access.subject,
}));
import { getDb } from "@server/v2/db";
import { calculateRelieverTrainingCompliance } from "@server/v2/shared/training-compliance/service";
import { getRelieverTrainingCompliance } from "@server/v2/vessel/controllers/trainingComplianceController";
import { getOnboardTrainingCompliance } from "@server/v2/vessel/controllers/onboardTrainingComplianceController";
import { readOnboardAssignments } from "@server/v2/shared/training-compliance/onboard";
import { AttachmentAccessError } from "@server/v2/shared/attachmentAccess";
import { trainingChecklistEvidence, recordTrainingAcceptance } from "@server/v2/shared/training-compliance/checklistEvidence";
import { trainingOverrideAllowed } from "@server/v2/shared/training-compliance/authority";
import { trainingComplianceSettingsController } from "@server/v2/admin/controllers/trainingComplianceSettingsController";

const tables = ["crew_members_v2", "crew_assignments", "vessel_planning_v2", "master_vessels",
  "crew_assignment_rule_context", "adm_available_ranks_v2", "adm_training_master_v2",
  "adm_company_trainings_v2", "adm_company_training_requirements_v2", "adm_company_training_groups_v2",
  "adm_training_matrix_vessel_revisions_v2", "adm_training_matrix_equivalents_v2",
  "adm_training_matrix_vessel_drafts_v2", "crew_training_courses", "crew_training_attachments",
  "adm_training_compliance_settings", "training_checklist_snapshots", "master_users",
  "adm_rolemaster_ac", "adm_resource_action_grants", "adm_permission_actions",
  "adm_access_control_state", "adm_access_control_audit"];
const schemas = [0, 1].map(() => `training_calc_${randomUUID().replaceAll("-", "")}`);
const pools: Pool[] = [], dbs: any[] = [], observed: string[][] = [];
const databaseErrors: string[] = [];
let control: Pool | undefined, tenant = 0, nextId = 1000;
const ids = Object.fromEntries(["vessel", "crew", "assignment", "plan", "rank", "courseA", "courseB",
  "companyA", "companyB", "revision", "certificateA", "certificateB"].map(k => [k, randomUUID()]));
function ident(value: string) {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) throw Error("Unsafe isolated test identifier");
  return `"${value}"`;
}
async function insert(pool: Pool, schema: string, table: string, supplied: Record<string, any>) {
  const columns = (await pool.query(`SELECT column_name,data_type,is_nullable,column_default,is_identity
    FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`, [schema, table])).rows;
  const data = { ...supplied };
  if (columns.some(c => c.column_name === "id" && c.data_type === "integer") && data.id === undefined) data.id = ++nextId;
  for (const c of columns) if (c.is_nullable === "NO" && c.column_default === null
    && c.is_identity === "NO" && !(c.column_name in data))
    data[c.column_name] = ["json", "jsonb"].includes(c.data_type) ? "{}" : ["integer", "bigint"].includes(c.data_type) ? 1
      : c.data_type === "boolean" ? false : c.data_type.includes("timestamp") ? new Date() : randomUUID();
  const keys = Object.keys(data);
  await pool.query(`INSERT INTO ${ident(table)} (${keys.map(ident).join(",")})
    VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(data));
}
async function fingerprint(pool: Pool) {
  const contents = [];
  for (const table of tables) contents.push((await pool.query(`SELECT row_to_json(t) AS row FROM ${ident(table)} t
    ORDER BY row_to_json(t)::text`)).rows);
  return createHash("sha256").update(JSON.stringify(contents)).digest("hex");
}
function check(revision?: string, targetTenant = 0) {
  tenant = targetTenant;
  return calculateRelieverTrainingCompliance({ planUuid: ids.plan, assignmentUuid: ids.assignment,
    ...(revision !== undefined ? { matrixRevisionUuid: revision } : {}) });
}
beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_VERIFIED !== "true")
    throw Error("The registered and identity-verified TEST_DATABASE_URL is required.");
  control = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  for (const schema of schemas) {
    await control.query(`CREATE SCHEMA ${ident(schema)}`);
    for (const table of tables) await control.query(`CREATE TABLE ${ident(schema)}.${ident(table)}
      (LIKE public.${ident(table)} INCLUDING ALL)`);
    const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });
    pools.push(pool);
    await pool.query(`CREATE TRIGGER training_evidence_immutable BEFORE UPDATE OR DELETE ON training_checklist_snapshots
      FOR EACH ROW EXECUTE FUNCTION public.training_checklist_evidence_immutable()`);
    await pool.query(`CREATE TRIGGER checklist_verified BEFORE INSERT OR UPDATE OF deployment_checklist_completed ON vessel_planning_v2
      FOR EACH ROW EXECUTE FUNCTION public.frm_checklist_verified_write()`);
    const db = drizzle(pool), transaction = db.transaction.bind(db);
    dbs.push({ transaction: async (work: any, options: any) => transaction(async tx => {
      observed.push([(await tx.execute(sql`SHOW transaction_read_only`)).rows[0].transaction_read_only as string,
        (await tx.execute(sql`SHOW transaction_isolation`)).rows[0].transaction_isolation as string]);
      return work(tx);
    }, options).catch((error: any) => {
      databaseErrors.push(error.cause?.message ?? error.message);
      throw error;
    }) });
  }
  vi.mocked(getDb).mockImplementation(() => dbs[tenant]);
}, 60000);
beforeEach(async () => {
  access.menu.mockReset().mockResolvedValue({});
  access.subject.mockReset().mockResolvedValue(undefined);
  databaseErrors.length = 0;
  for (const [index, pool] of pools.entries()) {
    await pool.query(`TRUNCATE ${tables.map(ident).join(",")}`);
    const add = (table: string, data: Record<string, any>) => insert(pool, schemas[index], table, data);
    await add("master_vessels", { vessel_uuid: ids.vessel, is_deleted: false });
    await add("crew_members_v2", { crew_uuid: ids.crew, emp_no: "TEST-CALC", present_rank: "Wrong present rank", is_deleted: false });
    await add("adm_available_ranks_v2", { id: 501, ar_uuid: ids.rank, name: "Captured rank", rank_id: "R501", is_deleted: false });
    await add("crew_assignments", { assign_uuid: ids.assignment, crew_uuid: ids.crew, vessel_uuid: ids.vessel,
      assignment_type: "Planned", sign_on_date: "2035-01-01", is_current: false, is_deleted: false });
    await add("crew_assignment_rule_context", { assign_uuid: ids.assignment, contract_rank_uuid: ids.rank, contract_rank_label: "Captured rank" });
    await add("adm_training_compliance_settings", { singleton: true, block_expiring_during_contract: false });
    await add("adm_rolemaster_ac", { ruid: ids.companyA, assigned_role: "Synthetic Crew Manager", roletype: "Office",
      is_active: true, is_deleted: false, parent_owned: true });
    await add("master_users", { id: 42, user_uuid: randomUUID(), role: "Synthetic Crew Manager", user_type: "Office" });
    await add("adm_access_control_state", { singleton: true, category_ready: false });
    for (const [resource, action] of [["training_compliance", "override"], ["access_control", "manage"], ["company_forms", "override_checklist"]])
      await add("adm_permission_actions", { resource, action, label: action, sort_order: 1 });
    await add("vessel_planning_v2", { plan_uuid: ids.plan, vessel_uuid: ids.vessel, rank_id: randomUUID(),
      deployment_checklist_completed: false,
      reliever_assign_uuid: ids.assignment, reliever_crew_uuid: ids.crew,
      reliever_sign_on_date: "2026-01-31", reliever_contract_end_range_end_months: 1,
      sign_on_date: "2035-08-01", contract_end_range_end_months: 12, is_deleted: false });
    for (const [i, course] of [ids.courseA, ids.courseB].entries()) {
      await add("adm_training_master_v2", { id: i + 1, tm_uuid: course, training_id: `MASTER-${i}`, training_name: `Course ${i}`, is_deleted: false });
      await add("adm_company_trainings_v2", { id: 101 + i, ct_uuid: i ? ids.companyB : ids.companyA,
        training_master_id: i + 1, company_id: `COMPANY-${i}`, training_label: `Required ${i}`, is_deleted: false });
    }
    await add("adm_company_training_requirements_v2", { ctr_uuid: randomUUID(), company_training_id: 101,
      rank_id: 501, status: "M", is_deleted: false });
    await add("adm_training_matrix_vessel_revisions_v2", { tmvr_uuid: ids.revision, vessel_id: ids.vessel,
      revision: "R0", revision_date: "2025-01-01", revision_data: '{"applicableTrainingIds":[101]}', is_deleted: false });
    await add("crew_training_courses", { train_uuid: ids.certificateA, crew_uuid: ids.crew,
      course_id: "101", training_course: "Held A", certificate_no: "CERT-A", issued: "2024-01-01",
      expiry: index ? "2025-01-01" : "2026-12-31", is_deleted: false });
  }
  tenant = 0;
});

async function onboardDisplay(query: Record<string, string> = {}) {
  const response: any = { code: 200, payload: undefined, setHeader: vi.fn(),
    status(n: number) { this.code = n; return this; },
    json(payload: any) { this.payload = payload; return this; } };
  await getOnboardTrainingCompliance({ params: { vesselUuid: ids.vessel }, query } as any, response);
  return response;
}
async function makeOnboard() {
  await pools[0].query("UPDATE crew_assignments SET assignment_type='OnBoard',is_current=true WHERE assign_uuid=$1", [ids.assignment]);
  await pools[0].query(`UPDATE vessel_planning_v2 SET crew_assign_uuid=$1,crew_uuid=$2,
    sign_off_date='2090-06-01',relief_due='2050-01-01' WHERE plan_uuid=$3`, [ids.assignment, ids.crew, ids.plan]);
}
describe("onboard matrix exact provenance and shared read-only evidence", () => {
  it("reads captured rank and exact linked planned sign-off, never present rank or relief due", async () => {
    await makeOnboard();
    const [row] = await readOnboardAssignments(drizzle(pools[0]), ids.vessel);
    expect(row).toMatchObject({ assignmentUuid: ids.assignment, contractRankUuid: ids.rank,
      rankRowId: 501, plannedReliefDate: "2090-06-01", planningCount: 1 });
  });
  it("does not borrow another assignment's planned dates", async () => {
    await makeOnboard();
    await pools[0].query("UPDATE vessel_planning_v2 SET crew_assign_uuid=$1 WHERE plan_uuid=$2", [randomUUID(), ids.plan]);
    const [row] = await readOnboardAssignments(drizzle(pools[0]), ids.vessel);
    expect(row).toMatchObject({ plannedReliefDate: null, planningCount: 0 });
  });
  it("shows a missing captured rank as incomplete with no present-rank replacement", async () => {
    await makeOnboard();
    await pools[0].query("DELETE FROM crew_assignment_rule_context WHERE assign_uuid=$1", [ids.assignment]);
    const result = await onboardDisplay();
    expect(result.code).toBe(200);
    expect(result.payload.crew[0]).toMatchObject({ status: "incomplete", contractRankUuid: null,
      context: { contractRankLabel: "Not recorded" } });
    expect(result.payload.crew[0].issues.some((i: any) => i.code === "MISSING_RANK")).toBe(true);
  });
  it("returns ordered rows, dates, certificate evidence and dots without changing any records", async () => {
    await makeOnboard();
    const before = await fingerprint(pools[0]);
    const result = await onboardDisplay();
    expect(result.code).toBe(200);
    expect(result.payload.rows[0]).toMatchObject({ companyTrainingId: 101, courseUuid: ids.courseA });
    expect(result.payload.crew[0]).toMatchObject({ referenceKind: "on_board", contractRankUuid: ids.rank,
      plannedReliefDate: "2090-06-01", context: { contractRankLabel: "Captured rank" },
      courses: [{ chosenCertificate: { certificateUuid: ids.certificateA },
        certificates: [{ selected: true, certificate: { certificateUuid: ids.certificateA } }] }],
      dots: [{ color: "amber", label: "Expires before planned relief" }] });
    expect(await fingerprint(pools[0])).toBe(before);
    expect(observed.at(-1)).toEqual(["on", "repeatable read"]);
  });
  it("trials a different relief date in a read-only snapshot and clearing restores actual dates", async () => {
    await makeOnboard();
    const before = await fingerprint(pools[0]);
    const actual = await onboardDisplay();
    const trial = await onboardDisplay({ trialReliefDate: "2026-11-30" });
    expect(trial.code).toBe(200);
    expect(trial.payload.trialReliefDate).toBe("2026-11-30");
    expect(trial.payload.crew[0]).toMatchObject({
      plannedReliefDate: "2090-06-01", effectiveReliefDate: "2026-11-30",
      contractEnd: "2026-11-30",
      courses: [{ state: "Valid", urgencyWindows: expect.any(Array) }],
      dots: [{ color: "green", label: "Valid" }],
    });
    expect(actual.payload.crew[0].courses[0].state).toBe("Expires during contract");
    expect(trial.payload.crew[0].courses[0].urgencyWindows)
      .toEqual(actual.payload.crew[0].courses[0].urgencyWindows);
    expect(await fingerprint(pools[0])).toBe(before);
    expect(observed.at(-1)).toEqual(["on", "repeatable read"]);
    const cleared = await onboardDisplay();
    expect(cleared.payload.trialReliefDate).toBeNull();
    expect(cleared.payload.crew[0].contractEnd).toBe(actual.payload.crew[0].contractEnd);
    expect(cleared.payload.crew[0].dots).toEqual(actual.payload.crew[0].dots);
  });
  it.each([
    { trialReliefDate: "2026-02-30" }, { trialReliefDate: "2026-2-01" },
    { trialReliefDate: "not-a-date" }, { trialReliefDate: "2026-11-30", rank: "forged" },
  ])("refuses malformed trial dates and additional authority inputs: %j", async query => {
    expect((await onboardDisplay(query)).code).toBe(400);
  });
  it("excludes planned, signed-off and deleted assignments", async () => {
    expect((await onboardDisplay()).payload.crew).toEqual([]);
    await makeOnboard();
    await pools[0].query("UPDATE crew_assignments SET sign_off_date='2026-01-01' WHERE assign_uuid=$1", [ids.assignment]);
    expect((await onboardDisplay()).payload.crew).toEqual([]);
    await pools[0].query("UPDATE crew_assignments SET sign_off_date=NULL,is_deleted=true WHERE assign_uuid=$1", [ids.assignment]);
    expect((await onboardDisplay()).payload.crew).toEqual([]);
  });
  it("rejects browser dates/ranks and refuses missing permissions with a plain sentence", async () => {
    expect((await onboardDisplay({ today: "1990-01-01" })).code).toBe(400);
    access.menu.mockRejectedValue(new AttachmentAccessError(403));
    const result = await onboardDisplay();
    expect(result.code).toBe(403);
    expect(result.payload.message).toContain("permission");
  });
});

describe("accepted checklist evidence in isolated tenant schemas", () => {
  it("default-denies training authority; Company Forms grant and browser role claims grant nothing", async () => {
    const db = drizzle(pools[0]), req: any = { user: { id: 42, userType: "Office", roleId: "forged-role" } };
    expect(await trainingOverrideAllowed(req, db)).toBe(false);
    await pools[0].query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
      VALUES($1,'company_forms','override_checklist',true)`, [ids.companyA]);
    expect(await trainingOverrideAllowed(req, db)).toBe(false);
    await pools[0].query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
      VALUES($1,'training_compliance','override',true)`, [ids.companyA]);
    expect(await trainingOverrideAllowed(req, db)).toBe(true);
    expect(await trainingOverrideAllowed({ user: { id: 999, userType: "Office" } } as any, db)).toBe(false);
    expect(await trainingOverrideAllowed({ user: { id: 42, userType: "Ship" } } as any, db)).toBe(false);
    await pools[0].query(`UPDATE adm_rolemaster_ac SET is_active=false WHERE ruid=$1`, [ids.companyA]);
    expect(await trainingOverrideAllowed(req, db)).toBe(false);
  });
  it("settings require management, reject browser identity, and audit server identity and before/after", async () => {
    tenant = 0;
    const invoke = async (body: any) => {
      const res: any = { code: 200, status(code: number) { this.code = code; return this; },
        json(data: unknown) { this.body = data; return this; } };
      await trainingComplianceSettingsController.save({ user: { id: 42, userType: "Office" }, body } as any, res);
      return res;
    };
    expect((await invoke({ blockExpiringDuringContract: true })).code).toBe(403);
    await pools[0].query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
      VALUES($1,'access_control','manage',true)`, [ids.companyA]);
    expect((await invoke({ blockExpiringDuringContract: true, actorId: 999 })).code).toBe(400);
    expect((await invoke({ blockExpiringDuringContract: true })).code).toBe(200);
    const audit = (await pools[0].query("SELECT * FROM adm_access_control_audit")).rows[0];
    expect(audit.actor.masterUserId).toBe(42);
    expect(audit.before_value).toBe(false);
    expect(audit.after_value).toBe(true);
    expect(audit.resource).toBe("training_compliance");
    expect(audit.recorded_at).toBeTruthy();
    expect((await pools[1].query("SELECT block_expiring_during_contract AS flag FROM adm_training_compliance_settings")).rows[0].flag).toBe(false);
  });
  it("reads expiry classification by master identity and applies an explicit No, not a missing date guess", async () => {
    tenant = 0;
    await pools[0].query("UPDATE crew_training_courses SET expiry=NULL");
    const first = await calculateRelieverTrainingCompliance({ planUuid: ids.plan, assignmentUuid: ids.assignment });
    expect(first.courses[0]).toMatchObject({ state: "Expiry not recorded",
      chosenCertificate: { certificateExpires: true } });
    await pools[0].query("UPDATE adm_training_master_v2 SET certificate_expires=false WHERE tm_uuid=$1", [ids.courseA]);
    const next = await calculateRelieverTrainingCompliance({ planUuid: ids.plan, assignmentUuid: ids.assignment });
    expect(next.courses[0]).toMatchObject({ state: "Valid, no expiry",
      chosenCertificate: { certificateExpires: false } });
  });
  it("contract period fallback uses only the reliever, never incumbent/shared values", async () => {
    tenant = 0;
    await pools[0].query(`UPDATE vessel_planning_v2 SET reliever_contract_end_range_end_months=NULL,
      reliever_contract_period_months=NULL,contract_period_months=9,contract_end_range_end_months=10`);
    const absent = await calculateRelieverTrainingCompliance({ planUuid: ids.plan, assignmentUuid: ids.assignment });
    expect(absent).toMatchObject({ contractEnd: null, contractEndStatus: "not_set", contractEndSource: null });
    await pools[0].query("UPDATE vessel_planning_v2 SET reliever_contract_period_months=2");
    const own = await calculateRelieverTrainingCompliance({ planUuid: ids.plan, assignmentUuid: ids.assignment });
    expect(own).toMatchObject({ contractEnd: "2026-03-31", contractEndStatus: "set", contractEndSource: "contract_period" });
  });
  it("missing-expiry setting defaults OFF, requires management, is tenant scoped and audited", async () => {
    tenant = 0;
    const invoke = async (body: any) => {
      const res: any = { code: 200, status(code: number) { this.code = code; return this; },
        json(data: unknown) { this.body = data; return this; } };
      await trainingComplianceSettingsController.save({ user: { id: 42, userType: "Office" }, body } as any, res);
      return res;
    };
    expect((await pools[0].query("SELECT block_missing_expiry AS flag FROM adm_training_compliance_settings")).rows[0].flag).toBe(false);
    expect((await invoke({ blockExpiringDuringContract: false, blockMissingExpiry: true })).code).toBe(403);
    await pools[0].query(`INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
      VALUES($1,'access_control','manage',true)`, [ids.companyA]);
    expect((await invoke({ blockExpiringDuringContract: false, blockMissingExpiry: true, actorId: 99 })).code).toBe(400);
    expect((await invoke({ blockExpiringDuringContract: false, blockMissingExpiry: true })).body)
      .toMatchObject({ blockMissingExpiry: true, blockExpiringDuringContract: false });
    const audit = (await pools[0].query(`SELECT * FROM adm_access_control_audit WHERE action='block_missing_expiry'`)).rows[0];
    expect(audit.actor.masterUserId).toBe(42);
    expect(audit.before_value).toBe(false); expect(audit.after_value).toBe(true);
    expect((await pools[1].query("SELECT block_missing_expiry AS flag FROM adm_training_compliance_settings")).rows[0].flag).toBe(false);
  });
  it("freezes selected revision, rank, equivalents, certificates and policy; later edits cannot change prior evidence", async () => {
    const db = drizzle(pools[0]);
    let frozen: any;
    const snapshot = await db.transaction(async tx => {
      const evidence = await trainingChecklistEvidence(tx, ids.plan, ids.assignment);
      expect(evidence.blockers).toEqual([]);
      expect(evidence.canonical?.contractRankUuid).toBe(ids.rank);
      expect(evidence.matrix?.revisionUuid).toBe(ids.revision);
      expect(evidence.check.courses[0].chosenCertificate?.certificateUuid).toBe(ids.certificateA);
      frozen = { ...evidence, overrides: null };
      return recordTrainingAcceptance(tx, ids.plan, ids.assignment, { masterUserId: 42 }, frozen);
    });
    const before = (await pools[0].query("SELECT * FROM training_checklist_snapshots WHERE snapshot_uuid=$1", [snapshot.snapshotUuid])).rows[0];
    await pools[0].query("UPDATE crew_training_courses SET expiry='2025-01-01' WHERE train_uuid=$1", [ids.certificateA]);
    expect((await pools[0].query("SELECT * FROM training_checklist_snapshots WHERE snapshot_uuid=$1", [snapshot.snapshotUuid])).rows[0]).toEqual(before);
    expect(before.evidence.check.courses[0].chosenCertificate.expiry).toBe("2026-12-31");
    await expect(pools[0].query("UPDATE training_checklist_snapshots SET evidence='{}' WHERE snapshot_uuid=$1",
      [snapshot.snapshotUuid])).rejects.toMatchObject({ code: "23514" });
    await expect(pools[0].query("DELETE FROM training_checklist_snapshots WHERE snapshot_uuid=$1",
      [snapshot.snapshotUuid])).rejects.toMatchObject({ code: "23514" });
    const second = await db.transaction(tx => recordTrainingAcceptance(tx, ids.plan, ids.assignment, { masterUserId: 42 }, frozen));
    expect(second.snapshotUuid).not.toBe(snapshot.snapshotUuid);
    expect((await pools[0].query("SELECT count(*)::int AS n FROM training_checklist_snapshots")).rows[0].n).toBe(2);
  });
  it("enforces tenant-local expiry policy and never falls through to another tenant's setting", async () => {
    await pools[0].query("UPDATE crew_training_courses SET expiry='2026-02-01'");
    await pools[1].query("UPDATE adm_training_compliance_settings SET block_expiring_during_contract=true");
    const first = await drizzle(pools[0]).transaction(tx => trainingChecklistEvidence(tx, ids.plan, ids.assignment));
    expect(first.blockExpiringDuringContract).toBe(false);
    expect(first.blockers).toEqual([]);
    expect(first.warnings.join(" ")).toContain("Expires during contract");
    await pools[0].query("UPDATE adm_training_compliance_settings SET block_expiring_during_contract=true");
    const on = await drizzle(pools[0]).transaction(tx => trainingChecklistEvidence(tx, ids.plan, ids.assignment));
    expect(on.blockers[0].status).toBe("Expires during contract");
  });
  it("calculation failure returns incomplete through savepoint while leaving the transaction usable", async () => {
    const result = await drizzle(pools[0]).transaction(async tx => {
      await tx.execute(sql`ALTER TABLE crew_training_courses RENAME COLUMN expiry TO hidden_expiry`);
      const evidence = await trainingChecklistEvidence(tx, ids.plan, ids.assignment);
      expect((await tx.execute(sql`SELECT 1 AS ok`)).rows[0].ok).toBe(1);
      return evidence;
    });
    expect(result.blockers).toMatchObject([{ status: "INCOMPLETE", reason: expect.stringContaining("could not finish") }]);
    await pools[0].query("ALTER TABLE crew_training_courses RENAME COLUMN hidden_expiry TO expiry");
  });
  it("raw Yes and Company Forms-only verification cannot bypass training", async () => {
    await expect(pools[0].query("UPDATE vessel_planning_v2 SET deployment_checklist_completed=true WHERE plan_uuid=$1",
      [ids.plan])).rejects.toMatchObject({ code: "23514" });
    await expect(drizzle(pools[0]).transaction(async tx => {
      await tx.execute(sql`SELECT set_config('sail.checklist_verified_plan',${ids.plan},true)`);
      await tx.execute(sql`UPDATE vessel_planning_v2 SET deployment_checklist_completed=true WHERE plan_uuid=${ids.plan}`);
    })).rejects.toThrow();
  });
});

async function display(query: Record<string, string> = {}, planUuid = ids.plan) {
  tenant = 0;
  const response: any = { code: 200, payload: undefined, setHeader: vi.fn(),
    status(code: number) { this.code = code; return this; },
    json(payload: unknown) { this.payload = payload; return this; } };
  await getRelieverTrainingCompliance({ params: { planUuid, assignUuid: ids.assignment }, query } as any, response);
  return response;
}

describe("read-only operational training endpoint", () => {
  it("adds matrix category/course order without dropping compliant rows or changing calculated results", async () => {
    await insert(pools[0], schemas[0], "adm_company_training_groups_v2",
      { ctg_uuid: randomUUID(), code: "A", label: "Statutory", display_order: 1, is_deleted: false });
    await insert(pools[0], schemas[0], "adm_company_training_groups_v2",
      { ctg_uuid: randomUUID(), code: "B", label: "Company", display_order: 2, is_deleted: false });
    await pools[0].query("UPDATE adm_company_trainings_v2 SET group_code=CASE WHEN id=101 THEN 'B' ELSE 'A' END,sort_order=3");
    await insert(pools[0], schemas[0], "adm_company_training_requirements_v2",
      { ctr_uuid: randomUUID(), company_training_id: 102, rank_id: 501, status: "R", is_deleted: false });
    await pools[0].query(`UPDATE adm_training_matrix_vessel_revisions_v2 SET revision_data='{"applicableTrainingIds":[101,102]}'`);
    const calculated = await check();
    const before = await fingerprint(pools[0]);
    const result = await display();
    expect(result.code, databaseErrors.join("; ")).toBe(200);
    expect(result.payload.courses).toHaveLength(2);
    expect(result.payload.courses[0]).toMatchObject({ courseUuid: ids.courseA,
      state: "Valid", companyId: "COMPANY-0", category: "B. Company", categoryOrder: 1, matrixOrder: 1 });
    expect(result.payload.courses[1]).toMatchObject({ courseUuid: ids.courseB,
      state: "Not held", category: "A. Statutory", categoryOrder: 0, matrixOrder: 0 });
    const { context, ...withLayout } = result.payload;
    expect({ ...withLayout, courses: withLayout.courses.map(
      ({ companyId, category, categoryOrder, matrixOrder, certificates, ...course }: any) => course) }).toEqual(calculated);
    expect(await fingerprint(pools[0])).toBe(before);
  });
  it("returns exact context, certificate details and protected attachment links without writes", async () => {
    const attachment = randomUUID();
    await insert(pools[0], schemas[0], "crew_training_attachments", {
      att_uuid: attachment, train_uuid: ids.certificateA, file_name: "certificate.pdf",
      file_data: "NEVER RETURN THIS", is_deleted: false });
    const before = await fingerprint(pools[0]);
    const result = await display();
    expect(result.code, databaseErrors.join("; ")).toBe(200);
    expect(access.menu.mock.calls.map(c => c[1])).toEqual(["Vessel", "Crew Database"]);
    expect(access.subject.mock.calls.map(c => c.slice(1))).toEqual([
      ["Vessel", ids.vessel, "vessel"], ["Crew Database", ids.crew] ]);
    expect(result.payload).toMatchObject({ calculationVersion: "1.5.0", context: {
      crewUuid: ids.crew }, courses: [{ state: "Valid", certificates: [{
        selected: true, disposition: "selected", attachments: [{
          uuid: attachment, url: `/api/v2/crew-pool/training/attachments/${attachment}/raw` }] }] }] });
    expect(JSON.stringify(result.payload)).not.toContain("NEVER RETURN THIS");
    expect(await fingerprint(pools[0])).toBe(before);
    expect(observed.at(-1)).toEqual(["on", "repeatable read"]);
  });
  it("refuses a missing grant before reading reliever facts", async () => {
    access.menu.mockRejectedValue(new AttachmentAccessError(403));
    const count = observed.length;
    const result = await display();
    expect(result.code).toBe(403);
    expect(observed.length).toBe(count);
    expect(result.payload.message).toContain("permission");
  });
  it("refuses an out-of-scope vessel before returning certificate information", async () => {
    access.subject.mockRejectedValue(new AttachmentAccessError(403));
    const result = await display();
    expect(result.code).toBe(403);
    expect(result.payload.courses).toBeUndefined();
  });
  it("refuses an orphaned or other-tenant exact link without substituting another assignment", async () => {
    expect((await display({}, randomUUID())).code).toBe(404);
  });
  it("refuses browser-selected revisions or calculation facts", async () => {
    expect((await display({ matrixRevisionUuid: ids.revision })).code).toBe(400);
    expect((await display({ plannedJoiningDate: "2035-01-01" })).code).toBe(400);
  });
  it("a database failure returns plain retry instructions, not raw SQL", async () => {
    access.menu.mockRejectedValue(new Error("private SQL detail"));
    const result = await display();
    expect(result.code).toBe(500);
    expect(result.payload.message).toContain("Retry");
    expect(JSON.stringify(result.payload)).not.toContain("private SQL");
  });
});
afterAll(async () => {
  for (const pool of pools) await pool.end();
  if (control) {
    for (const schema of schemas) await control.query(`DROP SCHEMA IF EXISTS ${ident(schema)} CASCADE`);
    await control.end();
  }
});

describe("tenant-scoped read-only compliance loader", () => {
  it("uses captured rank, own dates and a real read-only repeatable snapshot, changing no records", async () => {
    const before = await fingerprint(pools[0]);
    const result = await check();
    expect(result, databaseErrors.join("; ")).toMatchObject({ status: "complete", contractRankUuid: ids.rank,
      joiningDate: "2026-01-31", contractEnd: "2026-02-28", matrixRevisionUuid: ids.revision,
      courses: [{ state: "Valid", chosenCertificate: { certificateUuid: ids.certificateA }, isEquivalent: false }] });
    expect(observed.at(-1)).toEqual(["on", "repeatable read"]);
    expect(await fingerprint(pools[0])).toBe(before);
  });
  it("blank reliever inputs do not use the populated incumbent dates or assignment sign-on", async () => {
    await pools[0].query("UPDATE vessel_planning_v2 SET reliever_sign_on_date=NULL,reliever_contract_end_range_end_months=NULL");
    const result = await check();
    expect(result).toMatchObject({ status: "incomplete", joiningDate: null, contractEnd: null,
      contractEndStatus: "not_set", summary: { mandatory: { status: "incomplete" } } });
    expect(result.issues.map(i => i.code)).toEqual(expect.arrayContaining(["MISSING_JOINING_DATE", "CONTRACT_END_NOT_SET"]));
  });
  it("never substitutes the planning or present rank for absent captured rank", async () => {
    await pools[0].query("UPDATE crew_assignment_rule_context SET contract_rank_uuid=NULL");
    const result = await check();
    expect(result.status).toBe("incomplete");
    expect(result.contractRankUuid).toBeNull();
    expect(result.issues.map(i => i.code)).toContain("MISSING_RANK");
  });
  it.each(["101", "COMPANY-0", "MASTER-0", ids.courseA, ids.companyA])("resolves identifier %s through explicit lineage", async reference => {
    await pools[0].query("UPDATE crew_training_courses SET course_id=$1", [reference]);
    expect((await check()).courses[0].chosenCertificate?.courseUuid).toBe(ids.courseA);
  });
  it("does not match free text by name", async () => {
    await pools[0].query("UPDATE crew_training_courses SET course_id=NULL,training_course='Required 0'");
    const result = await check();
    expect(result.courses[0].state).toBe("Not held");
    expect(result.unlinkedCertificateUuids).toEqual([ids.certificateA]);
  });
  it("rejects an ambiguous legacy identifier rather than guessing", async () => {
    await pools[0].query("UPDATE adm_company_trainings_v2 SET company_id='101' WHERE id=102");
    expect((await check()).courses[0].state).toBe("Not held");
  });
  it("ignores deleted certificates", async () => {
    await pools[0].query("UPDATE crew_training_courses SET is_deleted=true");
    expect((await check()).courses[0].state).toBe("Not held");
  });
  it("uses equivalents only from the selected saved revision, never a newer revision or draft", async () => {
    const pool = pools[0], add = (t: string, d: Record<string, any>) => insert(pool, schemas[0], t, d);
    await pool.query("UPDATE crew_training_courses SET expiry='2026-02-01'");
    await add("crew_training_courses", { train_uuid: ids.certificateB, crew_uuid: ids.crew, course_id: "102",
      training_course: "Held B", issued: "2024-01-01", expiry: "2027-01-01", is_deleted: false });
    await add("adm_training_matrix_equivalents_v2", { link_uuid: randomUUID(), vessel_uuid: ids.vessel,
      revision_uuid: ids.revision, required_course_uuid: ids.courseA, accepted_course_uuid: ids.courseB,
      required_course_label: "A", accepted_course_label: "B", recorded_by: "test" });
    const newer = randomUUID(), draft = randomUUID();
    await add("adm_training_matrix_vessel_revisions_v2", { tmvr_uuid: newer, vessel_id: ids.vessel,
      revision: "R1", revision_date: "2025-12-01", revision_data: '{"applicableTrainingIds":[101]}', is_deleted: false });
    await add("adm_training_matrix_vessel_drafts_v2", { tmvd_uuid: draft, vessel_id: ids.vessel,
      revision: "R2", draft_data: '{"applicableTrainingIds":[101]}', is_deleted: false });
    await add("adm_training_matrix_equivalents_v2", { link_uuid: randomUUID(), vessel_uuid: ids.vessel,
      draft_uuid: draft, required_course_uuid: ids.courseA, accepted_course_uuid: ids.courseB,
      required_course_label: "A", accepted_course_label: "B", recorded_by: "test" });
    const latest = await check(), historical = await check(ids.revision);
    expect(latest).toMatchObject({ matrixRevisionUuid: newer, courses: [{ state: "Expires during contract", isEquivalent: false }] });
    expect(historical).toMatchObject({ matrixRevisionUuid: ids.revision, courses: [{
      state: "Valid", isEquivalent: true, chosenCertificate: { certificateUuid: ids.certificateB } }] });
  });
  it("does not fall back when an explicitly requested revision is unavailable", async () => {
    expect((await check(randomUUID())).status).toBe("incomplete");
    await pools[0].query("UPDATE adm_training_matrix_vessel_revisions_v2 SET is_deleted=true");
    expect((await check()).issues.map(i => i.code)).toContain("MISSING_MATRIX");
  });
  it("never resolves by crew or vessel guesses when the exact planning link is broken", async () => {
    await pools[0].query("UPDATE vessel_planning_v2 SET reliever_crew_uuid=$1", [randomUUID()]);
    expect((await check()).issues.map(i => i.code)).toContain("ASSIGNMENT_UNAVAILABLE");
  });
  it("isolates identical identifiers in two tenants", async () => {
    expect((await check(undefined, 0)).courses[0].state).toBe("Valid");
    expect((await check(undefined, 1)).courses[0].state).toBe("Expired at joining");
  });
  it("a real SQL failure becomes an incomplete check with a plain retry message", async () => {
    await pools[0].query("ALTER TABLE crew_training_courses RENAME TO temporarily_unavailable_courses");
    try {
      const result = await check();
      expect(result).toMatchObject({ status: "incomplete", issues: [{ code: "CALCULATION_FAILED",
        message: expect.stringContaining("Retry") }], summary: { mandatory: { status: "incomplete" } } });
      expect(JSON.stringify(result)).not.toMatch(/relation|does not exist|temporarily_unavailable_courses/);
    } finally { await pools[0].query("ALTER TABLE temporarily_unavailable_courses RENAME TO crew_training_courses"); }
  });
  it("distinguishes an empty valid matrix from a missing one", async () => {
    await pools[0].query(`UPDATE adm_training_matrix_vessel_revisions_v2 SET revision_data='{"applicableTrainingIds":[]}'`);
    expect(await check()).toMatchObject({ status: "complete", courses: [], summary: { mandatory: { count: 0 } } });
  });
  it("retains Recommended rather than promoting it to Mandatory", async () => {
    await pools[0].query("UPDATE adm_company_training_requirements_v2 SET status='R'");
    await pools[0].query("UPDATE crew_training_courses SET is_deleted=true");
    expect(await check()).toMatchObject({ courses: [{ obligation: "recommended", state: "Not held" }],
      summary: { mandatory: { status: "valid", count: 0 }, recommended: { status: "gap", count: 1 } } });
  });
  it("an absent own contract end stays absent despite the incumbent's twelve months", async () => {
    await pools[0].query("UPDATE vessel_planning_v2 SET reliever_contract_end_range_end_months=NULL");
    expect(await check()).toMatchObject({ status: "complete", joiningDate: "2026-01-31",
       contractEnd: null, contractEndStatus: "not_set", courses: [{ state: "Valid", validThroughContract: null,
        chosenCertificate: { certificateUuid: ids.certificateA } }] });
  });
  it("reads an absent D3 issue date as held, without filling it or changing records", async () => {
    await pools[0].query("UPDATE crew_training_courses SET issued=NULL");
    const before = await fingerprint(pools[0]);
    const result = await check();
    expect(result).toMatchObject({ status: "complete", courses: [{ state: "Valid",
      chosenCertificate: { certificateUuid: ids.certificateA, issued: null },
      issues: [expect.objectContaining({ code: "ISSUE_DATE_NOT_RECORDED", blocking: false })] }] });
    expect(await fingerprint(pools[0])).toBe(before);
  });
  it("sets invalid D3 dates aside and uses another certificate without writing a correction", async () => {
    await pools[0].query("UPDATE crew_training_courses SET expiry='not-a-date'");
    await insert(pools[0], schemas[0], "crew_training_courses", {
      train_uuid: randomUUID(), crew_uuid: ids.crew, course_id: "101",
      training_course: "Good replacement", certificate_no: "GOOD", issued: "2024-01-01",
      expiry: "2027-01-01", is_deleted: false });
    const before = await fingerprint(pools[0]);
    const result = await check();
    expect(result).toMatchObject({ status: "complete", courses: [{ state: "Valid",
      chosenCertificate: { number: "GOOD" } }] });
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "INVALID_CERTIFICATE_DATES",
      certificateUuid: ids.certificateA, blocking: false, message: "Certificate dates invalid: correct the record" }));
    expect(await fingerprint(pools[0])).toBe(before);
  });
  it("an unavailable captured rank never resolves through its label", async () => {
    await pools[0].query("UPDATE adm_available_ranks_v2 SET is_deleted=true");
    const result = await check();
    expect(result.status).toBe("incomplete");
    expect(result.issues.map(i => i.code)).toContain("MISSING_RANK");
  });
  it("a corrupted saved matrix is incomplete, not an empty valid matrix", async () => {
    await pools[0].query(`UPDATE adm_training_matrix_vessel_revisions_v2 SET revision_data='{"applicableTrainingIds":["101"]}'`);
    const result = await check();
    expect(result.status).toBe("incomplete");
    expect(result.issues.map(i => i.code)).toContain("INVALID_MATRIX");
  });
  it("a saved course that no longer exists makes the check incomplete", async () => {
    await pools[0].query("DELETE FROM adm_company_trainings_v2 WHERE id=101");
    const result = await check();
    expect(result.status).toBe("incomplete");
    expect(result.issues.map(i => i.code)).toContain("MATRIX_COURSE_UNAVAILABLE");
  });
  it("an unknown rank-cell value is incomplete rather than silently ignored", async () => {
    await pools[0].query("UPDATE adm_company_training_requirements_v2 SET status='unknown'");
    const result = await check();
    expect(result.status).toBe("incomplete");
    expect(result.issues.map(i => i.code)).toContain("INVALID_REQUIREMENT");
  });
});
