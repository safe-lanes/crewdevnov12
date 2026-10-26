import { describe, expect, it, vi } from "vitest";

// APD-20: rows the app derives on its own must not be added twice.

// Conditions become plain objects so the fake database below can apply them.
vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ op: "eq", column, value }),
  inArray: (column: unknown, values: unknown[]) => ({ op: "in", column, values }),
  and: (...conds: unknown[]) => ({ op: "and", conds }),
}));
vi.mock("@server/v2/db", () => ({ getDb: vi.fn() }));

import { ApprOfficeReviewsRepository } from "@server/v2/appraisals/repositories/apprOfficeReviewsRepository";
import { ApprTrainingsRepository } from "@server/v2/appraisals/repositories/apprTrainingsRepository";
import { apprOfficeReviewsV2, apprTrainingsV2 } from "@shared/v2/appraisals/schema";

const APPRAISAL = "a0000000-0000-4000-8000-000000000020";

type Cond = { op: "eq"; column: unknown; value: unknown }
  | { op: "in"; column: unknown; values: unknown[] }
  | { op: "and"; conds: Cond[] };

function matches(table: Record<string, unknown>, row: Record<string, unknown>, cond: Cond): boolean {
  if (cond.op === "and") return cond.conds.every((c) => matches(table, row, c));
  const key = Object.keys(table).find((k) => table[k] === cond.column);
  if (!key) throw new Error("Condition on an unknown column");
  return cond.op === "eq" ? row[key] === cond.value : cond.values.includes(row[key]);
}

// An in-memory table: selects, inserts and updates act on `rows`.
function fakeDb(table: any, rows: Record<string, any>[]) {
  const writes: { kind: "insert" | "update"; values: Record<string, unknown>; ids?: unknown[] }[] = [];
  let nextId = 100;
  const executor = {
    select: (columns?: unknown) => ({
      from: () => ({
        where: async (cond: Cond) => (columns ? [] : rows.filter((r) => matches(table, r, cond)).map((r) => ({ ...r }))),
      }),
    }),
    insert: () => ({
      values: async (values: Record<string, unknown>) => {
        writes.push({ kind: "insert", values });
        rows.push({ id: nextId++, isDeleted: false, ...values });
      },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: (cond: Cond) => {
          const hit = rows.filter((r) => matches(table, r, cond));
          hit.forEach((r) => Object.assign(r, values));
          writes.push({ kind: "update", values, ids: hit.map((r) => r.id) });
          return Object.assign(Promise.resolve(), { returning: async () => hit.map((r) => ({ id: r.id })) });
        },
      }),
    }),
  };
  return { executor, writes, rows };
}

function g1(id: number, fields: Record<string, unknown>) {
  return {
    id, officeReviewUuid: `g1-${id}`, appraisalUuid: APPRAISAL, name: null, position: null, feedback: null,
    userUuid: null, isAssigned: false, sortOrder: id - 1, isDeleted: false, updatedByUuid: null, ...fields,
  };
}

