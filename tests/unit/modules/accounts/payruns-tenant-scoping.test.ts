import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Service/repository-level tenant-scoping tests for the native V2 Accounts
 * payrun domain.
 *
 * Every repository reads its connection from getDb() (server/v2/db.ts), which
 * resolves the tenant's pool from AsyncLocalStorage. These tests mock getDb to
 * return a different fake connection per active tenant and assert that the
 * service/repository ALWAYS query through the tenant-resolved connection — i.e.
 * data for tenant A is never read from or written to tenant B's connection.
 */

type FakeDb = {
  name: "A" | "B";
  calls: { select: number; insert: number; update: number };
  select: () => any;
  insert: () => any;
  update: () => any;
};

function makeFakeDb(name: "A" | "B", rows: any[]): FakeDb {
  const calls = { select: 0, insert: 0, update: 0 };

  const selectChain: any = {
    from: () => selectChain,
    where: () => selectChain,
    orderBy: () => Promise.resolve(rows),
  };

  return {
    name,
    calls,
    select: () => {
      calls.select++;
      return selectChain;
    },
    insert: () => {
      calls.insert++;
      return {
        values: (v: any) => ({
          returning: () => Promise.resolve([{ ...v }]),
        }),
      };
    },
    update: () => {
      calls.update++;
      const whereResult: any = Promise.resolve([{}]);
      whereResult.returning = () => Promise.resolve([{}]);
      return {
        set: () => ({
          where: () => whereResult,
        }),
      };
    },
  };
}

const dbA = makeFakeDb("A", [{ payrunUuid: "a-1", vessel: "MV Alpha" }]);
const dbB = makeFakeDb("B", [{ payrunUuid: "b-1", vessel: "MV Bravo" }]);

let currentTenant: "A" | "B" = "A";

vi.mock("../../../../server/v2/db", () => ({
  getDb: () => (currentTenant === "A" ? dbA : dbB),
}));

import { payrunsService } from "../../../../server/v2/accounts/services/payrunsService";

describe("Accounts V2 payruns — service/repository tenant scoping", () => {
  beforeEach(() => {
    dbA.calls.select = dbA.calls.insert = dbA.calls.update = 0;
    dbB.calls.select = dbB.calls.insert = dbB.calls.update = 0;
  });

  it("reads from tenant A's connection when tenant A is active", async () => {
    currentTenant = "A";
    const result = await payrunsService.getAll();
    expect(result).toEqual([{ payrunUuid: "a-1", vessel: "MV Alpha" }]);
    expect(dbA.calls.select).toBe(1);
    expect(dbB.calls.select).toBe(0);
  });

  it("reads from tenant B's connection when tenant B is active", async () => {
    currentTenant = "B";
    const result = await payrunsService.getAll();
    expect(result).toEqual([{ payrunUuid: "b-1", vessel: "MV Bravo" }]);
    expect(dbB.calls.select).toBe(1);
    expect(dbA.calls.select).toBe(0);
  });

  it("writes a created payrun only to the active tenant's connection", async () => {
    currentTenant = "A";
    await payrunsService.create({ vessel: "MV Alpha", period: "P1" } as any);
    expect(dbA.calls.insert).toBe(1);
    expect(dbB.calls.insert).toBe(0);
  });

  it("generates a server-side payrunUuid on create (not client-supplied)", async () => {
    currentTenant = "A";
    const created: any = await payrunsService.create({
      vessel: "MV Alpha",
      period: "P1",
    } as any);
    expect(typeof created.payrunUuid).toBe("string");
    expect(created.payrunUuid.length).toBeGreaterThan(0);
  });

  it("rejects a create missing required fields before touching any connection", async () => {
    currentTenant = "A";
    await expect(payrunsService.create({ vessel: "MV Alpha" } as any)).rejects.toThrow(
      /period is required/,
    );
    expect(dbA.calls.insert).toBe(0);
  });
});
