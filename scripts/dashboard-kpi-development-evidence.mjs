// Read-only before/after evidence: no credentials or row contents are emitted.
import fs from "node:fs/promises";
import pg from "pg";
import { execFileSync } from "node:child_process";
const out = "generated-artifacts/dashboard-kpis";
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
  const constraints = (await db.query(`SELECT conrelid::regclass::text AS relation,conname,pg_get_constraintdef(oid) AS definition
    FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conrelid::regclass::text,conname`)).rows;
  await db.query("COMMIT");
  const snapshot = { tables, columns, constraints };
  const before = `${out}/development-before.json`;
  const mode = process.argv.includes("--before") ? "before" : "after";
  if (mode === "before") {
    // Refuse accidental replacement of this run's baseline.
    await fs.writeFile(before, JSON.stringify(snapshot, null, 2), { flag: "wx" });
  } else {
    const original = JSON.parse(await fs.readFile(before, "utf8"));
    await fs.writeFile(`${out}/development-after.json`, JSON.stringify(snapshot, null, 2));
    if (JSON.stringify(original) !== JSON.stringify(snapshot)) {
      const changed = [...new Set([...Object.keys(original.tables), ...Object.keys(tables)])]
        .filter(t => JSON.stringify(tables[t]) !== JSON.stringify(original.tables[t]));
      throw Error(`Development evidence changed: tables=${changed.join(",")}; columns=${JSON.stringify(columns) !== JSON.stringify(original.columns)}; constraints=${JSON.stringify(constraints) !== JSON.stringify(original.constraints)}`);
    }
  }
  console.log(JSON.stringify({ mode, tables: Object.keys(tables).length, unchanged: mode === "after",
    head: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), capturedAt: new Date().toISOString() }));
} finally { await db.end(); }
