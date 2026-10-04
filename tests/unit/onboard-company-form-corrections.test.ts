import { afterEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { CompanyFormSubmissionsRepository } from "../../server/v2/company-forms/submissionsRepository";
import { CompanyFormSubmissionsService } from "../../server/v2/company-forms/submissionsService";
import { CompanyFormSubmissionLifecycleRepository } from "../../server/v2/company-forms/submissionLifecycleRepository";

const dbMock = vi.hoisted(() => ({ current: null as any }));
vi.mock("../../server/v2/db", () => ({ getDb: () => dbMock.current }));
afterEach(() => vi.restoreAllMocks());

describe("Crew List count and reciprocal labels", () => {
  it.each(["on_board", "before_joining"])("keeps %s count semantics scoped and does not filter archived saved records", async stage => {
    let predicate: any;
    dbMock.current = { select: () => ({ from: () => ({ where: (where: any) => {
      predicate = where;
      return { groupBy: async () => [{ subjectRef: "saved", count: 2 }] };
    } }) }) };
    const counts = await new CompanyFormSubmissionsRepository().countsForSubjects("crew_assignment", ["saved", "empty"], stage);
    expect(counts).toEqual({ saved: 2, empty: 0 });
    const sql = new PgDialect().sqlToQuery(predicate);
    expect(sql.sql).toContain('"stage_key"');
    expect(sql.sql).toContain('"is_deleted"');
    expect(sql.params).toContain(stage);
    expect(sql.sql.includes("<> 'voided'")).toBe(stage === "on_board");
    expect(sql.sql).not.toContain("archived");
  });

  it.each(["replaces", "replaced_by"])("uses the actual pinned form and original saved voider in the %s direction", async direction => {
    const row = {
      submissionUuid: "source", voidedByName: "Saved Office Original", voidedAt: "2026-10-02",
      ...(direction === "replaces" ? { replacesSubmissionUuid: "target" } : { replacedBySubmissionUuid: "target" }),
    };
    const target = {
      submission: { systemSnapshotAt: "2026-10-03", createdAt: "2026-09-20",
        voidedByName: "Saved Target Original", voidedAt: "2026-10-01" },
      form: { name: "Actual On-board Declaration" },
      systemSnapshots: [{ fieldKey: "seafarer_name", value: "NEVER THE VOIDING PERSON" }],
    };
    const service = new CompanyFormSubmissionsService(undefined, undefined, undefined, {
      readPinnedRenderData: vi.fn().mockResolvedValue(target),
    } as any);
    const authorize = vi.spyOn(service as any, "authorizeSubmission").mockResolvedValue({});
    const links = await (service as any).readableHistory({}, row);
    expect(authorize).toHaveBeenCalledWith({}, "target", "read_submission");
    expect(links[0].submissionUuid).toBe("target");
    expect(links[0].targetLabel).toContain("Actual On-board Declaration — Declaration 03-Oct-2026");
    expect(links[0].targetLabel).toContain(direction === "replaces"
      ? "Voided by Saved Target Original — Voided 01-Oct-2026"
      : "Voided by Saved Office Original — Voided 02-Oct-2026");
    expect(links[0].targetLabel).not.toContain("NEVER");
  });

  it("labels creation fallback and unavailable saved identity without consulting current users", async () => {
    const service = new CompanyFormSubmissionsService(undefined, undefined, undefined, {
      readPinnedRenderData: async () => ({
        submission: { createdAt: "2026-09-20", systemSnapshotAt: null },
        form: { name: "Saved form" },
      }),
    } as any);
    vi.spyOn(service as any, "authorizeSubmission").mockResolvedValue({});
    const [link] = await (service as any).readableHistory({}, { replacedBySubmissionUuid: "target" });
    expect(link.targetLabel).toBe("Saved form — Created (declaration date unavailable) 20-Sep-2026 — Voided by Historical voiding identity unavailable — Voided Unavailable");
  });

  it("refuses labels for an unauthorized related submission", async () => {
    const read = vi.fn();
    const service = new CompanyFormSubmissionsService(undefined, undefined, undefined, { readPinnedRenderData: read } as any);
    vi.spyOn(service as any, "authorizeSubmission").mockRejectedValue(new Error("Denied"));
    await expect((service as any).readableHistory({}, { replacesSubmissionUuid: "target" })).rejects.toThrow("Denied");
    expect(read).not.toHaveBeenCalled();
  });
});

describe("Retirement acknowledgement under the server form lock", () => {
  it.each([undefined, "2026-10-01T00:00:00.000Z", "2026-10-03T09:36:28.067Z"])(
    "accepts only the exact current archive state, acknowledgement=%s", async acknowledgement => {
      let selectNo = 0;
      const writes = vi.fn();
      const archivedAt = new Date("2026-10-03T09:36:28.067Z");
      const submission = { submissionUuid: "test", formUuid: "form", subjectRef: "subject", stageKey: "on_board", status: "in_progress" };
      const tx: any = {
        execute: vi.fn(), update: () => ({ set: () => ({ where: writes }) }),
        select: () => {
          selectNo++;
          const rows = selectNo === 1 || selectNo === 3 || selectNo === 4 ? [submission]
            : selectNo === 2 ? [{ archivedAt }]
            : [{ fullname: "Recorded Office", designation: "Crewing" }];
          const chain: any = { from: () => chain, where: () => chain, limit: () => chain,
            for: async () => rows, then: (resolve: any) => Promise.resolve(rows).then(resolve) };
          return chain;
        },
      };
      dbMock.current = { transaction: (fn: any) => fn(tx) };
      const input = {
        submissionUuid: "test", reason: "Test reason", retirementConfirmedAt: acknowledgement,
        actor: { kind: "office", userId: 99 } as any,
        adapter: { lockForStart: async () => ({ subjectRef: "subject", context: {} }), authorize: async () => true } as any,
      };
      if (acknowledgement === archivedAt.toISOString()) {
        await new CompanyFormSubmissionLifecycleRepository().voidSubmission(input);
        expect(writes).toHaveBeenCalledTimes(1);
      } else {
        await expect(new CompanyFormSubmissionLifecycleRepository().voidSubmission(input))
          .rejects.toThrow("This form has been retired. Voiding will not allow a replacement on this form.");
        expect(writes).not.toHaveBeenCalled();
      }
    });
});