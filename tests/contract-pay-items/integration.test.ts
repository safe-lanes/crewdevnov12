// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { Table, is, getTableColumns, eq } from "drizzle-orm";
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
import { engagementsService } from "../../server/v2/accounts/services/engagementsService";
import { payItemOptions } from "../../server/v2/accounts/services/contractPayItemEligibilityService";
import { readApplicableWageValues, wageEngineService } from "../../server/v2/accounts/engine/wageEngineService";
import { wageScalesService } from "../../server/v2/accounts/services/wageScalesService";

let directory: string;
let pool: Pool;
const tables = [...Object.values(a).filter(value => is(value, Table)),
  crewMembersV2, crewAssignments, masterNationalities, promoExecutionLedgerV2, admCompanyRanksV2];
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const migration = readFileSync("migrations/0269_contract_pay_item_rules_version.sql", "utf8");

beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "pay-item-regression-"));
  execFileSync("initdb", ["-D", join(directory, "data"), "-U", "wage_test", "-A", "trust", "--no-locale"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"),
    "-o", `-k ${directory} -p 55441 -c listen_addresses=''`, "-w", "start"], { stdio: "pipe" });
  pool = new Pool({ host: directory, port: 55441, user: "wage_test", database: "postgres" });
  context.db = drizzle(pool);
  for (const table of tables) {
    const config = getTableConfig(table as any);
    const cols = config.columns.filter((column: any) => column.name !== "eligibility_rules_version").map((column: any) => {
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
  await pool.query(`INSERT INTO acc_engagement_pay_elements_v2
    (epe_uuid,engagement_uuid,pay_element_uuid,override_mode,amount)
    VALUES ('pre-migration','eng','basic','add_element',100)`);
  await pool.query(migration);
  await pool.query(migration);
  expect((await pool.query("SELECT eligibility_rules_version, amount FROM acc_engagement_pay_elements_v2")).rows[0])
    .toEqual({ eligibility_rules_version: 0, amount: "100.00" });
  await pool.query(readFileSync("migrations/0268_wage_revision_rate_protection.sql", "utf8"));
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

beforeEach(async () => {
  await pool.query(`TRUNCATE ${tables.map(t => quote(getTableConfig(t as any).name)).join(",")},
    acc_wage_revision_rate_protection_v2 RESTART IDENTITY CASCADE`);
  await seed(a.accTenantConfigV2, { configUuid: "config", preparationMode: "vessel_prepares" });
  for (const [id, method, category] of [
    ["basic", "scale_lookup", "basic"], ["ot", "rate_times_qty", "overtime_variable"],
    ["allowance", "fixed_amount", "allowance"], ["allot", "manual_entry", "allotment"],
  ]) await seed(a.accPayElementsV2, { payElementUuid: id, code: id, name: id,
    type: "earning", category, calcMethod: method, status: "active" });
  await seed(a.accWageScalesV2, { scaleUuid: "scale", scaleName: "Scale",
    status: "active", effectiveFrom: "2089-01-01" });
  await seed(a.accWageScaleLinesV2, { scaleLineUuid: "basic-line", scaleUuid: "scale",
    rankId: "capt", payElementUuid: "basic", amount: "2500" });
  await seed(a.accWageScaleLinesV2, { scaleLineUuid: "ot-line", scaleUuid: "scale",
    rankId: "capt", payElementUuid: "ot", rate: "10" });
  await seed(crewMembersV2, { crewUuid: "crew" });
  await seed(a.accEngagementsV2, { engagementUuid: "eng", crewUuid: "crew", vesselUuid: "v",
    wageScaleUuid: "scale", rankIdAtStart: "capt", scaleYearAtStart: 1,
    startDate: "2090-01-01", status: "active" });
});

const create = (data: any) => engagementsService.createPayItem("eng", data);
const options = (overrideMode: any, extra = {}) => payItemOptions("eng", { overrideMode, ...extra });
const rows = () => context.db.select().from(a.accEngagementPayElementsV2);
async function values(period = "2090-01") {
  return (await readApplicableWageValues(period, await context.db.select().from(a.accEngagementsV2))).get("eng")!;
}
async function legacy(data: any) {
  return seed(a.accEngagementPayElementsV2, { engagementUuid: "eng", ...data });
}

describe("contract pay-item database and calculation workflows", () => {
  it("checks actual scale entries and disables dedicated screens", async () => {
    const result = await options("add_element");
    expect(result.options.basic.reason).toBe("Already added");
    expect(result.options.allowance.disabled).toBe(false);
    expect(result.options.allot.reason).toBe("Manage in Allotments");
    await expect(create({ payElementUuid: "basic", overrideMode: "add_element", amount: "2700" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
    expect(await rows()).toHaveLength(0);
  });
  it("creates marked replacements, uses the value and rejects conflicts", async () => {
    const item = await create({ payElementUuid: "basic", overrideMode: "replace_scale_value", amount: "2700" });
    expect(item.eligibilityRulesVersion).toBe(1);
    expect((await values()).entries.basic.amount).toBe("2700.00");
    await expect(create({ payElementUuid: "basic", overrideMode: "suppress_element" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
  });
  it("serializes simultaneous Adds so only one succeeds", async () => {
    const results = await Promise.allSettled([1, 2].map(() =>
      create({ payElementUuid: "allowance", overrideMode: "add_element", amount: "100" })));
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await rows()).toHaveLength(1);
  });
  it("permits Add plus Replace and protects deletion and shortening", async () => {
    const add = await create({ payElementUuid: "allowance", overrideMode: "add_element", amount: "100" });
    const replace = await create({ payElementUuid: "allowance", overrideMode: "replace_scale_value", amount: "150" });
    expect((await values()).entries.allowance.amount).toBe("150.00");
    await expect(engagementsService.deletePayItem(add.epeUuid)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(engagementsService.updatePayItem(add.epeUuid, { effectiveTo: "2090-01-31" }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await engagementsService.deletePayItem(replace.epeUuid);
    await engagementsService.deletePayItem(add.epeUuid);
    expect((await options("add_element")).options.allowance.disabled).toBe(false);
  });
  it("checks the entire requested period and not just the first month", async () => {
    await create({ payElementUuid: "allowance", overrideMode: "add_element", amount: "100",
      effectiveFrom: "2090-01-01", effectiveTo: "2090-03-31" });
    expect((await options("replace_scale_value", { effectiveFrom: "2090-01-01", effectiveTo: "2090-06-30" }))
      .options.allowance.reason).toBe("Not currently added");
    expect((await options("replace_scale_value", { effectiveFrom: "2090-01-01", effectiveTo: "2090-03-31" }))
      .options.allowance.disabled).toBe(false);
  });
  it("does not invent a legacy fallback after deleting its underlying Add", async () => {
    const add = await create({ payElementUuid: "allowance", overrideMode: "add_element", amount: "100" });
    await legacy({ epeUuid: "dependent", payElementUuid: "allowance", overrideMode: "replace_scale_value", amount: "120" });
    await expect(engagementsService.deletePayItem(add.epeUuid)).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("retains genuine legacy replacement-without-base presence", async () => {
    await legacy({ epeUuid: "legacy", payElementUuid: "allowance", overrideMode: "replace_scale_value", amount: "100" });
    expect((await options("add_element")).options.allowance.reason).toBe("Already added");
    expect((await values()).entries.allowance.amount).toBe("100.00");
  });
  it("allows remarks-only legacy edits and validates meaningful changes", async () => {
    await legacy({ epeUuid: "legacy", payElementUuid: "basic", overrideMode: "add_element", amount: "100" });
    const note = await engagementsService.updatePayItem("legacy", { amount: "100.0", remarks: "note" });
    expect(note.eligibilityRulesVersion).toBe(0);
    await expect(engagementsService.updatePayItem("legacy", { amount: "101" }))
      .rejects.toMatchObject({ code: "VALIDATION" });
    const corrected = await engagementsService.updatePayItem("legacy", { overrideMode: "replace_scale_value", amount: "2700" });
    expect(corrected.eligibilityRulesVersion).toBe(1);
  });
  it("does not count an edited Add as its own duplicate", async () => {
    const item = await create({ payElementUuid: "allowance", overrideMode: "add_element", amount: "100" });
    expect((await options("add_element", { editingItemUuid: item.epeUuid })).options.allowance.disabled).toBe(false);
    await engagementsService.updatePayItem(item.epeUuid, { amount: "110" });
    expect((await values()).entries.allowance.amount).toBe("110.00");
  });
  it("suppresses Basic without values and does not allow Add to restore it", async () => {
    const item = await create({ payElementUuid: "basic", overrideMode: "suppress_element" });
    expect(item.amount).toBeNull();
    expect((await values()).entries.basic).toBeUndefined();
    expect((await options("add_element")).options.basic.reason).toBe("Already added");
  });
  it("keeps timing-only rows outside eligibility", async () => {
    await legacy({ epeUuid: "timing", payElementUuid: "basic", overrideMode: "replace_scale_value",
      paymentTimingOverride: "payable_at_settlement" });
    expect((await options("replace_scale_value")).options.basic.disabled).toBe(false);
  });
  it("keeps untouched old suppression behaviour but excludes new suppressed hourly payments", async () => {
    await seed(a.accMonthlyTransactionsV2, { txnUuid: "txn", engagementUuid: "eng", crewUuid: "crew",
      vesselUuid: "v", period: "2090-01", payElementUuid: "ot", qty: "10", rate: "10",
      amount: "100", currency: "USD", origin: "vessel", status: "accepted" });
    await legacy({ epeUuid: "supp", payElementUuid: "ot", overrideMode: "suppress_element" });
    await wageEngineService.runForEngagement("eng", "2090-01");
    const before = await context.db.select().from(a.accWageLedgerV2);
    expect(before.some((l: any) => l.payElementUuid === "ot" && !l.isDeleted)).toBe(true);
    await engagementsService.updatePayItem("supp", { effectiveFrom: "2090-01-01" });
    await wageEngineService.runForEngagement("eng", "2090-01");
    const after = await context.db.select().from(a.accWageLedgerV2);
    expect(after.some((l: any) => l.payElementUuid === "ot" && !l.isDeleted)).toBe(false);
    expect((await context.db.select().from(a.accMonthlyTransactionsV2))[0].amount).toBe("100.00");
  });
  it("preserves frozen contracts", async () => {
    await seed(a.accSettlementsV2, { settlementUuid: "frozen", engagementUuid: "eng", crewUuid: "crew",
      status: "approved" });
    await expect(create({ payElementUuid: "basic", overrideMode: "suppress_element" })).rejects.toBeDefined();
    expect(await rows()).toHaveLength(0);
  });
  it("preserves fully locked periods", async () => {
    await seed(a.accPortageBillsV2, { portageUuid: "locked", vesselUuid: "v", period: "2090-01",
      status: "locked", isLocked: true });
    await expect(create({ payElementUuid: "basic", overrideMode: "suppress_element",
      effectiveFrom: "2090-01-01", effectiveTo: "2090-01-31" })).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it("checks future revisions for open-ended eligibility", async () => {
    await seed(a.accWageScalesV2, { scaleUuid: "future", scaleName: "Future", status: "active",
      effectiveFrom: "2095-01-01" });
    await context.db.update(a.accWageScalesV2).set({ supersededByScaleUuid: "future" })
      .where(eq(a.accWageScalesV2.scaleUuid, "scale"));
    expect((await options("replace_scale_value")).options.basic.reason).toBe("Not currently added");
    expect((await options("replace_scale_value", { effectiveTo: "2094-12-31" })).options.basic.disabled).toBe(false);
  });
  it("checks nationality and configured zero values", async () => {
    await context.db.update(a.accWageScaleLinesV2).set({ amount: "0" })
      .where(eq(a.accWageScaleLinesV2.payElementUuid, "basic"));
    expect((await options("add_element")).options.basic.reason).toBe("Already added");
    await context.db.update(a.accPayElementsV2).set({ nationalityConditional: true, applicableNationalityUuids: ["other"] })
      .where(eq(a.accPayElementsV2.payElementUuid, "allowance"));
    expect((await options("add_element")).options.allowance.reason).toBe("Not applicable to this crew member");
  });
  it("rejects editing a different contract's item", async () => {
    await legacy({ epeUuid: "foreign", engagementUuid: "other", payElementUuid: "basic", overrideMode: "add_element", amount: "100" });
    await expect(options("add_element", { editingItemUuid: "foreign" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
  it("does not block revision activation for intentionally suppressed draft overtime", async () => {
    await create({ payElementUuid: "ot", overrideMode: "suppress_element", effectiveFrom: "2090-12-01" });
    await seed(a.accMonthlyTransactionsV2, { txnUuid: "txn", engagementUuid: "eng", crewUuid: "crew",
      vesselUuid: "v", period: "2090-12", payElementUuid: "ot", qty: "10", rate: "10",
      amount: "100", currency: "USD", origin: "vessel", status: "draft" });
    const revision = await wageScalesService.supersede("scale", { effectiveFrom: "2090-12-01" });
    await wageScalesService.activate(revision.scaleUuid, {
      predecessorAdjustment: { predecessorUuid: "scale", previousEffectiveTo: null,
        revisionEffectiveFrom: "2090-12-01", nextEffectiveTo: "2090-11-30" },
    });
    expect((await context.db.select().from(a.accMonthlyTransactionsV2))[0].amount).toBe("100.00");
  });
});
