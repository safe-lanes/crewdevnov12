// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { Table, is, getTableColumns, eq, sql } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import * as a from "../../shared/v2/accounts/schema";
import { crewMembersV2, crewAssignments } from "../../shared/v2/crew-pool/schema";
import { masterNationalities } from "../../shared/schema";
import { promoExecutionLedgerV2 } from "../../shared/v2/promotions/schema";
import { admCompanyRanksV2 } from "../../shared/v2/admin/schema";

const context = vi.hoisted(() => ({ db: undefined as any }));
vi.mock("../../server/v2/db", async () => {
  const { scopedAccountDb } = await import("../../server/v2/accounts/accountDbScope");
  return { getBaseDb: () => context.db, getDb: () => scopedAccountDb(context.db) };
});
import { wageScalesService } from "../../server/v2/accounts/services/wageScalesService";
import { monthlyTransactionsService } from "../../server/v2/accounts/services/monthlyTransactionsService";
import { readApplicableWageValues, wageEngineService } from "../../server/v2/accounts/engine/wageEngineService";
import { coordinateAccounts } from "../../server/v2/accounts/accountCoordination";
import { accountDbScope } from "../../server/v2/accounts/accountDbScope";
import { vesselPortageController } from "../../server/v2/accounts/controllers/vesselPortageController";
import { coordinatedControllers } from "../../server/v2/accounts/controllers/coordinatedControllers";
import { vesselPortageService } from "../../server/v2/accounts/services/vesselPortageService";

let directory: string;
let pool: Pool;
const tables = [...Object.values(a).filter(value => is(value, Table)),
  crewMembersV2, crewAssignments, masterNationalities, promoExecutionLedgerV2, admCompanyRanksV2];
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const migration = readFileSync("migrations/0268_wage_revision_rate_protection.sql", "utf8");

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "wage-regression-"));
  execFileSync("initdb", ["-D", join(directory, "data"), "-U", "wage_test", "-A", "trust", "--no-locale"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"),
    "-o", `-k ${directory} -p 55440 -c listen_addresses=''`, "-w", "start"], { stdio: "pipe" });
  pool = new Pool({ host: directory, port: 55440, user: "wage_test", database: "postgres" });
  context.db = drizzle(pool);
  // Real column definitions, defaults and unique columns. Deliberately not a
  // substitute for running every historical application migration.
  for (const table of tables) {
    const config = getTableConfig(table as any);
    const cols = config.columns.map((column: any) => {
      let definition = `${quote(column.name)} ${column.getSQLType()}`;
      if (column.primary) definition += " PRIMARY KEY";
      else if (column.isUnique) definition += " UNIQUE";
      if (column.notNull) definition += " NOT NULL";
      if (column.default !== undefined && !/serial/i.test(column.getSQLType())) {
        const value = column.default;
        if (typeof value === "string") definition += ` DEFAULT '${value.replaceAll("'", "''")}'`;
        else if (typeof value === "boolean" || typeof value === "number") definition += ` DEFAULT ${value}`;
        else if (column.dataType === "date") definition += " DEFAULT now()";
      }
      return definition;
    });
    await pool.query(`CREATE TABLE ${quote(config.name)} (${cols.join(",")})`);
  }
  await pool.query(migration);
  await pool.query(migration);
}, 60000);

