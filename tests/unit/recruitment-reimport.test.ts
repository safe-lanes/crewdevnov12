// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { candidateFingerprint, DuplicateImportError, persistCandidate, writeCandidate } from "../../server/v2/recruitment/import/persistence";
import type { Parsed } from "../../server/v2/recruitment/import/contract";

const context = vi.hoisted(() => ({ db: null as any }));
vi.mock("../../server/v2/db", () => ({ getDb: () => context.db }));
const parsed = (): Parsed => ({
  isValid: true, candidateName: "Import", status: "Applied", errors: [], summary: {},
  data: { candidate: [{ firstName: "Import" }], address: [], documents: [] },
} as any);

function database(initial: any[] = [], failTable?: string) {
  const rows = new Map(initial.map(row => [row.recCanUuid, structuredClone(row)]));
  const details: any[] = [];
  let numberReads = 0;
  const tx: any = {
    execute: vi.fn(async () => {}),
    select: (fields?: any) => {
      let condition: any;
      const chain: any = {
        from: () => chain, innerJoin: () => chain, where: (where: any) => { condition = where; return chain; },
        limit: async () => {
          const uuid = new PgDialect().sqlToQuery(condition).params[0];
          return rows.has(uuid as string) ? [rows.get(uuid as string)] : [];
        },
        then: (resolve: any) => { if (fields?.maxNum) numberReads++; return resolve([{ maxNum: 17 }]); },
      };
      return chain;
    },
    insert: (table: any) => ({ values: async (values: any) => {
      const name = getTableName(table);
      if (name === failTable) throw new Error("Late child failure");
      if (name === "recruitment_candidates_v2") {
        if (rows.has(values.recCanUuid)) throw new Error("UUID already exists");
        rows.set(values.recCanUuid, { ...values, isDeleted: false });
      } else details.push({ table: name, ...values });
    } }),
  };
  const db = { transaction: async (fn: any) => {
    const before = structuredClone([...rows.entries()]), length = details.length;
    try { return await fn(tx); } catch (error) {
      rows.clear(); for (const [key, row] of before) rows.set(key, row);
      details.splice(length);
      throw error;
    }
  } };
  return { db, tx, rows, details, numberReads: () => numberReads };
}

