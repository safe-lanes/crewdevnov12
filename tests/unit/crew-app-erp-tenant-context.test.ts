import { describe, expect, it } from "vitest";
import { tenantConnectionManager } from "../../server/utils/tenantConnectionManager";

describe("ERP worker tenant AsyncLocalStorage isolation", () => {
  it("keeps concurrent tenant database contexts separate", async () => {
    const seen: string[] = [];
    const run = (tenantId: string, delay: number) => tenantConnectionManager.tenantStorage.run(
      { tenantId, domain: `${tenantId}.example`, db: { marker: tenantId } as any },
      async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        seen.push(`${tenantConnectionManager.getCurrentTenantId()}:${(tenantConnectionManager.getCurrentTenantDb() as any).marker}`);
      },
    );
    await Promise.all([run("tenant-a", 10), run("tenant-b", 1)]);
    expect(seen.sort()).toEqual(["tenant-a:tenant-a", "tenant-b:tenant-b"]);
    expect(tenantConnectionManager.getCurrentTenantId()).toBeNull();
  });
});
