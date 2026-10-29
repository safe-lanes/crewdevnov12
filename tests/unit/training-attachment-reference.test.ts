// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import type { CrewTrainingCourse } from "../../shared/v2/crew-pool/types";
import { ensureTrainingAttachmentReference } from "../../server/v2/crew-pool/services/trainingAttachmentReference";

const context = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../server/v2/db", () => ({ getDb: () => context.db }));

const training = (overrides: Partial<CrewTrainingCourse> = {}): CrewTrainingCourse => ({
  trainUuid: "train-1", crewUuid: "crew-1", attachmentRef: null,
  abbr: "AFF", trainingCourse: "Advanced Fire Fighting", isDeleted: false,
  certificateNo: "CERT-1", updatedByUuid: "user-1", sortOrder: 7,
  ...overrides,
} as CrewTrainingCourse);

// No live databases: exercise generated SQL, persisted-row reads and transaction
// sequencing against an in-memory adapter. Advisory locks serialize transactions.
function fixture(initial = [training()], empNo: string | null = "K 1027") {
  const rows = new Map(initial.map(row => [row.trainUuid, { ...row }]));
  const queries: { sql: string; params: unknown[] }[] = [];
  const refs: { crewUuid: string; ref: string | null; deleted?: boolean }[] = [];
  const locks = new Map<string, Promise<void>>();
  const state = { fail: "", updates: 0 };
  const db = {
    transaction: vi.fn(async (fn: (tx: any) => Promise<any>) => {
      let unlock: (() => void) | undefined;
      const undo: (() => void)[] = [];
      const compile = (query: any) => {
        const compiled = new PgDialect().sqlToQuery(query);
        queries.push(compiled);
        return compiled;
      };
      const tx = {
        execute: async (query: any) => {
          const compiled = compile(query);
          if (compiled.sql.includes("pg_advisory_xact_lock")) {
            if (state.fail === "lock") throw Object.assign(new Error("lock timeout"), { code: "55P03" });
            const crewUuid = String(compiled.params[0]);
            const previous = locks.get(crewUuid) ?? Promise.resolve();
            const next = new Promise<void>(resolve => { unlock = resolve; });
            locks.set(crewUuid, previous.then(() => next));
            await previous;
          }
          if (compiled.sql.includes("existing_refs")) {
            if (state.fail === "lookup") throw new Error("reference query failed");
            const crewUuid = compiled.params[0];
            return { rows: [
              ...refs.filter(r => r.crewUuid === crewUuid && !r.deleted),
              ...[...rows.values()].filter(r => r.crewUuid === crewUuid && !r.isDeleted)
                .map(r => ({ ref: r.attachmentRef })),
            ] };
          }
          return { rows: [] };
        },
        select: () => ({ from: (table: any) => ({ where: (condition: any) => {
          const { params } = compile(condition);
          const result = () => {
            if (getTableName(table) === "crew_members_v2") return empNo === null ? [] : [{ empNo }];
            const row = rows.get(String(params[0]));
            return row && row.crewUuid === params[1] && !row.isDeleted ? [{ ...row }] : [];
          };
          return {
            for: async (mode: string) => { expect(mode).toBe("update"); return result(); },
            then: (resolve: any) => Promise.resolve(result()).then(resolve),
          };
        } }) }),
        update: () => ({ set: (data: any) => ({ where: (condition: any) => ({ returning: async () => {
          const { sql, params } = compile(condition);
          expect(sql).toContain('"attachment_ref" is null');
          expect(sql).toContain('"crew_uuid"');
          expect(sql).toContain('"is_deleted"');
          if (state.fail === "write") throw new Error("write failed");
          const row = rows.get(String(params[0]));
          if (!row || row.crewUuid !== params[1] || row.isDeleted || row.attachmentRef !== null) return [];
          const original = { ...row };
          undo.push(() => rows.set(row.trainUuid, original));
          rows.set(row.trainUuid, { ...row, ...data, updatedAt: new Date() });
          state.updates++;
          return [rows.get(row.trainUuid)];
        } }) }) }),
      };
      try {
        const result = await fn(tx);
        if (state.fail === "commit") throw new Error("commit failed");
        return result;
      } catch (error) {
        for (const restore of undo.reverse()) restore();
        throw error;
      } finally { unlock?.(); }
    }),
  };
  return { db, rows, queries, refs, state };
}

