// Read-only preflight and exact two-write verification; never logs credentials.
import fs from "node:fs/promises";
import pg from "pg";
const out = "generated-artifacts/retention-band-label";
const migration = "0272_retention_all_officers_label.sql";
const before = process.argv.includes("--before");
await fs.mkdir(out, { recursive: true });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
try {
  await db.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const rows = (await db.query(`SELECT c.* FROM kpi_components c JOIN kpi_definitions k USING(kpi_uuid)
    WHERE k.code='retention' AND c.code='officers'`)).rows;
  if (rows.length !== 1 || rows[0].label !== (before ? "Officers" : "All Officers"))
    throw Error("Unexpected Retention officers component; stop before any migration.");
  const component = rows[0];
  const ledger = (await db.query("SELECT * FROM schema_migrations WHERE filename=$1", [migration])).rows;
  if (ledger.length !== (before ? 0 : 1)) throw Error("Unexpected migration ledger state.");
  const fingerprint = async (table, where = "", params = []) =>
    (await db.query(`SELECT count(*)::text AS count,
      md5(coalesce(string_agg(h,'' ORDER BY h),'')) AS fingerprint
      FROM (SELECT md5(to_jsonb(t)::text) AS h FROM public."${table.replaceAll('"','""')}" t ${where}) q`, params)).rows[0];
  const tables = {};
  for (const { tablename } of (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows)
    tables[tablename] = await fingerprint(tablename);
  const keptComponents = await fingerprint("kpi_components", "WHERE component_uuid<>$1", [component.component_uuid]);
  const keptMigrations = await fingerprint("schema_migrations", "WHERE filename<>$1", [migration]);
  const columns = (await db.query(`SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows;
  const constraints = (await db.query(`SELECT conrelid::regclass::text AS relation,conname,pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conrelid::regclass::text,conname`)).rows;
  const oldAuditCount = (await db.query(`SELECT count(*)::int AS n FROM adm_access_control_audit
    WHERE details->>'componentLabel'='Officers'`)).rows[0].n;
  await db.query("COMMIT");
  const snapshot = { component, tables, keptComponents, keptMigrations, columns, constraints, oldAuditCount };
  if (before) {
    await fs.writeFile(`${out}/before.json`, JSON.stringify(snapshot, null, 2), { flag: "wx" });
    console.log(JSON.stringify({ preflight: "passed", component, oldAuditCount, tables: Object.keys(tables).length, migrationNotApplied: true }));
  } else {
    const old = JSON.parse(await fs.readFile(`${out}/before.json`, "utf8"));
    const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
    const changes = Object.keys(tables).filter(t => !same(tables[t],old.tables[t]));
    if (!same(Object.keys(tables),Object.keys(old.tables)) ||
        changes.length !== 2 || changes.some(t => !["kpi_components","schema_migrations"].includes(t)) ||
        !same(component,{...old.component,label:"All Officers"}) ||
        !same(keptComponents,old.keptComponents) || !same(keptMigrations,old.tables.schema_migrations) ||
        !same(columns,old.columns) || !same(constraints,old.constraints) || oldAuditCount !== old.oldAuditCount)
      throw Error("Unexpected development change; inspect the retained before/after evidence.");
    await fs.writeFile(`${out}/after.json`, JSON.stringify({ ...snapshot, ledger, changes }, null, 2));
    console.log(JSON.stringify({ verified: true, changes, writes: ["One Retention officers catalogue label update","One migration ledger insert"], oldAuditCount, otherTablesUnchanged: Object.keys(tables).length-2 }));
  }
} finally { await db.end(); }
