import { readFileSync } from "fs";
import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { v5 as uuidv5 } from "uuid";

// APD-39 parked issue 3: each server made up its own random ct_uuid, so the
// same company training had a different id on the office and on each vessel.
// The id is now worked out from the training code, the same on every server.

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@server/v2/db", () => ({ getDb: getDbMock }));

import {
  COMPANY_TRAINING_UUID_NAMESPACE,
  companyTrainingUuid,
  nameBasedUuidV8,
} from "@server/v2/admin/utils/companyTrainingUuid";
import { CompanyTrainingsRepository } from "@server/v2/admin/repositories/companyTrainingsRepository";

const SC001 = "fc65ca0c-1075-8e4f-817c-967c7df88377";

describe("companyTrainingUuid", () => {
  it("follows the RFC 9562 B.2 name-based UUIDv8 example", () => {
    expect(nameBasedUuidV8("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com"))
      .toBe("5c146b14-3c52-8afd-938a-375d0df1fbf6");
  });

  it("uses a fixed namespace and gives fixed ids (never change them)", () => {
    expect(COMPANY_TRAINING_UUID_NAMESPACE).toBe(uuidv5("safelanes.crewing.company_trainings", uuidv5.URL));
    expect(companyTrainingUuid("SC001")).toBe(SC001);
    expect(companyTrainingUuid("SA001")).toBe("27a5a229-505b-84d7-8865-f9b7ff94bc5f");
  });

  it("ignores case and surrounding spaces in the code", () => {
    expect(companyTrainingUuid("  sc001 ")).toBe(SC001);
  });

  it("refuses an empty code", () => {
    expect(() => companyTrainingUuid("  ")).toThrow(/needs a code/);
  });
});

describe("migration 0274", () => {
  const sql = readFileSync(join(__dirname, "../../migrations/0274_company_training_ct_uuid_from_code.sql"), "utf8");

  it("computes the id the same way as the app", () => {
    expect(sql).toContain(`decode('${COMPANY_TRAINING_UUID_NAMESPACE.replace(/-/g, "")}', 'hex')`);
    expect(sql).toContain("convert_to(upper(btrim(c.company_id)), 'UTF8')");
    expect(sql).toContain("6, (get_byte(d, 6) & 15) | 128");
    expect(sql).toContain("8, (get_byte(d, 8) & 63) | 128");
  });

  it("rewrites every stored copy before changing the ids, in one undoable block", () => {
    for (const table of ["appr_training_needs_v2", "appr_training_followups_v2", "promo_training_needs_v2",
      "training_needs_other_v2", "training_needs_source_overlay_v2"]) {
      expect(sql).toContain(`'${table}'`);
    }
    const rekey = sql.indexOf("UPDATE adm_company_trainings_v2 c");
    expect(sql.indexOf("UPDATE crew_training_courses t")).toBeGreaterThan(-1);
    expect(rekey).toBeGreaterThan(sql.indexOf("UPDATE crew_training_courses t"));
    expect(rekey).toBeGreaterThan(sql.indexOf("SET corresponding_in_db = m.new_uuid"));
    expect(sql).toMatch(/EXCEPTION\s+WHEN OTHERS THEN\s+RAISE WARNING/);
  });
});

// A tiny stand-in for the Drizzle calls the repository makes: each select()
// resolves to the next queued result; update/insert record what they write.
function fakeDb(selects: unknown[][]) {
  const queue = [...selects];
  const writes = { updated: [] as any[], inserted: [] as any[] };
  const query = (): any => {
    const result = queue.shift() ?? [];
    const chain: any = {
      from: () => chain, where: () => chain, orderBy: () => chain, leftJoin: () => chain,
      then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    };
    return chain;
  };
  return {
    writes,
    db: {
      select: query,
      update: () => {
        const chain: any = {
          set: (values: any) => { writes.updated.push(values); return chain; },
          where: () => chain,
          returning: async () => [{ id: 7, ...writes.updated.at(-1) }],
        };
        return chain;
      },
      insert: () => ({
        values: (values: any) => {
          writes.inserted.push(values);
          return { returning: async () => [{ id: 99, ...values }] };
        },
      }),
    },
  };
}

const MASTER = { id: 5, trainingId: "SC001", trainingLabel: "Basic Safety", trainingName: "Basic Safety Training", requirementReference: null };

describe("CompanyTrainingsRepository", () => {
  const repo = new CompanyTrainingsRepository();
  beforeEach(() => getDbMock.mockReset());

  it("createFromMaster inserts a new row with the code-based id", async () => {
    const fake = fakeDb([[], [MASTER], [{ sortOrder: 3 }], []]);
    getDbMock.mockReturnValue(fake.db);
    const row = await repo.createFromMaster(5, "user-1");
    expect(fake.writes.inserted).toHaveLength(1);
    expect(fake.writes.inserted[0]).toMatchObject({ ctUuid: SC001, trainingMasterId: 5, companyId: "SC001", sortOrder: 4, createdByUuid: "user-1" });
    expect(row?.ctUuid).toBe(SC001);
  });

  it("createFromMaster brings back the deleted row of the same code instead of inserting", async () => {
    const fake = fakeDb([[], [MASTER], [], [{ id: 7, ctUuid: SC001, isDeleted: true }]]);
    getDbMock.mockReturnValue(fake.db);
    const row = await repo.createFromMaster(5, "user-1");
    expect(fake.writes.inserted).toHaveLength(0);
    expect(fake.writes.updated[0]).toMatchObject({ isDeleted: false, trainingMasterId: 5, companyId: "SC001", updatedByUuid: "user-1" });
    expect(fake.writes.updated[0]).not.toHaveProperty("auditUserUuid");
    expect(row?.id).toBe(7);
  });

  it("createFromMaster refuses a code whose id a live row of another training holds", async () => {
    const fake = fakeDb([[], [MASTER], [], [{ id: 8, ctUuid: SC001, isDeleted: false }]]);
    getDbMock.mockReturnValue(fake.db);
    await expect(repo.createFromMaster(5)).rejects.toThrow(/already used/);
    expect(fake.writes.inserted).toHaveLength(0);
    expect(fake.writes.updated).toHaveLength(0);
  });

  it("create refuses a code that already has a row", async () => {
    const fake = fakeDb([[{ id: 7 }]]);
    getDbMock.mockReturnValue(fake.db);
    await expect(repo.create({ trainingMasterId: 5, companyId: "SC001", trainingLabel: "x" } as any))
      .rejects.toThrow(/already exists/);
    expect(fake.writes.inserted).toHaveLength(0);
  });

  it("updateById never changes ct_uuid", async () => {
    const fake = fakeDb([]);
    getDbMock.mockReturnValue(fake.db);
    await repo.updateById(7, { ctUuid: "00000000-0000-4000-8000-000000000000", trainingLabel: "New" } as any);
    expect(fake.writes.updated[0]).not.toHaveProperty("ctUuid");
    expect(fake.writes.updated[0]).toMatchObject({ trainingLabel: "New" });
  });
});
