import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { randomUUID } from "crypto";

const API_BASE = "http://localhost:5000";
const V2_BASE = `${API_BASE}/api/v2/accounts`;

/**
 * Task 155 — settlement skip on the vessel-month run.
 *
 * A frozen settlement (submitted/approved/paid/locked) no longer blocks the
 * whole vessel-month run: the settled engagement is skipped (its ledger
 * lines are preserved exactly), everyone else recomputes.
 *
 * Worked example (thirty_day_month, both_inclusive, USD):
 *   X: Basic 3000, full month 2026-04            → 3000.00
 *   Y: Basic 3000, signed on 01-Apr, off 02-Apr  → 2/30 × 3000 = 200.00
 *      then settled + PAID (frozen)
 *   Z: Basic 2000, full month + 50.00 bond added → net 1950.00
 * Vessel-month re-run: Y skipped (lines byte-identical), X unchanged,
 * Z picks up the bond; portage totals = full ledger:
 *   earnings 5200.00, deductions 50.00, net 5150.00, crewCount 3.
 */

const S = `${Date.now()}`;
const u = () => randomUUID();

const elBAS = u();
const elBND = u();
const scaleSkp = u();
const RANK_MST = `MSTS_${S}`;
const RANK_CO = `COS_${S}`;

const crewX = u();
const crewY = u();
const crewZ = u();
const engX = u();
const engY = u();
const engZ = u();
const vslSkp = `VSL_SKP_${S}`;
const stlY = u();
const txnBond = u();
const allEngagements = [engX, engY, engZ];

let db: Client;
let savedConfig: Array<Record<string, unknown>> = [];
let insertedConfigUuid: string | null = null;

async function insert(table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const params = cols.map((_, i) => `$${i + 1}`).join(", ");
  await db.query(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${params})`,
    vals,
  );
}

function payElement(
  uuid: string,
  code: string,
  overrides: Record<string, unknown> = {},
) {
  return insert("acc_pay_elements_v2", {
    pay_element_uuid: uuid,
    code: `${code}_SKP_${S}`,
    name: code,
    type: "earning",
    category: "wages",
    calc_method: "scale_lookup",
    prorate: true,
    payment_timing: "paid_on_board",
    rounding_rule: "nearest",
    rounding_precision: "0.01",
    status: "active",
    ...overrides,
  });
}

function scaleLine(
  rankId: string,
  payElementUuid: string,
  amount: string,
) {
  return insert("acc_wage_scale_lines_v2", {
    scale_line_uuid: u(),
    scale_uuid: scaleSkp,
    rank_id: rankId,
    pay_element_uuid: payElementUuid,
    experience_min_months: 0,
    experience_max_months: 11,
    amount,
  });
}

function engagement(
  uuid: string,
  crewUuid: string,
  rankId: string,
  startDate: string,
  extra: Record<string, unknown> = {},
) {
  return insert("acc_engagements_v2", {
    engagement_uuid: uuid,
    crew_uuid: crewUuid,
    engagement_type: "voyage_contract",
    vessel_uuid: vslSkp,
    start_date: startDate,
    end_date: null,
    wage_scale_uuid: scaleSkp,
    rank_id_at_start: rankId,
    currency: "USD",
    status: "active",
    scale_year_at_start: 1,
    next_step_date: "2027-12-01",
    ...extra,
  });
}

async function runVessel(period: string) {
  const res = await fetch(`${V2_BASE}/calc/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vesselUuid: vslSkp, period }),
  });
  const body = await res.json();
  return { status: res.status, body };
}

async function ledgerLines(engagementUuid: string, period: string) {
  const res = await fetch(
    `${V2_BASE}/ledger?engagementUuid=${engagementUuid}&period=${period}&_=${u()}`,
  );
  expect(res.status).toBe(200);
  return (await res.json()) as Array<Record<string, any>>;
}

function totalsFor(body: any, crewUuid: string) {
  const t = (body.crewTotals as any[]).find((c) => c.crewUuid === crewUuid);
  expect(t, `crewTotals entry for ${crewUuid}`).toBeTruthy();
  return t;
}

