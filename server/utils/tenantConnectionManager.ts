import { AsyncLocalStorage } from "async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, and } from "drizzle-orm";
import { tenants } from "@shared/v2/tenant/schema";
import { runMigrationsForTenant } from "../migrationRunner";

type DrizzleInstance = ReturnType<typeof drizzle>;

export class TenantNotFoundError extends Error {
  status = 404;
  constructor(identifier: string, type: "domain" | "tuid" = "domain") {
    super(
      type === "domain"
        ? `No company registered for domain: ${identifier}`
        : `No company registered for tenant ID: ${identifier}`
    );
    this.name = "TenantNotFoundError";
  }
}

export class TenantInactiveError extends Error {
  status = 403;
  constructor(identifier: string, type: "domain" | "tuid" = "domain") {
    super(
      type === "domain"
        ? `Company account for domain '${identifier}' is currently inactive. Please contact your administrator.`
        : `Company account for tenant '${identifier}' is currently inactive. Please contact your administrator.`
    );
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

interface TuidValidationCacheEntry {
  status: "active" | "not_found" | "inactive";
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
  domain?: string;
}

interface CircuitBreakerEntry {
  failures: number;
  openUntil: number;
}

function maskTuid(tuid: string): string {
  if (tuid.length <= 8) return tuid.substring(0, 4) + "***";
  return tuid.substring(0, 8) + "***";
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 60 * 1000;
const IDLE_EVICTION_MS = 30 * 60 * 1000;
const EVICTION_CHECK_INTERVAL_MS = 60 * 1000;
const TUID_CACHE_MAX_SIZE = 500;

const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 30 * 1000;

class TenantConnectionManager {
  private masterPool: Pool | null = null;
  private masterDb: DrizzleInstance | null = null;
  private tenantCache = new Map<string, TenantCacheEntry>();
  private tuidValidationCache = new Map<string, TuidValidationCacheEntry>();
  private poolCache = new Map<string, PoolCacheEntry>();
  private evictionTimer: ReturnType<typeof setInterval> | null = null;
  private _isMultiTenantEnabled = false;

  private migratedTenants = new Set<string>();
  private migrationFailures = new Map<string, number>();
  private circuitBreakers = new Map<string, CircuitBreakerEntry>();
  private pendingPoolCreations = new Map<string, Promise<DrizzleInstance>>();

  private tenantPoolMax: number;
  private globalMaxConnections: number;

  public tenantStorage = new AsyncLocalStorage<TenantStore>();

  constructor() {
    this.tenantPoolMax = parseInt(process.env.TENANT_POOL_MAX || "5", 10);
    this.globalMaxConnections = parseInt(process.env.GLOBAL_MAX_CONNECTIONS || "80", 10);
  }

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
      console.log(`📡 Master database connected (pool/tenant: ${this.tenantPoolMax}, global cap: ${this.globalMaxConnections})`);

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

  async validateTuid(tuid: string): Promise<void> {
    if (!this._isMultiTenantEnabled || !this.masterDb) {
      throw new Error("Multi-tenant is not configured");
    }

    const cached = this.tuidValidationCache.get(tuid);
    if (cached && cached.expiresAt > Date.now()) {
      if (cached.status === "not_found") {
        throw new TenantNotFoundError(tuid, "tuid");
      }
      if (cached.status === "inactive") {
        throw new TenantInactiveError(tuid, "tuid");
      }
      return;
    }

    if (this.tuidValidationCache.size >= TUID_CACHE_MAX_SIZE) {
      this.evictExpiredTuidCache();
    }

    try {
      const result = await this.masterDb
        .select({
          tuid: tenants.tuid,
          isActive: tenants.isActive,
          isDeleted: tenants.isDeleted,
        })
        .from(tenants)
        .where(eq(tenants.tuid, tuid))
        .limit(1);

      if (result.length === 0) {
        this.tuidValidationCache.set(tuid, {
          status: "not_found",
          expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
        });
        throw new TenantNotFoundError(tuid, "tuid");
      }

      const row = result[0];

      if (!row.isActive || row.isDeleted) {
        this.tuidValidationCache.set(tuid, {
          status: "inactive",
          expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
        });
        throw new TenantInactiveError(tuid, "tuid");
      }

      this.tuidValidationCache.set(tuid, {
        status: "active",
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    } catch (err) {
      if (err instanceof TenantNotFoundError) throw err;
      if (err instanceof TenantInactiveError) throw err;
      throw new TenantDatabaseError("sails_master_crewing", (err as Error).message);
    }
  }

  private getTotalPoolConnections(): number {
    let total = 0;
    for (const entry of this.poolCache.values()) {
      total += entry.pool.totalCount;
    }
    return total;
  }

  private isCircuitOpen(tuid: string): boolean {
    const cb = this.circuitBreakers.get(tuid);
    if (!cb) return false;
    if (cb.openUntil > Date.now()) return true;
    this.circuitBreakers.delete(tuid);
    return false;
  }

  private recordConnectionFailure(tuid: string): void {
    const cb = this.circuitBreakers.get(tuid) || { failures: 0, openUntil: 0 };
    cb.failures++;
    if (cb.failures >= CIRCUIT_BREAKER_THRESHOLD) {
      cb.openUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
      console.warn(`⚡ Circuit breaker OPEN for tenant '${maskTuid(tuid)}' — ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s cooldown`);
    }
    this.circuitBreakers.set(tuid, cb);
  }

  private clearCircuitBreaker(tuid: string): void {
    this.circuitBreakers.delete(tuid);
  }

  async getTenantDb(tuid: string): Promise<DrizzleInstance> {
    const existing = this.poolCache.get(tuid);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.db;
    }

    const pending = this.pendingPoolCreations.get(tuid);
    if (pending) {
      return pending;
    }

    const creationPromise = this.createTenantPool(tuid);
    this.pendingPoolCreations.set(tuid, creationPromise);

    try {
      return await creationPromise;
    } finally {
      this.pendingPoolCreations.delete(tuid);
    }
  }

  private async createTenantPool(tuid: string): Promise<DrizzleInstance> {
    if (this.isCircuitOpen(tuid)) {
      throw new TenantDatabaseError(tuid, "Temporarily unavailable due to repeated connection failures. Retrying shortly.");
    }

    const migrationFailedAt = this.migrationFailures.get(tuid);
    if (migrationFailedAt && Date.now() - migrationFailedAt < CIRCUIT_BREAKER_COOLDOWN_MS) {
      throw new TenantDatabaseError(tuid, "Schema migration recently failed. Retrying shortly.");
    }

    const currentTotal = this.getTotalPoolConnections();
    if (currentTotal >= this.globalMaxConnections) {
      throw new TenantDatabaseError(tuid, "Global connection limit reached. Please try again later.");
    }

    try {
      const masterUrl = process.env.MASTER_DATABASE_URL!;
      const url = new URL(masterUrl);
      url.pathname = `/${tuid}`;

      const requiresSsl =
        masterUrl.includes("sslmode=require") || masterUrl.includes("ssl=true");

      const connectionString = url.toString();

      const pool = new Pool({
        connectionString,
        ssl: requiresSsl
          ? { rejectUnauthorized: false, checkServerIdentity: () => undefined }
          : false,
        max: this.tenantPoolMax,
        min: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      const client = await pool.connect();
      await client.query("SELECT 1");
      client.release();

      this.clearCircuitBreaker(tuid);

      if (!this.migratedTenants.has(tuid)) {
        try {
          await runMigrationsForTenant(connectionString, tuid);
          this.migratedTenants.add(tuid);
          this.migrationFailures.delete(tuid);
        } catch (migErr: any) {
          console.error(`❌ Tenant migration failed for '${maskTuid(tuid)}':`, migErr.message);
          this.migrationFailures.set(tuid, Date.now());
          await pool.end().catch(() => {});
          throw new TenantDatabaseError(tuid, "Schema migration failed. Please contact your administrator.");
        }
      }

      const db = drizzle(pool);

      this.poolCache.set(tuid, { pool, db, lastUsed: Date.now() });
      console.log(`🔗 Tenant pool created for '${maskTuid(tuid)}' (active pools: ${this.poolCache.size})`);

      return db;
    } catch (err: any) {
      if (err instanceof TenantDatabaseError) throw err;
      this.recordConnectionFailure(tuid);
      throw new TenantDatabaseError(tuid, err.message);
    }
  }

  async runInTenantContext<T>(tuid: string, callback: () => T | Promise<T>, domain?: string): Promise<T> {
    const db = await this.getTenantDb(tuid);
    return this.tenantStorage.run({ db, tenantId: tuid, domain }, callback);
  }

  getCurrentTenantDb(): DrizzleInstance | null {
    return this.tenantStorage.getStore()?.db ?? null;
  }

  getCurrentTenantId(): string | null {
    return this.tenantStorage.getStore()?.tenantId ?? null;
  }

  getCurrentDomain(): string | null {
    return this.tenantStorage.getStore()?.domain ?? null;
  }

  async getActiveTenants(): Promise<string[]> {
    if (!this._isMultiTenantEnabled || !this.masterDb) {
      return [];
    }
    try {
      const result = await this.masterDb
        .select({ tuid: tenants.tuid })
        .from(tenants)
        .where(and(eq(tenants.isActive, true), eq(tenants.isDeleted, false)));
      return result.map(r => r.tuid);
    } catch (err: any) {
      console.error("Error fetching active tenants from master db:", err.message);
      return [];
    }
  }

  getPoolMetrics(): {
    activePools: number;
    totalConnections: number;
    globalMaxConnections: number;
    poolMaxPerTenant: number;
    migratedTenants: number;
    openCircuitBreakers: string[];
  } {
    const now = Date.now();
    const openCbs: string[] = [];
    for (const [tuid, cb] of this.circuitBreakers.entries()) {
      if (cb.openUntil > now) {
        openCbs.push(maskTuid(tuid));
      }
    }

    return {
      activePools: this.poolCache.size,
      totalConnections: this.getTotalPoolConnections(),
      globalMaxConnections: this.globalMaxConnections,
      poolMaxPerTenant: this.tenantPoolMax,
      migratedTenants: this.migratedTenants.size,
      openCircuitBreakers: openCbs,
    };
  }

  private evictIdlePools(): void {
    const now = Date.now();
    for (const [tuid, entry] of this.poolCache.entries()) {
      if (now - entry.lastUsed > IDLE_EVICTION_MS) {
        entry.pool.end().catch((err) =>
          console.error(`Failed to close idle pool for '${maskTuid(tuid)}':`, err.message),
        );
        this.poolCache.delete(tuid);
        console.log(`♻️ Evicted idle tenant pool '${maskTuid(tuid)}' (active pools: ${this.poolCache.size})`);
      }
    }

    this.evictExpiredTuidCache();
  }

  private evictExpiredTuidCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.tuidValidationCache.entries()) {
      if (entry.expiresAt <= now) {
        this.tuidValidationCache.delete(key);
      }
    }

    if (this.tuidValidationCache.size >= TUID_CACHE_MAX_SIZE) {
      const entriesToRemove = this.tuidValidationCache.size - TUID_CACHE_MAX_SIZE + 1;
      let removed = 0;
      for (const key of this.tuidValidationCache.keys()) {
        if (removed >= entriesToRemove) break;
        this.tuidValidationCache.delete(key);
        removed++;
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
          console.error(`Error closing pool for '${maskTuid(tuid)}':`, err.message),
        ),
      );
    }
    this.poolCache.clear();
    this.tenantCache.clear();
    this.tuidValidationCache.clear();
    this.migratedTenants.clear();
    this.migrationFailures.clear();
    this.circuitBreakers.clear();

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
