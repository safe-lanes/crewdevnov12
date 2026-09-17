import { tenantConnectionManager } from "../../utils/tenantConnectionManager";
import { storage } from "../../storage";

export type CrewAppTenancyMode = "single" | "multi" | "auto";

function configuredMode(): CrewAppTenancyMode {
  const value = (process.env.CREW_APP_TENANCY_MODE || "auto").toLowerCase();
  if (value !== "single" && value !== "multi" && value !== "auto") {
    throw new Error("CREW_APP_TENANCY_MODE must be single, multi, or auto");
  }
  return value;
}

export function activeCrewAppTenancyMode(): "single" | "multi" {
  const mode = configuredMode();
  if (mode === "auto") return tenantConnectionManager.isMultiTenantEnabled ? "multi" : "single";
  return mode;
}

function assertSingleTenantDomain(domain: string): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for crew-app single-tenant mode");
  }
  const configuredDomain = process.env.CREW_APP_SINGLE_TENANT_DOMAIN?.trim();
  if (!configuredDomain) {
    throw new Error("CREW_APP_SINGLE_TENANT_DOMAIN is required for crew-app single-tenant mode");
  }
  if (domain.trim().toLowerCase() !== configuredDomain.toLowerCase()) {
    throw new Error("Invalid credentials");
  }
}

export async function runInCrewAppTenant<T>(
  domain: string,
  callback: (tuid: string | null) => T | Promise<T>,
): Promise<T> {
  if (activeCrewAppTenancyMode() === "single") {
    assertSingleTenantDomain(domain);
    const db = storage && typeof (storage as any).getDb === "function"
      ? (storage as any).getDb()
      : null;
    if (!db) throw new Error("Single-tenant database is not available");
    return tenantConnectionManager.tenantStorage.run(
      { db, tenantId: "crew-app-single", domain },
      () => callback(null),
    );
  }

  if (!tenantConnectionManager.isMultiTenantEnabled) {
    throw new Error("Crew-app multi-tenant mode requires a reachable MASTER_DATABASE_URL");
  }
  const { tuid } = await tenantConnectionManager.resolveTenant(domain);
  return tenantConnectionManager.runInTenantContext(tuid, () => callback(tuid), domain);
}