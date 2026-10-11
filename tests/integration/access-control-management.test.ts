import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Request } from "express";
import { hasCompanyFormPermission } from "../../shared/v2/admin/companyFormPermissions";
const holder = vi.hoisted(() => ({ db: null as any }));
vi.mock("@server/v2/db", () => ({ getDb: () => holder.db }));
import { accessControlAuthority, appendAudit, lockAccessControl, managedWrite, managementSnapshot,
  saveActionDecisions } from "@server/v2/admin/services/accessControlManagement";
import { roleSyncTransition, parentSyncActor } from "@server/v2/admin/services/accessControlParentSync";
import { writeCatalogue, writeMenuGrants } from "@server/v2/admin/services/accessControlWrites";
import { accessControlController } from "@server/v2/admin/controllers/accessControlController";
import { actionPermissionsController } from "@server/v2/admin/controllers/actionPermissionsController";
import { MastersRepository } from "@server/v2/masters/repositories/mastersRepository";

const schema = `test_ac_${randomUUID().replaceAll("-", "")}`;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 6 });
const adminPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const source = { masterUserId: 1, userType: "Office", source: "trusted_parent_sync:fixture.invalid" };
const req = (id = 1, body: unknown = {}): Request => ({ user: { id, userType: "Office" }, body, params: {} }) as Request;
const management = (id: number, role: string, allowed: boolean) => saveActionDecisions(req(id), role, "access_control", { manage: allowed });
const authority = (id = 1) => accessControlAuthority(req(id));
const snapshotRows = (exclude: string[] = [], overrides: Record<string, any> = {}) =>
  [["admin", "Admin"], ["support", "Sail Admin"], ["super", "Super Admin"], ["ordinary", "Crewing Coordinator"], ["target", "Documentation Reviewer"]]
    .filter(([id]) => !exclude.includes(id))
    .map(([ruid, role]) => ({ ruid, role, roletype: "Office", isActive: true, ...overrides[ruid] }));
