import { AsyncLocalStorage } from "async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and } from "drizzle-orm";
import { tenants } from "@shared/v2/tenant/schema";
// import 'dotenv/config';

type DrizzleInstance = ReturnType<typeof drizzle>;

export class TenantNotFoundError extends Error {
  status = 404;
  constructor(domain: string) {
    super(`No company registered for domain: ${domain}`);
    this.name = "TenantNotFoundError";
  }
}

export class TenantInactiveError extends Error {
  status = 403;
  constructor(domain: string) {
    super(`Company account for domain '${domain}' is currently inactive. Please contact your administrator.`);
    this.name = "TenantInactiveError";
  }
}

export class TenantDatabaseError extends Error {
  status = 503;
  constructor(tuid: string, cause?: string) {
    super(`Unable to connect to the database for domain '${tuid}'.${cause ? ` ${cause}` : ""} Please try again later.`);
    this.name = "TenantDatabaseError";
  }
}

interface TenantCacheEntry {
  tuid: string;
  companyName: string | null;
  expiresAt: number;
}

interface PoolCacheEntry {
  pool: Pool;
  db: DrizzleInstance;
  lastUsed: number;
}

interface TenantStore {
  db: DrizzleInstance;
  tenantId: string;
}

const CACHE_TTL_MS = 1 * 60 * 1000;
const IDLE_EVICTION_MS = 10 * 60 * 1000;
const EVICTION_CHECK_INTERVAL_MS = 60 * 1000;

class TenantConnectionManager {
  private masterPool: Pool | null = null;
  private masterDb: DrizzleInstance | null = null;
  private tenantCache = new Map<string, TenantCacheEntry>();
  private poolCache = new Map<string, PoolCacheEntry>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;
  private _isMultiTenantEnabled = false;

  public tenantStorage = new AsyncLocalStorage<TenantStore>();

  get isMultiTenantEnabled(): boolean {
    return this._isMultiTenantEnabled;
  }

  async init(): Promise<void> {
    const masterUrl = process.env.MASTER_DATABASE_URL;

    if (!masterUrl) {
      console.log("🏠 Single-tenant mode (MASTER_DATABASE_URL not set)");
      this._isMultiTenantEnabled = false;
      return;
    }

    try {
      const requiresSsl =
        masterUrl.includes("sslmode=require") || masterUrl.includes("ssl=true");

      this.masterPool = new Pool({
        connectionString: masterUrl,
        ssl: requiresSsl
          ? { rejectUnauthorized: false, checkServerIdentity: () => undefined }
          : false,
        max: 5,
        min: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.masterDb = drizzle(this.masterPool);

      const client = await this.masterPool.connect();
      await client.query("SELECT 1");
      client.release();

      this._isMultiTenantEnabled = true;
      console.log("🏢 Multi-tenant mode: ENABLED");
      console.log("📡 Master database connected successfully");

      this.evictionTimer = setInterval(() => this.evictIdlePools(), EVICTION_CHECK_INTERVAL_MS);
    } catch (err: any) {
      console.error("❌ Failed to connect to master database:", err.message);
      console.log("🏠 Falling back to single-tenant mode");
      this._isMultiTenantEnabled = false;
      if (this.masterPool) {
        await this.masterPool.end().catch(() => { });
        this.masterPool = null;
      }
      this.masterDb = null;
    }
  }

  async resolveTenant(domain: string): Promise<{ tuid: string; companyName: string | null }> {
    if (!this._isMultiTenantEnabled || !this.masterDb) {
      throw new Error("Multi-tenant is not configured");
    }

    const cached = this.tenantCache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      return { tuid: cached.tuid, companyName: cached.companyName };
    }

    try {
      const result = await this.masterDb
        .select({
          tuid: tenants.tuid,
          companyName: tenants.companyName,
          isActive: tenants.isActive,
          isDeleted: tenants.isDeleted,
        })
        .from(tenants)
        .where(eq(tenants.domain, domain))
        .limit(1);

      if (result.length === 0) {
        throw new TenantNotFoundError(domain);
      }

      const row = result[0];

      if (!row.isActive || row.isDeleted) {
        throw new TenantInactiveError(domain);
      }

      const tenant = { tuid: row.tuid, companyName: row.companyName };
      this.tenantCache.set(domain, {
        tuid: tenant.tuid,
        companyName: tenant.companyName,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return { tuid: tenant.tuid, companyName: tenant.companyName };
    } catch (err) {
      if (err instanceof TenantNotFoundError) throw err;
      if (err instanceof TenantInactiveError) throw err;
      throw new TenantDatabaseError("sails_master_crewing", (err as Error).message);
    }
  }

  async getTenantDb(tuid: string): Promise<DrizzleInstance> {
    const existing = this.poolCache.get(tuid);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.db;
    }

    try {
      const masterUrl = process.env.MASTER_DATABASE_URL!;
      const url = new URL(masterUrl);
      url.pathname = `/${tuid}`;

      const requiresSsl =
        masterUrl.includes("sslmode=require") || masterUrl.includes("ssl=true");

      const pool = new Pool({
        connectionString: url.toString(),
        ssl: requiresSsl
          ? { rejectUnauthorized: false, checkServerIdentity: () => undefined }
          : false,
        max: 5,
        min: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();

      const db = drizzle(pool);

      this.poolCache.set(tuid, { pool, db, lastUsed: Date.now() });
      console.log(`🔗 Tenant pool created for '${tuid}' (active pools: ${this.poolCache.size})`);

      return db;
    } catch (err: any) {
      throw new TenantDatabaseError(tuid, err.message);
    }
  }

  async runInTenantContext<T>(tuid: string, callback: () => T | Promise<T>): Promise<T> {
    const db = await this.getTenantDb(tuid);
    return this.tenantStorage.run({ db, tenantId: tuid }, callback);
  }

  getCurrentTenantDb(): DrizzleInstance | null {
    return this.tenantStorage.getStore()?.db ?? null;
  }

  getCurrentTenantId(): string | null {
    return this.tenantStorage.getStore()?.tenantId ?? null;
  }

  private evictIdlePools(): void {
    const now = Date.now();
    for (const [tuid, entry] of this.poolCache.entries()) {
      if (now - entry.lastUsed > IDLE_EVICTION_MS) {
        entry.pool.end().catch((err) =>
          console.error(`Failed to close idle pool for '${tuid}':`, err.message),
        );
        this.poolCache.delete(tuid);
        console.log(`♻️ Evicted idle tenant pool '${tuid}' (active pools: ${this.poolCache.size})`);
      }
    }
  }

  async closeAll(): Promise<void> {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer);
      this.evictionTimer = null;
    }

    const closePromises: Promise<void>[] = [];
    for (const [tuid, entry] of this.poolCache.entries()) {
      closePromises.push(
        entry.pool.end().catch((err) =>
          console.error(`Error closing pool for '${tuid}':`, err.message),
        ),
      );
    }
    this.poolCache.clear();
    this.tenantCache.clear();

    if (this.masterPool) {
      closePromises.push(
        this.masterPool.end().catch((err) =>
          console.error("Error closing master pool:", err.message),
        ),
      );
      this.masterPool = null;
      this.masterDb = null;
    }

    await Promise.all(closePromises);
    console.log("🔒 All tenant database connections closed");
  }
}

export const tenantConnectionManager = new TenantConnectionManager();

export function getCurrentTenantDb(): DrizzleInstance | null {
  return tenantConnectionManager.getCurrentTenantDb();
}
