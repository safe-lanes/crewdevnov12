import { describe, it, expect, beforeEach, vi } from "vitest";

// Chainable fake of the Drizzle builder: every awaited chain resolves to the next queued result.
const state = vi.hoisted(() => ({ queue: [] as unknown[], transactions: 0, captured: [] as any[], tx: null as any }));

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
  // Same contract as the real one: a write that changed no row is not reported.
  captureChange: async (executor: unknown, change: any) => {
    if (!change.newRow) return;
    const table = typeof change.table === "string" ? change.table : change.table[Symbol.for("drizzle:Name")];
    state.captured.push({ executor, ...change, table });
  },
}));

vi.mock("../../server/v2/rest-hours/utils/naturalKeyInsert", () => ({
  insertOnNaturalKey: async () => state.queue.shift(),
}));

import { DailyRecordsRepository } from "../../server/v2/rest-hours/repositories/dailyRecordsRepository";
import { CrewRecordsRepository } from "../../server/v2/rest-hours/repositories/crewRecordsRepository";
import { FixedTasksRepository } from "../../server/v2/rest-hours/repositories/fixedTasksRepository";
import { VariableTasksRepository } from "../../server/v2/rest-hours/repositories/variableTasksRepository";
import { DatelineRepository } from "../../server/v2/rest-hours/repositories/datelineRepository";
import { OfficeCommentsRepository } from "../../server/v2/rest-hours/repositories/officeCommentsRepository";
import { VesselCommentsRepository } from "../../server/v2/rest-hours/repositories/vesselCommentsRepository";
import {
  VesselPlanningRepository,
  VesselPlanningAttachmentsRepository,
} from "../../server/v2/vessel/repositories/vesselPlanningRepository";

beforeEach(() => {
  state.queue = [];
  state.transactions = 0;
  state.captured = [];
});

const SIMPLE: Array<[string, any, string, string]> = [
  ["daily records", new DailyRecordsRepository(), "rhDailyUuid", "rh_daily_records_v2"],
  ["crew records", new CrewRecordsRepository(), "rhCrewRecordUuid", "rh_crew_records_v2"],
  ["fixed tasks", new FixedTasksRepository(), "fixedTaskUuid", "rh_fixed_tasks_v2"],
  ["variable tasks", new VariableTasksRepository(), "variableTaskUuid", "rh_variable_tasks_v2"],
  ["dateline", new DatelineRepository(), "adjustmentUuid", "rh_dateline_adjustments_v2"],
  ["office comments", new OfficeCommentsRepository(), "officeCommentUuid", "rh_office_violation_comments_v2"],
  ["vessel comments", new VesselCommentsRepository(), "vesselCommentUuid", "rh_vessel_violation_comments_v2"],
];

describe.each(SIMPLE)("%s capture", (_name, repo, key, tableName) => {
  it("update captures old and new row in one transaction", async () => {
    const old = { [key]: "u1", v: 1 };
    const next = { [key]: "u1", v: 2 };
    state.queue = [[old], [next]]; // lock read, update returning
    await repo.update("u1", { updatedByUuid: "actor" });
    expect(state.transactions).toBe(1);
    expect(state.captured).toHaveLength(1);
    expect(state.captured[0]).toMatchObject({ table: tableName, rowUuid: "u1", oldRow: old, newRow: next, actorUuid: "actor" });
    expect(state.captured[0].executor).toBe(state.tx);
  });

  it("soft delete is captured as an update", async () => {
    const old = { [key]: "u1", isDeleted: false };
    const next = { [key]: "u1", isDeleted: true };
    state.queue = [[old], [next]];
    expect(await repo.softDelete("u1")).toBe(true);
    expect(state.captured[0]).toMatchObject({ rowUuid: "u1", oldRow: old, newRow: next });
  });

  it("joins the caller's transaction instead of opening one", async () => {
    state.queue = [[{ [key]: "u1" }], [{ [key]: "u1" }]];
    const callerTx = state.tx;
    await repo.update("u1", {}, callerTx);
    expect(state.transactions).toBe(0);
    expect(state.captured).toHaveLength(1);
  });

  it("an update that matches no row captures nothing", async () => {
    state.queue = [[], []];
    expect(await repo.update("missing", {})).toBeUndefined();
    expect(state.captured).toHaveLength(0);
  });
});

