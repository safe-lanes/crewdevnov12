// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { crewCertificatesService } from "../../server/v2/crew-pool/services/crewCertificatesService";

const context = vi.hoisted(() => ({
  db: null as any,
  ensure: vi.fn(),
  crew: vi.fn(),
  lock: vi.fn(),
  reconcile: vi.fn(),
  events: [] as string[],
}));
vi.mock("../../server/v2/db", () => ({ getDb: () => context.db }));
vi.mock("../../server/v2/training-needs/complianceSuggestions", () => ({
  lockCrewSuggestionAssignments: (...args: any[]) => context.lock(...args),
  reconcileCrewSuggestions: (...args: any[]) => context.reconcile(...args),
}));
vi.mock("../../server/v2/crew-pool/services/trainingAttachmentReference", () => ({
  ensureTrainingAttachmentReference: (...args: any[]) => context.ensure(...args),
}));
vi.mock("../../server/v2/crew-pool/services/crewMembersService", () => ({
  crewMembersService: { getByUuid: (...args: any[]) => context.crew(...args) },
}));
vi.mock("../../server/v2/crew-pool/services/masterDataResolver", () => ({ resolveCountryUuid: vi.fn() }));
vi.mock("../../server/v2/crew-pool/repositories", async () => ({
  CrewTrainingRepository: (await import("../../server/v2/crew-pool/repositories/crewTrainingRepository")).CrewTrainingRepository,
  CrewLicensesRepository: class {},
}));
vi.mock("../../server/v2/shared/fileStorageService.js", () => ({
  fileStorageService: { writeAttachment: vi.fn(async () => "stored/file.pdf"), deleteAttachment: vi.fn() },
}));
vi.mock("../../server/v2/shared/serveAttachmentHelper.js", () => ({ decodeStoredFile: () => null }));

function database() {
  const rows = new Map<string, any>();
  const attachments: any[] = [];
  const state = { failSave: false, failAttachment: false };
  const queryParams = (query: any) => new PgDialect().sqlToQuery(query).params;
  const db: any = {
    select: () => ({ from: () => ({ where: async (condition: any) => {
      const row = rows.get(String(queryParams(condition)[0]));
      return row && !row.isDeleted ? [{ ...row }] : [];
    } }) }),
    insert: (table: any) => ({ values: (data: any) => {
      const execute = () => {
        if (state.failSave) throw new Error("training insert failed");
        if (getTableName(table) === "crew_training_attachments") {
          if (state.failAttachment) throw new Error("attachment insert failed");
          attachments.push(data);
          context.events.push("attachment");
          return [data];
        }
        const row = { attachmentRef: null, isDeleted: false, ...data };
        rows.set(row.trainUuid, row);
        context.events.push("save");
        return [{ ...row }];
      };
      return { returning: async () => execute(), then: (resolve: any, reject: any) => Promise.resolve().then(execute).then(resolve, reject) };
    } }),
    update: () => ({ set: (data: any) => ({ where: (condition: any) => {
      const execute = () => {
        if (state.failSave) throw new Error("training update failed");
        const key = String(queryParams(condition)[0]);
        const original = rows.get(key);
        if (!original) return [];
        const defined = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
        rows.set(key, { ...original, ...defined });
        context.events.push("save");
        return [{ ...rows.get(key) }];
      };
      return { returning: async () => execute(), then: (resolve: any, reject: any) => Promise.resolve().then(execute).then(resolve, reject) };
    } }) }),
    transaction: async (callback: any) => {
      const before = [...rows].map(([key, row]) => [key, { ...row }] as const);
      const attachmentCount = attachments.length;
      context.events.push("begin");
      try {
        const result = await callback(db);
        context.events.push("commit");
        return result;
      } catch (error) {
        rows.clear();
        for (const [key, row] of before) rows.set(key, row);
        attachments.splice(attachmentCount);
        context.events.push("rollback");
        throw error;
      }
    },
  };
  return { db, rows, attachments, state };
}

beforeEach(() => {
  context.events = [];
  context.crew.mockReset().mockResolvedValue({ crewUuid: "crew-1", empNo: "K 1027" });
  context.lock.mockReset().mockImplementation(async () => { context.events.push("lock"); });
  context.reconcile.mockReset().mockImplementation(async () => { context.events.push("reconcile"); });
  context.ensure.mockReset().mockImplementation(async saved => {
    context.events.push("allocate");
    return saved;
  });
});

