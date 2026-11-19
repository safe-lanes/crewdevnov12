import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { ncReportUpdatePatch, NCReportWorkflowError } from "../../server/v2/rest-hours/services/ncReportWorkflow";
import { NcReportsRepository } from "../../server/v2/rest-hours/repositories/ncReportsRepository";

const dbMock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../../server/v2/db", () => ({ getDb: dbMock.getDb }));
vi.mock("../../server/v2/rest-hours/repositories", async () => ({
  NcReportsRepository: (await import("../../server/v2/rest-hours/repositories/ncReportsRepository")).NcReportsRepository,
}));
vi.mock("../../server/v2/rest-hours/services", async () => ({
  ncReportsService: (await import("../../server/v2/rest-hours/services/ncReportsService")).ncReportsService,
}));
import { ncReportsService } from "../../server/v2/rest-hours/services/ncReportsService";
import { ncReportsController } from "../../server/v2/rest-hours/controllers/ncReportsController";

describe("NC report workflow patch", () => {
  it.each([
    ["draft", undefined, "draft", "Open"],
    ["draft", "draft", "draft", "Open"],
    ["draft", "vessel-submitted", "vessel-submitted", "Open"],
    ["draft", "office-submitted", "office-submitted", "Closed"],
    ["vessel-submitted", undefined, "vessel-submitted", "Open"],
    ["vessel-submitted", "draft", "vessel-submitted", "Open"],
    ["vessel-submitted", "vessel-submitted", "vessel-submitted", "Open"],
    ["vessel-submitted", "office-submitted", "office-submitted", "Closed"],
  ])("%s + %s retains/advances to %s", (current, requested, next, status) => {
    expect(ncReportUpdatePatch({ submissionStatus: current }, {
      submissionStatus: requested, status: "Closed", identifiedRootCause: "Changed", updatedByUuid: "AUDIT-USER",
    })).toMatchObject({ submissionStatus: next, status, identifiedRootCause: "Changed", updatedByUuid: "AUDIT-USER" });
  });

  it.each([undefined, null, "draft", "vessel-submitted", "office-submitted"])("rejects %s writes to Office-locked reports", requested => {
    expect(() => ncReportUpdatePatch({ submissionStatus: "office-submitted" }, { submissionStatus: requested }))
      .toThrowError(NCReportWorkflowError);
  });
  it("rejects an unknown explicit workflow stage", () => {
    expect(() => ncReportUpdatePatch({ submissionStatus: "vessel-submitted" }, { submissionStatus: "unknown" })).toThrow("Invalid NC report submission status.");
  });
  it("does not mutate the caller's patch", () => {
    const patch = Object.freeze({ submissionStatus: "draft", status: "Open", identifiedRootCause: "Changed" });
    ncReportUpdatePatch({ submissionStatus: "vessel-submitted" }, patch);
    expect(patch.submissionStatus).toBe("draft");
  });
});

// Isolated transaction harness: no database connections or project-data writes.
// Locking occurs at SELECT FOR UPDATE, not at transaction entry, so tests also
// assert that the repository actually requests the row lock before updating.
let rows: Map<string, any>, lockTail: Promise<void>, events: string[];
function row(stage = "draft") {
  return { ncReportUuid: "REPORT-A", submissionStatus: stage, status: stage === "office-submitted" ? "Closed" : "Open", identifiedRootCause: "Original", isDeleted: false };
}
function uuidFrom(where: any) {
  const query = new PgDialect().sqlToQuery(where);
  expect(query.sql).toContain('"nc_report_uuid"');
  expect(query.sql).toContain('"is_deleted"');
  expect(query.params[1]).toBe(false);
  return query.params[0] as string;
}
beforeEach(() => {
  rows = new Map([["REPORT-A", row()], ["REPORT-B", { ...row(), ncReportUuid: "REPORT-B" }]]);
  lockTail = Promise.resolve(); events = [];
  dbMock.getDb.mockReturnValue({
    select: () => ({ from: () => ({ where: async (where: any) => {
      const result = rows.get(uuidFrom(where));
      return result && !result.isDeleted ? [{ ...result }] : [];
    } }) }),
    transaction: async (work: any) => {
      let release: (() => void) | undefined;
      let selectedUuid: string | undefined;
      let snapshot: any;
      const tx = {
        select: () => ({ from: () => ({ where: (where: any) => ({ for: async (mode: string) => {
          expect(mode).toBe("update");
          const preceding = lockTail;
          lockTail = new Promise<void>(resolve => { release = resolve; });
          await preceding;
          selectedUuid = uuidFrom(where);
          snapshot = rows.get(selectedUuid);
          events.push(`lock:${snapshot?.submissionStatus}`);
          return snapshot && !snapshot.isDeleted ? [{ ...snapshot }] : [];
        } }) }) }),
        update: () => ({ set: (patch: any) => ({ where: (where: any) => ({ returning: async () => {
          expect(selectedUuid).toBeDefined();
          const uuid = uuidFrom(where);
          expect(uuid).toBe(selectedUuid);
          const updated = { ...rows.get(uuid), ...patch };
          rows.set(uuid, updated); events.push(`write:${updated.submissionStatus}`);
          return [updated];
        } }) }) }),
      };
      try { return await work(tx); }
      catch (error) {
        if (selectedUuid && snapshot) rows.set(selectedUuid, snapshot);
        throw error;
      } finally { release?.(); }
    },
  });
});