describe("plain-create repositories capture an insert", () => {
  it.each([
    ["daily records", new DailyRecordsRepository(), "rhDailyUuid"],
    ["fixed tasks", new FixedTasksRepository(), "fixedTaskUuid"],
    ["variable tasks", new VariableTasksRepository(), "variableTaskUuid"],
    ["dateline", new DatelineRepository(), "adjustmentUuid"],
  ])("%s", async (_n, repo: any, key) => {
    const row = { [key]: "new1" };
    state.queue = [[row]];
    await repo.create({ createdByUuid: "creator" });
    expect(state.captured[0]).toMatchObject({ rowUuid: "new1", oldRow: null, newRow: row, actorUuid: "creator" });
  });
});

describe("vessel planning repository capture", () => {
  const repo = new VesselPlanningRepository();
  const attachments = new VesselPlanningAttachmentsRepository();

  it("create captures an insert", async () => {
    const row = { planUuid: "p1" };
    state.queue = [[row]];
    await repo.create({ vesselUuid: "v", createdByUuid: "a" } as any);
    expect(state.captured[0]).toMatchObject({ table: "vessel_planning_v2", rowUuid: "p1", oldRow: null, newRow: row, actorUuid: "a" });
  });

  it("update captures old and new rows", async () => {
    state.queue = [[{ planUuid: "p1", rank: "A" }], [{ planUuid: "p1", rank: "B" }]];
    await repo.update("p1", { rank: "B", updatedByUuid: "a" } as any);
    expect(state.captured[0]).toMatchObject({ rowUuid: "p1", oldRow: { rank: "A" }, newRow: { rank: "B" }, actorUuid: "a" });
  });

  it("archive, unarchive and delete are each captured with the actor", async () => {
    state.queue = [[{ planUuid: "p1" }], [{ planUuid: "p1", isArchived: true }]];
    await repo.archive("p1", "actor");
    state.queue = [[{ planUuid: "p1" }], [{ planUuid: "p1", isArchived: false }]];
    await repo.unarchive("p1", "actor");
    state.queue = [[{ planUuid: "p1" }], [{ planUuid: "p1", isDeleted: true }]];
    expect(await repo.delete("p1", "actor")).toBe(true);
    expect(state.captured.map((c) => c.actorUuid)).toEqual(["actor", "actor", "actor"]);
  });

  it("attachment create and soft delete are captured", async () => {
    state.queue = [[{ attUuid: "a1" }]];
    await attachments.create({ planUuid: "p1", uploadedByUuid: "u" } as any);
    state.queue = [[{ attUuid: "a1" }], [{ attUuid: "a1", isDeleted: true }]];
    expect(await attachments.softDelete("a1")).toBe(true);
    expect(state.captured).toHaveLength(2);
    expect(state.captured[0]).toMatchObject({ table: "vessel_planning_attachments_v2", oldRow: null, actorUuid: "u" });
    expect(state.captured[1]).toMatchObject({ rowUuid: "a1", newRow: { isDeleted: true } });
  });

  it("a failing capture rolls the write back (error propagates)", async () => {
    state.queue = [[{ planUuid: "p1" }]];
    const mod = await import("../../server/v2/sync/changeCapture");
    const spy = vi.spyOn(mod, "captureChange").mockRejectedValueOnce(new Error("log failed"));
    await expect(repo.create({ vesselUuid: "v" } as any)).rejects.toThrow("log failed");
    spy.mockRestore();
  });
});
