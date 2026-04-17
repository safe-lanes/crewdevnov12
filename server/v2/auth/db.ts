import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { tenantConnectionManager } from "../../utils/tenantConnectionManager";

let singleTenantPool: Pool | null = null;
let singleTenantDb: ReturnType<typeof drizzle> | null = null;

function getSingleTenantDb() {
  if (singleTenantDb) return singleTenantDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not configured");
  const requiresSsl = url.includes("sslmode=require") || url.includes("ssl=true");
  singleTenantPool = new Pool({
    connectionString: url,
    ssl: requiresSsl ? { rejectUnauthorized: false } : false,
    max: 5,
  });
  singleTenantDb = drizzle(singleTenantPool);
  return singleTenantDb;
}

/**
 * Get a Drizzle DB for the given domain. Used by /login and /refresh which
 * are exempt from the tenant middleware. Falls back to the main DATABASE_URL
 * when running in single-tenant mode.
 */
export async function getDbForDomain(domain: string): Promise<{
  db: ReturnType<typeof drizzle>;
  tuid: string | null;
}> {
  if (tenantConnectionManager.isMultiTenantEnabled) {
    const tenant = await tenantConnectionManager.resolveTenant(domain);
    const db = await tenantConnectionManager.getTenantDb(tenant.tuid);
    return { db, tuid: tenant.tuid };
  }
  return { db: getSingleTenantDb(), tuid: null };
}

/**
 * Get the current request-scoped tenant DB (for routes behind tenant middleware).
 */
export function getCurrentDb(): ReturnType<typeof drizzle> {
  if (tenantConnectionManager.isMultiTenantEnabled) {
    const db = tenantConnectionManager.getCurrentTenantDb();
    if (!db) throw new Error("Tenant database not bound to request");
    return db;
  }
  return getSingleTenantDb();
}