const sync = (rows: any[]) => new MastersRepository().syncMasterData("roles", rows, source);
async function audit() { return (await pool.query("SELECT * FROM adm_access_control_audit ORDER BY id")).rows; }
async function response(fn: any, request: Request) {
  const res: any = { statusCode: 200, data: null, status(n: number) { this.statusCode = n; return this; }, json(data: any) { this.data = data; return this; } };
  await fn(request, res); return res;
}
beforeAll(async () => { await adminPool.query(`CREATE SCHEMA ${schema}`); holder.db = drizzle(pool); });
afterAll(async () => { await pool.end(); await adminPool.query(`DROP SCHEMA ${schema} CASCADE`); await adminPool.end(); });
beforeEach(async () => {
  // All data is isolated in a newly created test-only schema; never alter the tenant's mirror.
  await adminPool.query(`DROP SCHEMA ${schema} CASCADE; CREATE SCHEMA ${schema}`);
  await pool.query(`CREATE TABLE master_users(id serial PRIMARY KEY,user_uuid text,user_type text,role text,
      firstname text,lastname text,email text,fullname text,designation text,department text,display_name text,
      vessel_ids varchar(255),synched_at timestamptz DEFAULT now());
    CREATE TABLE adm_rolemaster_ac(id serial PRIMARY KEY,ruid text UNIQUE NOT NULL,assigned_role text NOT NULL,
      roletype text NOT NULL,is_active boolean DEFAULT true,is_deleted boolean DEFAULT false,
      orderby integer,sort_order integer DEFAULT 0,is_sync boolean DEFAULT false,
      created_at timestamp DEFAULT now(),updated_at timestamp DEFAULT now(),created_by_uuid text,updated_by_uuid text);
    CREATE TABLE adm_menumaster_ac(id serial PRIMARY KEY,muid text UNIQUE NOT NULL,name text UNIQUE NOT NULL,
      display_name text,route text UNIQUE NOT NULL,parent_menu text,is_active boolean DEFAULT true,sort_order integer DEFAULT 0,
      is_deleted boolean DEFAULT false,is_sync boolean DEFAULT false,created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),created_by_uuid text,updated_by_uuid text);
    CREATE TABLE adm_roleaccess_ac(id serial PRIMARY KEY,rauid text UNIQUE NOT NULL,role_id text NOT NULL,
      menu_id text NOT NULL,canview boolean NOT NULL DEFAULT false,cancreate boolean NOT NULL DEFAULT false,
      canedit boolean NOT NULL DEFAULT false,candelete boolean NOT NULL DEFAULT false,sort_order integer DEFAULT 0,
      is_deleted boolean DEFAULT false,is_sync boolean DEFAULT false,created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),created_by_uuid text,updated_by_uuid text);`);
  await pool.query(await readFile("migrations/0233_resource_action_permissions.sql", "utf8"));
  await pool.query(await readFile("migrations/0235_preserve_company_grants_on_role_sync.sql", "utf8"));
  await pool.query(await readFile("migrations/0236_access_control_management.sql", "utf8"));
  const rows = snapshotRows();
  for (let i = 0; i < rows.length; i++) {
    await pool.query("INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,parent_owned) VALUES ($1,$2,$3,true)", [rows[i].ruid, rows[i].role, rows[i].roletype]);
    await pool.query("INSERT INTO master_users(id,user_uuid,role,user_type) VALUES ($1,$2,$3,'Office')", [i + 1, `user-${i + 1}`, rows[i].role]);
  }
  await pool.query("INSERT INTO adm_menumaster_ac(muid,name,route) VALUES ('crew','Crew Database','/crew'),('admin-menu','Admin','/admin')");
});
describe("Access Control real database authority, audit and parent synchronization", () => {
  it("fresh bootstrap uses exactly the original normalized whitelist", async () => {
    for (const id of [1, 2, 3]) expect((await authority(id)).mode).toBe("name_bootstrap");
    expect((await authority(4)).allowed).toBe(false);
    expect((await authority(500)).allowed).toBe(false);
    await pool.query("UPDATE adm_rolemaster_ac SET assigned_role='  aDmIn  ' WHERE ruid='admin'; UPDATE master_users SET role=' admin ' WHERE id=1");
    expect((await authority()).allowed).toBe(true);
  });
  it("ordinary UUID-keyed manager can grant Company Forms View without other permissions", async () => {
    await management(1, "ordinary", true);
    expect((await authority(4)).mode).toBe("management");
    await saveActionDecisions(req(4), "target", "company_forms", { view: true });
    expect((await pool.query("SELECT count(*)::int AS n FROM adm_roleaccess_ac WHERE role_id='ordinary'")).rows[0].n).toBe(0);
    const records = await audit();
    expect(records[1]).toMatchObject({ role_id: "target", resource: "company_forms", action: "view",
      before_value: null, after_value: true, actor: { masterUserId: 4, roleId: "ordinary", roleName: "Crewing Coordinator" } });
  });
  it("client-only bootstrap immediately disables all ungranted whitelisted roles", async () => {
    await management(2, "ordinary", true);
    for (const id of [1, 2, 3]) expect((await authority(id)).allowed).toBe(false);
    await expect(management(2, "support", true)).rejects.toThrow("permission");
  });
  it("support can self-grant first, grant the client, then revoke its own non-last grant", async () => {
    await management(2, "support", true);
    await management(2, "ordinary", true);
    await management(2, "support", false);
    expect((await authority(2)).allowed).toBe(false);
    expect((await audit()).map(r => [r.role_id, r.before_value, r.after_value]))
      .toEqual([["support", null, true], ["ordinary", null, true], ["support", true, false]]);
  });
  it("support's last management grant cannot be revoked via name fallback", async () => {
    await management(2, "support", true);
    await expect(management(2, "support", false)).rejects.toThrow("last eligible");
    expect((await authority(2)).mode).toBe("management");
    expect(await audit()).toHaveLength(1);
  });
  it.each(["delete", "update"] as const)("refuses last-manager role %s atomically", async operation => {
    await management(1, "ordinary", true);
    await expect(writeCatalogue(req(4, operation === "update" ? { isActive: false } : {}), "role", operation, "ordinary"))
      .rejects.toThrow("last eligible");
    expect((await authority(4)).allowed).toBe(true);
    expect(await audit()).toHaveLength(1);
  });
  it("refuses a sole manager's self-rename that strands its persisted trusted user", async () => {
    await management(1, "ordinary", true);
    await expect(writeCatalogue(req(4, { assignedRole: "Unresolvable new title" }), "role", "update", "ordinary"))
      .rejects.toThrow("last eligible");
    expect((await authority(4)).mode).toBe("management");
    expect((await pool.query("SELECT assigned_role FROM adm_rolemaster_ac WHERE ruid='ordinary'")).rows[0].assigned_role).toBe("Crewing Coordinator");
    expect(await audit()).toHaveLength(1);
  });
  it.each(["delete", "deactivate", "rename", "duplicate"] as const)("refuses zero-manager loss of the final trusted named recovery role by %s", async operation => {
    await pool.query("UPDATE adm_rolemaster_ac SET is_active=false WHERE ruid IN ('support','super')");
    const body = operation === "deactivate" ? { isActive: false } : operation === "rename" ? { assignedRole: "No named recovery" } :
      operation === "duplicate" ? { assignedRole: "Admin" } : {};
    await expect(writeCatalogue(req(1, body), "role", operation === "delete" ? "delete" : operation === "duplicate" ? "create" : "update", "admin"))
      .rejects.toThrow("last valid trusted");
    expect((await authority()).mode).toBe("name_bootstrap");
    expect(await audit()).toHaveLength(0);
  });
  it("refuses removal of the final explicit-category recovery principal at zero managers", async () => {
    await sync(snapshotRows([], { support: { roletype: "SAIL Admin" } }));
    const prior = await audit();
    await expect(writeCatalogue(req(2), "role", "delete", "support")).rejects.toThrow("last valid trusted");
    expect((await authority(2)).mode).toBe("category_recovery");
    expect(await audit()).toHaveLength(prior.length);
  });
  it("allows a role rename when another resolvable manager remains, without changing grants", async () => {
    await management(1, "support", true);
    await management(2, "ordinary", true);
    await writeCatalogue(req(4, { assignedRole: "Waiting for parent user mapping" }), "role", "update", "ordinary");
    expect((await authority(2)).eligibleManagerCount).toBe(1);
    expect((await authority(4)).allowed).toBe(false);
    expect((await pool.query("SELECT allowed FROM adm_resource_action_grants WHERE role_id='ordinary' AND resource='access_control'")).rows[0].allowed).toBe(true);
  });
  it("does not disable recovery by counting a stored grant with no trusted user as an eligible manager", async () => {
    await pool.query("DELETE FROM master_users WHERE id=4");
    await management(1, "ordinary", true);
    expect((await authority()).mode).toBe("name_bootstrap");
    expect((await authority()).eligibleManagerCount).toBe(0);
  });
  it("unknown, inactive, ambiguous and non-parent roles cannot manage", async () => {
    await management(1, "ordinary", true);
    await pool.query("UPDATE adm_rolemaster_ac SET is_active=false WHERE ruid='ordinary'");
    expect((await authority(4)).allowed).toBe(false);
    await pool.query("UPDATE adm_rolemaster_ac SET is_active=true,parent_owned=false WHERE ruid='ordinary'");
    expect((await authority(4)).allowed).toBe(false);
    await pool.query("UPDATE adm_rolemaster_ac SET parent_owned=true WHERE ruid='ordinary'; INSERT INTO adm_rolemaster_ac(ruid,assigned_role,roletype,parent_owned) VALUES ('duplicate','Crewing Coordinator','Office',true)");
    expect((await authority(4)).allowed).toBe(false);
    expect((await managementSnapshot(holder.db)).eligibleManagerCount).toBe(0);
  });
  it("parent category replaces names permanently, but explicit other-category managers remain authorized", async () => {
    await sync(snapshotRows([], { support: { roletype: "SAIL ADMIN" } }));
    expect((await authority(1)).allowed).toBe(false);
    expect((await authority(2)).mode).toBe("category_recovery");
    await management(2, "ordinary", true);
    expect((await authority(4)).mode).toBe("management");
    expect((await authority(2)).allowed).toBe(false);
    await sync(snapshotRows(["ordinary"], { support: { roletype: "SAIL ADMIN" } }));
    expect((await authority(2)).mode).toBe("category_recovery");
    await sync(snapshotRows([], { support: { roletype: "SAIL ADMIN" } }));
    expect((await authority(4)).mode).toBe("management");
    await sync(snapshotRows([], { support: { isActive: false } }));
    expect((await authority(1)).allowed).toBe(false);
    expect((await authority(4)).categoryReady).toBe(true);
  });
  it("does not infer category readiness from a role name or local category edit", async () => {
    expect((await authority(2)).categoryReady).toBe(false);
    await expect(writeCatalogue(req(1, { roletype: "SAIL Admin" }), "role", "update", "support")).rejects.toThrow("server-owned");
    expect((await authority(1)).categoryReady).toBe(false);
  });
  it.each(["roletype", "roleType", "category", "parentOwned", "isSync", "auditUserUuid", "actor", "identity", "createdByUuid", "updatedAt", "authority", "categoryReady"])("rejects spoofed role metadata %s", async key => {
    await expect(writeCatalogue(req(1, { assignedRole: "New role", [key]: { id: 999, category: "SAIL Admin" } }), "role", "create"))
      .rejects.toThrow("server-owned");
    expect(await audit()).toHaveLength(0);
  });
  it("local role creation cannot fabricate a parent category/support identity", async () => {
    const role = await writeCatalogue(req(1, { assignedRole: "Sail Admin local" }), "role", "create");
    expect(role).toMatchObject({ roletype: "Unclassified", parentOwned: false });
    await expect(management(1, role.ruid, true)).rejects.toThrow("parent role");
  });
  it.each([{ auditUserUuid: "attacker" }, { actor: { id: 1 } }, { grants: { actor: { id: 1 } } }])("rejects top/nested spoofed Company Forms identity %j", async spoof => {
    const grants = { view: true, fill_in: false, witness: false, sign_representative: false, void: false, void_completed: false };
    const request = req(1, { grants, ...spoof }); request.params = { ruid: "target" };
    const res = await response(actionPermissionsController.save, request);
    expect(res.statusCode).toBe(400);
    expect(await audit()).toHaveLength(0);
  });
  it("rejects management audit/category flags rather than ignoring them", async () => {
    const request = req(1, { allowed: true, categoryReady: true, auditUserUuid: "spoof" }); request.params = { ruid: "ordinary" };
    expect((await response(accessControlController.saveManagement, request)).statusCode).toBe(400);
  });
  it("menu CRUD audit is atomic, exact and no-op aware", async () => {
    const flags = { menuId: "crew", canview: true, cancreate: false, canedit: false, candelete: false };
    await writeMenuGrants(req(1, { permissions: [flags] }), "target");
    expect(await audit()).toHaveLength(4);
    await writeMenuGrants(req(1, { permissions: [flags] }), "target");
    expect(await audit()).toHaveLength(4);
    await writeMenuGrants(req(1, { permissions: [{ ...flags, canview: false }] }), "target");
    expect((await audit()).at(-1)).toMatchObject({ action: "view", before_value: true, after_value: false, actor: { masterUserId: 1 } });
    await expect(writeMenuGrants(req(1, { permissions: [{ ...flags, canview: true }, { ...flags, menuId: "missing" }] }), "target")).rejects.toThrow("Menu not found");
    expect(await audit()).toHaveLength(5);
    expect((await pool.query("SELECT canview FROM adm_roleaccess_ac WHERE role_id='target'")).rows[0].canview).toBe(false);
  });
  it("action no-op saves do not create false changes, missing and false remain distinct", async () => {
    await management(1, "target", false);
    await management(1, "target", false);
    expect(await audit()).toHaveLength(1);
    expect((await audit())[0]).toMatchObject({ before_value: null, after_value: false });
  });
  it("a failed audit insert rolls back the successful-looking grant write", async () => {
    await pool.query(`CREATE FUNCTION fail_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$;
      CREATE TRIGGER fail_test_audit BEFORE INSERT ON adm_access_control_audit FOR EACH ROW EXECUTE FUNCTION fail_test_audit()`);
    await expect(management(1, "ordinary", true)).rejects.toThrow("test audit failure");
    expect((await managementSnapshot(holder.db)).eligibleManagerCount).toBe(0);
    expect(await audit()).toHaveLength(0);
  });
  it("audit storage rejects update, delete and truncate", async () => {
    await management(1, "ordinary", true);
    for (const statement of ["UPDATE adm_access_control_audit SET action='spoof'", "DELETE FROM adm_access_control_audit", "TRUNCATE adm_access_control_audit"])
      await expect(pool.query(statement)).rejects.toThrow("append-only");
  });
  it("audit API exposes Management, Void completed and parent-sync events by UUID", async () => {
    await management(1, "ordinary", true);
    await saveActionDecisions(req(4), "target", "company_forms", { void_completed: true });
    await sync(snapshotRows(["ordinary"]));
    const request = req(2); request.query = { filter: "parent_sync" };
    const records = (await response(accessControlController.audit, request)).data;
    expect(records).toEqual(expect.arrayContaining([expect.objectContaining({ event: "parent_sync_management_eligibility", role_id: "ordinary" })]));
    request.query = { filter: "void_completed", roleId: "target" };
    expect((await response(accessControlController.audit, request)).data).toHaveLength(1);
  });
  it.each(["removal", "deactivation"])("completed parent %s of last manager retains grant and activates trusted recovery", async mode => {
    await management(1, "ordinary", true);
    await sync(mode === "removal" ? snapshotRows(["ordinary"]) : snapshotRows([], { ordinary: { isActive: false } }));
    expect((await authority(4)).allowed).toBe(false);
    expect((await authority(2)).mode).toBe("name_bootstrap");
    expect((await pool.query("SELECT allowed FROM adm_resource_action_grants WHERE role_id='ordinary'")).rows[0].allowed).toBe(true);
    expect((await audit()).at(-1)).toMatchObject({ event: "parent_sync_management_eligibility", role_id: "ordinary",
      before_value: { eligible: true, storedManagementDecision: true }, after_value: { eligible: false, storedManagementDecision: true },
      details: { eligibleHolderCountBefore: 1, eligibleHolderCountAfter: 0, recoveryActive: true, recoveryRoute: "interim_names" },
      actor: { source: source.source, masterUserId: 1 } });
  });
  it("unchanged refresh causes no false loss and grants/history survive rename by UUID", async () => {
    await management(1, "ordinary", true);
    await sync(snapshotRows());
    expect(await audit()).toHaveLength(1);
    const renamed = snapshotRows([], { ordinary: { role: "Fleet Permissions Lead" } });
    await new MastersRepository().syncIdentitySnapshot(renamed.map((row, index) =>
      ({ id: index + 1, uuid: `user-${index + 1}`, userType: "Office", role: row.role })), renamed, source);
    expect((await authority(4)).allowed).toBe(true);
    expect((await audit())[0].role_id).toBe("ordinary");
    expect(await audit()).toHaveLength(1);
  });
  it("rejects an unrecoverable parent snapshot atomically, visibly preserving roles/grants/readiness", async () => {
    await management(1, "ordinary", true);
    await expect(sync(snapshotRows(["ordinary", "admin", "super", "support"]))).rejects.toThrow("PARENT SYNC REJECTED");
    expect((await authority(4)).allowed).toBe(true);
    expect((await audit()).at(-1)).toMatchObject({ event: "parent_sync_rejected", details: { existingStatePreserved: true } });
    // A support-category role with no trusted master user is not a valid recovery principal.
    await expect(sync([{ ruid: "new-support", role: "Unknown upstream support", roletype: "SAIL Admin" }])).rejects.toThrow("PARENT SYNC REJECTED");
    expect((await authority(4)).categoryReady).toBe(false);
  });
  it("retains locally created roles, their menu grants and unrelated audit history across parent replacement", async () => {
    const local = await writeCatalogue(req(1, { assignedRole: "Local training observer" }), "role", "create");
    await writeMenuGrants(req(1, { permissions: [{ menuId: "crew", canview: true, cancreate: false, canedit: false, candelete: false }] }), local.ruid);
    await sync(snapshotRows());
    const row = (await pool.query("SELECT * FROM adm_rolemaster_ac WHERE ruid=$1", [local.ruid])).rows[0];
    expect(row).toMatchObject({ parent_owned: false, is_deleted: false, assigned_role: "Local training observer" });
    expect((await pool.query("SELECT canview FROM adm_roleaccess_ac WHERE role_id=$1", [local.ruid])).rows[0].canview).toBe(true);
    expect(await audit()).toHaveLength(4);
  });
  it("rejects a parent user mapping change that orphans every manager and recovery principal", async () => {
    await management(1, "ordinary", true);
    const users = snapshotRows().map((row, index) => ({ id: index + 1, uuid: `user-${index + 1}`, userType: "Office", role: "Unmatched upstream identity" }));
    await expect(new MastersRepository().syncIdentitySnapshot(users, snapshotRows(), source)).rejects.toThrow("PARENT SYNC REJECTED");
    expect((await authority(4)).mode).toBe("management");
    expect((await audit()).at(-1)).toMatchObject({ event: "parent_sync_rejected", details: { existingStatePreserved: true } });
  });
  it("category readiness never reverts when a later snapshot eliminates support", async () => {
    await sync(snapshotRows([], { support: { roletype: "SAIL Admin" } }));
    await management(2, "ordinary", true);
    await sync(snapshotRows(["support"]));
    expect((await authority(4)).categoryReady).toBe(true);
    await expect(sync(snapshotRows(["support", "ordinary"]))).rejects.toThrow("PARENT SYNC REJECTED");
    expect((await authority(1)).allowed).toBe(false);
  });
  it("failed database replacement preserves state and records rejection, not successful loss", async () => {
    await management(1, "ordinary", true);
    await expect(roleSyncTransition(holder.db, source, async tx => {
      await tx.execute(sql`UPDATE adm_rolemaster_ac SET is_deleted=true`);
      throw Error("fixture replacement failed");
    })).rejects.toThrow("fixture replacement failed");
    expect((await authority(4)).allowed).toBe(true);
    expect((await audit()).map(r => r.event)).toEqual(["grant_change", "parent_sync_rejected"]);
  });
  it("rejects user-plus-role snapshots that would remove all recovery principals, rolling back both mappings and roles", async () => {
    await management(1, "ordinary", true);
    const users = snapshotRows().map((row, index) => ({ id: index + 1, uuid: `user-${index + 1}`,
      userType: "Office", role: index < 3 ? "No surviving support role" : row.role }));
    await expect(new MastersRepository().syncIdentitySnapshot(users, snapshotRows(["ordinary"]), source)).rejects.toThrow("PARENT SYNC REJECTED");
    expect((await authority(4)).allowed).toBe(true);
    expect((await pool.query("SELECT role FROM master_users WHERE id=1")).rows[0].role).toBe("Admin");
    expect((await audit()).at(-1)).toMatchObject({ event: "parent_sync_rejected", details: { existingStatePreserved: true } });
  });
  it("commits user renames and parent role renames together while preserving UUID authority", async () => {
    await management(1, "ordinary", true);
    const rows = snapshotRows([], { ordinary: { role: "Identity Snapshot Manager" } });
    const users = rows.map((row, index) => ({ id: index + 1, uuid: `user-${index + 1}`, userType: "Office", role: row.role }));
    await new MastersRepository().syncIdentitySnapshot(users, rows, source);
    expect((await authority(4)).mode).toBe("management");
    expect(await audit()).toHaveLength(1);
  });
  it("two concurrent self-revocations of different managers cannot remove the last manager", async () => {
    await management(1, "admin", true);
    await management(1, "ordinary", true);
    const results = await Promise.allSettled([management(1, "admin", false), management(4, "ordinary", false)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await managementSnapshot(holder.db)).eligibleManagerCount).toBe(1);
  });
  it("revoked editor queued behind the serialization lock cannot write", async () => {
    await management(1, "admin", true); await management(1, "ordinary", true);
    let release!: () => void, entered!: () => void;
    const ready = new Promise<void>(r => { entered = r; });
    const block = new Promise<void>(r => { release = r; });
    const revocation = managedWrite(req(1), async (tx, actor) => {
      await tx.execute(sql`UPDATE adm_resource_action_grants SET allowed=false WHERE role_id='ordinary' AND resource='access_control'`);
      await appendAudit(tx, actor, "grant_change", "ordinary", "access_control", "manage", true, false);
      entered(); await block;
    });
    await ready;
    const queued = management(4, "target", true);
    release(); await revocation;
    await expect(queued).rejects.toThrow("permission");
    expect((await audit()).filter(r => r.role_id === "target")).toHaveLength(0);
  });
  it("incomplete parent replacement cannot expose fallback, and queued removed editors fail closed", async () => {
    await management(1, "ordinary", true);
    let release!: () => void, entered!: () => void;
    const ready = new Promise<void>(r => { entered = r; }), block = new Promise<void>(r => { release = r; });
    const replacing = roleSyncTransition(holder.db, source, async tx => {
      await tx.execute(sql`UPDATE adm_rolemaster_ac SET is_deleted=true`);
      entered(); await block;
      await tx.execute(sql`UPDATE adm_rolemaster_ac SET is_deleted=false WHERE ruid IN ('admin','support','super','target')`);
    });
    await ready;
    let authoritySettled = false;
    const pendingAuthority = authority(2).then(value => { authoritySettled = true; return value; });
    const queuedWrite = management(4, "target", true);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(authoritySettled).toBe(false);
    release(); await replacing;
    expect((await pendingAuthority).mode).toBe("name_bootstrap");
    await expect(queuedWrite).rejects.toThrow("permission");
    expect((await managementSnapshot(holder.db)).eligibleManagerCount).toBe(0);
  });
  it("concurrent sync and revocation evaluate complete committed states", async () => {
    await management(1, "admin", true); await management(1, "ordinary", true);
    const results = await Promise.allSettled([management(4, "ordinary", false), sync(snapshotRows(["admin"]))]);
    expect(results[1].status).toBe("fulfilled");
    const state = await managementSnapshot(holder.db);
    expect(state.eligibleManagerCount).toBeGreaterThanOrEqual(0);
    if (state.eligibleManagerCount === 0) expect((await authority(2)).mode).toBe("name_bootstrap");
    else expect((await authority(4)).mode).toBe("management");
  });
  it("sync audit identity comes from authenticated master user and configured host", async () => {
    const request = req(1, { auditUserUuid: "spoof", actor: { id: 99 } });
    expect(await parentSyncActor(request, "parent.example")).toEqual({ masterUserId: 1, userType: "Office", source: "trusted_parent_sync:parent.example" });
    await expect(parentSyncActor({ ...request, user: { id: 1, userType: "Ship" } } as Request, "parent.example")).rejects.toThrow("identity mismatch");
    await expect(new MastersRepository().syncMasterData("roles", snapshotRows())).rejects.toThrow("source required");
  });
  it("Company Forms categories remain independent from management and names", async () => {
    for (const action of ["fill_in", "witness", "sign_representative", "void", "void_completed"] as const)
      expect(hasCompanyFormPermission({ [action]: true }, "SAIL Admin", action)).toBe(false);
    expect(hasCompanyFormPermission({ sign_representative: true }, "Ship", "sign_representative")).toBe(false);
    expect(hasCompanyFormPermission({ view: true }, "Unclassified", "view")).toBe(false);
    expect(hasCompanyFormPermission({ view: true }, "SAIL Admin", "view")).toBe(true);
  });
});
