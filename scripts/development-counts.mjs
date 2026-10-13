import pg from "pg";
import fs from "node:fs/promises";

if (process.env.TEST_DATABASE_VERIFIED === "true")
  throw new Error("Development evidence must run independently of test workers.");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const categories = {
  master_vessels: "vessels", crew_members_v2: "crew", crew_assignments: "assignments",
  adm_forms_v2: "forms", adm_rank_groups_v2: "rank_groups", frm_requirements: "requirements",
};
const client = await pool.connect();
try {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const identity = (await client.query(`SELECT current_database() AS database,
    d.oid::text AS database_oid,(pg_control_system()).system_identifier::text AS cluster_id
    FROM pg_database d WHERE d.datname=current_database()`)).rows[0];
  if (identity.database_oid !== "16384" || identity.cluster_id !== "7586633721581772821")
    throw new Error("Development evidence target identity changed; reverify before proceeding.");
  const tables = (await client.query(
    "SELECT schemaname,tablename FROM pg_tables WHERE tablename=ANY($1) ORDER BY schemaname,tablename",
    [Object.keys(categories)])).rows;
  const counts = {};
  for (const { schemaname, tablename } of tables) {
    if (!/^[a-z0-9_]+$/.test(schemaname)) throw new Error("Unsafe evidence schema name.");
    const table = `"${schemaname}"."${tablename}"`;
    if (tablename === "adm_forms_v2") {
      const result = await client.query(`SELECT
        count(*) FILTER (WHERE category='dynamic')::text AS company_forms,
        count(*) FILTER (WHERE category IS DISTINCT FROM 'dynamic')::text AS standard_forms
        FROM ${table}`);
      counts[`${schemaname}.company_forms`] = result.rows[0].company_forms;
      counts[`${schemaname}.standard_forms`] = result.rows[0].standard_forms;
    } else {
      counts[`${schemaname}.${categories[tablename]}`] = (await client.query(`SELECT count(*)::text AS count FROM ${table}`)).rows[0].count;
    }
  }
  const observedAt = (await client.query("SELECT clock_timestamp() AS time")).rows[0].time;
  await client.query("COMMIT");
  const evidence = { identity, observedAt, counts };
  if (process.argv[2]) {
    await fs.mkdir("test-logs", { recursive: true });
    await fs.writeFile(process.argv[2], JSON.stringify(evidence, null, 2));
  }
  console.log(JSON.stringify(evidence));
} finally { client.release(); await pool.end(); }