describe("NC report atomic persistence", () => {
  const repository = new NcReportsRepository();
  it("locks the exact non-deleted report, preserves stage and audit, and leaves other reports untouched", async () => {
    rows.set("REPORT-A", row("vessel-submitted"));
    const result = await ncReportsService.update("REPORT-A", {
      identifiedRootCause: "Changed", submissionStatus: "draft", status: "Open", auditUserUuid: "AUDIT-USER",
    });
    expect(events).toEqual(["lock:vessel-submitted", "write:vessel-submitted"]);
    expect(result).toMatchObject({ submissionStatus: "vessel-submitted", status: "Open", updatedByUuid: "AUDIT-USER" });
    expect(result).not.toHaveProperty("auditUserUuid");
    expect(rows.get("REPORT-B")).toMatchObject({ identifiedRootCause: "Original", submissionStatus: "draft" });
  });

  it.each([true, false])("a concurrent stale save cannot undo Vessel submission; save first=%s", async saveFirst => {
    const save = () => repository.update("REPORT-A", { submissionStatus: "draft", status: "Open" });
    const submit = () => repository.update("REPORT-A", { submissionStatus: "vessel-submitted", status: "Open" });
    await Promise.all(saveFirst ? [save(), submit()] : [submit(), save()]);
    expect(rows.get("REPORT-A")).toMatchObject({ submissionStatus: "vessel-submitted", status: "Open" });
    expect(events.filter(e => e.startsWith("lock:"))).toHaveLength(2);
  });

  it.each([true, false])("a concurrent stale save cannot reopen Office submission; save first=%s", async saveFirst => {
    const save = () => repository.update("REPORT-A", { submissionStatus: "draft", status: "Open", identifiedRootCause: "Stale" });
    const submit = () => repository.update("REPORT-A", { submissionStatus: "office-submitted", status: "Closed", identifiedRootCause: "Office approved" });
    const results = await Promise.allSettled(saveFirst ? [save(), submit()] : [submit(), save()]);
    expect(rows.get("REPORT-A")).toMatchObject({ submissionStatus: "office-submitted", status: "Closed", identifiedRootCause: "Office approved" });
    if (!saveFirst) {
      expect(results[1].status).toBe("rejected");
      expect(events).toEqual(["lock:draft", "write:office-submitted", "lock:office-submitted"]);
    }
  });

  it("makes no update when the report was deleted or is absent", async () => {
    rows.set("REPORT-A", { ...row(), isDeleted: true });
    expect(await repository.update("REPORT-A", { submissionStatus: "vessel-submitted" })).toBeUndefined();
    expect(await repository.update("MISSING", { submissionStatus: "vessel-submitted" })).toBeUndefined();
    expect(events.some(e => e.startsWith("write:"))).toBe(false);
  });

  it("returns a clear 409 without changing an Office-submitted record", async () => {
    rows.set("REPORT-A", row("office-submitted"));
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await ncReportsController.update({ params: { uuid: "REPORT-A" }, body: { submissionStatus: "draft", identifiedRootCause: "Stale" } } as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: expect.stringContaining("Your changes were not saved") });
    expect(rows.get("REPORT-A")).toEqual(row("office-submitted"));
    expect(events).toEqual(["lock:office-submitted"]);
  });
});
