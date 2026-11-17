import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Request } from "express";
const holder = vi.hoisted(() => ({ db: null as any }));
vi.mock("@server/v2/db", () => ({ getDb: () => holder.db }));
import { kpiTargetAuthority, readKpiCatalogue, readKpiTargets, saveKpiTargets } from "@server/v2/admin/services/kpiTargets";
import { writeCombinedRoleGrants } from "@server/v2/admin/services/accessControlWrites";
import { emptyCompanyFormGrants } from "../../shared/v2/admin/companyFormPermissions";
import { presentAccessAudit } from "../../shared/v2/admin/accessAuditPresentation";
import { requirePermission } from "../../server/middleware/requirePermission";
import { readDashboardKpis } from "../../server/v2/admin/services/dashboardKpis";

const schema = `test_kpi_${randomUUID().replaceAll("-", "")}`;
const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}`, max: 6 });
const retention = "74360000-0000-4000-8000-000000000011";
const officers = "74360000-0000-4000-8000-000000000012";
const alcohol = "74360000-0000-4000-8000-000000000021";
const targetRequest = (values: Record<string, string | null>, revision = 0, code = "retention", year = 2026, id = 1) =>
  ({ user: { id, userType: "Office" }, params: { code, year: String(year) }, body: { revision, values } }) as unknown as Request;
const req = (id = 1) => targetRequest({}, 0, "retention", 2026, id);
const read = (code = "retention", year = 2026) => readKpiTargets(req(), code, year);
const audit = async () => (await pool.query("SELECT * FROM adm_access_control_audit ORDER BY id")).rows;
beforeAll(async () => { holder.db = drizzle(pool); });
afterAll(async () => { await pool.end(); await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); });
beforeEach(async () => {
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE; CREATE SCHEMA ${schema}`);
  // Base identity fixtures only; new KPI constraints/triggers are installed from
  // the REAL migration, not LIKE copies (which omit FKs and triggers).
  for (const table of ["master_users", "adm_rolemaster_ac", "adm_menumaster_ac", "adm_roleaccess_ac", "adm_access_control_audit", "adm_access_control_state"])
    await pool.query(`CREATE TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
  await pool.query(await readFile("migrations/0233_resource_action_permissions.sql", "utf8"));
  await pool.query(await readFile("migrations/0270_kpi_targets.sql", "utf8"));
  await pool.query(await readFile("migrations/0271_kpi_permission.sql", "utf8"));
  await pool.query(`INSERT INTO adm_permission_actions VALUES ('access_control','manage','Access Control management',1),
    ('training_compliance','override','Override deployment block',1),
    ('company_forms','override_checklist','Override checklist',7);
    INSERT INTO adm_access_control_state(singleton,category_ready) VALUES(true,false);
    INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,parent_owned)
      VALUES ('editor','Crewing Coordinator','Office',true),('manager','Access Manager','Office',true),('viewer','KPI Reader','Office',true);
    INSERT INTO master_users(id,role,user_type,fullname)
      VALUES(1,'Crewing Coordinator','Office','Original Editor'),(2,'Access Manager','Office','Grant Manager'),(3,'KPI Reader','Office','Read Only');
    INSERT INTO adm_menumaster_ac(muid,name,route) VALUES('admin','Admin','/admin'),('kpimenu','KPIs','/admin/kpis');
    INSERT INTO adm_roleaccess_ac(rauid,role_id,menu_id,canview)
      SELECT gen_random_uuid()::text,ruid,'kpimenu',true FROM adm_rolemaster_ac;
    INSERT INTO adm_resource_action_grants(role_id,resource,action,allowed)
      VALUES('editor','kpi_targets','set',true),('manager','access_control','manage',true);`);
});
describe("Annual KPI targets — isolated database with real constraints", () => {
  it("Dashboard-only viewers read the minimal company projection without settings or action grants", async () => {
    await saveKpiTargets(targetRequest({ [retention]: "90.000001", [officers]: "85" }));
    await saveKpiTargets(targetRequest({ [alcohol]: "0" }, 0, "alcohol_violations"));
    await pool.query(`INSERT INTO adm_menumaster_ac(muid,name,route) VALUES('dashboard','Dashboard','/dashboard');
      DELETE FROM adm_roleaccess_ac WHERE role_id='viewer';
      INSERT INTO adm_roleaccess_ac(rauid,role_id,menu_id,canview) VALUES('dashboard-view','viewer','dashboard',true)`);
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() }, next = vi.fn();
    await requirePermission("Dashboard", "view")(req(3), response as any, next);
    expect(next).toHaveBeenCalledOnce();
    expect(await kpiTargetAuthority(req(3))).toBe(false);
    const result = await readDashboardKpis(2026);
    expect(Object.keys(result).sort()).toEqual(["kpis", "scope", "year"]);
    expect(result).toMatchObject({ year: 2026, scope: "company" });
    expect(result.kpis[0]).toEqual({ code: "retention", direction: "minimum", unit: "percentage",
      components: [{ code: "senior_officers", value: "90.000001" }, { code: "officers", value: "85" }, { code: "ratings", value: null }] });
    expect(result.kpis[1].components[0].value).toBe("0");
    expect((await readDashboardKpis(2027)).kpis.every(k => k.components.every(c => c.value === null))).toBe(true);
    for (const kpi of result.kpis) expect(Object.keys(kpi).sort()).toEqual(["code", "components", "direction", "unit"]);
    await pool.query("UPDATE adm_roleaccess_ac SET canview=false WHERE role_id='viewer'");
    next.mockClear();
    await requirePermission("Dashboard", "view")(req(3), response as any, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    await requirePermission("Dashboard", "view")(req(999999), response as any, next);
    expect(next).not.toHaveBeenCalled();
  });
  it("has exactly three KPIs and five components with explicit definitions, no target or event", async () => {
    const catalogue = await readKpiCatalogue();
    expect(catalogue.map(k => [k.code, k.direction, k.unit, k.components.length])).toEqual([
      ["retention", "minimum", "percentage", 3], ["alcohol_violations", "maximum", "count", 1],
      ["drug_violations", "maximum", "count", 1],
    ]);
    expect(catalogue.every(k => k.calculationKey && k.calculationVersion && k.periodBasis)).toBe(true);
    expect((await read()).values[retention]).toBeNull();
    expect((await read()).lastChanged).toBeNull();
  });
  it("saves a partial retention target without filling other components", async () => {
    const result = await saveKpiTargets(targetRequest({ [retention]: "96.50" }));
    expect(result.values[retention]).toBe("96.5");
    expect(result.values[officers]).toBeNull();
    expect(result.revision).toBe(1);
    expect((await read()).values).toEqual(result.values);
  });
  it("clears back to no row and keeps the audit-derived last change", async () => {
    await saveKpiTargets(targetRequest({ [retention]: "95" }));
    const result = await saveKpiTargets(targetRequest({ [retention]: null }, 1));
    expect(result.values[retention]).toBeNull();
    expect((await pool.query("SELECT * FROM kpi_target_values")).rowCount).toBe(0);
    expect(result.lastChanged?.name).toBe("Original Editor");
    expect((await audit()).at(-1)).toMatchObject({ before_value: "95", after_value: null });
  });
  it("persists zero distinctly from missing, including the count KPI", async () => {
    const saved = await saveKpiTargets(targetRequest({ [alcohol]: "0" }, 0, "alcohol_violations"));
    expect(saved.values[alcohol]).toBe("0");
    expect((await read("alcohol_violations")).values[alcohol]).toBe("0");
    expect((await pool.query("SELECT target_value::text FROM kpi_target_values")).rows[0].target_value).toBe("0");
  });
  it("does not audit or bump revision for identical, format-only or repeated empty saves", async () => {
    await saveKpiTargets(targetRequest({ [retention]: null }));
    expect(await audit()).toHaveLength(0);
    expect((await pool.query("SELECT * FROM kpi_target_years")).rowCount).toBe(0);
    const initial = await saveKpiTargets(targetRequest({ [retention]: "2.00" }));
    const unchanged = await saveKpiTargets(targetRequest({ [retention]: "02.0" }, 1));
    expect(unchanged.revision).toBe(initial.revision);
    expect(unchanged.lastChanged).toEqual(initial.lastChanged);
    expect(await audit()).toHaveLength(1);
  });
  it("default-off permission refuses viewer and Access Control manager without target grant", async () => {
    for (const id of [2, 3]) {
      expect(await kpiTargetAuthority(req(id))).toBe(false);
      await expect(saveKpiTargets(targetRequest({ [retention]: "95" }, 0, "retention", 2026, id))).rejects.toThrow("permission to set");
    }
    expect(await audit()).toHaveLength(0);
  });
  it("ordinary target editor does not need Access Control management", async () => {
    expect((await pool.query("SELECT * FROM adm_resource_action_grants WHERE role_id='editor' AND resource='access_control'")).rowCount).toBe(0);
    expect((await saveKpiTargets(targetRequest({ [retention]: "95" }))).lastChanged?.name).toBe("Original Editor");
    expect((await read()).canSetTargets).toBe(true);
  });
  it("requires menu View inside the write transaction, not merely the action", async () => {
    await pool.query("UPDATE adm_roleaccess_ac SET canview=false WHERE role_id='editor'");
    await expect(saveKpiTargets(targetRequest({ [retention]: "95" }))).rejects.toThrow("permission to view");
  });
  it("freezes actor, labels, unit, direction and time; summary survives current-name changes", async () => {
    const saved = await saveKpiTargets(targetRequest({ [retention]: "95" }));
    const [event] = await audit();
    expect(event).toMatchObject({ actor_display_name: "Original Editor", actor: { masterUserId: 1 }, before_value: null, after_value: "95",
      details: { kpiLabel: "Retention Rate", componentLabel: "Senior Officers", direction: "minimum", unit: "percentage", year: 2026, scope: "company" } });
    expect(event.recorded_at).toBeInstanceOf(Date);
    await pool.query("UPDATE master_users SET fullname='Renamed editor' WHERE id=1; UPDATE kpi_definitions SET label='New label',direction='maximum',unit='score' WHERE code='retention'");
    expect((await read()).lastChanged).toEqual(saved.lastChanged);
    expect(presentAccessAudit((await audit())[0]).sentence).toContain("Retention Rate — Senior Officers target from not set to 95% (minimum)");
    expect(presentAccessAudit(event).unmapped).toEqual([]);
  });
  it("selects last change across components but not other KPI/years, including removal", async () => {
    await saveKpiTargets(targetRequest({ [retention]: "95" }));
    await saveKpiTargets(targetRequest({ [officers]: "96" }, 1));
    await saveKpiTargets(targetRequest({ [alcohol]: "2" }, 0, "alcohol_violations", 2027));
    expect((await read("retention", 2027)).lastChanged).toBeNull();
    expect((await read("alcohol_violations", 2026)).lastChanged).toBeNull();
    await saveKpiTargets(targetRequest({ [retention]: null }, 2));
    expect((await audit()).at(-1).details.componentUuid).toBe(retention);
    expect((await read()).lastChanged?.name).toBe("Original Editor");
    expect(Object.keys((await read()).lastChanged!)).toEqual(["name", "recordedAt"]);
  });
  it("renames only the officers catalogue label, preserving targets and frozen historical audit labels", async () => {
    await saveKpiTargets(targetRequest({ [officers]: "95" }));
    const component = (await pool.query("SELECT * FROM kpi_components WHERE component_uuid=$1", [officers])).rows[0];
    const targets = (await pool.query("SELECT * FROM kpi_target_values ORDER BY component_uuid")).rows;
    const [oldEvent] = await audit();
    expect(oldEvent.details.componentLabel).toBe("Officers");
    const migration = await readFile("migrations/0272_retention_all_officers_label.sql", "utf8");
    await pool.query(migration);
    await pool.query(migration); // Idempotent replay cannot rewrite audit or targets.
    expect((await pool.query("SELECT * FROM kpi_components WHERE component_uuid=$1", [officers])).rows[0])
      .toEqual({ ...component, label: "All Officers" });
    expect((await pool.query("SELECT * FROM kpi_target_values ORDER BY component_uuid")).rows).toEqual(targets);
    expect(await audit()).toEqual([oldEvent]);
    expect(presentAccessAudit(oldEvent).sentence).toContain("Retention Rate — Officers target");
    await saveKpiTargets(targetRequest({ [officers]: "96" }, 1));
    const events = await audit();
    expect(events[0]).toEqual(oldEvent);
    expect(events[1].details.componentLabel).toBe("All Officers");
    expect(presentAccessAudit(events[1]).sentence).toContain("Retention Rate — All Officers target from 95% to 96%");
    expect((await readKpiCatalogue()).find(k => k.code === "retention")!.components.find(c => c.code === "officers")!.label)
      .toBe("All Officers");
  });
  it("rejects browser identity/time/authority and unknown scope fields", async () => {
    for (const key of ["actor", "actorName", "auditUserUuid", "recordedAt", "tenantId", "scope", "allowed"]) {
      const request = targetRequest({ [retention]: "95" });
      request.body[key] = "forged";
      await expect(saveKpiTargets(request)).rejects.toThrow("recorded by the server");
    }
    expect(await audit()).toHaveLength(0);
  });
  it.each(["-1", "101", "NaN", "Infinity", "1e2", "2.1234567"])("refuses invalid percentage %s", async value => {
    await expect(saveKpiTargets(targetRequest({ [retention]: value }))).rejects.toThrow();
  });
  it("rejects fractional counts and foreign components", async () => {
    await expect(saveKpiTargets(targetRequest({ [alcohol]: "0.5" }, 0, "alcohol_violations"))).rejects.toThrow("whole-number");
    await expect(saveKpiTargets(targetRequest({ [alcohol]: "2" }))).rejects.toThrow("does not belong");
  });
  it("keeps years independent and refuses stale concurrent saves", async () => {
    await saveKpiTargets(targetRequest({ [retention]: "90" }));
    await saveKpiTargets(targetRequest({ [retention]: "91" }, 0, "retention", 2027));
    expect((await read()).values[retention]).toBe("90");
    const results = await Promise.allSettled([saveKpiTargets(targetRequest({ [retention]: "92" }, 1)), saveKpiTargets(targetRequest({ [retention]: "93" }, 1))]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
  });
  it("rolls back targets and revision when audit insertion fails", async () => {
    await pool.query(`CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable'; END $$;
      CREATE TRIGGER reject_kpi_audit BEFORE INSERT ON adm_access_control_audit FOR EACH ROW EXECUTE FUNCTION reject_audit()`);
    await expect(saveKpiTargets(targetRequest({ [retention]: "95" }))).rejects.toThrow("audit unavailable");
    expect((await pool.query("SELECT * FROM kpi_target_years")).rowCount).toBe(0);
    expect((await pool.query("SELECT * FROM kpi_target_values")).rowCount).toBe(0);
  });
  it("real migration FKs and unit trigger reject direct-insert bypasses", async () => {
    const year = (await pool.query("INSERT INTO kpi_target_years(kpi_uuid,year,created_by,updated_by) VALUES('74360000-0000-4000-8000-000000000001',2026,'1','1') RETURNING *")).rows[0];
    for (const value of ["101", "-1", "NaN"]) await expect(pool.query("INSERT INTO kpi_target_values VALUES($1,$2,$3,$4)",
      [year.target_year_uuid, retention, year.kpi_uuid, value])).rejects.toThrow();
    await expect(pool.query("INSERT INTO kpi_target_values VALUES($1,$2,$3,2)", [year.target_year_uuid, alcohol, year.kpi_uuid])).rejects.toThrow();
    await expect(pool.query("INSERT INTO kpi_target_years(kpi_uuid,year,scope,created_by,updated_by) VALUES($1,2027,'vessel','1','1')", [year.kpi_uuid])).rejects.toThrow();
    await pool.query("INSERT INTO kpi_target_values VALUES($1,$2,$3,0)", [year.target_year_uuid, retention, year.kpi_uuid]);
    const countYear = (await pool.query("INSERT INTO kpi_target_years(kpi_uuid,year,created_by,updated_by) VALUES('74360000-0000-4000-8000-000000000002',2026,'1','1') RETURNING *")).rows[0];
    await expect(pool.query("INSERT INTO kpi_target_values VALUES($1,$2,$3,0.5)", [countYear.target_year_uuid, alcohol, countYear.kpi_uuid])).rejects.toThrow();
  });
  it("includes permission and audit in atomic role saves; omitted old-client field preserves it", async () => {
    const request = req(2);
    request.body = { permissions: [], companyFormGrants: emptyCompanyFormGrants(), trainingComplianceAllowed: false, kpiTargetsAllowed: true };
    await writeCombinedRoleGrants(request, "viewer");
    expect(await kpiTargetAuthority(req(3))).toBe(true);
    expect((await audit()).find(e => e.resource === "kpi_targets")).toMatchObject({ role_id: "viewer", action: "set", after_value: true, actor_display_name: "Grant Manager" });
    delete request.body.kpiTargetsAllowed;
    await writeCombinedRoleGrants(request, "viewer");
    expect(await kpiTargetAuthority(req(3))).toBe(true);
    await pool.query("UPDATE adm_rolemaster_ac SET parent_owned=false WHERE ruid='viewer'");
    request.body = { ...request.body, permissions: [{ menuId: "kpimenu", canview: false, cancreate: false, canedit: false, candelete: false }], kpiTargetsAllowed: false };
    await expect(writeCombinedRoleGrants(request, "viewer")).rejects.toThrow();
    expect((await pool.query("SELECT canview FROM adm_roleaccess_ac WHERE role_id='viewer'")).rows[0].canview).toBe(true);
    expect(await kpiTargetAuthority(req(3))).toBe(true);
  });
  it("menu read guard denies an identity from a different tenant or without the view grant", async () => {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await requirePermission("KPIs", "view")({ user: { id: 999999, userType: "Office" } } as any, response as any, next);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it("isolates targets and last-change summaries between two resolved tenant contexts", async () => {
    // Two schemas model distinct getDb() resolutions inside the sole allowed
    // test database. No extra database or search_path fallback is permitted.
    await saveKpiTargets(targetRequest({ [retention]: "95" }));
    const other = `${schema}_other`;
    const otherPool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${other}` });
    try {
      await admin.query(`CREATE SCHEMA ${other}`);
      for (const table of ["master_users", "adm_rolemaster_ac", "adm_menumaster_ac", "adm_roleaccess_ac",
        "adm_resource_action_grants", "adm_access_control_audit", "kpi_definitions", "kpi_components",
        "kpi_target_years", "kpi_target_values"]) {
        await admin.query(`CREATE TABLE ${other}.${table} (LIKE ${schema}.${table} INCLUDING ALL)`);
        if (!["adm_access_control_audit", "kpi_target_years", "kpi_target_values"].includes(table))
          await admin.query(`INSERT INTO ${other}.${table} SELECT * FROM ${schema}.${table}`);
      }
      holder.db = drizzle(otherPool);
      expect((await readDashboardKpis(2026)).kpis[0].components[0].value).toBeNull();
      expect((await read()).values[retention]).toBeNull();
      expect((await read()).lastChanged).toBeNull();
      await saveKpiTargets(targetRequest({ [retention]: "81" }));
      expect((await read()).values[retention]).toBe("81");
      holder.db = drizzle(pool);
      expect((await readDashboardKpis(2026)).kpis[0].components[0].value).toBe("95");
      expect((await read()).values[retention]).toBe("95");
      expect(await audit()).toHaveLength(1);
    } finally {
      holder.db = drizzle(pool);
      await otherPool.end();
      await admin.query(`DROP SCHEMA IF EXISTS ${other} CASCADE`);
    }
  });
});