describe("ApprOfficeReviewsRepository.addAssignedReviewers", () => {
  const repo = new ApprOfficeReviewsRepository();
  const X = { userUuid: "user-x", reviewerName: "Xavier X", designation: "DPA" };

  it("adds one assigned row per reviewer with a user, skipping duplicates and reviewers without a user", async () => {
    const db = fakeDb(apprOfficeReviewsV2, []);
    const n = await repo.addAssignedReviewers(APPRAISAL, [X, { ...X }, { reviewerName: "Zed Z" }], "me", db.executor);

    expect(n).toBe(1);
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0].kind).toBe("insert");
    expect(db.writes[0].values).toMatchObject({
      appraisalUuid: APPRAISAL, name: "Xavier X", position: "DPA", userUuid: "user-x", isAssigned: true, createdByUuid: "me",
    });
  });

  it("writes nothing when run again", async () => {
    const db = fakeDb(apprOfficeReviewsV2, []);
    await repo.addAssignedReviewers(APPRAISAL, [X], "me", db.executor);
    const again = await repo.addAssignedReviewers(APPRAISAL, [X], "me", db.executor);

    expect(again).toBe(0);
    expect(db.writes).toHaveLength(1);
    expect(db.rows.filter((r) => r.userUuid === "user-x")).toHaveLength(1);
  });

  it("leaves a reviewer who already has an assigned row alone", async () => {
    const db = fakeDb(apprOfficeReviewsV2, [g1(1, { userUuid: "user-x", name: "Xavier X", isAssigned: true, feedback: "Done" })]);

    expect(await repo.addAssignedReviewers(APPRAISAL, [X], "me", db.executor)).toBe(0);
    expect(db.writes).toEqual([]);
  });

  it("marks the reviewer's hand-added row assigned instead of adding another", async () => {
    const db = fakeDb(apprOfficeReviewsV2, [g1(1, { userUuid: "user-x", name: "Xavier X", isAssigned: false, feedback: "Note" })]);
    await repo.addAssignedReviewers(APPRAISAL, [X], "me", db.executor);

    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({ kind: "update", ids: [1] });
    expect(db.writes[0].values).toMatchObject({ isAssigned: true });
    expect(db.writes[0].values).not.toHaveProperty("feedback");
  });

  it("counts a row from before migration 0180 (no user, same name) as the reviewer's", async () => {
    const db = fakeDb(apprOfficeReviewsV2, [g1(1, { userUuid: null, name: " Xavier X ", isAssigned: false })]);
    await repo.addAssignedReviewers(APPRAISAL, [X], "me", db.executor);

    expect(db.writes.map((w) => w.kind)).toEqual(["update"]);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].isAssigned).toBe(true);
  });

  it("does not match by name a row that belongs to another user", async () => {
    const db = fakeDb(apprOfficeReviewsV2, [g1(1, { userUuid: "user-other", name: "Xavier X", isAssigned: false })]);
    await repo.addAssignedReviewers(APPRAISAL, [X], "me", db.executor);

    expect(db.writes.map((w) => w.kind)).toEqual(["insert"]);
    expect(db.rows[0].isAssigned).toBe(false);
  });

  it("ignores deleted rows when deciding whether the reviewer has one", async () => {
    const db = fakeDb(apprOfficeReviewsV2, [g1(1, { userUuid: "user-x", name: "Xavier X", isAssigned: true, isDeleted: true })]);
    await repo.addAssignedReviewers(APPRAISAL, [X], "me", db.executor);

    expect(db.writes.map((w) => w.kind)).toEqual(["insert"]);
  });
});

function training(id: number, uuid: string, fields: Record<string, unknown>) {
  return {
    id, trainingUuid: uuid, appraisalUuid: APPRAISAL, training: "Fire fighting", evaluation: null, comment: null,
    source: "auto", sortOrder: id - 1, isDeleted: false, updatedByUuid: null, ...fields,
  };
}

describe("ApprTrainingsRepository brings back an auto row whose course returns", () => {
  const repo = new ApprTrainingsRepository();

  it("save draft: restores the deleted auto row and saves into it", async () => {
    const db = fakeDb(apprTrainingsV2, [training(1, "auto-u", { isDeleted: true, comment: "old" })]);
    const n = await repo.applyChanges(APPRAISAL, {
      rows: [{ uuid: "auto-u", training: "Fire fighting", source: "auto", comment: "new" }],
    }, "me", db.executor);

    expect(n).toBe(2);
    expect(db.rows[0]).toMatchObject({ isDeleted: false, comment: "new" });
    expect(db.writes.some((w) => w.kind === "insert")).toBe(false);
  });

  it("stage submit: restores it too", async () => {
    const db = fakeDb(apprTrainingsV2, [training(1, "auto-u", { isDeleted: true })]);
    await repo.syncForAppraisal(APPRAISAL, [{ uuid: "auto-u", training: "Fire fighting", source: "auto" }], "me", db.executor);

    expect(db.rows[0].isDeleted).toBe(false);
  });

  it("does not restore a deleted manual row", async () => {
    const db = fakeDb(apprTrainingsV2, [training(1, "row-u", { isDeleted: true, source: "manual" })]);
    const n = await repo.applyChanges(APPRAISAL, {
      rows: [{ uuid: "row-u", training: "Fire fighting", source: "auto" }],
    }, "me", db.executor);

    expect(n).toBe(0);
    expect(db.rows[0].isDeleted).toBe(true);
  });

  it("does not restore a row sent without source auto (a stale edit of a deleted row)", async () => {
    const db = fakeDb(apprTrainingsV2, [training(1, "auto-u", { isDeleted: true })]);
    const n = await repo.applyChanges(APPRAISAL, { rows: [{ uuid: "auto-u", comment: "late edit" }] }, "me", db.executor);

    expect(n).toBe(0);
    expect(db.rows[0]).toMatchObject({ isDeleted: true, comment: null });
  });

  it("writes nothing extra for a live auto row", async () => {
    const db = fakeDb(apprTrainingsV2, [training(1, "auto-u", {})]);
    const n = await repo.applyChanges(APPRAISAL, {
      rows: [{ uuid: "auto-u", training: "Fire fighting", source: "auto" }],
    }, "me", db.executor);

    expect(n).toBe(0);
    expect(db.writes.filter((w) => w.ids && w.ids.length > 0)).toEqual([]);
  });
});
