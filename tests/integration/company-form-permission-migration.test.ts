import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const client = new Client({ connectionString: process.env.DATABASE_URL });
beforeAll(() => client.connect());
afterAll(() => client.end());
describe("Company Forms bootstrap and upgrade", () => {
  it.each([false, true])("seeds explicitly identified upgrade=%s without overwriting decisions", async upgrade => {
    const schema = `cf_permissions_${randomUUID().replaceAll("-", "")}`;
    await client.query("BEGIN");
    try {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`SET LOCAL search_path="${schema}"`);
      await client.query(`SELECT set_config('sail.permission_upgrade',$1,true)`, [String(upgrade)]);
      await client.query(`CREATE TABLE adm_rolemaster_ac(ruid text PRIMARY KEY,assigned_role text,roletype text,is_active boolean,is_deleted boolean);
        CREATE TABLE adm_menumaster_ac(muid text,name text,is_active boolean,is_deleted boolean);
        CREATE TABLE adm_roleaccess_ac(role_id text,menu_id text,canview boolean,cancreate boolean,canedit boolean,is_deleted boolean);
        INSERT INTO adm_rolemaster_ac VALUES ('office','Unlisted Office','Office',true,false),('create-only','Create only','Office',true,false),('ship','Unlisted Ship','Ship',true,false);
        INSERT INTO adm_menumaster_ac VALUES ('crew','Crew Database',true,false);
        INSERT INTO adm_roleaccess_ac VALUES ('office','crew',true,false,true,false),('create-only','crew',true,true,false,false);`);
      await client.query(await readFile("migrations/0233_resource_action_permissions.sql", "utf8"));
      const seed = await readFile("migrations/0234_company_form_permission_upgrade.sql", "utf8");
      await client.query(seed);
      const rows = (await client.query("SELECT role_id,action,allowed FROM adm_resource_action_grants")).rows;
      expect(rows).toHaveLength(18);
      expect(rows.filter(row => row.action === "void_completed").every(row => !row.allowed)).toBe(true);
      expect(rows.find(row => row.role_id === "office" && row.action === "fill_in").allowed).toBe(upgrade);
      expect(rows.find(row => row.role_id === "create-only" && row.action === "fill_in").allowed).toBe(false);
      expect(rows.find(row => row.role_id === "ship" && row.action === "witness").allowed).toBe(upgrade);
      expect(rows.find(row => row.role_id === "ship" && row.action === "void").allowed).toBe(false);
      await client.query("UPDATE adm_resource_action_grants SET allowed=true WHERE role_id='office' AND action='void_completed'");
      await client.query(seed);
      expect((await client.query("SELECT allowed FROM adm_resource_action_grants WHERE role_id='office' AND action='void_completed'")).rows[0].allowed).toBe(true);
      expect((await client.query("SELECT legacy_grants FROM adm_permission_upgrade_report WHERE role_id='create-only'")).rows[0].legacy_grants.create_without_edit).toBe(true);
      await client.query(await readFile("migrations/0235_preserve_company_grants_on_role_sync.sql", "utf8"));
      await client.query("CREATE TEMP TABLE saved_roles AS SELECT * FROM adm_rolemaster_ac");
      await client.query("TRUNCATE adm_rolemaster_ac CASCADE");
      expect((await client.query("SELECT count(*)::int AS count FROM adm_resource_action_grants")).rows[0].count).toBe(18);
      await client.query("INSERT INTO adm_rolemaster_ac SELECT * FROM saved_roles");
      await client.query(seed);
      expect((await client.query("SELECT allowed FROM adm_resource_action_grants WHERE role_id='office' AND action='void_completed'")).rows[0].allowed).toBe(true);
    } finally { await client.query("ROLLBACK"); }
  });
});
