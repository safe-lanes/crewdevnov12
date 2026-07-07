import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { randomUUID } from "crypto";

const API_BASE = "http://localhost:5000";
const V2_BASE = `${API_BASE}/api/v2/accounts`;

/**
 * Wage Calculation Engine integration tests (H1–H5 + gates).
 *
 * Fixtures are inserted directly into the database (unique uuids/codes per
 * run, removed in afterAll) and the engine is exercised end-to-end through
 * the HTTP API. Expected figures are the hand-computed values from the spec:
 *   H1 net on board 5,777.17 (17/30 days)
 *   H2 basic total   2,769.00 (15+15 split on promotion)
 *   H3 basic total   3,708.60 (9+21 split on scale-year step)
 *   H4 net on board    239.52 (incl. VarOT 26 × 4.02 = 104.52)
 *   H5 net on board 10,545.00 (overrides: SUBS→300, +CompAdj 250)
 */

const S = `${Date.now()}`;
const u = () => randomUUID();

// ---- fixture ids -----------------------------------------------------------
const el = {
  BAS: u(), LV: u(), FOT: u(), SUBS: u(), TKR: u(),
  GOT: u(), SMB: u(), SI: u(), PF: u(), VOT: u(), CADJ: u(),
  ALT: u(), ADVR: u(), BND: u(),
};
const scaleH1 = u();
const scaleH2 = u();
const scaleH3 = u();
const scaleH4 = u();

const RANK_MST = `MST_${S}`;
const RANK_2O = `2O_${S}`;
const RANK_CO = `CO_${S}`;
const RANK_CO3 = `CO3_${S}`;
const RANK_AB = `AB_${S}`;
const NAT_PH = `NAT_PH_${S}`;

const crewH1 = u();
const crewH2 = u();
const crewH3 = u();
const crewH4 = u();
const crewFeb = u();
const crewLock = u();
const crewTim = u();
const crewBal = u();
const crewFbk = u();

const vslH1 = `VSL_H1_${S}`;
const vslH2 = `VSL_H2_${S}`;
const vslH3 = `VSL_H3_${S}`;
const vslH4 = `VSL_H4_${S}`;
const vslFeb = `VSL_FEB_${S}`;
const vslLock = `VSL_LOCK_${S}`;
const vslTim = `VSL_TIM_${S}`;
const vslBal = `VSL_BAL_${S}`;
const vslFbk = `VSL_FBK_${S}`;

const engH1 = u();
const engH2 = u();
const engH3 = u();
const engH4 = u();
const engFeb = u();
const engLock = u();
const engTim = u();
const engBal = u();
const engFbk = u();

// ---- Task 95 fixtures: settlements + overlap guard -------------------------
const crewS1 = u();
const crewMiss = u();
const crewFrz = u();
const crewOvlA = u();
const crewOvlB = u();
const crewOvlC = u();
const vslS1 = `VSL_S1_${S}`;
const vslMiss = `VSL_MISS_${S}`;
const vslFrz = `VSL_FRZ_${S}`;
const vslOvlSync = `VSL_OVLS_${S}`;
const vslOvlOther = `VSL_OVLO_${S}`;
const engS1 = u();
const engMiss = u();
const engFrz = u();
const engOvlA1 = u();
const engOvlA2 = u();
const engOvlB1 = u();
const engOvlB2 = u();
const engOvlC1 = u();
const assignOvlC = u();
const txnFrz = u();
let s1SettlementUuid: string | null = null;
let frzSettlementUuid: string | null = null;

const allEngagements = [
  engH1, engH2, engH3, engH4, engFeb, engLock, engTim, engBal, engFbk,
  engS1, engMiss, engFrz, engOvlA1, engOvlA2, engOvlB1, engOvlB2, engOvlC1,
];

const promoLedgerUuid = u();
const epeSubs = u();
const epeCadj = u();
const epeTimLv = u();
const epeTimPf = u();
const epeFbkGot = u();
const txnVot = u();
const txnFx = u();
const allotH4 = u();
const advH4 = u();
const bondH4 = u();
const portageLock = u();

let db: Client;
const runUuids: string[] = [];
let savedConfig: Array<Record<string, unknown>> = [];
let insertedConfigUuid: string | null = null;

// ---- helpers ----------------------------------------------------------------
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
    code: `${code}_${S}`,
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
  scaleUuid: string,
  rankId: string,
  payElementUuid: string,
  amount: string | null,
  extra: Record<string, unknown> = {},
) {
  return insert("acc_wage_scale_lines_v2", {
    scale_line_uuid: u(),
    scale_uuid: scaleUuid,
    rank_id: rankId,
    pay_element_uuid: payElementUuid,
    experience_min_months: 0,
    experience_max_months: 11,
    amount,
    ...extra,
  });
}

function engagement(
  uuid: string,
  crewUuid: string,
  vesselUuid: string,
  scaleUuid: string,
  rankId: string,
  startDate: string,
  nextStepDate: string,
  extra: Record<string, unknown> = {},
) {
  return insert("acc_engagements_v2", {
    engagement_uuid: uuid,
    crew_uuid: crewUuid,
    engagement_type: "voyage_contract",
    vessel_uuid: vesselUuid,
    start_date: startDate,
    end_date: null,
    wage_scale_uuid: scaleUuid,
    rank_id_at_start: rankId,
    currency: "USD",
    status: "active",
    scale_year_at_start: 1,
    next_step_date: nextStepDate,
    ...extra,
  });
}

