import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { bootstrapMissingTestTables } from "../../helpers/private-schema";
import { crewAttachmentOwners, type AttachmentOwner } from "@server/v2/shared/attachmentAccess";

// Only the connection provider is substituted. Authorization, signed-JWT
// verification, role/grant lookup, ownership joins and handlers are real.
vi.mock("@server/v2/db", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const context = new AsyncLocalStorage();
  return { getDb: () => {
    const db = context.getStore();
    if (!db) throw new Error("Missing isolated attachment test tenant");
    return db;
  }, attachmentTestContext: context };
});

const secret = "isolated-attachment-security-test-key";
const schemas = [`att_a_${randomUUID().replaceAll("-", "")}`, `att_b_${randomUUID().replaceAll("-", "")}`];
const control = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const pools: Pool[] = [];
const prior = { secret: process.env.JWT_SECRET, bypass: process.env.AUTH_BYPASS };
let app: express.Express;
const crew = randomUUID(), vessel = randomUUID(), otherVessel = randomUUID();
const users = { office: 880001, ship: 880002, other: 880003, denied: 880004 };
type Case = { name: string; path: string; owner: AttachmentOwner; attachment: string; parent: string };
const cases: Case[] = [];
const ident = (s: string) => {
  if (!/^[a-z][a-z0-9_]*$/.test(s)) throw new Error("Invalid test identifier");
  return `"${s}"`;
};

async function insert(table: string, supplied: Record<string, unknown>) {
  const columns = (await pools[0].query(`SELECT column_name,data_type FROM information_schema.columns
    WHERE table_schema=$1 AND table_name=$2 AND is_nullable='NO' AND column_default IS NULL
      AND is_identity='NO'`, [schemas[0], table])).rows;
  const data = { ...supplied };
  for (const col of columns) if (!(col.column_name in data)) {
    data[col.column_name] = ["integer", "bigint"].includes(col.data_type) ? 1
      : col.data_type === "boolean" ? false : col.data_type.includes("timestamp") ? new Date()
      : col.data_type === "date" ? "2026-10-20" : randomUUID();
  }
  const keys = Object.keys(data);
  await pools[0].query(`INSERT INTO ${ident(table)} (${keys.map(ident).join(",")})
    VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")})`, Object.values(data));
}
async function addCase(name: string, path: string, owner: AttachmentOwner) {
  const parent = randomUUID(), attachment = randomUUID();
  await insert(owner.parent, { [owner.parentKey]: parent, crew_uuid: crew });
  await insert(owner.table, { att_uuid: attachment, [owner.key]: parent,
    file_name: "evidence.pdf", file_type: "application/pdf",
    file_data: "data:application/pdf;base64,JVBERi0xLjQKJSVFT0Y=" });
  cases.push({ name, path: path.replace(":att", attachment), owner, attachment, parent });
}
function call(path: string, actor: keyof typeof users = "office", domain = "a") {
  const token = jwt.sign({ id: users[actor], userType: actor === "office" || actor === "denied" ? "Office" : "Ship",
    domain, vessels: [vessel] }, secret, { expiresIn: "1h" });
  return request(app).get(path).set("Authorization", `Bearer ${token}`);
}