describe("Wage engine — settlement skip on vessel-month run (Task 155)", () => {
  beforeAll(async () => {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error("Server not running");

    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    const cfg = await db.query("SELECT * FROM acc_tenant_config_v2");
    savedConfig = cfg.rows;
    if (cfg.rows.length === 0) {
      insertedConfigUuid = u();
      await insert("acc_tenant_config_v2", {
        config_uuid: insertedConfigUuid,
        proration_basis: "thirty_day_month",
        functional_currency: "USD",
        day_inclusion_rule: "both_inclusive",
      });
    } else {
      await db.query(
        `UPDATE acc_tenant_config_v2
         SET proration_basis = 'thirty_day_month',
             functional_currency = 'USD',
             day_inclusion_rule = 'both_inclusive'`,
      );
    }

    await payElement(elBAS, "BAS", { category: "basic" });
    await payElement(elBND, "ZBND", {
      type: "deduction",
      category: "bond_slop_chest",
      calc_method: "fixed_amount",
    });

    await insert("acc_wage_scales_v2", {
      scale_uuid: scaleSkp,
      scale_name: `Test Scale SKP ${S}`,
      currency: "USD",
      effective_from: "2025-01-01",
      status: "active",
    });
    await scaleLine(RANK_MST, elBAS, "3000");
    await scaleLine(RANK_CO, elBAS, "2000");

    // X full month, Y on/off 01–02 Apr (then settled), Z full month.
    await engagement(engX, crewX, RANK_MST, "2026-01-01");
    await engagement(engY, crewY, RANK_MST, "2026-04-01", {
      end_date: "2026-04-02",
      status: "completed",
    });
    await engagement(engZ, crewZ, RANK_CO, "2026-01-01");
  }, 60_000);

  afterAll(async () => {
    const tryQuery = async (sql: string, params: unknown[] = []) => {
      try {
        await db.query(sql, params);
      } catch (e) {
        console.error("cleanup failed:", sql, e);
      }
    };
    await tryQuery(
      "DELETE FROM acc_settlements_v2 WHERE engagement_uuid = ANY($1)",
      [allEngagements],
    );
    await tryQuery(
      "DELETE FROM acc_wage_ledger_v2 WHERE engagement_uuid = ANY($1)",
      [allEngagements],
    );
    await tryQuery(
      "DELETE FROM acc_calculation_runs_v2 WHERE portage_uuid IN (SELECT portage_uuid FROM acc_portage_bills_v2 WHERE vessel_uuid = $1)",
      [vslSkp],
    );
    await tryQuery(
      "DELETE FROM acc_calculation_runs_v2 WHERE engagement_uuid = ANY($1)",
      [allEngagements],
    );
    await tryQuery("DELETE FROM acc_portage_bills_v2 WHERE vessel_uuid = $1", [
      vslSkp,
    ]);
    await tryQuery(
      "DELETE FROM acc_monthly_transactions_v2 WHERE txn_uuid = $1",
      [txnBond],
    );
    await tryQuery(
      "DELETE FROM acc_engagements_v2 WHERE engagement_uuid = ANY($1)",
      [allEngagements],
    );
    await tryQuery(
      "DELETE FROM acc_wage_scale_lines_v2 WHERE scale_uuid = $1",
      [scaleSkp],
    );
    await tryQuery("DELETE FROM acc_wage_scales_v2 WHERE scale_uuid = $1", [
      scaleSkp,
    ]);
    await tryQuery(
      "DELETE FROM acc_pay_elements_v2 WHERE pay_element_uuid = ANY($1)",
      [[elBAS, elBND]],
    );
    if (insertedConfigUuid) {
      await tryQuery("DELETE FROM acc_tenant_config_v2 WHERE config_uuid = $1", [
        insertedConfigUuid,
      ]);
    } else if (savedConfig.length > 0) {
      const c = savedConfig[0] as Record<string, any>;
      await tryQuery(
        `UPDATE acc_tenant_config_v2
         SET proration_basis = $1, functional_currency = $2, day_inclusion_rule = $3`,
        [c.proration_basis, c.functional_currency, c.day_inclusion_rule],
      );
    }
    await db.end();
  }, 60_000);

  let yLinesBefore: Array<Record<string, any>> = [];

  it("run #1 (no settlement): all three crew compute — X 3000.00, Y 200.00, Z 2000.00", async () => {
    const { status, body } = await runVessel("2026-04");
    expect(status).toBe(200);
    expect(body.skippedSettled ?? []).toEqual([]);
    expect(totalsFor(body, crewX).netOnBoard).toBe("3000.00");
    expect(totalsFor(body, crewY).netOnBoard).toBe("200.00");
    expect(totalsFor(body, crewZ).netOnBoard).toBe("2000.00");

    yLinesBefore = await ledgerLines(engY, "2026-04");
    expect(yLinesBefore.length).toBeGreaterThan(0);
  });

  it("re-run with Y settled+paid: Y skipped with lines byte-identical, Z picks up new bond, portage totals from full ledger", async () => {
    await insert("acc_settlements_v2", {
      settlement_uuid: stlY,
      engagement_uuid: engY,
      crew_uuid: crewY,
      status: "paid",
    });
    await insert("acc_monthly_transactions_v2", {
      txn_uuid: txnBond,
      engagement_uuid: engZ,
      crew_uuid: crewZ,
      vessel_uuid: vslSkp,
      period: "2026-04",
      pay_element_uuid: elBND,
      qty: null,
      amount: "50.00",
      currency: "USD",
      origin: "office",
      status: "accepted",
    });

    const { status, body } = await runVessel("2026-04");
    expect(status).toBe(200);

    // Y reported as skipped, not recomputed.
    expect(body.skippedSettled).toHaveLength(1);
    expect(body.skippedSettled[0].engagementUuid).toBe(engY);
    expect(body.skippedSettled[0].settlementUuid).toBe(stlY);
    expect(body.skippedSettled[0].status).toBe("paid");
    expect((body.crewTotals as any[]).some((c) => c.crewUuid === crewY)).toBe(
      false,
    );

    // X unchanged; Z now nets 1950 after the 50.00 bond.
    expect(totalsFor(body, crewX).netOnBoard).toBe("3000.00");
    expect(totalsFor(body, crewZ).netOnBoard).toBe("1950.00");

    // Y's ledger lines preserved byte-identical (same rows, same uuids).
    const yLinesAfter = await ledgerLines(engY, "2026-04");
    expect(yLinesAfter).toEqual(yLinesBefore);

    // Portage totals recomputed from the FULL ledger (frozen + fresh).
    const pb = await db.query(
      "SELECT * FROM acc_portage_bills_v2 WHERE vessel_uuid = $1 AND period = $2",
      [vslSkp, "2026-04"],
    );
    expect(pb.rows).toHaveLength(1);
    expect(pb.rows[0].crew_count).toBe(3);
    expect(pb.rows[0].total_earnings).toBe("5200.00");
    expect(pb.rows[0].total_deductions).toBe("50.00");
    expect(pb.rows[0].net_total).toBe("5150.00");
  });

  it("re-run is deterministic: same skip, same totals, Y still byte-identical", async () => {
    const { status, body } = await runVessel("2026-04");
    expect(status).toBe(200);
    expect(body.skippedSettled).toHaveLength(1);
    expect(totalsFor(body, crewX).netOnBoard).toBe("3000.00");
    expect(totalsFor(body, crewZ).netOnBoard).toBe("1950.00");

    const yLinesAfter = await ledgerLines(engY, "2026-04");
    expect(yLinesAfter).toEqual(yLinesBefore);

    const pb = await db.query(
      "SELECT total_earnings, total_deductions, net_total, crew_count FROM acc_portage_bills_v2 WHERE vessel_uuid = $1 AND period = $2",
      [vslSkp, "2026-04"],
    );
    expect(pb.rows[0].crew_count).toBe(3);
    expect(pb.rows[0].total_earnings).toBe("5200.00");
    expect(pb.rows[0].total_deductions).toBe("50.00");
    expect(pb.rows[0].net_total).toBe("5150.00");
  });

  it("all engagements settled (empty computable set): run succeeds, nothing deleted, totals unchanged", async () => {
    await insert("acc_settlements_v2", {
      settlement_uuid: u(),
      engagement_uuid: engX,
      crew_uuid: crewX,
      status: "paid",
    });
    await insert("acc_settlements_v2", {
      settlement_uuid: u(),
      engagement_uuid: engZ,
      crew_uuid: crewZ,
      status: "approved",
    });

    const { status, body } = await runVessel("2026-04");
    expect(status).toBe(200);
    expect(body.skippedSettled).toHaveLength(3);
    expect(body.crewTotals).toEqual([]);
    expect(body.lineCount).toBe(0);

    // Every crew's lines are preserved untouched.
    const yLinesAfter = await ledgerLines(engY, "2026-04");
    expect(yLinesAfter).toEqual(yLinesBefore);
    const count = await db.query(
      "SELECT COUNT(*)::int AS n FROM acc_wage_ledger_v2 WHERE engagement_uuid = ANY($1) AND is_deleted = false",
      [allEngagements],
    );
    expect(count.rows[0].n).toBeGreaterThan(0);

    // Portage totals still reflect the full preserved ledger.
    const pb = await db.query(
      "SELECT total_earnings, total_deductions, net_total, crew_count FROM acc_portage_bills_v2 WHERE vessel_uuid = $1 AND period = $2",
      [vslSkp, "2026-04"],
    );
    expect(pb.rows[0].crew_count).toBe(3);
    expect(pb.rows[0].total_earnings).toBe("5200.00");
    expect(pb.rows[0].total_deductions).toBe("50.00");
    expect(pb.rows[0].net_total).toBe("5150.00");
  });

  it("single-engagement run for the settled engagement still refuses with 409", async () => {
    const res = await fetch(`${V2_BASE}/calc/run-engagement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engagementUuid: engY, period: "2026-04" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain(stlY);
  });
});
