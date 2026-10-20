import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { bootstrapMissingTestTables } from "../../helpers/private-schema";

vi.mock("@server/v2/db", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const context = new AsyncLocalStorage();
  return { getDb: () => {
    const db = context.getStore();
    if (!db) throw Error("Missing isolated training policy tenant");
    return db;
  }, matrixTestContext: context };
});
const control = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const schemas = [0, 1].map(() => `training_equiv_${randomUUID().replaceAll("-", "")}`);
const pools: Pool[] = [];
const secret = "training-equivalents-isolated-jwt";
const prior = { secret: process.env.JWT_SECRET, bypass: process.env.AUTH_BYPASS };
const vessel = randomUUID(), otherVessel = randomUUID();
const courses = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const users = { author: 990480001, viewer: 990480002, denied: 990480003 };
let app: express.Express;
function ident(s: string) {
  if (!/^[a-z][a-z0-9_]*$/.test(s)) throw Error("Unsafe test identifier");
  return `"${s}"`;
}
async function insert(db: Pool, schema: string, table: string, supplied: Record<string, any>) {
  const columns = (await db.query(`SELECT column_name,data_type FROM information_schema.columns
    WHERE table_schema=$1 AND table_name=$2 AND is_nullable='NO' AND column_default IS NULL AND is_identity='NO'`,
  [schema, table])).rows;
  const data = { ...supplied };
  for (const c of columns) if (!(c.column_name in data)) data[c.column_name] =
    ["integer", "bigint"].includes(c.data_type) ? 1 : c.data_type === "boolean" ? false
      : c.data_type.includes("timestamp") ? new Date() : randomUUID();
  const keys = Object.keys(data);
  await db.query(`INSERT INTO ${ident(table)} (${keys.map(ident).join(",")})
    VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(data));
}
function call(method: "get" | "put" | "post" | "patch", path: string, actor: keyof typeof users = "author", tenant = "a") {
  return request(app)[method](`/api/v2/admin/${path}`).set("Authorization",
    `Bearer ${jwt.sign({ id: users[actor], userType: "Office", domain: tenant }, secret, { expiresIn: "1h" })}`)
    .set("x-test-tenant", tenant);
}
const path = `training-matrix-equivalents/${vessel}`;
const pair = (a = 0, b = 1) => ({ requiredCourseUuid: courses[a], acceptedCourseUuid: courses[b] });
async function save(links: ReturnType<typeof pair>[], draftData?: { applicableTrainingIds: number[] }) {
  const current = (await call("get", path)).body;
  return call("put", path).send({ links,
    expectedDraftUuid: current.source.kind === "draft" ? current.source.uuid : null,
    expectedRevisionUuid: current.latestRevisionUuid, ...(draftData ? { draftData } : {}) });
}
beforeAll(async () => {
  expect(process.env.TEST_DATABASE_VERIFIED).toBe("true");
  const migration = await readFile("migrations/0260_training_matrix_equivalents.sql", "utf8");
  for (const schema of schemas) {
    await control.query(`CREATE SCHEMA ${ident(schema)}`);
    await bootstrapMissingTestTables(control, schema);
    const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` });
    pools.push(db);
    await db.query("DROP TABLE adm_training_matrix_equivalents_v2,adm_training_matrix_equivalent_events_v2");
    await db.query(migration);
    await db.query(migration); // idempotent on a namespace with real legacy table shapes
    await insert(db, schema, "master_vessels", { vessel_uuid: vessel, is_deleted: false });
    await insert(db, schema, "master_vessels", { vessel_uuid: otherVessel, is_deleted: false });
    for (let i = 0; i < courses.length; i++) {
      await insert(db, schema, "adm_training_master_v2", { id: i + 1, tm_uuid: courses[i],
        training_id: `TEST-TM-${i}`, training_name: `Synthetic training ${i}`, is_deleted: i === 3 });
      if (i < 3) await insert(db, schema, "adm_company_trainings_v2", {
        id: 101 + i, ct_uuid: randomUUID(), training_master_id: i + 1,
        company_id: "test", training_label: `Synthetic training ${i}`, is_deleted: false });
    }
    const menu = randomUUID();
    await insert(db, schema, "adm_menumaster_ac", { muid: menu, name: "Admin Training Matrix", is_active: true, is_deleted: false });
    for (const [name, id] of Object.entries(users)) {
      const role = randomUUID();
      await insert(db, schema, "adm_rolemaster_ac", { ruid: role, assigned_role: `Training ${name}`, roletype: "Office", is_active: true, is_deleted: false });
      await insert(db, schema, "master_users", { id, user_type: "Office", role: `Training ${name}` });
      await insert(db, schema, "adm_roleaccess_ac", { role_id: role, menu_id: menu,
        canview: name !== "denied", canedit: name === "author", candelete: false, cancreate: false, is_deleted: false });
    }
  }
  process.env.JWT_SECRET = secret;
  delete process.env.AUTH_BYPASS;
  const { matrixTestContext } = await import("@server/v2/db") as any;
  const { authMiddleware } = await import("@server/middleware/authMiddleware");
  const { default: routes } = await import("@server/v2/admin/routes");
  app = express();
  app.use(express.json());
  app.use((req, _res, next) => matrixTestContext.run(
    drizzle(pools[req.headers["x-test-tenant"] === "b" ? 1 : 0]), next));
  app.use(authMiddleware);
  app.use("/api/v2/admin", routes);
}, 60000);
afterAll(async () => {
  await Promise.all(pools.map(p => p.end()));
  for (const schema of schemas) await control.query(`DROP SCHEMA IF EXISTS ${ident(schema)} CASCADE`);
  await control.end();
  if (prior.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = prior.secret;
  if (prior.bypass === undefined) delete process.env.AUTH_BYPASS; else process.env.AUTH_BYPASS = prior.bypass;
});

describe("tenant-scoped, master-identifier training equivalents", () => {
  it("leaves legacy matrices direct-course-only and uses real signed JWT grants", async () => {
    expect((await pools[0].query("SHOW search_path")).rows[0].search_path).toBe(schemas[0]);
    expect((await call("get", path)).body).toMatchObject({ source: { kind: "none" }, links: [] });
    expect((await call("get", path, "denied")).status).toBe(403);
    expect((await call("put", path, "viewer").send({})).status).toBe(403);
    expect((await call("post", "training-matrix-vessel-drafts/upsert", "viewer").send({})).status).toBe(403);
    expect((await call("post", "training-matrix-vessel-revisions/submit", "viewer").send({})).status).toBe(403);
  });
  it("records only explicit directional links, never reverse or transitive edges, with server identity", async () => {
    const response = await save([pair(), pair(1, 2)], { applicableTrainingIds: [101, 102] });
    expect(response.status).toBe(200);
    expect(response.body.links).toHaveLength(2);
    expect(response.body.links).toEqual(expect.arrayContaining([pair(), pair(1, 2)]));
    expect(response.body.links).not.toContainEqual(pair(1, 0));
    expect(response.body.links).not.toContainEqual(pair(0, 2));
    const rawDraft = (await pools[0].query("SELECT draft_data FROM adm_training_matrix_vessel_drafts_v2 WHERE tmvd_uuid=$1",
      [response.body.source.uuid])).rows[0];
    expect(JSON.parse(rawDraft.draft_data)).toEqual({ applicableTrainingIds: [101, 102] });
    const audit = (await pools[0].query("SELECT actor_id,before_value,after_value FROM adm_training_matrix_equivalent_events_v2 ORDER BY recorded_at DESC LIMIT 1")).rows[0];
    expect(audit).toMatchObject({ actor_id: String(users.author), before_value: [] });
    expect(audit.after_value).toEqual([pair(), pair(1, 2)]);
    const body = { links: [], expectedDraftUuid: response.body.source.uuid, expectedRevisionUuid: null };
    expect((await call("put", path).send({ ...body, auditUserUuid: "spoofed" })).status).toBe(400);
    expect((await call("post", "training-matrix-vessel-drafts/upsert").send({
      vesselId: vessel, draftData: [], auditUserUuid: "spoofed" })).status).toBe(400);
  });
  it.each([
    ["self", [pair(0, 0)]], ["duplicate", [pair(), pair()]],
    ["deleted", [pair(0, 3)]], ["unknown", [{ ...pair(), acceptedCourseUuid: randomUUID() }]],
    ["unlinked required course", [{ ...pair(), requiredCourseUuid: randomUUID() }]],
  ])("refuses %s references without partial writes", async (_name, links) => {
    const before = (await call("get", path)).body.links;
    expect((await save(links as ReturnType<typeof pair>[])).status).toBe(400);
    expect((await call("get", path)).body.links).toEqual(before);
  });
  it("freezes independent revision rows and preserves them through ordinary Save Draft and a later revision", async () => {
    const first = await call("post", "training-matrix-vessel-revisions/submit").send({
      vesselId: vessel, revisionDate: "2026-10-20", revisionData: { applicableTrainingIds: [101, 102] } });
    expect(first.status).toBe(200);
    const revisionUuid = first.body.revision.tmvrUuid;
    const frozen = (await pools[0].query("SELECT * FROM adm_training_matrix_equivalents_v2 WHERE revision_uuid=$1 ORDER BY link_uuid", [revisionUuid])).rows;
    expect(frozen).toHaveLength(2);
    await expect(pools[0].query("UPDATE adm_training_matrix_equivalents_v2 SET accepted_course_label='changed' WHERE revision_uuid=$1", [revisionUuid])).rejects.toMatchObject({ code: "23514" });
    await expect(pools[0].query("DELETE FROM adm_training_matrix_equivalent_events_v2")).rejects.toMatchObject({ code: "23514" });
    expect((await call("put", path).send({ links: [], expectedDraftUuid: null, expectedRevisionUuid: revisionUuid, revisionUuid })).status).toBe(400);
    const draft = await call("post", "training-matrix-vessel-drafts/upsert").send({
      vesselId: vessel, draftData: { applicableTrainingIds: [101] } });
    expect(draft.status).toBe(200);
    expect((await call("get", path)).body.links).toHaveLength(2);
    const draftIds = (await pools[0].query("SELECT link_uuid FROM adm_training_matrix_equivalents_v2 WHERE draft_uuid=$1", [draft.body.tmvdUuid])).rows;
    expect(draftIds.every(r => !frozen.some(f => f.link_uuid === r.link_uuid))).toBe(true);
    expect((await save([pair(0, 2)])).status).toBe(200);
    const second = await call("post", "training-matrix-vessel-revisions/submit").send({
      vesselId: vessel, revisionDate: "2026-10-20", revisionData: { applicableTrainingIds: [101] } });
    expect(second.status).toBe(200);
    expect((await pools[0].query("SELECT * FROM adm_training_matrix_equivalents_v2 WHERE revision_uuid=$1 ORDER BY link_uuid", [revisionUuid])).rows).toEqual(frozen);
    expect((await call("get", `${path}?revisionUuid=${revisionUuid}`)).body.links).toHaveLength(2);
    expect((await call("get", path)).body.links).toEqual([pair(0, 2)]);
    expect((await call("get", `${path}?revisionUuid=${revisionUuid}`, "author", "b")).status).toBe(404);
    expect((await call("get", path, "author", "b")).body.links).toEqual([]);
  });
  it("refuses stale publication epochs and cross-vessel draft parents", async () => {
    expect((await call("put", path).send({ links: [], expectedDraftUuid: null, expectedRevisionUuid: null })).status).toBe(409);
    const draft = await save([pair()]);
    expect(draft.status).toBe(200);
    await expect(pools[0].query(`INSERT INTO adm_training_matrix_equivalents_v2
      (link_uuid,vessel_uuid,draft_uuid,required_course_uuid,accepted_course_uuid,required_course_label,accepted_course_label,recorded_by)
      VALUES($1,$2,$3,$4,$5,'A','B','test')`,
    [randomUUID(), otherVessel, draft.body.source.uuid, courses[1], courses[2]])).rejects.toMatchObject({ code: "23503" });
  });
  it("also freezes links through the legacy create-revision entry point", async () => {
    const created = await call("post", "training-matrix-vessel-revisions").send({
      vesselId: vessel, revision: "R2", revisionDate: "2026-10-20",
      revisionData: { applicableTrainingIds: [101] } });
    expect(created.status).toBe(200);
    expect((await call("get", `${path}?revisionUuid=${created.body.tmvrUuid}`)).body.links).toEqual([pair()]);
  });
});
