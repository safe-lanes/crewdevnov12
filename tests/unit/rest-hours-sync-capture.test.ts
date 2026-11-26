import { describe, it, expect, vi, beforeEach } from "vitest";

// A chainable fake of the Drizzle query builder. Every query chain is awaited
// once and resolves to the next queued result.
const state = vi.hoisted(() => ({
  queue: [] as unknown[],
  transactions: 0,
  captured: [] as any[],
  tx: null as any,
}));

vi.mock("../../server/v2/db", () => {
  const chain = (): any => {
    const q: any = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === "then") return (res: any, rej: any) => Promise.resolve(state.queue.shift()).then(res, rej);
        return () => q;
      },
    });
    return q;
  };
  const tx = { select: chain, update: chain, insert: chain };
  state.tx = tx;
  return {
    getDb: () => ({
      transaction: async (fn: (t: any) => Promise<unknown>) => {
        state.transactions++;
        return fn(tx);
      },
    }),
  };
});

vi.mock("../../server/v2/sync/changeCapture", () => ({
  captureChange: async (executor: unknown, change: any) => {
    state.captured.push({ executor, ...change });
  },
}));

vi.mock("../../server/v2/rest-hours/utils/naturalKeyInsert", () => ({
  insertOnNaturalKey: async () => state.queue.shift(),
}));

import { VesselRecordsRepository } from "../../server/v2/rest-hours/repositories/vesselRecordsRepository";
import { NcReportsRepository } from "../../server/v2/rest-hours/repositories/ncReportsRepository";
import { rhVesselRecordsV2, rhNcReportsV2 } from "../../shared/v2/rest-hours/schema";

beforeEach(() => {
  state.queue = [];
  state.transactions = 0;
  state.captured = [];
});

describe("vessel records capture", () => {
  const repo = new VesselRecordsRepository();

  it("update captures the locked old row and the new row in one transaction", async () => {
    const old = { rhVesselUuid: "v1", vesselReviewStatus: "Due" };
    const next = { rhVesselUuid: "v1", vesselReviewStatus: "Submitted" };
    state.queue = [[old], [next]]; // lock read, update returning
    const out = await repo.update("v1", { vesselReviewStatus: "Submitted", updatedByUuid: "u1" } as any);
    expect(out).toBe(next);
    expect(state.transactions).toBe(1);
    expect(state.captured).toHaveLength(1);
    expect(state.captured[0]).toMatchObject({
      table: rhVesselRecordsV2, rowUuid: "v1", oldRow: old, newRow: next, actorUuid: "u1",
    });
    expect(state.captured[0].executor).toBe(state.tx);
  });

  it("uses the caller's transaction instead of opening one", async () => {
    const callerTx = {
      select: state.tx.select, update: state.tx.update, insert: state.tx.insert,
    };
    state.queue = [[{ rhVesselUuid: "v1" }], [{ rhVesselUuid: "v1", isLocked: true }]];
    await repo.update("v1", { isLocked: true } as any, callerTx);
    expect(state.transactions).toBe(0);
    expect(state.captured[0].executor).toBe(callerTx);
  });

  it("create reads the existing row first so a re-create is an update, not an insert", async () => {
    const existing = { rhVesselUuid: "x", totalCrew: 1 };
    const saved = { rhVesselUuid: "x", totalCrew: 2 };
    state.queue = [[existing], saved]; // lock read, insertOnNaturalKey
    await repo.create({ vesselId: "ves", monthValue: "2026-11", updatedByUuid: "u2" } as any);
    expect(state.captured[0]).toMatchObject({ oldRow: existing, newRow: saved, actorUuid: "u2" });
  });

  it("create of a new month captures an insert (old row null)", async () => {
    const saved = { rhVesselUuid: "n" };
    state.queue = [[], saved];
    await repo.create({ vesselId: "ves", monthValue: "2026-12", createdByUuid: "u3" } as any);
    expect(state.captured[0]).toMatchObject({ oldRow: null, newRow: saved, actorUuid: "u3" });
  });

  it("soft delete is captured as an update of the row", async () => {
    const old = { rhVesselUuid: "v1", isDeleted: false };
    const gone = { rhVesselUuid: "v1", isDeleted: true };
    state.queue = [[old], [gone]];
    expect(await repo.softDelete("v1")).toBe(true);
    expect(state.captured[0]).toMatchObject({ oldRow: old, newRow: gone });
  });
});

describe("NC report capture", () => {
  const repo = new NcReportsRepository();

  it("create captures an insert with the creator as actor", async () => {
    const row = { ncReportUuid: "n1", status: "Open" };
    state.queue = [[row]];
    await repo.create({ vesselId: "ves", crewMemberId: "c1", createdByUuid: "u1" } as any);
    expect(state.transactions).toBe(1);
    expect(state.captured[0]).toMatchObject({ table: rhNcReportsV2, rowUuid: "n1", oldRow: null, newRow: row, actorUuid: "u1" });
  });

  it("update captures the locked current row and the saved row", async () => {
    const current = { ncReportUuid: "n1", submissionStatus: "draft", status: "Open" };
    const saved = { ncReportUuid: "n1", submissionStatus: "vessel-submitted", status: "Open" };
    state.queue = [[current], [saved]];
    await repo.update("n1", { submissionStatus: "vessel-submitted", updatedByUuid: "u2" } as any);
    expect(state.captured[0]).toMatchObject({ rowUuid: "n1", oldRow: current, newRow: saved, actorUuid: "u2" });
  });

  it("a locked (office-submitted) report is rejected and nothing is captured", async () => {
    state.queue = [[{ ncReportUuid: "n1", submissionStatus: "office-submitted" }]];
    await expect(repo.update("n1", { rootCause: "x" } as any)).rejects.toThrow(/locked/);
    expect(state.captured).toHaveLength(0);
  });

  it("a missing report is not captured", async () => {
    state.queue = [[]];
    expect(await repo.update("nope", {} as any)).toBeUndefined();
    expect(state.captured).toHaveLength(0);
  });

  it("soft delete is captured", async () => {
    state.queue = [[{ ncReportUuid: "n1", isDeleted: false }], [{ ncReportUuid: "n1", isDeleted: true }]];
    expect(await repo.softDelete("n1")).toBe(true);
    expect(state.captured[0]).toMatchObject({ oldRow: { isDeleted: false }, newRow: { isDeleted: true } });
  });
});
