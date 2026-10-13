import pg from "pg";

export const identitySQL = `SELECT current_database() AS database,
  d.oid::text AS databaseOid,
  (pg_catalog.pg_control_system()).system_identifier::text AS clusterId
  FROM pg_catalog.pg_database d WHERE d.datname=current_database()`;

export function sameIdentity(a, b) {
  return !!a && !!b && a.clusterid === b.clusterid && a.databaseoid === b.databaseoid;
}

export function assertTestIdentity(target, protectedIdentities) {
  if (!target?.clusterid || !target?.databaseoid || !protectedIdentities?.length)
    throw new Error("Test database identity could not be established. No tests were started.");
  if (protectedIdentities.some(protectedIdentity => sameIdentity(target, protectedIdentity)))
    throw new Error("Refusing tests against a protected development or production database.");
}

export async function readIdentity(connectionString) {
  if (!connectionString) throw new Error("A database connection is required for identity verification.");
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000 });
  try {
    await client.connect();
    return (await client.query(identitySQL)).rows[0];
  } finally {
    await client.end();
  }
}

// Published identity status must be re-attested when production is provisioned.
// No URL, password or other credential is persisted in the attestation.
const productionAbsenceVerifiedUntil = Date.parse("2026-10-14T00:00:00Z");

export async function inspectTestTarget() {
  if (!process.env.TEST_DATABASE_URL)
    throw new Error("TEST_DATABASE_URL is required. DATABASE_URL is never a test fallback.");
  const protectedIdentities = [await readIdentity(process.env.DATABASE_URL)];
  if (process.env.PRODUCTION_DATABASE_URL) {
    protectedIdentities.push(await readIdentity(process.env.PRODUCTION_DATABASE_URL));
  } else if (Date.now() >= productionAbsenceVerifiedUntil) {
    throw new Error("Production database status needs authoritative re-verification before tests can run.");
  }
  const target = await readIdentity(process.env.TEST_DATABASE_URL);
  assertTestIdentity(target, protectedIdentities);
  return { target, protectedIdentities };
}

export async function prepareTestEnvironment() {
  if (!process.env.TEST_DATABASE_URL)
    throw new Error("TEST_DATABASE_URL is required. DATABASE_URL is never a test fallback.");
  if (process.env.TEST_DATABASE_VERIFIED === "true") {
    installConnectionGuard();
    return JSON.parse(process.env.TEST_DATABASE_IDENTITY);
  }
  const { target, protectedIdentities } = await inspectTestTarget();
  process.env.TEST_DATABASE_IDENTITY = JSON.stringify(target);
  process.env.TEST_PROTECTED_DATABASE_IDENTITIES = JSON.stringify(protectedIdentities);
  process.env.TEST_DATABASE_VERIFIED = "true";
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  // Do not let application connection factories inherit alternative targets.
  for (const key of ["MASTER_DATABASE_URL", "PRODUCTION_DATABASE_URL", "PGHOST", "PGPORT",
    "PGUSER", "PGPASSWORD", "PGDATABASE", "DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD"])
    delete process.env[key];
  process.env.TEST_BACKEND_PORT ||= "5100";
  if (!/^\d+$/.test(process.env.TEST_BACKEND_PORT) || Number(process.env.TEST_BACKEND_PORT) === 5000)
    throw new Error("The test backend must use a separate port, not 5000.");
  process.env.TEST_API_URL = `http://127.0.0.1:${process.env.TEST_BACKEND_PORT}`;
  installConnectionGuard();
  return target;
}

let installed = false;
export function installConnectionGuard() {
  if (installed) return;
  if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_VERIFIED !== "true")
    throw new Error("Test database preflight must finish before application imports.");
  const expected = JSON.parse(process.env.TEST_DATABASE_IDENTITY);
  const protectedIdentities = JSON.parse(process.env.TEST_PROTECTED_DATABASE_IDENTITIES);
  assertTestIdentity(expected, protectedIdentities);
  const connect = pg.Client.prototype.connect;
  const query = pg.Client.prototype.query;
  pg.Client.prototype.query = function(...args) {
    const text = typeof args[0] === "string" ? args[0] : args[0]?.text ?? "";
    if (/\bsearch_path\b[^;\n]*,\s*"?public"?/i.test(text))
      throw new Error("Automated schema search_path must not fall through to public.");
    return query.apply(this, args);
  };
  pg.Client.prototype.connect = function(callback) {
    const operation = (async () => {
      if (/\bsearch_path\b[^;\n]*,\s*"?public"?/i.test(this.connectionParameters.options ?? ""))
        throw new Error("Automated schema search_path must not fall through to public.");
      await connect.call(this);
      try {
        const target = (await query.call(this, identitySQL)).rows[0];
        assertTestIdentity(target, protectedIdentities);
        if (!sameIdentity(target, expected))
          throw new Error("Connection does not reach the verified test database.");
      } catch (error) {
        await this.end();
        throw error;
      }
    })();
    if (typeof callback === "function") {
      operation.then(() => callback(null, this), error => callback(error));
      return;
    }
    return operation;
  };
  installed = true;
}
