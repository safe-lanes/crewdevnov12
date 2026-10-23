// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { lockRecruitmentNumbering, nextRecruitmentFileNumber, recruitmentSubmissionDate } from "../../server/v2/recruitment/services/candidateNumbering";

function database(maxNum: string | number | null) {
  const where = vi.fn(async () => [{ maxNum }]);
  return { select: vi.fn(() => ({ from: vi.fn(() => ({ where })) })), where, execute: vi.fn(async () => {}) };
}
describe("Recruitment annual numbering", () => {
  it.each([[17, "0018"], ["9999", "10000"], [null, "0001"]])("continues the saved maximum %s with at least four digits", async (max, suffix) => {
    expect(await nextRecruitmentFileNumber(database(max), new Date(2026, 9, 14))).toBe(`R-2026-${suffix}`);
  });
  it("uses the requested calendar year, ignores malformed suffixes and does not filter out deleted numbers", async () => {
    const db = database(null);
    const date = new Date(2027, 0, 1);
    expect(await nextRecruitmentFileNumber(db, date)).toBe("R-2027-0001");
    const selected = db.select.mock.calls[0][0];
    const dialect = new PgDialect();
    const query = dialect.sqlToQuery(selected.maxNum);
    expect(query.params).toContain("^R-2027-([0-9]+)$");
    const filter = dialect.sqlToQuery(db.where.mock.calls[0][0]);
    expect(filter.params).toContain("R-2027-%");
    expect(filter.sql).not.toContain("is_deleted");
    expect(db.execute).not.toHaveBeenCalled();
  });
  it("takes a transaction advisory lock shared by all numbering writers", async () => {
    const db = database(null);
    await lockRecruitmentNumbering(db);
    expect(new PgDialect().sqlToQuery(db.execute.mock.calls[0][0]).sql).toContain("pg_advisory_xact_lock(9642026)");
  });
  it("fails rather than overflowing or silently resetting invalid large numbers", async () => {
    await expect(nextRecruitmentFileNumber(database("9007199254740991"))).rejects.toThrow("supported range");
  });
  it("stores a server-calendar date matching the number's calendar, including rollover", () => {
    expect(recruitmentSubmissionDate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
    expect(recruitmentSubmissionDate(new Date(2027, 0, 1, 0, 1))).toBe("2027-01-01");
  });
});