beforeEach(() => { vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

describe("training attachment reference allocation", () => {
  it("uses the persisted abbreviation and employee number without sort order", async () => {
    const f = fixture([training({ abbr: "  ADV CHEMICAL TANKER  " })]);
    context.db = f.db;
    const result = await ensureTrainingAttachmentReference(training());
    expect(result.attachmentRef).toBe("K 1027-T_ADV CHEMICAL TANKER");
    expect(f.rows.get("train-1")).toMatchObject({ certificateNo: "CERT-1", updatedByUuid: "user-1", sortOrder: 7 });
    expect(f.queries.some(q => q.sql.includes("SET LOCAL lock_timeout"))).toBe(true);
  });

  it.each([null, "", "  "])("falls back to trainingCourse when abbr is %s", async abbr => {
    const row = training({ abbr, trainingCourse: "  Advanced Fire Fighting  " });
    const f = fixture([row]);
    const result = await ensureTrainingAttachmentReference(row, f.db);
    expect(result.attachmentRef).toBe("K 1027-T_Advanced Fire Fighting");
  });

  it.each(["EXISTING-REF", "", "   "])("preserves non-null reference '%s' without allocation", async attachmentRef => {
    const row = training({ attachmentRef });
    const f = fixture([row]);
    expect(await ensureTrainingAttachmentReference(row, f.db)).toBe(row);
    expect(f.db.transaction).not.toHaveBeenCalled();
  });

  it("preserves a reference assigned after the original save returned", async () => {
    const f = fixture([training({ attachmentRef: "ALREADY-ASSIGNED" })]);
    expect((await ensureTrainingAttachmentReference(training(), f.db)).attachmentRef).toBe("ALREADY-ASSIGNED");
    expect(f.state.updates).toBe(0);
  });

  it("is idempotent across retries using stale save results", async () => {
    const f = fixture();
    await ensureTrainingAttachmentReference(training(), f.db);
    await ensureTrainingAttachmentReference(training(), f.db);
    expect(f.state.updates).toBe(1);
  });

  it.each([null, "", "  "])("leaves null for missing employee number %s", async empNo => {
    const f = fixture(undefined, empNo);
    expect((await ensureTrainingAttachmentReference(training(), f.db)).attachmentRef).toBeNull();
    expect(f.state.updates).toBe(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it.each(["", "  ", null])("leaves null when both training names are blank (%s)", async name => {
    const row = training({ abbr: name, trainingCourse: name });
    const f = fixture([row]);
    expect((await ensureTrainingAttachmentReference(row, f.db)).attachmentRef).toBeNull();
    expect(f.state.updates).toBe(0);
  });

  it.each(["A/B", "A\\B", "A:B", "A\0B", "AFF.", "x".repeat(256)])(
    "does not silently modify unsafe reference suffix %s", async abbr => {
      const row = training({ abbr });
      const f = fixture([row]);
      expect((await ensureTrainingAttachmentReference(row, f.db)).attachmentRef).toBeNull();
      expect(f.state.updates).toBe(0);
    },
  );

  it("detects normalized conflicts across all importer sections", async () => {
    const f = fixture();
    f.refs.push({ crewUuid: "crew-1", ref: "\t k 1027-t_aff \n" });
    expect((await ensureTrainingAttachmentReference(training(), f.db)).attachmentRef).toBeNull();
    const query = f.queries.find(q => q.sql.includes("existing_refs"))!;
    for (const table of ["crew_documents", "crew_visas", "crew_education", "crew_licenses",
      "crew_training_courses", "crew_sea_service", "crew_pre_joining_medicals", "crew_doctor_visits",
      "crew_briefings", "crew_debriefings"]) {
      expect(query.sql).toContain(`from "${table}"`.replace("from", "FROM"));
    }
    expect(query.params).toEqual(Array(10).fill("crew-1"));
    expect(f.state.updates).toBe(0);
  });

  it("does not treat another crew or a deleted record as an active conflict", async () => {
    const f = fixture();
    f.refs.push({ crewUuid: "other-crew", ref: "K 1027-T_AFF" },
      { crewUuid: "crew-1", ref: "K 1027-T_AFF", deleted: true });
    expect((await ensureTrainingAttachmentReference(training(), f.db)).attachmentRef).toBe("K 1027-T_AFF");
  });

  it("keeps allocation isolated to the database provided by the tenant", async () => {
    const otherTenant = fixture();
    otherTenant.refs.push({ crewUuid: "crew-1", ref: "K 1027-T_AFF" });
    context.db = otherTenant.db;
    const tenant = fixture();
    expect((await ensureTrainingAttachmentReference(training(), tenant.db)).attachmentRef).toBe("K 1027-T_AFF");
    expect(otherTenant.db.transaction).not.toHaveBeenCalled();
  });

  it("does not modify deleted or moved records", async () => {
    for (const row of [training({ isDeleted: true }), training({ crewUuid: "other-crew" })]) {
      const f = fixture([row]);
      expect((await ensureTrainingAttachmentReference(training(), f.db)).attachmentRef).toBeNull();
      expect(f.state.updates).toBe(0);
    }
  });

  it.each(["lock", "lookup", "write", "commit"])("returns the successful save if allocation fails at %s", async fail => {
    const f = fixture();
    f.state.fail = fail;
    const saved = training();
    expect(await ensureTrainingAttachmentReference(saved, f.db)).toBe(saved);
    expect(f.rows.get("train-1")?.attachmentRef).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("serializes concurrent allocations for the same crew and abbreviation", async () => {
    const rows = [training(), training({ trainUuid: "train-2" })];
    const f = fixture(rows);
    const results = await Promise.all(rows.map(row => ensureTrainingAttachmentReference(row, f.db)));
    expect(results.filter(r => r.attachmentRef === "K 1027-T_AFF")).toHaveLength(1);
    expect(results.filter(r => r.attachmentRef === null)).toHaveLength(1);
    expect(f.state.updates).toBe(1);
  });
});
