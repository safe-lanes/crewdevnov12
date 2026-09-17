import { describe, expect, it } from "vitest";
import { getDatabaseHealthStatus } from "../../server/utils/healthStatus";
import { isExplicitMultiTenantMode } from "../../server/utils/tenantConnectionManager";

describe("release health and tenancy configuration", () => {
  it.each(["multi", "MULTI", " Multi "])(
    "treats %s as explicitly multi-tenant",
    (value) => {
      expect(isExplicitMultiTenantMode(value)).toBe(true);
    },
  );

  it("does not treat auto or single as explicitly multi-tenant", () => {
    expect(isExplicitMultiTenantMode("auto")).toBe(false);
    expect(isExplicitMultiTenantMode("single")).toBe(false);
  });

  it("reports truthful master-only database health", () => {
    expect(getDatabaseHealthStatus(false, true, true)).toBe("master-connected");
    expect(getDatabaseHealthStatus(false, true, false)).toBe("master-disconnected");
  });
});