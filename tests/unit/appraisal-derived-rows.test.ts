import { describe, expect, it, vi } from "vitest";

// APD-20: rows the app derives on its own must not be added twice.
// APD-37: a Stage 2 resubmit must not rewrite the reviewer rows.

// Conditions become plain objects so the fake database below can apply them.
vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ op: "eq", column, value }),
  inArray: (column: unknown, values: unknown[]) => ({ op: "in", column, values }),
  and: (...conds: unknown[]) => ({ op: "and", conds }),
}));
vi.mock("@server/v2/db", () => ({ getDb: vi.fn() }));

import { ApprOfficeReviewsRepository } from "@server/v2/appraisals/repositories/apprOfficeReviewsRepository";
import { ApprTrainingsRepository } from "@server/v2/appraisals/repositories/apprTrainingsRepository";
import { ApprReviewersRepository } from "@server/v2/appraisals/repositories/apprReviewersRepository";
import { AppraisalRowFieldLockedError } from "@server/v2/appraisals/repositories/childRowSync";
import { apprOfficeReviewsV2, apprTrainingsV2, apprReviewersV2 } from "@shared/v2/appraisals/schema";

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

// APD-41: a client's isAssigned is ignored; only Stage 2 sets it.
describe("G1 is_assigned is set only by Stage 2", () => {
  const repo = new ApprOfficeReviewsRepository();

  it("save draft: a sent isAssigned does not change a hand-added row", async () => {
    const db = fakeDb(apprOfficeReviewsV2, [g1(1, { userUuid: "user-m", name: "Manual M", isAssigned: false })]);
    const n = await repo.applyChanges(APPRAISAL, { rows: [{ uuid: "g1-1", isAssigned: true }] }, "me", db.executor);

    expect(n).toBe(0);
    expect(db.writes).toEqual([]);
    expect(db.rows[0].isAssigned).toBe(false);
  });

  it("stage submit: a stale isAssigned does not unassign an assigned row", async () => {
    const db = fakeDb(apprOfficeReviewsV2, [g1(1, { userUuid: "user-x", name: "Xavier X", isAssigned: true })]);
    await repo.syncForAppraisal(APPRAISAL, [{ uuid: "g1-1", name: "Xavier X", userUuid: "user-x", isAssigned: false }], "me", db.executor);

    expect(db.writes).toEqual([]);
    expect(db.rows[0].isAssigned).toBe(true);
  });

  it("a new row is inserted without isAssigned, so it gets the column default", async () => {
    const db = fakeDb(apprOfficeReviewsV2, []);
    await repo.applyChanges(APPRAISAL, { rows: [{ uuid: "g1-new", name: "Manual M", userUuid: "user-m", isAssigned: true }] }, "me", db.executor);

    expect(db.writes.map((w) => w.kind)).toEqual(["insert"]);
    expect(db.writes[0].values).toMatchObject({ name: "Manual M", userUuid: "user-m" });
    expect(db.writes[0].values).not.toHaveProperty("isAssigned");
  });

  it("saves the rest of the row and drops only isAssigned", async () => {
    const db = fakeDb(apprOfficeReviewsV2, [g1(1, { userUuid: "user-x", name: "Xavier X", isAssigned: true })]);
    await repo.applyChanges(APPRAISAL, { rows: [{ uuid: "g1-1", feedback: "Looks good", isAssigned: false }] }, "me", db.executor);

    expect(db.writes).toHaveLength(1);
    expect(db.writes[0].values).toMatchObject({ feedback: "Looks good" });
    expect(db.writes[0].values).not.toHaveProperty("isAssigned");
    expect(db.rows[0].isAssigned).toBe(true);
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

describe("ApprTrainingsRepository stores an auto row's D3 course (APD-42)", () => {
  const repo = new ApprTrainingsRepository();

  it("saves the course of a new auto row", async () => {
    const db = fakeDb(apprTrainingsV2, []);
    await repo.syncForAppraisal(APPRAISAL, [
      { uuid: "auto-u", training: "Fire fighting", source: "auto", sourceTrainUuid: "train-a" },
    ], "me", db.executor);

    const inserts = db.writes.filter((w) => w.kind === "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].values).toMatchObject({ trainingUuid: "auto-u", sourceTrainUuid: "train-a" });
  });

  it("fills the course of a row saved before the link existed", async () => {
    const db = fakeDb(apprTrainingsV2, [training(1, "auto-u", { sourceTrainUuid: null })]);
    const n = await repo.applyChanges(APPRAISAL, { rows: [{ uuid: "auto-u", sourceTrainUuid: "train-a" }] }, "me", db.executor);

    expect(n).toBe(1);
    expect(db.rows[0].sourceTrainUuid).toBe("train-a");
  });

  it("refuses to move a row to another course and writes nothing", async () => {
    const db = fakeDb(apprTrainingsV2, [training(1, "auto-u", { sourceTrainUuid: "train-a" })]);

    await expect(repo.applyChanges(APPRAISAL, {
      rows: [{ uuid: "auto-u", evaluation: "Good", sourceTrainUuid: "train-b" }],
    }, "me", db.executor)).rejects.toBeInstanceOf(AppraisalRowFieldLockedError);
    expect(db.writes.filter((w) => w.ids && w.ids.length > 0)).toEqual([]);
    expect(db.rows[0]).toMatchObject({ sourceTrainUuid: "train-a", evaluation: null });
  });

  it("keeps the stored course when a row is sent without one", async () => {
    const db = fakeDb(apprTrainingsV2, [training(1, "auto-u", { sourceTrainUuid: "train-a" })]);
    const n = await repo.syncForAppraisal(APPRAISAL, [
      { uuid: "auto-u", training: "Fire fighting", source: "auto", sourceTrainUuid: null },
    ], "me", db.executor);

    expect(n).toBe(0);
    expect(db.rows[0].sourceTrainUuid).toBe("train-a");
  });
});

function reviewerRow(id: number, fields: Record<string, unknown>) {
  return {
    id, reviewerUuid: `rv-${id}`, appraisalUuid: APPRAISAL, userUuid: null, reviewerName: null, designation: null,
    sortOrder: id - 1, isDeleted: false, updatedByUuid: null, ...fields,
  };
}

describe("ApprReviewersRepository.syncForAppraisal (APD-37)", () => {
  const repo = new ApprReviewersRepository();
  const A = { userUuid: "user-a", reviewerName: "Anna A", designation: "DPA" };
  const B = { userUuid: "user-b", reviewerName: "Ben B", designation: "Fleet Manager" };
  const live = () => [reviewerRow(1, A), reviewerRow(2, B)];

  it("first submit inserts one row per reviewer, in order", async () => {
    const db = fakeDb(apprReviewersV2, []);
    const n = await repo.syncForAppraisal(APPRAISAL, [A, B], "me", db.executor);

    expect(n).toBe(2);
    expect(db.writes.map((w) => w.kind)).toEqual(["insert", "insert"]);
    expect(db.rows.map((r) => [r.userUuid, r.sortOrder, r.createdByUuid])).toEqual([["user-a", 0, "me"], ["user-b", 1, "me"]]);
  });

  it("the same list again writes nothing and keeps the row uuids", async () => {
    const db = fakeDb(apprReviewersV2, []);
    await repo.syncForAppraisal(APPRAISAL, [A, B], "me", db.executor);
    const uuids = db.rows.map((r) => r.reviewerUuid);
    const again = await repo.syncForAppraisal(APPRAISAL, [{ ...A }, { ...B }], "other", db.executor);

    expect(again).toBe(0);
    expect(db.writes).toHaveLength(2);
    expect(db.rows.map((r) => r.reviewerUuid)).toEqual(uuids);
    expect(db.rows.every((r) => !r.isDeleted)).toBe(true);
  });

  it("adding a reviewer inserts only that one", async () => {
    const db = fakeDb(apprReviewersV2, live());
    const C = { userUuid: "user-c", reviewerName: "Cara C", designation: "HSEQ" };

    expect(await repo.syncForAppraisal(APPRAISAL, [A, B, C], "me", db.executor)).toBe(1);
    expect(db.writes.map((w) => w.kind)).toEqual(["insert"]);
    expect(db.writes[0].values).toMatchObject({ userUuid: "user-c", sortOrder: 2 });
  });

  it("removing a reviewer soft-deletes only that row", async () => {
    const db = fakeDb(apprReviewersV2, live());

    expect(await repo.syncForAppraisal(APPRAISAL, [A], "me", db.executor)).toBe(1);
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({ kind: "update", ids: [2], values: { isDeleted: true } });
    expect(db.rows[0].isDeleted).toBe(false);
  });

  it("a new order updates only the sort order", async () => {
    const db = fakeDb(apprReviewersV2, live());
    await repo.syncForAppraisal(APPRAISAL, [B, A], "me", db.executor);

    expect(db.writes.map((w) => w.kind)).toEqual(["update", "update"]);
    for (const w of db.writes) expect(Object.keys(w.values).sort()).toEqual(["sortOrder", "updatedAt", "updatedByUuid"]);
    expect(db.rows.map((r) => [r.id, r.sortOrder, r.isDeleted])).toEqual([[1, 1, false], [2, 0, false]]);
  });

  it("an edited designation updates only that column", async () => {
    const db = fakeDb(apprReviewersV2, live());
    await repo.syncForAppraisal(APPRAISAL, [{ ...A, designation: "Superintendent" }, B], "me", db.executor);

    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({ kind: "update", ids: [1], values: { designation: "Superintendent" } });
    expect(db.writes[0].values).not.toHaveProperty("reviewerName");
    expect(db.writes[0].values).not.toHaveProperty("sortOrder");
  });

  it("matches a row with no user by its name instead of adding another", async () => {
    const db = fakeDb(apprReviewersV2, [reviewerRow(1, { reviewerName: " Anna A ", designation: "DPA" })]);
    await repo.syncForAppraisal(APPRAISAL, [A], "me", db.executor);

    expect(db.writes.map((w) => w.kind)).toEqual(["update"]);
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]).toMatchObject({ reviewerUuid: "rv-1", userUuid: "user-a", isDeleted: false });
  });

  it("does not bring back a deleted row of the same user", async () => {
    const db = fakeDb(apprReviewersV2, [reviewerRow(1, { ...A, isDeleted: true })]);
    await repo.syncForAppraisal(APPRAISAL, [A], "me", db.executor);

    expect(db.writes.map((w) => w.kind)).toEqual(["insert"]);
    expect(db.rows[0].isDeleted).toBe(true);
  });

  it("a reviewer listed twice keeps the same two rows on the next submit", async () => {
    const db = fakeDb(apprReviewersV2, []);
    await repo.syncForAppraisal(APPRAISAL, [A, A], "me", db.executor);

    expect(await repo.syncForAppraisal(APPRAISAL, [A, A], "me", db.executor)).toBe(0);
    expect(db.rows).toHaveLength(2);
  });
});