async function runEngagement(engagementUuid: string, period: string) {
  const res = await fetch(`${V2_BASE}/calc/run-engagement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ engagementUuid, period }),
  });
  const body = await res.json();
  if (res.ok && body?.run?.calcRunUuid) runUuids.push(body.run.calcRunUuid);
  return { status: res.status, body };
}

async function ledgerLines(engagementUuid: string, period: string) {
  const res = await fetch(
    `${V2_BASE}/ledger?engagementUuid=${engagementUuid}&period=${period}`,
  );
  expect(res.status).toBe(200);
  return (await res.json()) as Array<Record<string, any>>;
}

function lineByCode(lines: Array<Record<string, any>>, elementUuid: string) {
  return lines.filter((l) => l.payElementUuid === elementUuid);
}

function totalsFor(body: any, crewUuid: string) {
  const t = (body.crewTotals as any[]).find((c) => c.crewUuid === crewUuid);
  expect(t, `crewTotals entry for ${crewUuid}`).toBeTruthy();
  return t;
}

// ---- suite -------------------------------------------------------------------
describe("Wage Calculation Engine (H1–H5)", () => {
  beforeAll(async () => {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error("Server not running");

    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    // -- tenant config: thirty-day month, both-inclusive, USD ---------------
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

    // -- pay elements ---------------------------------------------------------
    await payElement(el.BAS, "BAS", { category: "basic" });
    await payElement(el.LV, "LV", {
      category: "leave",
      payment_timing: "payable_at_settlement",
    });
    await payElement(el.FOT, "FOT");
    await payElement(el.SUBS, "SUBS");
    await payElement(el.TKR, "TKR");
    await payElement(el.GOT, "GOT");
    await payElement(el.SMB, "SMB");
    await payElement(el.SI, "SI");
    await payElement(el.PF, "PF", {
      type: "employer_contribution",
      category: "fund",
      payment_timing: "remitted_to_fund",
    });
    await payElement(el.VOT, "VOT", {
      calc_method: "rate_times_qty",
      prorate: false,
      category: "overtime",
    });
    await payElement(el.CADJ, "CADJ", {
      calc_method: "fixed_amount",
      category: "adjustment",
    });
    await payElement(el.ALT, "ZALT", {
      type: "deduction",
      category: "allotment",
      calc_method: "fixed_amount",
    });
    await payElement(el.ADVR, "ZADVR", {
      type: "deduction",
      category: "advance_recovery",
      calc_method: "fixed_amount",
    });
    await payElement(el.BND, "ZBND", {
      type: "deduction",
      category: "bond_slop_chest",
      calc_method: "fixed_amount",
    });

    // -- wage scales ------------------------------------------------------------
    for (const [uuid, name] of [
      [scaleH1, "H1"],
      [scaleH2, "H2"],
      [scaleH3, "H3"],
      [scaleH4, "H4"],
    ] as const) {
      await insert("acc_wage_scales_v2", {
        scale_uuid: uuid,
        scale_name: `Test Scale ${name} ${S}`,
        currency: "USD",
        effective_from: "2025-01-01",
        status: "active",
      });
    }

    // H1/H5/Feb: Master, year 1
    await scaleLine(scaleH1, RANK_MST, el.BAS, "4762");
    await scaleLine(scaleH1, RANK_MST, el.LV, "1429");
    await scaleLine(scaleH1, RANK_MST, el.FOT, "3333");
    await scaleLine(scaleH1, RANK_MST, el.SUBS, "200");
    await scaleLine(scaleH1, RANK_MST, el.TKR, "1900");
    await scaleLine(scaleH1, RANK_MST, el.PF, "476");

    // H2: 2/O -> C/O promotion mid-month
    await scaleLine(scaleH2, RANK_2O, el.BAS, "1919");
    await scaleLine(scaleH2, RANK_CO, el.BAS, "3619");

    // H3: C/O year 1 vs year 2
    await scaleLine(scaleH3, RANK_CO3, el.BAS, "3619");
    await scaleLine(scaleH3, RANK_CO3, el.BAS, "3747", {
      experience_min_months: 12,
      experience_max_months: 23,
    });

    // H4: AB, Filipino-specific lines
    const ph = { nationality_uuid: NAT_PH };
    await scaleLine(scaleH4, RANK_AB, el.BAS, "614", ph);
    await scaleLine(scaleH4, RANK_AB, el.LV, "225", ph);
    await scaleLine(scaleH4, RANK_AB, el.GOT, "342", ph);
    await scaleLine(scaleH4, RANK_AB, el.SMB, "72", ph);
    await scaleLine(scaleH4, RANK_AB, el.SI, "32", ph);
    await scaleLine(scaleH4, RANK_AB, el.TKR, "20", ph);
    await scaleLine(scaleH4, RANK_AB, el.PF, "61", ph);
    await scaleLine(scaleH4, RANK_AB, el.VOT, null, { ...ph, rate: "4.02" });

    // -- crew ------------------------------------------------------------------
    await insert("crew_members_v2", {
      crew_uuid: crewH4,
      emp_no: `TEST_${S}_H4`,
      first_name: "Test",
      nationality_uuid: NAT_PH,
    });

    // -- engagements -------------------------------------------------------------
    await engagement(engH1, crewH1, vslH1, scaleH1, RANK_MST, "2026-03-15", "2027-03-15");
    await engagement(engH2, crewH2, vslH2, scaleH2, RANK_2O, "2026-01-10", "2027-01-10");
    await engagement(engH3, crewH3, vslH3, scaleH3, RANK_CO3, "2025-08-10", "2026-08-10");
    await engagement(engH4, crewH4, vslH4, scaleH4, RANK_AB, "2026-01-05", "2027-01-05");
    await engagement(engFeb, crewFeb, vslFeb, scaleH1, RANK_MST, "2025-12-01", "2026-12-01");
    await engagement(engLock, crewLock, vslLock, scaleH1, RANK_MST, "2026-03-01", "2027-03-01");
    await engagement(engTim, crewTim, vslTim, scaleH1, RANK_MST, "2026-03-15", "2027-03-15");
    await engagement(engBal, crewBal, vslBal, scaleH1, RANK_MST, "2025-12-01", "2026-12-01");
    await engagement(engFbk, crewFbk, vslFbk, scaleH1, RANK_MST, "2026-03-01", "2027-03-01");

    // -- Task 95: settlement + overlap fixtures ----------------------------------
    await engagement(engS1, crewS1, vslS1, scaleH1, RANK_MST, "2026-03-15", "2027-03-15", {
      end_date: "2026-05-20",
    });
    await engagement(engMiss, crewMiss, vslMiss, scaleH1, RANK_MST, "2026-03-15", "2027-03-15", {
      end_date: "2026-05-20",
    });
    await engagement(engFrz, crewFrz, vslFrz, scaleH1, RANK_MST, "2026-03-01", "2027-03-01", {
      end_date: "2026-03-31",
    });
    // overlap PATCH case: active + cancelled ranges overlap for the same crew
    await engagement(engOvlA1, crewOvlA, vslOvlOther, scaleH1, RANK_MST, "2026-01-01", "2027-01-01");
    await engagement(engOvlA2, crewOvlA, vslOvlOther, scaleH1, RANK_MST, "2026-02-01", "2027-02-01", {
      status: "cancelled",
    });
    // overlap audit case: two live overlapping engagements (seeded directly)
    await engagement(engOvlB1, crewOvlB, vslOvlOther, scaleH1, RANK_MST, "2026-01-01", "2027-01-01");
    await engagement(engOvlB2, crewOvlB, vslOvlOther, scaleH1, RANK_MST, "2026-02-15", "2027-02-15");
    // overlap sync case: existing open engagement + a new assignment elsewhere
    await engagement(engOvlC1, crewOvlC, vslOvlOther, scaleH1, RANK_MST, "2026-01-01", "2027-01-01");
    await insert("crew_assignments", {
      assign_uuid: assignOvlC,
      crew_uuid: crewOvlC,
      vessel_uuid: vslOvlSync,
      sign_on_date: "2026-03-05",
    });

    // -- H1-override: value-neutral timing overrides (0157) ----------------------
    await insert("acc_engagement_pay_elements_v2", {
      epe_uuid: epeTimLv,
      engagement_uuid: engTim,
      pay_element_uuid: el.LV,
      override_mode: "replace_scale_value",
      payment_timing_override: "paid_on_board",
      effective_from: "2026-03-01",
    });
    await insert("acc_engagement_pay_elements_v2", {
      epe_uuid: epeTimPf,
      engagement_uuid: engTim,
      pay_element_uuid: el.PF,
      override_mode: "replace_scale_value",
      payment_timing_override: "paid_on_board",
      effective_from: "2026-03-01",
    });

    // -- fix (c): replace_scale_value with no base scale line (GOT not on H1 scale)
    await insert("acc_engagement_pay_elements_v2", {
      epe_uuid: epeFbkGot,
      engagement_uuid: engFbk,
      pay_element_uuid: el.GOT,
      override_mode: "replace_scale_value",
      amount: "150",
      effective_from: "2026-04-01",
    });

    // -- H2 promotion event (2/O -> C/O effective 16-May-2026) -------------------
    await insert("promo_execution_ledger_v2", {
      ledger_uuid: promoLedgerUuid,
      review_uuid: u(),
      crew_member_id: crewH2,
      crew_uuid: crewH2,
      from_rank: RANK_2O,
      to_rank: RANK_CO,
      effective_date: "2026-05-16",
    });

    // -- H5 overrides on the H1 engagement, effective April ----------------------
    await insert("acc_engagement_pay_elements_v2", {
      epe_uuid: epeSubs,
      engagement_uuid: engH1,
      pay_element_uuid: el.SUBS,
      override_mode: "replace_scale_value",
      amount: "300",
      effective_from: "2026-04-01",
    });
    await insert("acc_engagement_pay_elements_v2", {
      epe_uuid: epeCadj,
      engagement_uuid: engH1,
      pay_element_uuid: el.CADJ,
      override_mode: "add_element",
      amount: "250",
      effective_from: "2026-04-01",
    });

    // -- H4 monthly inputs ---------------------------------------------------------
    await insert("acc_monthly_transactions_v2", {
      txn_uuid: txnVot,
      engagement_uuid: engH4,
      crew_uuid: crewH4,
      vessel_uuid: vslH4,
      period: "2026-06",
      pay_element_uuid: el.VOT,
      qty: "26",
      amount: "0",
      currency: "USD",
      origin: "vessel",
      status: "accepted",
    });
    // cross-currency transaction (EUR vs USD functional) for the FX test, July
    await insert("acc_monthly_transactions_v2", {
      txn_uuid: txnFx,
      engagement_uuid: engH4,
      crew_uuid: crewH4,
      vessel_uuid: vslH4,
      period: "2026-07",
      pay_element_uuid: el.CADJ,
      qty: null,
      amount: "120.00",
      currency: "EUR",
      origin: "office",
      status: "accepted",
    });
    await insert("acc_allotments_v2", {
      allotment_uuid: allotH4,
      crew_uuid: crewH4,
      beneficiary_name: "Test Beneficiary",
      allotment_type: "fixed",
      value: "800",
      currency: "USD",
      valid_from: "2026-01-01",
      status: "active",
    });
    await insert("acc_advances_v2", {
      advance_uuid: advH4,
      crew_uuid: crewH4,
      amount: "300",
      recovery_amount: "100",
      currency: "USD",
      period: "2026-06",
      status: "approved",
    });
    await insert("acc_bond_items_v2", {
      bond_item_uuid: bondH4,
      crew_uuid: crewH4,
      item_name: "Slop chest",
      deduction_amount: "45",
      auto_deduct: true,
      currency: "USD",
      period: "2026-06",
      status: "active",
    });

    // -- locked portage fixture ------------------------------------------------------
    await insert("acc_portage_bills_v2", {
      portage_uuid: portageLock,
      vessel_uuid: vslLock,
      period: "2026-03",
      status: "locked",
      is_locked: true,
      currency: "USD",
    });
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
      `DELETE FROM acc_settlement_approvals_v2
       WHERE settlement_uuid IN (
         SELECT settlement_uuid FROM acc_settlements_v2
         WHERE engagement_uuid = ANY($1))`,
      [allEngagements],
    );
    await tryQuery(
      `DELETE FROM acc_settlement_adjustments_v2
       WHERE settlement_uuid IN (
         SELECT settlement_uuid FROM acc_settlements_v2
         WHERE engagement_uuid = ANY($1))`,
      [allEngagements],
    );
    await tryQuery(
      "DELETE FROM acc_settlements_v2 WHERE engagement_uuid = ANY($1)",
      [allEngagements],
    );
    await tryQuery("DELETE FROM crew_assignments WHERE assign_uuid = $1", [
      assignOvlC,
    ]);
    await tryQuery("DELETE FROM acc_engagements_v2 WHERE vessel_uuid = $1", [
      vslOvlSync,
    ]);
    await tryQuery(
      "DELETE FROM acc_wage_ledger_v2 WHERE engagement_uuid = ANY($1)",
      [allEngagements],
    );
    if (runUuids.length > 0) {
      await tryQuery(
        "DELETE FROM acc_calculation_runs_v2 WHERE calc_run_uuid = ANY($1)",
        [runUuids],
      );
    }
    await tryQuery(
      "DELETE FROM acc_calculation_runs_v2 WHERE engagement_uuid = ANY($1)",
      [allEngagements],
    );
    await tryQuery("DELETE FROM acc_portage_bills_v2 WHERE portage_uuid = $1", [
      portageLock,
    ]);
    await tryQuery(
      "DELETE FROM acc_engagement_pay_elements_v2 WHERE epe_uuid = ANY($1)",
      [[epeSubs, epeCadj, epeTimLv, epeTimPf, epeFbkGot]],
    );
    await tryQuery("DELETE FROM acc_monthly_transactions_v2 WHERE txn_uuid = ANY($1)", [
      [txnVot, txnFx, txnFrz],
    ]);
    await tryQuery("DELETE FROM acc_allotments_v2 WHERE allotment_uuid = $1", [allotH4]);
    await tryQuery("DELETE FROM acc_advances_v2 WHERE advance_uuid = $1", [advH4]);
    await tryQuery("DELETE FROM acc_bond_items_v2 WHERE bond_item_uuid = $1", [bondH4]);
    await tryQuery("DELETE FROM promo_execution_ledger_v2 WHERE ledger_uuid = $1", [
      promoLedgerUuid,
    ]);
    await tryQuery("DELETE FROM acc_engagements_v2 WHERE engagement_uuid = ANY($1)", [
      allEngagements,
    ]);
    await tryQuery("DELETE FROM crew_members_v2 WHERE crew_uuid = $1", [crewH4]);
    await tryQuery("DELETE FROM acc_wage_scale_lines_v2 WHERE scale_uuid = ANY($1)", [
      [scaleH1, scaleH2, scaleH3, scaleH4],
    ]);
    await tryQuery("DELETE FROM acc_wage_scales_v2 WHERE scale_uuid = ANY($1)", [
      [scaleH1, scaleH2, scaleH3, scaleH4],
    ]);
    await tryQuery("DELETE FROM acc_pay_elements_v2 WHERE pay_element_uuid = ANY($1)", [
      Object.values(el),
    ]);

    // restore tenant config
    if (insertedConfigUuid) {
      await tryQuery("DELETE FROM acc_tenant_config_v2 WHERE config_uuid = $1", [
        insertedConfigUuid,
      ]);
    } else {
      for (const row of savedConfig) {
        await tryQuery(
          `UPDATE acc_tenant_config_v2
           SET proration_basis = $2, functional_currency = $3, day_inclusion_rule = $4
           WHERE config_uuid = $1`,
          [
            row.config_uuid,
            row.proration_basis,
            row.functional_currency,
            row.day_inclusion_rule,
          ],
        );
      }
    }

    await db.end();
  }, 60_000);

  // ---- H1 ---------------------------------------------------------------------
  it("H1: Master joins 15-Mar-2026 — 17/30 days, net on board 5777.17", async () => {
    const { status, body } = await runEngagement(engH1, "2026-03");
    expect(status).toBe(200);

    const totals = totalsFor(body, crewH1);
    expect(totals.netOnBoard).toBe("5777.17");
    expect(totals.settlementAccrual).toBe("809.77");
    expect(totals.fundRemittance).toBe("269.73");

    const lines = await ledgerLines(engH1, "2026-03");
    const amounts = Object.fromEntries(
      lines.map((l) => [l.payElementUuid, l.amount]),
    );
    expect(amounts[el.BAS]).toBe("2698.47");
    expect(amounts[el.FOT]).toBe("1888.70");
    expect(amounts[el.SUBS]).toBe("113.33");
    expect(amounts[el.TKR]).toBe("1076.67");
    expect(amounts[el.LV]).toBe("809.77");
    expect(amounts[el.PF]).toBe("269.73");

    for (const l of lines) {
      expect(Number(l.daysServed)).toBe(17);
      expect(Number(l.daysBasis)).toBe(30);
      expect(Number(l.fxRate)).toBe(1);
      expect(l.amountFunctional).toBe(l.amount);
    }
  });

  // ---- H2 ---------------------------------------------------------------------
  it("H2: promotion 16-May splits the month 15+15 — basic total 2769.00", async () => {
    const { status, body } = await runEngagement(engH2, "2026-05");
    expect(status).toBe(200);
    expect(totalsFor(body, crewH2).netOnBoard).toBe("2769.00");

    const lines = await ledgerLines(engH2, "2026-05");
    const basics = lineByCode(lines, el.BAS).sort((a, b) =>
      String(a.periodFrom).localeCompare(String(b.periodFrom)),
    );
    expect(basics.length).toBe(2);
    expect(basics[0].amount).toBe("959.50"); // 2/O, 01–15 May
    expect(Number(basics[0].daysServed)).toBe(15);
    expect(basics[0].rankId).toBe(RANK_2O);
    expect(basics[1].amount).toBe("1809.50"); // C/O, 16–31 May
    expect(Number(basics[1].daysServed)).toBe(15);
    expect(basics[1].rankId).toBe(RANK_CO);
  });

  // ---- H3 ---------------------------------------------------------------------
  it("H3: scale-year step on 10-Aug splits 9+21 — basic total 3708.60", async () => {
    const { status, body } = await runEngagement(engH3, "2026-08");
    expect(status).toBe(200);
    expect(totalsFor(body, crewH3).netOnBoard).toBe("3708.60");

    const lines = await ledgerLines(engH3, "2026-08");
    const basics = lineByCode(lines, el.BAS).sort((a, b) =>
      String(a.periodFrom).localeCompare(String(b.periodFrom)),
    );
    expect(basics.length).toBe(2);
    expect(basics[0].amount).toBe("1085.70"); // year 1: 3619 × 9/30
    expect(Number(basics[0].daysServed)).toBe(9);
    expect(basics[1].amount).toBe("2622.90"); // year 2: 3747 × 21/30
    expect(Number(basics[1].daysServed)).toBe(21);
  });

  // ---- H4 ---------------------------------------------------------------------
  it("H4: AB with VarOT + deductions — net on board 239.52", async () => {
    const { status, body } = await runEngagement(engH4, "2026-06");
    expect(status).toBe(200);

    const totals = totalsFor(body, crewH4);
    expect(totals.earnedGross).toBe("1184.52");
    expect(totals.deductions).toBe("945.00");
    expect(totals.netOnBoard).toBe("239.52");
    expect(totals.settlementAccrual).toBe("225.00");
    expect(totals.fundRemittance).toBe("61.00");

    const lines = await ledgerLines(engH4, "2026-06");

    const vot = lineByCode(lines, el.VOT);
    expect(vot.length).toBe(1);
    expect(vot[0].amount).toBe("104.52"); // 26 × 4.02
    expect(Number(vot[0].qty)).toBe(26);
    expect(Number(vot[0].rate)).toBeCloseTo(4.02, 4);

    const bySource = (t: string) => lines.filter((l) => l.sourceType === t);
    expect(bySource("allotment")[0]?.amount).toBe("800.00");
    expect(bySource("advance_recovery")[0]?.amount).toBe("100.00");
    expect(bySource("bond")[0]?.amount).toBe("45.00");
  });

  // ---- H5 ---------------------------------------------------------------------
  it("H5: April overrides (SUBS→300, +CompAdj 250) — net on board 10545.00", async () => {
    const { status, body } = await runEngagement(engH1, "2026-04");
    expect(status).toBe(200);
    expect(totalsFor(body, crewH1).netOnBoard).toBe("10545.00");

    const lines = await ledgerLines(engH1, "2026-04");
    const amounts = Object.fromEntries(
      lines.map((l) => [l.payElementUuid, l.amount]),
    );
    expect(amounts[el.BAS]).toBe("4762.00");
    expect(amounts[el.FOT]).toBe("3333.00");
    expect(amounts[el.SUBS]).toBe("300.00"); // replaced scale value
    expect(amounts[el.TKR]).toBe("1900.00");
    expect(amounts[el.CADJ]).toBe("250.00"); // added element
    expect(amounts[el.LV]).toBe("1429.00");
    expect(amounts[el.PF]).toBe("476.00");
  });

  // ---- February full month ------------------------------------------------------
  it("February full month pays the full monthly amount (30/30 days)", async () => {
    const { status, body } = await runEngagement(engFeb, "2026-02");
    expect(status).toBe(200);
    expect(totalsFor(body, crewFeb).netOnBoard).toBe("10195.00"); // 4762+3333+200+1900

    const lines = await ledgerLines(engFeb, "2026-02");
    const bas = lineByCode(lines, el.BAS);
    expect(bas.length).toBe(1);
    expect(bas[0].amount).toBe("4762.00");
    expect(Number(bas[0].daysServed)).toBe(30);
    expect(Number(bas[0].daysBasis)).toBe(30);
  });

  // ---- determinism ---------------------------------------------------------------
  it("re-running the same engagement/period is deterministic", async () => {
    const normalize = (lines: Array<Record<string, any>>) =>
      lines
        .map((l) => ({
          payElementUuid: l.payElementUuid,
          elementCode: l.elementCode,
          amount: l.amount,
          qty: l.qty,
          rate: l.rate,
          daysServed: l.daysServed,
          daysBasis: l.daysBasis,
          periodFrom: l.periodFrom,
          periodTo: l.periodTo,
          rankId: l.rankId,
          sourceType: l.sourceType,
          paymentTiming: l.paymentTiming,
          fxRate: l.fxRate,
          amountFunctional: l.amountFunctional,
        }))
        .sort((a, b) =>
          `${a.payElementUuid}|${a.periodFrom}|${a.sourceType}`.localeCompare(
            `${b.payElementUuid}|${b.periodFrom}|${b.sourceType}`,
          ),
        );

    const first = await runEngagement(engH1, "2026-03");
    expect(first.status).toBe(200);
    const linesA = normalize(await ledgerLines(engH1, "2026-03"));

    const second = await runEngagement(engH1, "2026-03");
    expect(second.status).toBe(200);
    const linesB = normalize(await ledgerLines(engH1, "2026-03"));

    expect(linesA.length).toBeGreaterThan(0);
    expect(linesB).toEqual(linesA);
    expect(second.body.crewTotals).toEqual(first.body.crewTotals);
  });

  // ---- cross-currency FX columns -----------------------------------------------
  it("cross-currency lines carry non-null deterministic fxRate/amountFunctional", async () => {
    const { status } = await runEngagement(engH4, "2026-07");
    expect(status).toBe(200);
    const lines = await ledgerLines(engH4, "2026-07");
    expect(lines.length).toBeGreaterThan(0);

    // no nulls in money columns on any engine-written line
    for (const l of lines) {
      expect(l.fxRate, `fxRate null on line ${l.ledgerUuid}`).not.toBeNull();
      expect(
        l.amountFunctional,
        `amountFunctional null on line ${l.ledgerUuid}`,
      ).not.toBeNull();
    }

    const eurLines = lines.filter((l) => l.currency === "EUR");
    expect(eurLines.length).toBe(1);
    const eur = eurLines[0];
    expect(Number(eur.amount)).toBeCloseTo(120.0, 2);
    expect(Number(eur.fxRate)).toBeCloseTo(1.0, 6);
    expect(Number(eur.amountFunctional)).toBeCloseTo(Number(eur.amount), 2);
    expect(String(eur.calcSnapshot?.fxNote ?? "")).toContain(
      "conversion not performed",
    );

    // deterministic on re-run
    const again = await runEngagement(engH4, "2026-07");
    expect(again.status).toBe(200);
    const linesAgain = await ledgerLines(engH4, "2026-07");
    const eurAgain = linesAgain.filter((l) => l.currency === "EUR")[0];
    expect(eurAgain.fxRate).toEqual(eur.fxRate);
    expect(eurAgain.amountFunctional).toEqual(eur.amountFunctional);
  });

  // ---- locked portage refusal ------------------------------------------------------
  it("refuses to run a vessel/period whose portage bill is locked (409)", async () => {
    const res = await fetch(`${V2_BASE}/calc/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vesselUuid: vslLock, period: "2026-03" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(String(body.error).toLowerCase()).toContain("lock");
  });

  // ---- H1-override: payment-timing override (0157) -------------------------------
  it("H1-override: LV+PF retimed on board — net 6856.67, accrual 0.00, fund 0.00", async () => {
    const { status, body } = await runEngagement(engTim, "2026-03");
    expect(status).toBe(200);

    const totals = totalsFor(body, crewTim);
    expect(totals.netOnBoard).toBe("6856.67");
    expect(totals.settlementAccrual).toBe("0.00");
    expect(totals.fundRemittance).toBe("0.00");

    // line amounts identical to H1 — only the timing changed
    const lines = await ledgerLines(engTim, "2026-03");
    const amounts = Object.fromEntries(
      lines.map((l) => [l.payElementUuid, l.amount]),
    );
    expect(amounts[el.BAS]).toBe("2698.47");
    expect(amounts[el.LV]).toBe("809.77");
    expect(amounts[el.PF]).toBe("269.73");

    const lv = lineByCode(lines, el.LV)[0];
    const pf = lineByCode(lines, el.PF)[0];
    expect(lv.paymentTiming).toBe("paid_on_board");
    expect(pf.paymentTiming).toBe("paid_on_board");
    expect(lv.calcSnapshot?.paymentTimingOverriddenBy).toBe(epeTimLv);
    expect(pf.calcSnapshot?.paymentTimingOverriddenBy).toBe(epeTimPf);
  });

  it("H4 keeps element-default timings — net on board still 239.52", async () => {
    const { status, body } = await runEngagement(engH4, "2026-06");
    expect(status).toBe(200);
    const totals = totalsFor(body, crewH4);
    expect(totals.netOnBoard).toBe("239.52");
    expect(totals.settlementAccrual).toBe("225.00");
    expect(totals.fundRemittance).toBe("61.00");
  });

  // ---- balance carry (derived balances) --------------------------------------------
  it("balance-carry: period-2 balance_bf = period-1 net on board; leave accumulates", async () => {
    const p1 = await runEngagement(engBal, "2026-01");
    expect(p1.status).toBe(200);
    const t1 = totalsFor(p1.body, crewBal);
    expect(t1.netOnBoard).toBe("10195.00");
    expect(t1.balanceBf).toBe("0.00");
    expect(t1.balanceCf).toBe("10195.00");
    expect(t1.leaveBf).toBe("0.00");
    expect(t1.leaveThisMonth).toBe("1429.00");
    expect(t1.leaveCf).toBe("1429.00");

    const p2 = await runEngagement(engBal, "2026-02");
    expect(p2.status).toBe(200);
    const t2 = totalsFor(p2.body, crewBal);
    expect(t2.netOnBoard).toBe("10195.00");
    expect(t2.balanceBf).toBe("10195.00"); // = period-1 net on board
    expect(t2.balanceCf).toBe("20390.00");
    expect(t2.leaveBf).toBe("1429.00");
    expect(t2.leaveThisMonth).toBe("1429.00");
    expect(t2.leaveCf).toBe("2858.00");
  });

  // ---- fix (a): lock guard on the single-engagement path ---------------------------
  it("fix (a): run-engagement against a locked vessel-period refuses with 409, writes nothing", async () => {
    const res = await fetch(`${V2_BASE}/calc/run-engagement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engagementUuid: engLock, period: "2026-03" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(String(body.error).toLowerCase()).toContain("lock");

    const lines = await db.query(
      "SELECT 1 FROM acc_wage_ledger_v2 WHERE engagement_uuid = $1",
      [engLock],
    );
    expect(lines.rowCount).toBe(0);
  });

  // ---- fix (b): run-status lifecycle ------------------------------------------------
  it("fix (b): successful runs end 'completed'; no run is left 'running'", async () => {
    const { status, body } = await runEngagement(engTim, "2026-03");
    expect(status).toBe(200);
    expect(body.run.status).toBe("completed");

    const dbRun = await db.query(
      "SELECT status FROM acc_calculation_runs_v2 WHERE calc_run_uuid = $1",
      [body.run.calcRunUuid],
    );
    expect(dbRun.rows[0]?.status).toBe("completed");

    const stuck = await db.query(
      "SELECT calc_run_uuid FROM acc_calculation_runs_v2 WHERE engagement_uuid = ANY($1) AND status = 'running'",
      [allEngagements],
    );
    expect(stuck.rowCount).toBe(0);
  });

  // ---- fix (c): replace_scale_value fallback ----------------------------------------
  it("fix (c): replace_scale_value with no base scale line applies the value and warns", async () => {
    const { status, body } = await runEngagement(engFbk, "2026-04");
    expect(status).toBe(200);

    const warnings = (body.warnings ?? []) as string[];
    expect(
      warnings.some((w) => w.includes("no base scale line")),
      `run summary warnings: ${JSON.stringify(warnings)}`,
    ).toBe(true);

    const lines = await ledgerLines(engFbk, "2026-04");
    const got = lineByCode(lines, el.GOT);
    expect(got.length).toBe(1);
    expect(got[0].amount).toBe("150.00");
    expect(got[0].sourceType).toBe("engagement_override");
    expect(String(got[0].calcSnapshot?.warning ?? "")).toContain(
      "no base scale line",
    );

    // 4762 + 3333 + 200 + 1900 + 150 (GOT fallback) = 10345.00
    expect(totalsFor(body, crewFbk).netOnBoard).toBe("10345.00");
  });

  // ---- validation ---------------------------------------------------------------
  it("rejects malformed periods with 400", async () => {
    const res = await fetch(`${V2_BASE}/calc/run-engagement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engagementUuid: engH1, period: "2026-3" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown engagement", async () => {
    const res = await fetch(`${V2_BASE}/calc/run-engagement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engagementUuid: u(), period: "2026-03" }),
    });
    expect(res.status).toBe(404);
  });

  // ---- Task 95: S1 settlement worked example (exact figures) -------------------
  it("S1: settlement compute — balance 22768.84, accruals 3191.44, net 26210.28", async () => {
    for (const [period, expectedNet] of [
      ["2026-03", "5777.17"],
      ["2026-04", "10195.00"],
      ["2026-05", "6796.67"],
    ] as const) {
      const { status, body } = await runEngagement(engS1, period);
      expect(status).toBe(200);
      expect(totalsFor(body, crewS1).netOnBoard).toBe(expectedNet);
    }

    const res = await fetch(`${V2_BASE}/settlements/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engagementUuid: engS1 }),
    });
    expect(res.status).toBe(201);
    const detail = await res.json();
    s1SettlementUuid = detail.settlement.settlementUuid;
    expect(detail.settlement.status).toBe("draft");
    expect(detail.settlement.balancePaid).toBe("22768.84");
    expect(detail.settlement.accrualsPaid).toBe("3191.44");
    expect(detail.settlement.netPayable).toBe("25960.28"); // before adjustment

    const snap = detail.settlement.statementSnapshot;
    expect(snap.balance.total).toBe("22768.84");
    expect(
      snap.balance.byPeriod.map((p: any) => [p.period, p.netOnBoard]),
    ).toEqual([
      ["2026-03", "5777.17"],
      ["2026-04", "10195.00"],
      ["2026-05", "6796.67"],
    ]);
    expect(snap.accruals.total).toBe("3191.44");
    expect(snap.accruals.leaveTotal).toBe("3191.44");
    expect(snap.fundRemittance).toBe("1063.06");
    expect(snap.periods).toEqual(["2026-03", "2026-04", "2026-05"]);
    const coveredPeriods = (snap.sourceCalcRuns as any[])
      .flatMap((r) => r.periods)
      .sort();
    expect(coveredPeriods).toEqual(["2026-03", "2026-04", "2026-05"]);
    expect(
      (snap.sourceCalcRuns as any[]).every((r) => !!r.calcRunUuid),
    ).toBe(true);

    // Adjustment: earning "Travel Wages" 250.00 → net_payable 26,210.28
    const adjRes = await fetch(
      `${V2_BASE}/settlements/${s1SettlementUuid}/adjustments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payElementUuid: el.CADJ,
          type: "earning",
          amount: "250.00",
          remarks: "Travel Wages",
        }),
      },
    );
    expect(adjRes.status).toBe(201);
    const adjusted = await adjRes.json();
    expect(adjusted.settlement.adjustmentsEarnings).toBe("250.00");
    expect(adjusted.settlement.netPayable).toBe("26210.28");
  });

  it("S1: submit → approve → mark paid — engagement settled, post-paid balances 0.00", async () => {
    expect(s1SettlementUuid).toBeTruthy();
    const submitRes = await fetch(
      `${V2_BASE}/settlements/${s1SettlementUuid}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvers: [{ approver: "Chief Accountant" }] }),
      },
    );
    expect(submitRes.status).toBe(200);
    const submitted = await submitRes.json();
    expect(submitted.settlement.status).toBe("submitted");
    const approvalUuid = submitted.approvals[0].stApprovalUuid;

    const decideRes = await fetch(
      `${V2_BASE}/settlements/approvals/${approvalUuid}/decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "Approved", comments: "ok" }),
      },
    );
    expect(decideRes.status).toBe(200);
    expect((await decideRes.json()).settlement.status).toBe("approved");

    const paidRes = await fetch(
      `${V2_BASE}/settlements/${s1SettlementUuid}/mark-paid`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidDate: "2026-05-20",
          paymentReference: `PAY_${S}`,
        }),
      },
    );
    expect(paidRes.status).toBe(200);
    const paid = await paidRes.json();
    expect(paid.settlement.status).toBe("paid");
    expect(paid.settlement.paidDate).toBe("2026-05-20");

    const eng = await db.query(
      "SELECT status FROM acc_engagements_v2 WHERE engagement_uuid = $1",
      [engS1],
    );
    expect(eng.rows[0].status).toBe("settled");

    // Post-paid balances: balance_cf and leave_cf both 0.00.
    const { BalanceService } = await import(
      "@server/v2/accounts/engine/balanceService"
    );
    const post = await new BalanceService().priorBalances(engS1, "2026-06");
    expect(post.balanceBfCents).toBe(0);
    expect(post.leaveBfCents).toBe(0);
  });

  it("settlement compute with uncalculated months ⇒ 409 naming the missing periods", async () => {
    const run = await runEngagement(engMiss, "2026-03");
    expect(run.status).toBe(200);

    const res = await fetch(`${V2_BASE}/settlements/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engagementUuid: engMiss }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("2026-04");
    expect(body.error).toContain("2026-05");
  });

  it("recompute after paid ⇒ 409", async () => {
    const res = await fetch(
      `${V2_BASE}/settlements/${s1SettlementUuid}/recompute`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );
    expect(res.status).toBe(409);
  });

  // ---- Task 95: settlement freeze guard regression ------------------------------
  it("freeze guard: submit freezes re-runs; revert re-enables; recompute picks up new figures", async () => {
    const first = await runEngagement(engFrz, "2026-03");
    expect(first.status).toBe(200);
    expect(totalsFor(first.body, crewFrz).netOnBoard).toBe("10195.00");

    const computeRes = await fetch(`${V2_BASE}/settlements/compute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ engagementUuid: engFrz }),
    });
    expect(computeRes.status).toBe(201);
    const detail = await computeRes.json();
    frzSettlementUuid = detail.settlement.settlementUuid;
    expect(detail.settlement.balancePaid).toBe("10195.00");

    const submitRes = await fetch(
      `${V2_BASE}/settlements/${frzSettlementUuid}/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvers: [{ approver: "Chief Accountant" }] }),
      },
    );
    expect(submitRes.status).toBe(200);

    // Covered-period re-run is now frozen, naming the settlement.
    const frozen = await runEngagement(engFrz, "2026-03");
    expect(frozen.status).toBe(409);
    expect(frozen.body.error).toContain(frzSettlementUuid!);
    expect(frozen.body.error).toContain("revert");

    // Revert to draft re-enables the re-run.
    const revertRes = await fetch(
      `${V2_BASE}/settlements/${frzSettlementUuid}/revert-to-draft`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );
    expect(revertRes.status).toBe(200);
    expect((await revertRes.json()).settlement.status).toBe("draft");

    // New input lands after the revert; the re-run succeeds with new figures.
    await insert("acc_monthly_transactions_v2", {
      txn_uuid: txnFrz,
      engagement_uuid: engFrz,
      crew_uuid: crewFrz,
      vessel_uuid: vslFrz,
      period: "2026-03",
      pay_element_uuid: el.CADJ,
      qty: null,
      amount: "100.00",
      currency: "USD",
      origin: "office",
      status: "accepted",
    });
    const rerun = await runEngagement(engFrz, "2026-03");
    expect(rerun.status).toBe(200);
    expect(totalsFor(rerun.body, crewFrz).netOnBoard).toBe("10295.00");

    // Recompute picks up the new figures.
    const recomputeRes = await fetch(
      `${V2_BASE}/settlements/${frzSettlementUuid}/recompute`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );
    expect(recomputeRes.status).toBe(200);
    const recomputed = await recomputeRes.json();
    expect(recomputed.settlement.balancePaid).toBe("10295.00");
  });

  // ---- Task 95: engagement overlap guard -----------------------------------------
  it("overlap: PATCH reactivating an overlapping engagement ⇒ 409", async () => {
    const res = await fetch(`${V2_BASE}/engagements/${engOvlA2}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active" }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain(engOvlA1);
  });

  it("overlap: engagement sync reports the overlap in the errors list", async () => {
    const res = await fetch(`${V2_BASE}/engagements/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vesselUuid: vslOvlSync, period: "2026-03" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const err = (body.errors as any[]).find((e) => e.crewUuid === crewOvlC);
    expect(err, `sync errors: ${JSON.stringify(body.errors)}`).toBeTruthy();
    expect(err.reason).toContain("overlapping engagement");
    expect(err.reason).toContain(engOvlC1);
    expect(body.created).toEqual([]);
  });

  it("overlap: audit endpoint lists the seeded overlap group", async () => {
    const res = await fetch(`${V2_BASE}/engagements/audit`);
    expect(res.status).toBe(200);
    const groups = (await res.json()) as any[];
    const group = groups.find((g) => g.crewUuid === crewOvlB);
    expect(group, "seeded overlap group present").toBeTruthy();
    const uuids = group.engagements.map((e: any) => e.engagementUuid).sort();
    expect(uuids).toEqual([engOvlB1, engOvlB2].sort());
  });
});
