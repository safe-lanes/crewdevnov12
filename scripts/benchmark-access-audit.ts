// Run with npx tsx scripts/benchmark-access-audit.ts. All changes roll back
// within a private schema in the independently registered test database.
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { prepareTestEnvironment } from "./test-database-guard.mjs";

async function main() {
  await prepareTestEnvironment();
  const { readAccessAuditPage } = await import("../server/v2/admin/services/accessAuditRead");
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  const schema = `audit_bench_${randomUUID().replaceAll("-", "")}`;
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA ${schema}; SET LOCAL search_path=${schema}`);
    for (const table of ["adm_access_control_audit", "adm_rolemaster_ac", "adm_menumaster_ac", "master_users"]) {
      await client.query(`CREATE TABLE ${table} (LIKE public.${table} INCLUDING ALL)`);
      await client.query(`INSERT INTO ${table} SELECT * FROM public.${table} ${
        table === "adm_access_control_audit" ? "WHERE id <= 14816" : ""}`);
    }
    await client.query(await readFile("migrations/0275_access_audit_search.sql", "utf8"));
    await client.query(await readFile(process.argv[2] ?? "migrations/0276_access_audit_menu_search_parts.sql", "utf8"));
    const testRole = (await client.query("SELECT affected_role_name FROM adm_access_control_audit WHERE id=14811")).rows[0]?.affected_role_name;
    if (!testRole) throw Error("Original benchmark fixture no longer exists. Restore the isolated benchmark snapshot.");
    const db = drizzle(client);
    async function measure(table: string, search: string, mode: string) {
      const samples: number[] = [];
      let matches = 0, returned = 0;
      for (let attempt = 0; attempt < 5; attempt++) {
        const t = performance.now();
        const result = await readAccessAuditPage({ query: { page: "1", search } } as unknown as Request, db);
        samples.push(Math.round(performance.now() - t));
        matches = result.total;
        returned = result.items.length;
      }
      console.log(JSON.stringify({ table, mode, matches, returned, samplesMs: samples,
        medianMs: [...samples].sort((a,b) => a-b)[2], maxMs: Math.max(...samples) }));
    }
    async function measureAll() {
      await client.query("ANALYZE");
      const { total, frozen, menuParts } = (await client.query(`SELECT count(*)::int AS total,
        (SELECT count(*)::int FROM adm_access_control_audit_search WHERE sentence_folded IS NOT NULL) AS frozen,
        (SELECT count(*)::int FROM adm_access_control_audit_search WHERE menu_id IS NOT NULL) AS "menuParts"
        FROM adm_access_control_audit`)).rows[0];
      console.log(JSON.stringify({ total, frozen, menuParts, liveFallback: total - frozen - menuParts }));
      await measure(String(total), "", "initial page");
      await measure(String(total), testRole, "fixture-role search");
      await measure(String(total), "granted", "broad sentence search");
    }
    await measureAll();
    // Add synthetic copies of the test-only cases, deliberately preserving the
    // existing mix of indexed and legacy rows rather than testing a best case.
    await client.query(`
      WITH base AS MATERIALIZED (SELECT *,row_number() OVER (ORDER BY id) AS slot FROM adm_access_control_audit),
      size AS (SELECT count(*) AS n,max(id) AS last_id FROM base)
      INSERT INTO adm_access_control_audit
        (id,event,actor,role_id,resource,action,before_value,after_value,details,recorded_at,
         actor_display_name,affected_role_name,permission_display_label)
      SELECT size.last_id + g.i,event,actor,role_id,resource,action,before_value,after_value,
        details,recorded_at,actor_display_name,affected_role_name,permission_display_label
      FROM size CROSS JOIN LATERAL generate_series(1,100000-size.n) AS g(i)
      JOIN base ON base.slot=(g.i-1)%size.n+1`);
    await measureAll();
  } finally {
    await client.query("ROLLBACK");
    await client.end();
  }
}
void main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
