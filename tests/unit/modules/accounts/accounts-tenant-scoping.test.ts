import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Repository-level tenant-scoping tests for the native V2 Accounts module
 * (wage ledger, engagements, portage).
 *
 * Replaces the dead payruns-tenant-scoping suite (the payrun domain was
 * refactored away). Every accounts repository reads its connection from
 * getDb() (server/v2/db.ts), which resolves the tenant's pool from
 * AsyncLocalStorage. These tests mock getDb to return a different fake
 * connection per active tenant and assert that repositories ALWAYS query
 * through the tenant-resolved connection — i.e. tenant A's ledger,
 * engagements, and portage data is never read from or written to tenant B's
 * connection.
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

  // Thenable chain: awaitable after from()/where()/orderBy()/limit().
  const selectChain: any = {
    from: () => selectChain,
    where: () => selectChain,
    orderBy: () => selectChain,
    limit: () => selectChain,
    then: (resolve: any, reject: any) =>
      Promise.resolve(rows).then(resolve, reject),
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

const ledgerRowA = { txnUuid: "txn-a-1", vesselUuid: "vsl-a", amount: "100" };
const ledgerRowB = { txnUuid: "txn-b-1", vesselUuid: "vsl-b", amount: "999" };

const dbA = makeFakeDb("A", [ledgerRowA]);
const dbB = makeFakeDb("B", [ledgerRowB]);

let currentTenant: "A" | "B" = "A";

vi.mock("../../../../server/v2/db", () => ({
  getDb: () => (currentTenant === "A" ? dbA : dbB),
}));

import { MonthlyTransactionsRepository } from "../../../../server/v2/accounts/repositories/monthlyTransactionsRepository";
import { EngagementsRepository } from "../../../../server/v2/accounts/repositories/engagementsRepository";
import { PortageRepository } from "../../../../server/v2/accounts/repositories/portageRepository";

const ledgerRepo = new MonthlyTransactionsRepository();
const engagementsRepo = new EngagementsRepository();
const portageRepo = new PortageRepository();

function resetCalls() {
  dbA.calls.select = dbA.calls.insert = dbA.calls.update = 0;
  dbB.calls.select = dbB.calls.insert = dbB.calls.update = 0;
}

describe("Accounts V2 — repository tenant scoping (ledger / engagements / portage)", () => {
  beforeEach(() => {
    resetCalls();
    currentTenant = "A";
  });

  describe("wage ledger (monthly transactions)", () => {
    it("reads tenant A's ledger from tenant A's connection only", async () => {
      currentTenant = "A";
      const result = await ledgerRepo.findAll();
      expect(result).toEqual([ledgerRowA]);
      expect(dbA.calls.select).toBe(1);
      expect(dbB.calls.select).toBe(0);
    });

    it("reads tenant B's ledger from tenant B's connection only", async () => {
      currentTenant = "B";
      const result = await ledgerRepo.findAll();
      expect(result).toEqual([ledgerRowB]);
      expect(dbB.calls.select).toBe(1);
      expect(dbA.calls.select).toBe(0);
    });

    it("never returns tenant B rows while tenant A is active", async () => {
      currentTenant = "A";
      const result = await ledgerRepo.findAll();
      expect(result).not.toContainEqual(ledgerRowB);
    });

    it("resolves the connection per call — a tenant switch redirects the very next query", async () => {
      currentTenant = "A";
      await ledgerRepo.findAll();
      currentTenant = "B";
      const result = await ledgerRepo.findAll();
      expect(result).toEqual([ledgerRowB]);
      expect(dbA.calls.select).toBe(1);
      expect(dbB.calls.select).toBe(1);
    });

    it("writes a ledger transaction only to the active tenant's connection", async () => {
      currentTenant = "A";
      await ledgerRepo.create({
        vesselUuid: "vsl-a",
        crewUuid: "crew-a",
        period: "2026-07",
        origin: "manual",
        amount: "100",
      } as any);
      expect(dbA.calls.insert).toBe(1);
      expect(dbB.calls.insert).toBe(0);
    });
  });

  describe("engagements", () => {
    it("reads an engagement through the active tenant's connection only", async () => {
      currentTenant = "B";
      await engagementsRepo.findByUuid("eng-1");
      expect(dbB.calls.select).toBe(1);
      expect(dbA.calls.select).toBe(0);
    });

    it("creates an engagement only on the active tenant's connection, with a server-side uuid", async () => {
      currentTenant = "A";
      const created: any = await engagementsRepo.create({
        assignmentUuid: "asg-1",
        crewUuid: "crew-a",
        vesselUuid: "vsl-a",
      } as any);
      expect(dbA.calls.insert).toBe(1);
      expect(dbB.calls.insert).toBe(0);
      expect(typeof created.engagementUuid).toBe("string");
      expect(created.engagementUuid.length).toBeGreaterThan(0);
    });
  });

  describe("portage", () => {
    it("reads a vessel-month portage header through the active tenant's connection only", async () => {
      currentTenant = "A";
      await portageRepo.findByVesselPeriod("vsl-a", "2026-07");
      expect(dbA.calls.select).toBe(1);
      expect(dbB.calls.select).toBe(0);
    });

    it("creates a portage header only on the active tenant's connection, with a server-side uuid", async () => {
      currentTenant = "B";
      const created: any = await portageRepo.createPortage({
        vesselUuid: "vsl-b",
        period: "2026-07",
      } as any);
      expect(dbB.calls.insert).toBe(1);
      expect(dbA.calls.insert).toBe(0);
      expect(typeof created.portageUuid).toBe("string");
      expect(created.portageUuid.length).toBeGreaterThan(0);
    });

    it("updates a portage header only on the active tenant's connection", async () => {
      currentTenant = "A";
      await portageRepo.updatePortage("prt-1", { status: "submitted" } as any);
      expect(dbA.calls.update).toBe(1);
      expect(dbB.calls.update).toBe(0);
    });
  });
});
