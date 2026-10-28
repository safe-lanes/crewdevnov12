import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import { PgDialect, PgTable } from "drizzle-orm/pg-core";

// APD-33: deleting an appraisal soft-deleted only appraisal_results_v2. Its
// rows in the 11 appr_* tables stayed live, so the sync would send live rows
// of a deleted appraisal to the other side. Now the delete takes the child
// rows with it, in the same transaction.

const { repo, getDbMock } = vi.hoisted(() => ({
  repo: { softDeleteByAppraisalUuid: vi.fn() },
  getDbMock: vi.fn(),
}));

vi.mock("@server/v2/db", () => ({ getDb: getDbMock }));
vi.mock("@server/v2/appraisals/repositories", () => {
  const Repo = vi.fn(function () { return repo; });
  return {
    AppraisalResultsRepository: Repo,
    ApprTrainingsRepository: Repo,
    ApprTargetsRepository: Repo,
    ApprCompetenceAssessmentsRepository: Repo,
    ApprBehaviouralAssessmentsRepository: Repo,
    ApprTrainingNeedsRepository: Repo,
    ApprRecommendationsRepository: Repo,
    ApprAppraiserCommentsRepository: Repo,
    ApprSeafarerCommentsRepository: Repo,
    ApprOfficeReviewsRepository: Repo,
    ApprTrainingFollowupsRepository: Repo,
    ApprReviewersRepository: Repo,
  };
});
vi.mock("@server/v2/crew-pool/repositories", () => ({ CrewMembersRepository: vi.fn() }));
vi.mock("@server/v2/admin/services", () => ({ formsService: {} }));
vi.mock("@server/v2/shared/emailService", () => ({ sendEmail: vi.fn(), logEmailEvent: vi.fn() }));

import * as schema from "@shared/v2/appraisals/schema";
import { AppraisalResultsService } from "@server/v2/appraisals/services/appraisalResultsService";
import { AppraisalResultsRepository } from "@server/v2/appraisals/repositories/appraisalResultsRepository";
import {
  APPRAISAL_CHILD_TABLES,
  softDeleteAppraisalChildRows,
} from "@server/v2/appraisals/repositories/childRowSync";

const UUID = "30000000-0000-4000-8000-000000000033";
const ACTOR_UUID = "2228582e-8c50-4bb9-ad0d-58be4e02a165";

const dialect = new PgDialect();
const render = (cond: any) => dialect.sqlToQuery(cond);

interface RecordedUpdate {
  table: any;
  values: Record<string, unknown>;
  where: { sql: string; params: unknown[] };
}

// An executor that records each UPDATE. Each update matches `rowsPerTable`
// rows, and an update of `failOn` throws.
function fakeExecutor(opts: { rowsPerTable?: number; failOn?: any } = {}) {
  const updates: RecordedUpdate[] = [];
  const executor = {
    updates,
    update: (table: any) => ({
      set: (values: Record<string, unknown>) => ({
        where: (cond: any) => ({
          returning: async () => {
            if (table === opts.failOn) throw new Error(`update of ${getTableName(table)} failed`);
            updates.push({ table, values, where: render(cond) });
            return Array.from({ length: opts.rowsPerTable ?? 1 }, (_, i) => ({ id: i + 1 }));
          },
        }),
      }),
    }),
  };
  return executor;
}

let tx: ReturnType<typeof fakeExecutor>;

beforeEach(() => {
  vi.clearAllMocks();
  tx = fakeExecutor();
  getDbMock.mockReturnValue({
    transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
  });
  repo.softDeleteByAppraisalUuid.mockResolvedValue(true);
});

describe("the child table list", () => {
  it("holds every appr_* table of the appraisal schema, once", () => {
    const apprTables = Object.values(schema)
      .filter((t): t is PgTable => t instanceof PgTable)
      .map((t) => getTableName(t))
      .filter((name) => name.startsWith("appr_"))
      .sort();

    const listed = APPRAISAL_CHILD_TABLES.map((t) => getTableName(t)).sort();

    expect(listed).toEqual(apprTables);
    expect(new Set(listed).size).toBe(11);
  });
});

describe("deleting an appraisal (service)", () => {
  const service = new AppraisalResultsService();

  it("deletes the appraisal and its live rows in all 11 child tables in one transaction", async () => {
    await expect(service.delete(UUID, ACTOR_UUID)).resolves.toBe(true);

    expect(getDbMock().transaction).toHaveBeenCalledTimes(1);
    expect(repo.softDeleteByAppraisalUuid).toHaveBeenCalledWith(UUID, ACTOR_UUID, tx);
    expect(tx.updates.map((u) => u.table)).toEqual([...APPRAISAL_CHILD_TABLES]);

    for (const u of tx.updates) {
      const name = getTableName(u.table);
      expect(u.values).toEqual({ isDeleted: true, updatedAt: expect.any(Date), updatedByUuid: ACTOR_UUID });
      // Only this appraisal's rows, and only the live ones.
      expect(u.where.sql).toBe(`("${name}"."appraisal_uuid" = $1 and "${name}"."is_deleted" = $2)`);
      expect(u.where.params).toEqual([UUID, false]);
    }
  });

  it("returns false and touches no child row when the appraisal is not found or already deleted", async () => {
    repo.softDeleteByAppraisalUuid.mockResolvedValue(false);

    await expect(service.delete(UUID, ACTOR_UUID)).resolves.toBe(false);

    expect(tx.updates).toEqual([]);
  });

  it("fails as a whole when a child table can't be updated, so the transaction rolls back", async () => {
    tx = fakeExecutor({ failOn: schema.apprOfficeReviewsV2 });

    await expect(service.delete(UUID, ACTOR_UUID)).rejects.toThrow(/appr_office_reviews_v2/);
  });
});

describe("softDeleteAppraisalChildRows", () => {
  it("returns the number of rows deleted across all tables", async () => {
    const executor = fakeExecutor({ rowsPerTable: 2 });

    await expect(softDeleteAppraisalChildRows(executor, UUID, ACTOR_UUID)).resolves.toBe(22);
  });

  it("keeps each row's updated_by when no user is given", async () => {
    const executor = fakeExecutor();

    await softDeleteAppraisalChildRows(executor, UUID, null);

    for (const u of executor.updates) {
      expect(u.values).toEqual({ isDeleted: true, updatedAt: expect.any(Date) });
    }
  });
});

describe("AppraisalResultsRepository.softDeleteByAppraisalUuid", () => {
  const parentRepo = new AppraisalResultsRepository();

  it("writes on the given transaction and records who deleted it", async () => {
    const executor = fakeExecutor();

    await expect(parentRepo.softDeleteByAppraisalUuid(UUID, ACTOR_UUID, executor)).resolves.toBe(true);

    expect(executor.updates).toHaveLength(1);
    const [u] = executor.updates;
    expect(getTableName(u.table)).toBe("appraisal_results_v2");
    expect(u.values).toEqual({ isDeleted: true, updatedAt: expect.any(Date), updatedByUuid: ACTOR_UUID });
    expect(u.where.params).toEqual([UUID, false]);
  });

  it("returns false when no live appraisal has the id", async () => {
    const executor = fakeExecutor({ rowsPerTable: 0 });

    await expect(parentRepo.softDeleteByAppraisalUuid(UUID, ACTOR_UUID, executor)).resolves.toBe(false);
  });
});
