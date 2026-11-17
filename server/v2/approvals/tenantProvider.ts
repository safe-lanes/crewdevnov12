/**
 * Approval engine ↔ Crewing tenancy (host layer; the engine itself is in ../approval-engine).
 *
 * The engine keeps its tables (apprv_*) in each tenant's own database. Inside a request the
 * tenant is the one tenantMiddleware put into the AsyncLocalStorage context; single-tenant mode
 * has no context and uses the app database. resolveTenantId (mount.ts) and this provider read
 * the SAME source, so the engine's tenant id can never point at another company's database.
 */
import type { Pool } from "pg";
import { DrizzleApprovalRepository, type TenantRepositoryProvider } from "../approval-engine";
import { tenantConnectionManager } from "../../utils/tenantConnectionManager";
import { getBaseDb } from "../db";

/** Engine tenant id = the ALS tenant id, or 'default' in single-tenant mode. */
export function currentEngineTenantId(): string {
  return tenantConnectionManager.getCurrentTenantId() ?? "default";
}

/** The raw pg pool behind the current tenant's Drizzle instance (drizzle(pool).$client). */
function currentTenantPool(): Pool {
  // getBaseDb(): the tenant's own database (not the Accounts-scoped wrapper getDb() returns).
  const db = getBaseDb() as unknown as { $client?: Pool };
  if (!db.$client || typeof (db.$client as Pool).query !== "function") {
    throw new Error("[approvals] could not reach the tenant database pool");
  }
  return db.$client;
}

export class AlsTenantRepositoryProvider implements TenantRepositoryProvider {
  // Keyed by pool, not tenant id: idle tenant pools are closed and re-created by the
  // connection manager, and a repository must never hold on to a closed pool.
  private repos = new WeakMap<Pool, DrizzleApprovalRepository>();

  forTenant(tenantId: string): DrizzleApprovalRepository {
    const ctxTenant = currentEngineTenantId();
    if (tenantId !== ctxTenant) {
      // The engine is always called inside the request that owns the tenant context.
      // A mismatch means a caller passed someone else's tenant id: refuse.
      throw new Error(`[approvals] tenant mismatch: engine ctx '${tenantId}' vs request '${ctxTenant}'`);
    }
    const pool = currentTenantPool();
    let repo = this.repos.get(pool);
    if (!repo) {
      repo = new DrizzleApprovalRepository(pool);
      this.repos.set(pool, repo);
    }
    return repo;
  }
}
