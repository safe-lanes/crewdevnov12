import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { randomUUID, createHash } from "node:crypto";
vi.mock("@server/v2/db", () => ({ getDb: vi.fn() }));
import { getDb } from "@server/v2/db";
import { calculateRelieverTrainingCompliance } from "@server/v2/shared/training-compliance/service";

const tables = ["crew_members_v2", "crew_assignments", "vessel_planning_v2", "master_vessels",
  "crew_assignment_rule_context", "adm_available_ranks_v2", "adm_training_master_v2",
  "adm_company_trainings_v2", "adm_company_training_requirements_v2",
  "adm_training_matrix_vessel_revisions_v2", "adm_training_matrix_equivalents_v2",
  "adm_training_matrix_vessel_drafts_v2", "crew_training_courses"];
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
    await add("vessel_planning_v2", { plan_uuid: ids.plan, vessel_uuid: ids.vessel, rank_id: randomUUID(),
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
