// Read-only counts/content fingerprints. Never logs connection strings or row data.
import fs from "node:fs/promises";
import pg from "pg";
import { execFileSync } from "node:child_process";
const out = "generated-artifacts/kpi-settings";
await fs.mkdir(out, { recursive: true });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const tables = {};
  for (const { tablename } of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows) {
    const name = `"${tablename.replaceAll('"', '""')}"`;
    tables[tablename] = (await db.query(`SELECT count(*)::text AS count,
      md5(coalesce(string_agg(h,'' ORDER BY h),'')) AS fingerprint
      FROM (SELECT md5(to_jsonb(t)::text) AS h FROM public.${name} t) q`)).rows[0];
  }
  const columns = (await db.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows;
  const menus = (await db.query(`SELECT muid,name,route,parent_menu,sort_order,is_deleted
    FROM adm_menumaster_ac WHERE lower(name) IN ('admin','approval workflow','kpis') ORDER BY name`)).rows;
  const snapshot = { capturedAt: new Date().toISOString(), head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), tables, columns, menus };
  await db.query("COMMIT");
  const beforePath = `${out}/before.json`;
  if (process.argv.includes("--before")) {
    if (Object.keys(tables).some(t => t.startsWith("kpi_"))) throw Error("KPI tables already exist; investigate before migration.");
    await fs.writeFile(beforePath, JSON.stringify(snapshot, null, 2));
    console.log(JSON.stringify({ tables: Object.keys(tables).length, menus, head: snapshot.head, capturedAt: snapshot.capturedAt }));
  } else {
    const before = JSON.parse(await fs.readFile(beforePath, "utf8"));
    const changes = Object.entries(tables).filter(([t, v]) => JSON.stringify(v) !== JSON.stringify(before.tables[t])).map(([table, after]) => ({ table, before: before.tables[table] ?? null, after }));
    const removed = Object.keys(before.tables).filter(t => !tables[t]);
    await fs.writeFile(`${out}/after.json`, JSON.stringify({ ...snapshot, changes, removed }, null, 2));
    console.log(JSON.stringify({ changes, removed }, null, 2));
    const allowed = new Set(["kpi_definitions", "kpi_components", "kpi_target_years", "kpi_target_values", "adm_menumaster_ac", "schema_migrations"]);
    if (removed.length || changes.some(c => !allowed.has(c.table))) throw Error("Unexpected development changes; inspect fingerprints.");
  }
} finally { await db.end(); }