beforeAll(async () => {
  expect(process.env.TEST_DATABASE_VERIFIED).toBe("true");
  for (const schema of schemas) {
    await control.query(`CREATE SCHEMA ${ident(schema)}`);
    await bootstrapMissingTestTables(control, schema);
    pools.push(new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` }));
  }
  await insert("crew_members_v2", { crew_uuid: crew, first_name: "Synthetic", family_name: "Attachment Evidence" });
  await insert("master_vessels", { id: 880001, vessel_uuid: vessel, vessel: "TEST ONLY Attachment Own", is_active: true, is_deleted: false });
  await insert("master_vessels", { id: 880002, vessel_uuid: otherVessel, vessel: "TEST ONLY Attachment Other", is_active: true, is_deleted: false });
  await insert("crew_assignments", { assign_uuid: randomUUID(), crew_uuid: crew, vessel_uuid: vessel,
    is_current: true, assignment_type: "OnBoard", sign_on_date: "2026-10-01" });
  const menu = randomUUID();
  await insert("adm_menumaster_ac", { muid: menu, name: "Crew Database", is_active: true, is_deleted: false });
  for (const [name, id] of Object.entries(users)) {
    const role = randomUUID(), ship = name === "ship" || name === "other";
    await insert("adm_rolemaster_ac", { ruid: role, assigned_role: `Attachment ${name}`, roletype: ship ? "Ship" : "Office", is_active: true, is_deleted: false });
    await insert("master_users", { id, user_type: ship ? "Ship" : "Office", role: `Attachment ${name}`,
      vessel_ids: ship ? (name === "ship" ? "880001" : "880002") : null });
    await insert("adm_roleaccess_ac", { role_id: role, menu_id: menu, canview: name !== "denied", is_deleted: false });
  }
  for (const [name, owner] of Object.entries(crewAttachmentOwners)) {
    await addCase(name, `/api/v2/crew-pool/${["briefing", "debriefing"].includes(name)
      ? `${name}-attachments/:att/raw` : `${name}/attachments/:att/raw`}`, owner);
  }
  process.env.JWT_SECRET = secret;
  delete process.env.AUTH_BYPASS;
  const { attachmentTestContext } = await import("@server/v2/db") as any;
  const { authMiddleware } = await import("@server/middleware/authMiddleware");
  const { default: crewRoutes } = await import("@server/v2/crew-pool/routes");
  app = express();
  // Select separate real database schemas as tenants; no connection can fall
  // through to public. The production auth middleware still verifies each JWT.
  app.use((req, res, next) => {
    const token = req.headers.authorization?.slice(7);
    const domain = token ? (jwt.decode(token) as any)?.domain : "a";
    const index = domain === "a" ? 0 : domain === "b" ? 1 : -1;
    if (index < 0) { res.sendStatus(403); return; }
    attachmentTestContext.run(drizzle(pools[index]), next);
  });
  app.use(authMiddleware);
  app.use("/api/v2/crew-pool", crewRoutes);
}, 120000);

afterAll(async () => {
  for (const pool of pools) await pool.end();
  for (const schema of schemas) await control.query(`DROP SCHEMA IF EXISTS ${ident(schema)} CASCADE`);
  await control.end();
  if (prior.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = prior.secret;
  if (prior.bypass === undefined) delete process.env.AUTH_BYPASS; else process.env.AUTH_BYPASS = prior.bypass;
});

describe.each(Object.entries(crewAttachmentOwners))("crew attachment %s", (name, owner) => {
  const fixture = () => cases.find(c => c.name === name)!;
  it("allows authenticated office and own-vessel users to read actual bytes", async () => {
    for (const actor of ["office", "ship"] as const) {
      const response = await call(fixture().path, actor);
      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("application/pdf");
      expect(response.body.length).toBeGreaterThan(0);
    }
  });
  it("refuses other vessel, other tenant, missing grant, no JWT and forged JWT", async () => {
    expect((await call(fixture().path, "other")).status).toBe(403);
    expect((await call(fixture().path, "office", "b")).status).toBeGreaterThanOrEqual(400);
    expect((await call(fixture().path, "denied")).status).toBe(403);
    expect((await request(app).get(fixture().path)).status).toBe(401);
    const forged = jwt.sign({ id: users.office, domain: "a", userType: "Office" }, "wrong-key");
    expect((await request(app).get(fixture().path).set("Authorization", `Bearer ${forged}`)).status).toBe(401);
  });
  it("refuses deleted attachment, deleted parent, deleted crew and orphaned parent", async () => {
    const f = fixture();
    for (const [table, key, value] of [[owner.table, "att_uuid", f.attachment],
      [owner.parent, owner.parentKey, f.parent], ["crew_members_v2", "crew_uuid", crew]]) {
      await pools[0].query(`UPDATE ${ident(table)} SET is_deleted=true WHERE ${ident(key)}=$1`, [value]);
      try { expect((await call(f.path)).status).toBe(404); }
      finally { await pools[0].query(`UPDATE ${ident(table)} SET is_deleted=false WHERE ${ident(key)}=$1`, [value]); }
    }
    await pools[0].query(`UPDATE ${ident(owner.table)} SET ${ident(owner.key)}=$1 WHERE att_uuid=$2`, [randomUUID(), f.attachment]);
    try { expect((await call(f.path)).status).toBe(404); }
    finally { await pools[0].query(`UPDATE ${ident(owner.table)} SET ${ident(owner.key)}=$1 WHERE att_uuid=$2`, [f.parent, f.attachment]); }
  });
});
