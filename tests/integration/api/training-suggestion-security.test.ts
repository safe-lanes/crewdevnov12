import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { bootstrapMissingTestTables } from "../../helpers/private-schema";

vi.mock("@server/v2/db", async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  const context = new AsyncLocalStorage();
  return { getDb: () => {
    const db = context.getStore();
    if (!db) throw new Error("Missing isolated suggestion tenant");
    return db;
  }, suggestionTestContext: context };
});
const schemas = [`tn_a_${randomUUID().slice(0, 8)}`, `tn_b_${randomUUID().slice(0, 8)}`];
const root = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const pools: Pool[] = [];
const secret = "isolated-training-suggestion-test-signing-key";
const previous = { secret: process.env.JWT_SECRET, bypass: process.env.AUTH_BYPASS };
const vessel = randomUUID(), otherVessel = randomUUID(), crew = randomUUID(), assignment = randomUUID(),
  plan = randomUUID(), course = randomUUID(), suggestion = randomUUID();
let app: express.Express;
const users = { office: 986001, denied: 986002, ship: 986003, other: 986004 };
function call(actor: keyof typeof users, domain = "a") {
  return request(app).post(`/api/v2/training-needs/compliance/${suggestion}/confirm`).set("Authorization", `Bearer ${jwt.sign({
    id: users[actor], userType: ["ship", "other"].includes(actor) ? "Ship" : "Office", domain,
  }, secret)}`);
}
describe("training suggestions use real authentication, grants and tenant/vessel scope", () => {
  beforeAll(async () => {
    expect(process.env.TEST_DATABASE_VERIFIED).toBe("true");
    for (const schema of schemas) {
      await root.query(`CREATE SCHEMA "${schema}"`);
      await bootstrapMissingTestTables(root, schema);
      pools.push(new Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}` }));
    }
    const db = pools[0];
    await db.query("INSERT INTO master_vessels(id,vessel_uuid,vessel,is_active,is_deleted) VALUES(986001,$1,'TEST ONLY Own',true,false),(986002,$2,'TEST ONLY Other',true,false)", [vessel, otherVessel]);
    await db.query("INSERT INTO crew_members_v2(crew_uuid,emp_no,first_name,family_name) VALUES($1,$2,'TEST ONLY','Suggestion security')", [crew, crew]);
    await db.query("INSERT INTO crew_assignments(assign_uuid,crew_uuid,vessel_uuid,assignment_type,is_current) VALUES($1,$2,$3,'OnBoard',true)", [assignment, crew, vessel]);
    await db.query("INSERT INTO vessel_planning_v2(plan_uuid,vessel_uuid,rank_id,rank,reliever_crew_uuid,reliever_assign_uuid) VALUES($1,$2,'TEST','Fixture',$3,$4)", [plan, vessel, crew, assignment]);
    await db.query("INSERT INTO adm_training_master_v2(tm_uuid,training_id,training_name,category,training_group) VALUES($1,$2,'TEST ONLY Course','S','A')", [course, course]);
    await db.query(`INSERT INTO training_compliance_suggestions(suggestion_uuid,assign_uuid,plan_uuid,
      crew_uuid,vessel_uuid,course_uuid,status,gap) VALUES($1,$2,$3,$4,$5,$6,'SUGGESTED','{}')`,
    [suggestion, assignment, plan, crew, vessel, course]);
    const menus: string[] = [];
    for (const name of ["Training", "Vessel", "Crew Database"]) {
      const uuid = randomUUID(); menus.push(uuid);
      await db.query("INSERT INTO adm_menumaster_ac(muid,name,route,is_active,is_deleted) VALUES($1,$2,$3,true,false)", [uuid, name, `/fixture/${uuid}`]);
    }
    for (const [name, id] of Object.entries(users)) {
      const uuid = randomUUID(), ship = ["ship", "other"].includes(name);
      await db.query("INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,is_active,is_deleted) VALUES($1,$2,$3,true,false)",
        [uuid, `Training fixture ${name}`, ship ? "Ship" : "Office"]);
      await db.query("INSERT INTO master_users(id,role,user_type,vessel_ids) VALUES($1,$2,$3,$4)",
        [id, `Training fixture ${name}`, ship ? "Ship" : "Office", ship ? name === "other" ? "986002" : "986001" : null]);
      for (const menu of menus)
        await db.query("INSERT INTO adm_roleaccess_ac(rauid,role_id,menu_id,canview,cancreate,is_deleted) VALUES($1,$2,$3,true,$4,false)",
          [randomUUID(), uuid, menu, name !== "denied"]);
    }
    process.env.JWT_SECRET = secret; delete process.env.AUTH_BYPASS;
    const { suggestionTestContext } = await import("@server/v2/db") as any;
    const { authMiddleware } = await import("@server/middleware/authMiddleware");
    const { complianceSuggestionRoutes } = await import("@server/v2/training-needs/complianceSuggestionController");
    const { getOnboardTrainingCompliance } = await import("@server/v2/vessel/controllers/onboardTrainingComplianceController");
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      const domain = (jwt.decode(req.headers.authorization?.slice(7) ?? "") as any)?.domain ?? "a";
      const index = domain === "a" ? 0 : domain === "b" ? 1 : -1;
      if (index < 0) { res.sendStatus(403); return; }
      suggestionTestContext.run(drizzle(pools[index]), next);
    });
    app.use(authMiddleware); app.use("/api/v2/training-needs/compliance", complianceSuggestionRoutes);
    app.get("/api/v2/vessel/:vesselUuid/training-compliance", getOnboardTrainingCompliance);
  });
  afterAll(async () => {
    if (previous.secret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.secret;
    if (previous.bypass === undefined) delete process.env.AUTH_BYPASS; else process.env.AUTH_BYPASS = previous.bypass;
    await Promise.all(pools.map(pool => pool.end()));
    for (const schema of schemas) await root.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await root.end();
  });
  it("refuses unauthenticated requests", async () => {
    expect((await request(app).post(`/api/v2/training-needs/compliance/${suggestion}/confirm`).send({})).status).toBe(401);
  });
  it("onboard matrix requires a signed login and refuses browser date overrides", async () => {
    const url = `/api/v2/vessel/${vessel}/training-compliance`;
    expect((await request(app).get(url)).status).toBe(401);
    const bearer = jwt.sign({ id: users.office, userType: "Office", domain: "a" }, secret);
    expect((await request(app).get(`${url}?today=1990-01-01`).set("Authorization", `Bearer ${bearer}`)).status).toBe(400);
  });
  it("onboard matrix allows own vessel, refuses another vessel and another tenant", async () => {
    for (const [actor, domain, status] of [["ship", "a", 200], ["other", "a", 403], ["office", "b", 403]] as const) {
      const bearer = jwt.sign({ id: users[actor], userType: actor === "office" ? "Office" : "Ship", domain }, secret);
      const response = await request(app).get(`/api/v2/vessel/${vessel}/training-compliance`).set("Authorization", `Bearer ${bearer}`);
      expect(response.status).toBe(status);
      if (status === 200) expect(response.body.crew[0]).toMatchObject({ assignmentUuid: assignment, status: "incomplete" });
      else expect(JSON.stringify(response.body)).not.toContain("TEST ONLY");
    }
  });
  it("refuses a role with View but without Training Create", async () => {
    expect((await call("denied").send({})).status).toBe(403);
  });
  it("rejects browser-supplied audit identities", async () => {
    expect((await call("office").send({ auditUserUuid: "forged", actor: "forged" })).status).toBe(400);
  });
  it("refuses an identifier from another tenant", async () => {
    expect((await call("office", "b").send({})).status).toBe(403);
    // Tenant B has neither this role grant nor the suggestion.
    expect((await pools[1].query("SELECT * FROM training_compliance_suggestions")).rows).toHaveLength(0);
  });
  it("refuses another vessel with a plain message", async () => {
    const response = await call("other").send({});
    expect(response.status).toBe(403);
    expect(response.body.message).toContain("permission");
    expect(response.body).not.toHaveProperty("stack");
  });
  it("allows the own-vessel actor and records only the signed principal", async () => {
    const response = await call("ship").send({});
    expect(response.status).toBe(200);
    expect(response.body.confirmed_by).toBe(String(users.ship));
    const history = (await pools[0].query("SELECT * FROM training_compliance_suggestion_history WHERE suggestion_uuid=$1 ORDER BY id DESC", [suggestion])).rows[0];
    expect(history.actor).toBe(String(users.ship));
    expect(history.before_value.status).toBe("SUGGESTED");
    expect(history.after_value.status).toBe("CONFIRMED");
    expect(history.occurred_at).toBeTruthy();
  });
});
