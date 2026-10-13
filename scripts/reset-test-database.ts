import pg from "pg";
// @ts-ignore Node ESM helper outside the application compiler project.
import { inspectTestTarget, prepareTestEnvironment, identitySQL, sameIdentity } from "./test-database-guard.mjs";

// Deliberately before installing worker connection guards: this maintenance
// connection may read catalogs and recreate ONLY the verified test database.
const { target, protectedIdentities } = await inspectTestTarget();
if (!/^[a-z][a-z0-9_]+$/.test(target.database))
  throw new Error("Test database name is not safe for reset.");
const admin = new pg.Client({ connectionString: process.env.DATABASE_URL });
await admin.connect();
try {
  const identity = (await admin.query(identitySQL)).rows[0];
  if (identity.clusterid !== target.clusterid || !sameIdentity(identity, protectedIdentities[0]))
    throw new Error("Reset requires the verified same-server administrative connection.");
  await admin.query("SELECT pg_advisory_lock(404404)");
  const catalog = (await admin.query(
    "SELECT oid::text AS oid FROM pg_catalog.pg_database WHERE datname=$1", [target.database])).rows[0];
  if (catalog?.oid !== target.databaseoid)
    throw new Error("Test database identity changed before reset; nothing was dropped.");
  const active = (await admin.query(
    "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datid=$1", [target.databaseoid])).rows[0];
  if (active.count !== 0)
    throw new Error("Stop the test backend and tests before resetting their database.");
  console.log("Resetting verified test identity", JSON.stringify(target));
  await admin.query(`DROP DATABASE "${target.database}"`);
  await admin.query(`CREATE DATABASE "${target.database}"`);
} finally { await admin.end(); }

const identity = await prepareTestEnvironment();
const { runMigrations } = await import("../server/migrationRunner");
await runMigrations();
const { seedIsolatedTests } = await import("./seed-isolated-tests");
await seedIsolatedTests();
console.log("Reset complete. New test identity", JSON.stringify(identity));