afterAll(async () => {
  if (pool) await pool.end();
  if (directory) {
    try { execFileSync("pg_ctl", ["-D", join(directory, "data"), "-m", "immediate", "-w", "stop"], { stdio: "pipe" }); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }
});

async function seed(table: any, values: Record<string, any>) {
  const data = { ...values };
  for (const [key, column] of Object.entries(getTableColumns(table)) as Array<[string, any]>) {
    if (key in data || !column.notNull || column.hasDefault) continue;
    data[key] = column.dataType === "number" ? 0
      : column.dataType === "boolean" ? false
      : column.dataType === "date" ? new Date()
      : column.dataType === "json" ? {}
      : /date/.test(column.getSQLType()) ? "2090-01-01"
      : /numeric/.test(column.getSQLType()) ? "0" : "test";
  }
  return (await context.db.insert(table).values(data).returning())[0];
}

async function fixture(status = "draft", bill?: string) {
  await pool.query(`TRUNCATE ${tables.map(t => quote(getTableConfig(t as any).name)).join(",")},
    acc_wage_revision_rate_protection_v2 RESTART IDENTITY CASCADE`);
  await seed(a.accTenantConfigV2, { configUuid: "config", preparationMode: "vessel_prepares" });
  await seed(a.accPayElementsV2, { payElementUuid: "ot", code: "OT", name: "Overtime",
    type: "earning", category: "overtime_variable", calcMethod: "rate_times_qty" });
  await seed(a.accWageScalesV2, { scaleUuid: "old", scaleName: "Old", status: "superseded",
    effectiveFrom: "2089-01-01", effectiveTo: "2090-10-31", supersededByScaleUuid: "new" });
  await seed(a.accWageScalesV2, { scaleUuid: "new", scaleName: "New",
    status: "draft", effectiveFrom: "2090-12-01" });
  for (const [scaleUuid, rate] of [["old", "10"], ["new", "15"]]) {
    await seed(a.accWageScaleLinesV2, { scaleLineUuid: `${scaleUuid}-ot`, scaleUuid,
      rankId: "capt", payElementUuid: "ot", rate, seniorityYearsFrom: 0 });
  }
  await seed(crewMembersV2, { crewUuid: "crew" });
  await seed(a.accEngagementsV2, { engagementUuid: "eng", crewUuid: "crew", vesselUuid: "v",
    wageScaleUuid: "old", rankIdAtStart: "capt", scaleYearAtStart: 1,
    startDate: "2090-01-01", status: "active" });
  await seed(a.accMonthlyTransactionsV2, { txnUuid: "t", engagementUuid: "eng",
    crewUuid: "crew", vesselUuid: "v", period: "2090-12", payElementUuid: "ot",
    qty: "10", rate: "10", amount: "100", currency: "USD", origin: "vessel", status });
  if (bill) await seed(a.accPortageBillsV2, { portageUuid: "bill", vesselUuid: "v",
    period: "2090-12", status: bill, isLocked: bill === "locked" });
}
beforeEach(() => fixture());

const activate = (extra: any = {}) => wageScalesService.activate("new", {
  predecessorAdjustment: { predecessorUuid: "old", previousEffectiveTo: "2090-10-31",
    revisionEffectiveFrom: "2090-12-01", nextEffectiveTo: "2090-11-30" }, ...extra,
});
async function snapshot() {
  return {
    scales: await context.db.select().from(a.accWageScalesV2).orderBy(a.accWageScalesV2.id),
    txns: await context.db.select().from(a.accMonthlyTransactionsV2).orderBy(a.accMonthlyTransactionsV2.id),
    markers: (await pool.query("SELECT * FROM acc_wage_revision_rate_protection_v2 ORDER BY txn_uuid")).rows,
  };
}
async function values() {
  return readApplicableWageValues("2090-12", await context.db.select().from(a.accEngagementsV2));
}

describe("real PostgreSQL activation and applicable wage integration", () => {
  it("installs the idempotent migration and index", async () => {
    expect((await pool.query("SELECT indexname FROM pg_indexes WHERE tablename='acc_wage_revision_rate_protection_v2'")).rows).toHaveLength(2);
  });
  it("looks up without writes and activates/corrects atomically", async () => {
    const before = await snapshot();
    expect((await values()).get("eng")?.entries.ot.rate).toBe("10.0000");
    expect(await snapshot()).toEqual(before);
    await activate();
    const after = await snapshot();
    expect(after.scales[0].effectiveTo).toBe("2090-11-30");
    expect(after.scales[1].status).toBe("active");
    expect(after.txns[0]).toMatchObject({ qty: "10.00", rate: "15.0000", amount: "150.00" });
    expect((await values()).get("eng")?.entries.ot.rate).toBe("15.0000");
  });
  it.each(["submitted", "accepted"])("preserves %s and adds protection", async status => {
    await fixture(status);
    const before = await snapshot();
    await activate();
    const after = await snapshot();
    expect(after.txns).toEqual(before.txns);
    expect(after.markers[0].txn_uuid).toBe("t");
  });
  it.each(["submitted", "accepted"])("missing saved %s rate rolls everything back", async status => {
    await fixture(status);
    await context.db.update(a.accMonthlyTransactionsV2).set({ rate: null });
    const before = await snapshot();
    await expect(activate()).rejects.toMatchObject({ code: "OVERTIME_RATE_BLOCKERS" });
    expect(await snapshot()).toEqual(before);
  });
  it("missing applicable draft rate rolls everything back", async () => {
    await context.db.update(a.accWageScaleLinesV2).set({ rate: null })
      .where(eq(a.accWageScaleLinesV2.scaleUuid, "new"));
    const before = await snapshot();
    await expect(activate()).rejects.toMatchObject({ code: "OVERTIME_RATE_BLOCKERS" });
    expect(await snapshot()).toEqual(before);
  });
  it.each(["locked", "approved", "office_review"])("preserves %s month drafts", async bill => {
    await fixture("draft", bill);
    const before = await snapshot();
    await activate();
    expect((await snapshot()).txns).toEqual(before.txns);
  });
  it("preserves frozen settlements", async () => {
    await seed(a.accSettlementsV2, { settlementUuid: "settled", engagementUuid: "eng",
      crewUuid: "crew", status: "approved" });
    const before = await snapshot();
    await activate();
    expect((await snapshot()).txns).toEqual(before.txns);
  });
  it("rejects stale confirmation without writes", async () => {
    const before = await snapshot();
    await expect(activate({ predecessorAdjustment: undefined })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await snapshot()).toEqual(before);
  });
  it("rejects late activation without writes", async () => {
    await context.db.update(a.accWageScalesV2).set({ effectiveFrom: "2000-01-01" })
      .where(eq(a.accWageScalesV2.scaleUuid, "new"));
    const before = await snapshot();
    await expect(activate()).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await snapshot()).toEqual(before);
  });
  it("shortens an existing end after exact confirmation", async () => {
    await context.db.update(a.accWageScalesV2).set({ effectiveTo: "2091-12-31" })
      .where(eq(a.accWageScalesV2.scaleUuid, "old"));
    await activate({ predecessorAdjustment: { predecessorUuid: "old",
      previousEffectiveTo: "2091-12-31", revisionEffectiveFrom: "2090-12-01",
      nextEffectiveTo: "2090-11-30" } });
    expect((await snapshot()).scales[0].effectiveTo).toBe("2090-11-30");
  });
  it("replaces a stale browser rate on actual draft save", async () => {
    await activate();
    const updated = await monthlyTransactionsService.update("t", { qty: "12", rate: "10", amount: "120" });
    expect(updated).toMatchObject({ rate: "15.0000", amount: "180.00" });
  });
  it("rejects foreign engagement rate lookup through a claimed own vessel", async () => {
    await seed(a.accEngagementsV2, { engagementUuid: "foreign", crewUuid: "other",
      vesselUuid: "other-vessel", wageScaleUuid: "old", rankIdAtStart: "capt",
      startDate: "2090-01-01", status: "active" });
    const before = await snapshot();
    await expect(monthlyTransactionsService.update("t", {
      engagementUuid: "foreign", crewUuid: "other",
    }, { vesselUser: true, vessels: ["v"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await snapshot()).toEqual(before);
  });
  it("rolls back corrections and activation on a later marker insertion failure", async () => {
    await seed(a.accMonthlyTransactionsV2, { txnUuid: "protected", engagementUuid: "eng",
      crewUuid: "crew", vesselUuid: "v", period: "2090-12", payElementUuid: "ot",
      qty: "1", rate: "10", amount: "10", origin: "vessel", status: "accepted" });
    await pool.query(`CREATE FUNCTION reject_marker() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'injected marker failure'; END $$;
      CREATE TRIGGER fail_marker BEFORE INSERT ON acc_wage_revision_rate_protection_v2
      FOR EACH ROW EXECUTE FUNCTION reject_marker()`);
    try {
      const before = await snapshot();
      await expect(activate()).rejects.toThrow("injected marker failure");
      expect(await snapshot()).toEqual(before);
    } finally {
      await pool.query("DROP TRIGGER fail_marker ON acc_wage_revision_rate_protection_v2; DROP FUNCTION reject_marker()");
    }
  });
  it("coordinates readers without wrapping ordinary writes in transactions", async () => {
    await coordinateAccounts("shared", async () => {
      await context.db.execute(sql`SELECT 1`);
      await expect(accountDbScope.exit(() => coordinateAccounts("exclusive", async () => {})))
        .rejects.toMatchObject({ code: "CONFLICT" });
    });
    await expect(coordinateAccounts("exclusive", async () => "ok")).resolves.toBe("ok");
  });
  it("returns the complete scoped lookup response through the real handler", async () => {
    await fixture("accepted"); await activate();
    const handler = coordinatedControllers({ vesselPortageController }).vesselPortageController.getWageValues;
    const response = () => ({
      statusCode: 200, body: null as any, headersSent: false,
      status(code: number) { this.statusCode = code; return this; },
      json(body: any) { this.body = body; this.headersSent = true; return this; },
    });
    const res = response();
    await (handler as any)({ params: { vesselUuid: "v", period: "2090-12" },
      user: { userType: "Ship", vessels: ["v"] } }, res, (error: any) => { throw error; });
    expect(res.statusCode).toBe(200);
    expect(res.body.values.eng.entries.ot.rate).toBe("15.0000");
    expect(res.body.protectedTxnUuids).toEqual(["t"]);
    const denied = response();
    await (handler as any)({ params: { vesselUuid: "v", period: "2090-12" },
      user: { userType: "Ship", vessels: ["other"] } }, denied, (error: any) => { throw error; });
    expect(denied.statusCode).toBe(403);
  });
  it.each(["accepted", "submitted"])("actual payroll honors protection after %s", async status => {
    await fixture(status);
    await activate();
    if (status === "submitted") await monthlyTransactionsService.accept("t", "reviewer");
    await coordinateAccounts("shared", () => wageEngineService.runForEngagement("eng", "2090-12"));
    const ledger = await context.db.select().from(a.accWageLedgerV2);
    const overtime = ledger.find((row: any) => row.sourceType === "monthly_txn" && !row.isDeleted);
    expect(overtime).toMatchObject({ rate: "10.0000", amount: "100.00" });
  });
  it("unmarked accepted payroll retains resolved-rate precedence", async () => {
    await fixture("accepted");
    await context.db.update(a.accMonthlyTransactionsV2).set({ rate: "8", amount: "80" });
    await wageEngineService.runForEngagement("eng", "2090-11");
    // Use an overlapping original scale for the December calculation without a revision activation.
    await context.db.update(a.accWageScalesV2).set({ effectiveTo: null })
      .where(eq(a.accWageScalesV2.scaleUuid, "old"));
    await wageEngineService.runForEngagement("eng", "2090-12");
    const ledger = await context.db.select().from(a.accWageLedgerV2);
    const overtime = ledger.find((row: any) => row.sourceType === "monthly_txn" && !row.isDeleted);
    expect(overtime).toMatchObject({ rate: "10.0000", amount: "100.00" });
  });
  it("CBA floors still block and acknowledgement still permits activation", async () => {
    await seed(a.accPayElementsV2, { payElementUuid: "basic", code: "BASIC", name: "Basic",
      type: "earning", category: "basic", calcMethod: "scale_lookup" });
    await seed(a.accWageScaleLinesV2, { scaleLineUuid: "basic-line", scaleUuid: "new",
      rankId: "capt", payElementUuid: "basic", amount: "10" });
    await seed(a.accCbaReferenceV2, { cbaRefUuid: "cba", cbaName: "Minimum",
      payElementUuid: "basic", rankId: "capt", minimumAmount: "20", currency: "USD" });
    const before = await snapshot();
    await expect(activate()).rejects.toMatchObject({ code: "FLOOR_VIOLATIONS" });
    expect(await snapshot()).toEqual(before);
    await activate({ acknowledge: true, auditUserUuid: "reviewer" });
    expect((await snapshot()).scales[1].status).toBe("active");
  });
  it("actual vessel submission stays submitted after payroll failure", async () => {
    const run = vi.spyOn(wageEngineService, "runForVesselPeriod")
      .mockRejectedValueOnce(new Error("injected calculation failure"));
    try {
      await coordinateAccounts("shared", () => vesselPortageService.submit("v", "2090-12"));
      expect((await snapshot()).txns[0].status).toBe("submitted");
      const [bill] = await context.db.select().from(a.accPortageBillsV2);
      expect(bill.status).toBe("submitted");
    } finally { run.mockRestore(); }
  });
  it("ordinary manual save keeps its supplied rate and amount", async () => {
    await seed(a.accPayElementsV2, { payElementUuid: "manual", code: "MAN", name: "Manual",
      type: "earning", category: "other", calcMethod: "manual_entry" });
    await context.db.update(a.accMonthlyTransactionsV2).set({ payElementUuid: "manual" });
    const updated = await monthlyTransactionsService.update("t", { rate: "2", amount: "77" });
    expect(updated).toMatchObject({ rate: "2.0000", amount: "77.00" });
  });
  it("enforces optional draft dates and read-only non-drafts on actual save", async () => {
    const blank = await wageScalesService.create({ scaleName: "Undated", currency: "USD" });
    expect(blank.effectiveFrom).toBeNull();
    await expect(wageScalesService.update(blank.scaleUuid, { effectiveFrom: "2000-01-01" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
    await expect(wageScalesService.update("old", { effectiveTo: "2090-12-31" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
    await expect(wageScalesService.update("new", { status: "active" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });
});
