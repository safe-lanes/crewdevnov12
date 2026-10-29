import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";

// APD-50: the Appraisal reports compared appraisal_results_v2.vessel as plain
// text, but the column holds a master_vessels UUID (older / synced rows may
// hold the name) while the Reports dropdown sends the name, so the filter found
// nothing and the Vessel column showed the UUID. They also ignored the
// logged-in Ship user's vessels, and one rating that was not a plain number
// failed the whole Scores Summary on ::numeric.

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@server/v2/db", () => ({ getDb: getDbMock }));

import { apprPendingReport, apprScoresSummaryReport } from "@server/v2/reports/handlers/appraisals";
import type { ReportHandlerContext } from "@server/v2/reports/types";

const GAS_MIA = "744535d0-841a-11ed-aa7c-7003bca91a86";
const OFFICE = { vesselUser: false, vessels: [] };

// Builds each query with a real (unconnected) Drizzle builder, records the
// rendered SQL, and resolves it with no rows.
let queries: { sql: string; params: unknown[] }[] = [];
function fakeDb() {
  const real = drizzle.mock();
  return {
    select(fields: any) {
      let builder: any = real.select(fields);
      const proxy: any = new Proxy({}, {
        get(_t, prop) {
          if (prop === "then") {
            queries.push(builder.toSQL());
            return (resolve: (rows: unknown[]) => void) => resolve([]);
          }
          return (...args: unknown[]) => {
            builder = builder[prop](...args);
            return proxy;
          };
        },
      });
      return proxy;
    },
  };
}

const ctx = (actor?: ReportHandlerContext["actor"]): ReportHandlerContext => ({
  page: 1,
  pageSize: 50,
  sort: null,
  actor,
});

beforeEach(() => {
  queries = [];
  getDbMock.mockReset();
  getDbMock.mockImplementation(() => fakeDb());
});

describe("appr-pending vessel", () => {
  it("filters by the vessel name resolved through master_vessels", async () => {
    await apprPendingReport.run({ vessel: "Gas Mia" }, ctx(OFFICE));
    for (const q of queries) {
      expect(q.sql).toContain("master_vessels.vessel_uuid");
      expect(q.params).toContain("Gas Mia");
      expect(q.sql).not.toMatch(/"vessel" = \$\d/);
    }
  });

  it("shows and sorts by the name, with the column keeping its table prefix", async () => {
    await apprPendingReport.run({}, { ...ctx(OFFICE), sort: { key: "vessel", direction: "asc" } });
    const rowsQuery = queries.find((q) => q.sql.includes("order by"))!;
    const [selectList, orderBy] = rowsQuery.sql.split(/ from "appraisal_results_v2"/);
    // A bare "vessel" inside the subquery would bind to master_vessels.vessel.
    expect(selectList).toContain('master_vessels.vessel_uuid = "appraisal_results_v2"."vessel"');
    expect(orderBy).toMatch(/order by COALESCE\(\(/);
  });
});

describe("ship scoping", () => {
  const reports = [
    ["appr-pending", () => apprPendingReport],
    ["appr-scores-summary", () => apprScoresSummaryReport],
  ] as const;

  it.each(reports)("%s: a Ship user with no vessels gets nothing and no query runs", async (_id, report) => {
    const result = await report().run({}, ctx({ vesselUser: true, vessels: [] }));
    expect(result).toEqual({ total: 0, rows: [] });
    expect(getDbMock).not.toHaveBeenCalled();
  });

  it.each(reports)("%s: a Ship user is limited to their vessels (UUID or name rows)", async (_id, report) => {
    await report().run({}, ctx({ vesselUser: true, vessels: [GAS_MIA] }));
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) {
      expect(q.sql).toMatch(/"appraisal_results_v2"\."vessel" IN \(\$\d+\)/);
      expect(q.sql).toContain("WHERE master_vessels.vessel_uuid IN (");
      expect(q.params).toContain(GAS_MIA);
    }
  });

  it.each(reports)("%s: office users and requests without a user are not limited", async (_id, report) => {
    for (const actor of [OFFICE, undefined]) {
      queries = [];
      await report().run({}, ctx(actor));
      for (const q of queries) expect(q.sql).not.toContain("vessel_uuid IN (");
    }
  });
});

describe("appr-scores-summary ratings", () => {
  it("only averages ratings that are plain numbers", async () => {
    await apprScoresSummaryReport.run({}, ctx(OFFICE));
    const q = queries[0];
    expect(q.sql).toContain("~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$' THEN TRIM(");
    expect(q.sql.match(/THEN TRIM\("appraisal_results_v2"\."\w+_rating"\)::numeric/g)).toHaveLength(3);
    expect(q.sql).not.toContain("'')::numeric");
  });
});