describe("Deleted workbook import identity", () => {
  it("recognizes an older typed certificate import after live IDs/canonical names are derived", async () => {
    const legacy = parsed();
    legacy.data.licenses = [{ certificateDocument: "chief engineer", certificateNo: "0007", __row: "0" }];
    legacy.data.training = [{ trainingCourse: "company induction", __row: "0" }];
    const current = structuredClone(legacy);
    current.data.licenses[0] = { certificateDocument: "Chief Engineer", licenseId: "LIC007",
      __certificateInput: "chief engineer", certificateNo: "0007", __row: "0" };
    current.data.training[0] = { trainingCourse: "Company Induction", courseId: "SAF029",
      __certificateInput: "company induction", __row: "0" };
    const oldUuid = candidateFingerprint(legacy);
    const fake = database([{ recCanUuid: oldUuid, isDeleted: false }]);
    await expect(writeCandidate(fake.tx, current, null)).rejects.toBeInstanceOf(DuplicateImportError);
    expect(fake.details).toEqual([]);
    fake.rows.get(oldUuid).isDeleted = true;
    const uuid = await writeCandidate(fake.tx, current, null);
    expect(uuid).not.toBe(oldUuid);
    expect(fake.details).toContainEqual(expect.objectContaining({ table: "cand_licenses", licenseId: "LIC007", certificateDocument: "Chief Engineer" }));
    expect(fake.details).toContainEqual(expect.objectContaining({ table: "cand_training_courses", courseId: "SAF029" }));
    await expect(writeCandidate(fake.tx, current, null)).rejects.toBeInstanceOf(DuplicateImportError);
  });
  it("retains legacy fingerprint UUIDs for a first import and rejects its active retry", async () => {
    const data = parsed(), fake = database();
    const uuid = await writeCandidate(fake.tx, data, null);
    expect(uuid).toBe(candidateFingerprint(data));
    const before = structuredClone([...fake.rows.values()]);
    await expect(writeCandidate(fake.tx, data, null)).rejects.toBeInstanceOf(DuplicateImportError);
    expect([...fake.rows.values()]).toEqual(before);
    expect(fake.numberReads()).toBe(1);
  });
  it("creates fresh candidate/details without changing the deleted legacy application", async () => {
    const data = parsed();
    data.data.address = [{ addressLine1: "New value" }];
    const old = { recCanUuid: candidateFingerprint(data), isDeleted: true, fileNo: "R-2020-0123", screeningDate: "2020-01-02", createdByUuid: "old-actor" };
    const fake = database([old]);
    const uuid = await writeCandidate(fake.tx, data, "new-actor");
    expect(uuid).not.toBe(old.recCanUuid);
    expect(fake.rows.get(old.recCanUuid)).toEqual(old);
    expect(fake.rows.get(uuid)).toMatchObject({ status: "Applied", createdByUuid: "new-actor", isDeleted: false, fileNo: `R-${new Date().getFullYear()}-0018` });
    expect(fake.details).toEqual([expect.objectContaining({ table: "cand_addresses", recCanUuid: uuid, addressLine1: "New value" })]);
  });
  it("keeps active duplicate protection across many delete/reimport cycles, even without identity fields", async () => {
    const data = parsed(), fake = database();
    const ids = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const uuid = await writeCandidate(fake.tx, data, null);
      expect(ids.has(uuid)).toBe(false);
      ids.add(uuid);
      await expect(writeCandidate(fake.tx, data, null)).rejects.toThrow("Open the active candidate");
      fake.rows.get(uuid).isDeleted = true;
    }
    expect(fake.rows.size).toBe(25);
    expect(fake.numberReads()).toBe(25);
    expect([...fake.rows.values()].every(row => row.isDeleted)).toBe(true);
  });
  it("continues to recognize an active generation after its candidate fields are edited", async () => {
    const data = parsed(), fake = database([{ recCanUuid: candidateFingerprint(data), isDeleted: true }]);
    const uuid = await writeCandidate(fake.tx, data, null);
    fake.rows.get(uuid).firstName = "Edited after import";
    await expect(writeCandidate(fake.tx, data, null)).rejects.toThrow("already imported");
    expect(fake.rows.get(uuid).firstName).toBe("Edited after import");
    expect(fake.numberReads()).toBe(1);
  });
  it("allows edited workbook values after deletion without merging deleted fields", async () => {
    const oldData = parsed(), newData = parsed();
    oldData.data.candidate[0].middleName = "Removed";
    const old = { recCanUuid: candidateFingerprint(oldData), isDeleted: true, middleName: "Removed" };
    const fake = database([old]);
    const uuid = await writeCandidate(fake.tx, newData, null);
    expect(fake.rows.get(uuid)).not.toHaveProperty("middleName");
    expect(fake.rows.get(old.recCanUuid)).toEqual(old);
  });
  it("treats unknown/nullable deletion markers as active rather than silently bypassing a duplicate", async () => {
    const data = parsed(), fake = database([{ recCanUuid: candidateFingerprint(data), isDeleted: null }]);
    await expect(writeCandidate(fake.tx, data, null)).rejects.toBeInstanceOf(DuplicateImportError);
    expect(fake.numberReads()).toBe(0);
  });
  it("rolls back a fresh generation on child failure without touching the old tombstone", async () => {
    const data = parsed();
    data.data.address = [{ addressLine1: "New value" }];
    const old = { recCanUuid: candidateFingerprint(data), isDeleted: true, fileNo: "R-2020-0001" };
    const fake = database([old], "cand_addresses");
    context.db = fake.db;
    await expect(persistCandidate(data, null)).rejects.toThrow("Late child failure");
    expect([...fake.rows.values()]).toEqual([old]);
    expect(fake.details).toEqual([]);
  });
});
