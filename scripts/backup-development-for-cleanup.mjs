import pg from "pg";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { identitySQL, sameIdentity } from "./test-database-guard.mjs";

const root = "generated-artifacts/private-db-backups";
await fs.mkdir(root, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
const scratchName = `cleanup_restore_${Date.now()}`;
const backupPath = `${root}/development-${stamp}.dump`;
const dev = new pg.Client({ connectionString: process.env.DATABASE_URL });
let scratch;
let created = false;
const expected = { clusterid: "7586633721581772821", databaseoid: "16384" };
const report = { startedAt: new Date().toISOString(), backupPath, scratchName };
function run(command, args, connection) {
  return new Promise((resolve, reject) => {
    const url = new URL(connection);
    const child = spawn(command, ["--dbname", decodeURIComponent(url.pathname.slice(1)), ...args], {
      env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432",
        PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
        PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
        PGSSLMODE: url.searchParams.get("sslmode") || "prefer",
        PGOPTIONS: url.searchParams.get("options") || "",
      }, stdio: ["ignore", "ignore", "pipe"],
    });
    let error = "";
    child.stderr.on("data", chunk => { error += chunk; });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() :
      reject(new Error(`${command} exit ${code}: ${error.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]")}`)));
  });
}
const quote = name => `"${name.replaceAll('"', '""')}"`;
async function counts(client, tables) {
  const result = {};
  for (const { schemaname, tablename } of tables) {
    result[`${schemaname}.${tablename}`] = (await client.query(
      `SELECT count(*)::text AS n FROM ${quote(schemaname)}.${quote(tablename)}`)).rows[0].n;
  }
  return result;
}
try {
  await dev.connect();
  report.developmentIdentity = (await dev.query(identitySQL)).rows[0];
  if (!sameIdentity(report.developmentIdentity, expected))
    throw new Error("Development identity changed; backup refused.");
  await dev.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const snapshot = (await dev.query("SELECT pg_export_snapshot() AS id")).rows[0].id;
  const tables = (await dev.query(`SELECT schemaname,tablename FROM pg_tables
    WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema'
    ORDER BY schemaname,tablename`)).rows;
  report.before = await counts(dev, tables);
  await run("pg_dump", ["--format=custom", `--snapshot=${snapshot}`, `--file=${backupPath}`],
    process.env.DATABASE_URL);
  await fs.chmod(backupPath, 0o600);
  await dev.query("COMMIT");
  await dev.query(`CREATE DATABASE ${quote(scratchName)}`);
  created = true;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${scratchName}`;
  scratch = new pg.Client({ connectionString: url.toString() });
  await scratch.connect();
  report.scratchIdentity = (await scratch.query(identitySQL)).rows[0];
  const registered = JSON.parse(await fs.readFile(".local/test-database-identity.json", "utf8"));
  if (report.scratchIdentity.clusterid !== expected.clusterid ||
      sameIdentity(report.scratchIdentity, expected) || sameIdentity(report.scratchIdentity, registered))
    throw new Error("Unsafe scratch identity.");
  await run("pg_restore", ["--exit-on-error", "--no-owner", "--no-acl", backupPath], url.toString());
  report.restored = await counts(scratch, tables);
  report.differences = Object.keys(report.before).filter(key => report.before[key] !== report.restored[key]);
  report.tableCount = tables.length;
  report.backupBytes = (await fs.stat(backupPath)).size;
  if (report.differences.length) throw new Error("Restored table counts differ; inspect private report.");
} finally {
  if (scratch) await scratch.end();
  if (created) {
    await dev.query(`DROP DATABASE ${quote(scratchName)}`);
    report.scratchDropped = true;
  }
  await dev.end();
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(`${root}/restore-proof-${stamp}.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
}
console.log(JSON.stringify({
  backupPath, backupBytes: report.backupBytes, comparedTables: report.tableCount,
  countDifferences: report.differences.length, scratchDropped: report.scratchDropped,
  finishedAt: report.finishedAt,
}, null, 2));
