// Read-only evidence. Never prints connection strings or row contents.
import pg from "pg";
import fs from "node:fs/promises";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const identity = (await client.query(`SELECT current_database() AS database,
    (pg_control_system()).system_identifier::text AS cluster,
    (SELECT oid::text FROM pg_database WHERE datname=current_database()) AS oid`)).rows[0];
  const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  const fingerprints = {};
  for (const { tablename } of tables) {
    if (!/^[a-z0-9_]+$/.test(tablename)) throw new Error("Unsafe table");
    fingerprints[tablename] = (await client.query(`SELECT count(*)::int AS count,
      md5(coalesce(string_agg(row_hash,'' ORDER BY row_hash),'')) AS hash
      FROM (SELECT md5(row_to_json(t)::text) AS row_hash FROM public."${tablename}" t) s`)).rows[0];
  }
  await client.query("COMMIT");
  const out = process.argv[2];
  if (!out?.startsWith("generated-artifacts/")) throw new Error("Use ignored evidence directory");
  await fs.mkdir(out.slice(0,out.lastIndexOf("/")), { recursive:true });
  await fs.writeFile(out,JSON.stringify({identity,fingerprints},null,2));
  console.log(`Captured ${tables.length} table fingerprints without row contents`);
} finally { client.release(); await pool.end(); }
