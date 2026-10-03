import { describe, expect, it, vi } from "vitest";
import { requireMobileRole, requireResourceOwnership } from "@server/v2/crew-app/authorization";
import { tenantConnectionManager } from "@server/utils/tenantConnectionManager";

const request = (crewUuid: string, domain = "tenant-a", userType = "Crew") => ({
  crewUser: { credentialId: 1, crewUuid, domain, userType },
}) as any;

describe("crew-app centralized authorization", () => {
  it("hides another crew member's resource", () => {
    expect(() => requireResourceOwnership(request("crew-a1"), { crewUuid: "crew-a2" }))
      .toThrow("Record not found");
  });

  it("hides a cross-tenant crew resource regardless of client-controlled IDs", () => {
    const req: any = { ...request("crew-a1", "tenant-a"), params: { crewUuid: "crew-b1" }, body: { tenantId: "tenant-b", role: "Admin" } };
    expect(() => requireResourceOwnership(req, { crewUuid: "crew-b1" })).toThrow("Record not found");
  });

  it("prevents crew from invoking an admin role guard", () => {
    const status = vi.fn().mockReturnThis(); const json = vi.fn(); const next = vi.fn();
    requireMobileRole("Admin")(request("crew-a1"), { status, json } as any, next);
    expect(status).toHaveBeenCalledWith(403); expect(next).not.toHaveBeenCalled();
  });

  it("keeps concurrent tenant contexts isolated", async () => {
    const fakeDbA = { tenant: "a" } as any; const fakeDbB = { tenant: "b" } as any;
    const seen = await Promise.all([
      tenantConnectionManager.tenantStorage.run({ db: fakeDbA, tenantId: "tenant-a", domain: "a.test" }, async () => {
        await Promise.resolve(); return [tenantConnectionManager.getCurrentTenantId(), tenantConnectionManager.getCurrentDomain()];
      }),
      tenantConnectionManager.tenantStorage.run({ db: fakeDbB, tenantId: "tenant-b", domain: "b.test" }, async () => {
        await Promise.resolve(); return [tenantConnectionManager.getCurrentTenantId(), tenantConnectionManager.getCurrentDomain()];
      }),
    ]);
    expect(seen).toEqual([["tenant-a", "a.test"], ["tenant-b", "b.test"]]);
  });
});
