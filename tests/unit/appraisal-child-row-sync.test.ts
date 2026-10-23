import { beforeEach, describe, expect, it, vi } from "vitest";

// Conditions become plain objects so a test can see which row a write targets.
vi.mock("drizzle-orm", () => ({
  eq: (column: string, value: unknown) => ({ column, value }),
  inArray: (column: string, values: unknown[]) => ({ column, values }),
}));

import {
  AppraisalRowOwnershipError,
  syncChildRows,
  textField,
  type ChildTableConfig,
} from "@server/v2/appraisals/repositories/childRowSync";

const APPRAISAL = "a0000000-0000-4000-8000-000000000001";

const table = { id: "id", appraisalUuid: "appraisal_uuid", trainingUuid: "training_uuid" };
const cfg: ChildTableConfig = {
  table,
  uuidKey: "trainingUuid",
  fields: [
    textField("training"),
    textField("comment"),
    { column: "source", from: ["source"], normalize: (r) => r.source || undefined },
  ],
};

type Write = { kind: "insert" | "update"; values: Record<string, unknown>; rowId?: unknown };

function fakeExecutor(existing: any[], foreign: any[] = []) {
  const writes: Write[] = [];
  const executor = {
    select: (columns?: unknown) => ({
      from: () => ({ where: async () => (columns ? foreign : existing) }),
    }),
    insert: () => ({
      values: async (values: Record<string, unknown>) => { writes.push({ kind: "insert", values }); },
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async (cond: { value: unknown }) => { writes.push({ kind: "update", values, rowId: cond.value }); },
      }),
    }),
  };
  return { executor, writes };
}

function row(id: number, uuid: string, fields: Record<string, unknown> = {}) {
  return {
    id, trainingUuid: uuid, appraisalUuid: APPRAISAL, training: `T${id}`, comment: null,
    source: "manual", sortOrder: id - 1, isDeleted: false, updatedByUuid: "someone", ...fields,
  };
}

describe("syncChildRows (APD-16 / APD-36)", () => {
  let stored: any[];
  beforeEach(() => {
    stored = [row(1, "u1"), row(2, "u2", { comment: "office edit" }), row(3, "u3")];
  });

  it("patch: writes nothing for an unchanged row", async () => {
    const { executor, writes } = fakeExecutor(stored);
    const n = await syncChildRows(executor, cfg, APPRAISAL, { rows: [{ uuid: "u1", training: "T1", comment: "" }] }, "patch", "me");
    expect(n).toBe(0);
    expect(writes).toEqual([]);
  });

  it("patch: updates only the changed column of the matching row and leaves other rows alone", async () => {
    const { executor, writes } = fakeExecutor(stored);
    await syncChildRows(executor, cfg, APPRAISAL, { rows: [{ uuid: "u3", comment: "ship edit" }] }, "patch", "me");

    expect(writes).toHaveLength(1);
    expect(writes[0].kind).toBe("update");
    expect(writes[0].rowId).toBe(3);
    expect(Object.keys(writes[0].values).sort()).toEqual(["comment", "updatedAt", "updatedByUuid"]);
    expect(writes[0].values.comment).toBe("ship edit");
  });

  it("patch: soft-deletes only the listed uuid, never rows that were not sent", async () => {
    const { executor, writes } = fakeExecutor(stored);
    await syncChildRows(executor, cfg, APPRAISAL, { rows: [], deleted: ["u2"] }, "patch", "me");

    expect(writes).toEqual([
      expect.objectContaining({ kind: "update", rowId: 2, values: expect.objectContaining({ isDeleted: true }) }),
    ]);
  });

  it("patch: inserts a new row under the client's uuid after the last row", async () => {
    const { executor, writes } = fakeExecutor(stored);
    await syncChildRows(executor, cfg, APPRAISAL, { rows: [{ uuid: "u-new", training: "ECDIS", comment: "" }] }, "patch", "me");

    expect(writes).toEqual([{
      kind: "insert",
      values: {
        training: "ECDIS", comment: null, trainingUuid: "u-new", appraisalUuid: APPRAISAL,
        sortOrder: 3, createdByUuid: "me", updatedByUuid: "me",
      },
    }]);
  });

  it("an empty value whose normaliser returns undefined keeps the stored column", async () => {
    const { executor, writes } = fakeExecutor(stored);
    await syncChildRows(executor, cfg, APPRAISAL, { rows: [{ uuid: "u1", source: "" }] }, "patch", "me");
    expect(writes).toEqual([]);
  });

  it("ignores a write to a row that was deleted elsewhere", async () => {
    stored[0].isDeleted = true;
    const { executor, writes } = fakeExecutor(stored);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await syncChildRows(executor, cfg, APPRAISAL, { rows: [{ uuid: "u1", comment: "late edit" }] }, "patch", "me");
    expect(writes).toEqual([]);
  });

  it("rejects a uuid that belongs to another appraisal", async () => {
    const { executor } = fakeExecutor(stored, [{ uuid: "other" }]);
    await expect(
      syncChildRows(executor, cfg, APPRAISAL, { rows: [{ uuid: "other", comment: "x" }] }, "patch", "me"),
    ).rejects.toBeInstanceOf(AppraisalRowOwnershipError);
  });

  it("replace: matches by uuid, so removing a middle row deletes it instead of shifting content", async () => {
    const { executor, writes } = fakeExecutor(stored);
    await syncChildRows(executor, cfg, APPRAISAL, {
      rows: [
        { uuid: "u1", training: "T1", comment: "" },
        { uuid: "u3", training: "T3", comment: "" },
      ],
    }, "replace", "me");

    // u3 moves up one place (sortOrder only); u2 is soft-deleted; u1 is untouched.
    expect(writes).toEqual([
      expect.objectContaining({ kind: "update", rowId: 3, values: expect.objectContaining({ sortOrder: 1 }) }),
      expect.objectContaining({ kind: "update", rowId: 2, values: expect.objectContaining({ isDeleted: true }) }),
    ]);
    expect(Object.keys(writes[0].values).sort()).toEqual(["sortOrder", "updatedAt", "updatedByUuid"]);
  });
});
