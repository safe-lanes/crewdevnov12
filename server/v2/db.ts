import { storage } from "../storage";
import { getCurrentTenantDb } from "../utils/tenantConnectionManager";
import { tenantConnectionManager } from "../utils/tenantConnectionManager";
import { scopedAccountDb } from "./accounts/accountDbScope";

export function getBaseDb() {
  const tenantDb = getCurrentTenantDb();
  if (tenantDb) {
    return tenantDb;
  }

  if (tenantConnectionManager.isMultiTenantEnabled) {
    throw new Error(
      "Tenant context required. All V2 API requests must include x-tenant-id header in multi-tenant mode.",
    );
  }

  if (storage && typeof (storage as any).getDb === "function") {
    return (storage as any).getDb();
  }
  throw new Error("Database not available. Storage must be DatabaseStorage.");
}

export function getDb() {
  return scopedAccountDb(getBaseDb());
}