describe("training save reference integration", () => {
  it("keeps create response, UUID, audit values and course data, then allocates", async () => {
    const f = database(); context.db = f.db;
    const saved = await crewCertificatesService.createTraining("crew-1", {
      trainingCourse: "Advanced Fire Fighting", abbr: "AFF", auditUserUuid: "actor-1",
    });
    expect(saved.trainUuid).toBeTruthy();
    expect(saved).toMatchObject({ crewUuid: "crew-1", abbr: "AFF", courseId: null,
      createdByUuid: "actor-1", updatedByUuid: "actor-1" });
    expect(context.events).toEqual(["begin", "lock", "save", "reconcile", "commit", "allocate"]);
    expect(context.lock).toHaveBeenCalledWith(f.db, "crew-1");
    expect(context.reconcile).toHaveBeenCalledWith("crew-1", f.db);
    expect(context.ensure).toHaveBeenCalledWith(saved);
  });

  it.each(["SUPPLIED-REF", ""])("keeps a supplied non-null reference on creation (%s)", async attachmentRef => {
    const f = database(); context.db = f.db;
    const saved = await crewCertificatesService.createTraining("crew-1", { trainingCourse: "AFF", attachmentRef });
    expect(saved.attachmentRef).toBe(attachmentRef);
  });

  it.each(["STORED-REF", "", null])("preserves stored reference %s despite an incoming replacement", async attachmentRef => {
    const f = database(); context.db = f.db;
    f.rows.set("train-1", { trainUuid: "train-1", crewUuid: "crew-1", attachmentRef, abbr: "AFF",
      trainingCourse: "Advanced Fire Fighting", certificateNo: "old", isDeleted: false });
    const result = await crewCertificatesService.updateTraining("train-1", {
      certificateNo: "new", attachmentRef: "UNWANTED-REPLACEMENT", auditUserUuid: "actor-2",
    });
    expect(result).toMatchObject({ attachmentRef, abbr: "AFF", trainingCourse: "Advanced Fire Fighting",
      certificateNo: "new", updatedByUuid: "actor-2" });
    // The helper receives the already-merged persisted record, not a partial body.
    expect(context.ensure).toHaveBeenCalledWith(result);
    expect(context.events).toEqual(["begin", "lock", "save", "reconcile", "commit", "allocate"]);
    expect(context.lock).toHaveBeenCalledWith(f.db, "crew-1");
    expect(context.reconcile).toHaveBeenCalledWith("crew-1", f.db);
  });

  it("allows clearing abbr for fallback while preserving omitted course name", async () => {
    const f = database(); context.db = f.db;
    f.rows.set("train-1", { trainUuid: "train-1", crewUuid: "crew-1", attachmentRef: null,
      abbr: "AFF", trainingCourse: "Advanced Fire Fighting", isDeleted: false });
    const result = await crewCertificatesService.updateTraining("train-1", { abbr: " " });
    expect(context.ensure).toHaveBeenCalledWith(expect.objectContaining({ abbr: " ", trainingCourse: "Advanced Fire Fighting" }));
    expect(result.attachmentRef).toBeNull();
  });

  it("keeps original validation and save errors without allocating", async () => {
    const f = database(); context.db = f.db;
    await expect(crewCertificatesService.createTraining("crew-1", { trainingCourse: "" })).rejects.toThrow("Training course is required");
    await expect(crewCertificatesService.updateTraining("missing", { abbr: "AFF" })).rejects.toThrow("not found");
    f.state.failSave = true;
    await expect(crewCertificatesService.createTraining("crew-1", { trainingCourse: "AFF" })).rejects.toThrow("insert failed");
    expect(context.ensure).not.toHaveBeenCalled();
  });

  it("allocates only after the bulk transaction commits, preserving existing references and attachments", async () => {
    const f = database(); context.db = f.db;
    f.rows.set("old", { trainUuid: "old", crewUuid: "crew-1", attachmentRef: "EXISTING", isDeleted: false });
    f.rows.set("delete", { trainUuid: "delete", crewUuid: "crew-1", attachmentRef: null, isDeleted: false });
    const result = await crewCertificatesService.reconcileTrainingWithAttachments("crew-1", [
      { trainUuid: "old", data: { trainingCourse: "Updated", attachmentRef: null } },
      { data: { trainingCourse: "New", abbr: "NEW" }, attachments: [
        { isNew: true, fileName: "file.pdf", filePath: "existing/file.pdf" },
      ] },
      { trainUuid: "delete", isDeleted: true, data: {} },
    ], "actor-3");
    expect(result).toHaveLength(2);
    expect(result[0].attachmentRef).toBe("EXISTING");
    expect(result[1]).toMatchObject({ attachmentRef: null, abbr: "NEW", updatedByUuid: "actor-3" });
    expect(f.attachments).toHaveLength(1);
    expect(f.rows.get("delete").isDeleted).toBe(true);
    expect(context.ensure).toHaveBeenCalledTimes(2);
    expect(context.events.indexOf("allocate")).toBeGreaterThan(context.events.indexOf("commit"));
    expect(context.events[1]).toBe("lock");
    expect(context.events.indexOf("reconcile")).toBeLessThan(context.events.indexOf("commit"));
    expect(context.reconcile).toHaveBeenCalledWith("crew-1", f.db);
  });

  it("retains bulk rollback for real attachment failures and never allocates on rollback", async () => {
    const f = database(); context.db = f.db; f.state.failAttachment = true;
    await expect(crewCertificatesService.reconcileTrainingWithAttachments("crew-1", [{
      data: { trainingCourse: "New", abbr: "NEW" },
      attachments: [{ isNew: true, fileName: "file.pdf", filePath: "existing/file.pdf" }],
    }])).rejects.toThrow("attachment insert failed");
    expect(f.rows.size).toBe(0);
    expect(context.events).toContain("rollback");
    expect(context.ensure).not.toHaveBeenCalled();
  });

  it("rejects an ownership change before saving or allocating a reference", async () => {
    const f = database(); context.db = f.db;
    const original = { trainUuid: "train-1", crewUuid: "crew-1", attachmentRef: "STORED", isDeleted: false };
    f.rows.set("train-1", { ...original });
    await expect(crewCertificatesService.updateTraining("train-1", {
      crewUuid: "other-crew", attachmentRef: "REPLACEMENT", certificateNo: "BAD",
    })).rejects.toThrow("ownership cannot be changed");
    expect(f.rows.get("train-1")).toEqual(original);
    expect(context.events).toEqual([]);
    expect(context.ensure).not.toHaveBeenCalled();
  });

  it("retains repository ownership protection and bulk rollback", async () => {
    const f = database(); context.db = f.db;
    const original = { trainUuid: "train-1", crewUuid: "crew-1", attachmentRef: "STORED", isDeleted: false };
    f.rows.set("train-1", { ...original });
    await expect(crewCertificatesService.reconcileTrainingWithAttachments("crew-1", [
      { trainUuid: "train-1", data: { certificateNo: "FIRST" } },
      { trainUuid: "train-1", data: { crewUuid: "other-crew", attachmentRef: null } as any },
    ])).rejects.toThrow("ownership cannot be changed");
    expect(f.rows.get("train-1")).toEqual(original);
    expect(context.events).toEqual(["begin", "lock", "save", "rollback"]);
    expect(context.reconcile).not.toHaveBeenCalled();
    expect(context.ensure).not.toHaveBeenCalled();
  });

  it.each(["create", "update", "bulk"])("rolls back %s on suggestion failure without allocating", async path => {
    const f = database(); context.db = f.db;
    const original = { trainUuid: "train-1", crewUuid: "crew-1", attachmentRef: null, isDeleted: false };
    f.rows.set("train-1", { ...original });
    context.reconcile.mockImplementationOnce(async () => {
      context.events.push("reconcile");
      throw new Error("suggestion reconciliation failed");
    });
    const save = path === "create"
      ? crewCertificatesService.createTraining("crew-1", { trainingCourse: "AFF" })
      : path === "update"
        ? crewCertificatesService.updateTraining("train-1", { certificateNo: "NEW" })
        : crewCertificatesService.reconcileTrainingWithAttachments("crew-1", [
          { trainUuid: "train-1", data: { certificateNo: "NEW" } },
        ]);
    await expect(save).rejects.toThrow("suggestion reconciliation failed");
    expect([...f.rows.values()]).toEqual([original]);
    expect(context.events).toEqual(["begin", "lock", "save", "reconcile", "rollback"]);
    expect(context.ensure).not.toHaveBeenCalled();
  });
});
