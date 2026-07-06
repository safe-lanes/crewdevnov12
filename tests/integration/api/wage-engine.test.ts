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

const vslH1 = `VSL_H1_${S}`;
const vslH2 = `VSL_H2_${S}`;
const vslH3 = `VSL_H3_${S}`;
const vslH4 = `VSL_H4_${S}`;
const vslFeb = `VSL_FEB_${S}`;
const vslLock = `VSL_LOCK_${S}`;

const engH1 = u();
const engH2 = u();
const engH3 = u();
const engH4 = u();
const engFeb = u();
const engLock = u();

const allEngagements = [engH1, engH2, engH3, engH4, engFeb, engLock];

const promoLedgerUuid = u();
const epeSubs = u();
const epeCadj = u();
const txnVot = u();
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
      [[epeSubs, epeCadj]],
    );
    await tryQuery("DELETE FROM acc_monthly_transactions_v2 WHERE txn_uuid = $1", [txnVot]);
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
});
