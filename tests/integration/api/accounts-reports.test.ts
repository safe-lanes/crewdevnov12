// @vitest-environment node
// (native undici fetch — no per-URL GET caching; see crew-finance.test.ts)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { randomUUID } from "crypto";

const API_BASE = "http://localhost:5000";
const V2_BASE = `${API_BASE}/api/v2/accounts`;

/**
 * Reports layer exact-figure tests (Task: Accounts Reports).
 *
 * The reports are pure projections of acc_wage_ledger_v2, so the fixture
 * inserts ledger lines directly (no engine run) for full figure control.
 *
 * Vessel RPT, two crew, periods Mar-2026 (no portage → DRAFT) and
 * Apr-2026 (approved portage → final; superseding rule exercised with a
 * leftover preview line that must be ignored):
 *
 *   Crew A (Alice) April: BAS 3000 (gl 5100) + OTF 500 (no gl → UNMAPPED)
 *     on board; LVE 250 payable_at_settlement (leave); ALT 800 deduction
 *     (gl 2400); PF 100 employer remitted_to_fund; + preview BAS 999
 *     (ignored) ⇒ gross 3500.00, deductions 800.00, net 2700.00,
 *     accrual 250.00, fund 100.00; March: BAS 3000 − ALT 800 ⇒ balance
 *     B/F 2200.00, C/F 4900.00; leave B/F 250.00 ⇒ C/F 500.00.
 *   Crew B (Bob) April: BAS 2000 ⇒ net 2000.00.
 *
 *   GL export April: DR 5100=5000.00, UNMAPPED=500.00; CR 2400=800.00,
 *     wages payable 2100=4700.00 ⇒ ΣDR = ΣCR = 5500.00 balanced,
 *     memo accrual 250.00 / fund 100.00, finalized (approved).
 *   Fleet summary April: 2 crew, gross 5500.00, contributions 100.00,
 *     deductions 800.00, net 4700.00, accruals 250.00.
 */

const S = `${Date.now()}`;
const u = () => randomUUID();

const el = { BAS: u(), OTF: u(), LVE: u(), ALT: u(), PF: u() };
const crewA = u();
const crewB = u();
const vsl = u();
const engA = u();
const engB = u();
const portageApr = u();
const CALC_RUN = u();
const RANK = `AB_RPT_${S}`;
const WAGES_PAYABLE = "2100";

let db: Client;
let insertedConfigUuid: string | null = null;
let originalWagesPayable: { configUuid: string; value: string | null } | null =
  null;
const ledgerUuids: string[] = [];

async function insert(table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const params = cols.map((_, i) => `$${i + 1}`).join(", ");
  await db.query(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${params})`,
    vals,
  );
}

async function get(path: string) {
  const res = await fetch(`${V2_BASE}${path}`);
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

interface LedgerLineSeed {
  crew: string;
  eng: string;
  period: string;
  element: keyof typeof el;
  type: "earning" | "deduction" | "employer_contribution";
  timing: "paid_on_board" | "payable_at_settlement" | "remitted_to_fund";
  amount: string;
  portage?: string | null;
  from?: string;
  to?: string;
  days?: string;
}

async function seedLine(l: LedgerLineSeed) {
  const uuid = u();
  ledgerUuids.push(uuid);
  await insert("acc_wage_ledger_v2", {
    ledger_uuid: uuid,
    calc_run_uuid: CALC_RUN,
    portage_uuid: l.portage ?? null,
    engagement_uuid: l.eng,
    crew_uuid: l.crew,
    vessel_uuid: vsl,
    period: l.period,
    period_from: l.from ?? `${l.period}-01`,
    period_to: l.to ?? null,
    days_served: l.days ?? null,
    rank_id: RANK,
    pay_element_uuid: el[l.element],
    element_type: l.type,
    element_code: `RPT${l.element}_${S}`,
    payment_timing: l.timing,
    amount: l.amount,
    currency: "USD",
    source_type: "scale",
    is_adjustment: false,
  });
}

describe("Accounts Reports: payslips, GL export, fleet summary", () => {
  beforeAll(async () => {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error("Server not running");

    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    // tenant config: ensure it exists and set the wages-payable GL account
    const cfg = await db.query(
      "SELECT config_uuid, gl_wages_payable_code FROM acc_tenant_config_v2 LIMIT 1",
    );
    if (cfg.rows.length === 0) {
      insertedConfigUuid = u();
      await insert("acc_tenant_config_v2", {
        config_uuid: insertedConfigUuid,
        proration_basis: "thirty_day_month",
        functional_currency: "USD",
        day_inclusion_rule: "both_inclusive",
        gl_wages_payable_code: WAGES_PAYABLE,
      });
    } else {
      originalWagesPayable = {
        configUuid: cfg.rows[0].config_uuid,
        value: cfg.rows[0].gl_wages_payable_code,
      };
      await db.query(
        "UPDATE acc_tenant_config_v2 SET gl_wages_payable_code = $1 WHERE config_uuid = $2",
        [WAGES_PAYABLE, cfg.rows[0].config_uuid],
      );
    }

    // pay elements
    const elements: Array<
      [string, string, string, string, string, string | null]
    > = [
      [el.BAS, `RPTBAS_${S}`, "earning", "basic", "paid_on_board", "5100"],
      [el.OTF, `RPTOTF_${S}`, "earning", "overtime", "paid_on_board", null],
      [el.LVE, `RPTLVE_${S}`, "earning", "leave", "payable_at_settlement", null],
      [el.ALT, `RPTALT_${S}`, "deduction", "allotment", "paid_on_board", "2400"],
      [
        el.PF,
        `RPTPF_${S}`,
        "employer_contribution",
        "provident_fund",
        "remitted_to_fund",
        "5300",
      ],
    ];
    for (const [uuid, code, type, category, timing, gl] of elements) {
      await insert("acc_pay_elements_v2", {
        pay_element_uuid: uuid,
        code,
        name: code,
        type,
        category,
        calc_method: "fixed_amount",
        prorate: false,
        payment_timing: timing,
        rounding_rule: "nearest",
        rounding_precision: "0.01",
        status: "active",
        gl_code: gl,
      });
    }

    // crew + engagements (open-ended from 01-Mar-2026)
    await insert("crew_members_v2", {
      crew_uuid: crewA,
      emp_no: `TEST_RPT_${S}_A`,
      first_name: "RPT",
      family_name: "Alice",
    });
    await insert("crew_members_v2", {
      crew_uuid: crewB,
      emp_no: `TEST_RPT_${S}_B`,
      first_name: "RPT",
      family_name: "Bob",
    });
    for (const [eng, crew] of [
      [engA, crewA],
      [engB, crewB],
    ] as const) {
      await insert("acc_engagements_v2", {
        engagement_uuid: eng,
        crew_uuid: crew,
        engagement_type: "voyage_contract",
        vessel_uuid: vsl,
        start_date: "2026-03-01",
        end_date: null,
        rank_id_at_start: RANK,
        currency: "USD",
        status: "active",
        scale_year_at_start: 1,
      });
    }

    // approved portage bill for April
    await insert("acc_portage_bills_v2", {
      portage_uuid: portageApr,
      vessel_uuid: vsl,
      period: "2026-04",
      status: "approved",
      currency: "USD",
    });

    // March (no portage → draft)
    await seedLine({ crew: crewA, eng: engA, period: "2026-03", element: "BAS", type: "earning", timing: "paid_on_board", amount: "3000.00", from: "2026-03-01", to: "2026-03-31", days: "31.00" });
    await seedLine({ crew: crewA, eng: engA, period: "2026-03", element: "ALT", type: "deduction", timing: "paid_on_board", amount: "800.00" });
    await seedLine({ crew: crewA, eng: engA, period: "2026-03", element: "LVE", type: "earning", timing: "payable_at_settlement", amount: "250.00" });

    // April (portage lines; approved)
    await seedLine({ crew: crewA, eng: engA, period: "2026-04", element: "BAS", type: "earning", timing: "paid_on_board", amount: "3000.00", portage: portageApr, from: "2026-04-01", to: "2026-04-30", days: "30.00" });
    await seedLine({ crew: crewA, eng: engA, period: "2026-04", element: "OTF", type: "earning", timing: "paid_on_board", amount: "500.00", portage: portageApr });
    await seedLine({ crew: crewA, eng: engA, period: "2026-04", element: "LVE", type: "earning", timing: "payable_at_settlement", amount: "250.00", portage: portageApr });
    await seedLine({ crew: crewA, eng: engA, period: "2026-04", element: "ALT", type: "deduction", timing: "paid_on_board", amount: "800.00", portage: portageApr });
    await seedLine({ crew: crewA, eng: engA, period: "2026-04", element: "PF", type: "employer_contribution", timing: "remitted_to_fund", amount: "100.00", portage: portageApr });
    // leftover preview line — MUST be superseded by the portage lines above
    await seedLine({ crew: crewA, eng: engA, period: "2026-04", element: "BAS", type: "earning", timing: "paid_on_board", amount: "999.00", portage: null });

    await seedLine({ crew: crewB, eng: engB, period: "2026-04", element: "BAS", type: "earning", timing: "paid_on_board", amount: "2000.00", portage: portageApr, from: "2026-04-01", to: "2026-04-30", days: "30.00" });
  }, 60_000);

  afterAll(async () => {
    const tryQuery = async (sql: string, params: unknown[] = []) => {
      try {
        await db.query(sql, params);
      } catch (e) {
        console.error("cleanup failed:", sql, e);
      }
    };
    await tryQuery("DELETE FROM acc_wage_ledger_v2 WHERE ledger_uuid = ANY($1)", [ledgerUuids]);
    await tryQuery("DELETE FROM acc_portage_bills_v2 WHERE portage_uuid = $1", [portageApr]);
    await tryQuery("DELETE FROM acc_engagements_v2 WHERE engagement_uuid = ANY($1)", [[engA, engB]]);
    await tryQuery("DELETE FROM crew_members_v2 WHERE crew_uuid = ANY($1)", [[crewA, crewB]]);
    await tryQuery("DELETE FROM acc_pay_elements_v2 WHERE pay_element_uuid = ANY($1)", [Object.values(el)]);
    if (insertedConfigUuid) {
      await tryQuery("DELETE FROM acc_tenant_config_v2 WHERE config_uuid = $1", [insertedConfigUuid]);
    } else if (originalWagesPayable) {
      await tryQuery(
        "UPDATE acc_tenant_config_v2 SET gl_wages_payable_code = $1 WHERE config_uuid = $2",
        [originalWagesPayable.value, originalWagesPayable.configUuid],
      );
    }
    await db.end();
  }, 60_000);

  // ==========================================================================
  // Payslips
  // ==========================================================================
  it("single payslip (by engagement) has exact section and total figures", async () => {
    const r = await get(`/reports/payslip?engagementUuid=${engA}&period=2026-04`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const p = r.body;
    expect(p.crewName).toBe("RPT Alice");
    expect(p.period).toBe("2026-04");
    expect(p.daysServed).toBe("30");
    expect(p.sections.earnings).toHaveLength(2); // BAS + OTF (preview 999 superseded)
    expect(p.sections.deductions).toHaveLength(1);
    expect(p.sections.settlementAccruals).toHaveLength(1);
    expect(p.sections.fundRemittances).toHaveLength(1);
    expect(
      p.sections.earnings.map((l: any) => l.amount).sort(),
    ).toEqual(["3000.00", "500.00"]);
    expect(p.totals.earnedGross).toBe("3500.00");
    expect(p.totals.deductions).toBe("800.00");
    expect(p.totals.netOnBoard).toBe("2700.00");
    expect(p.totals.settlementAccrual).toBe("250.00");
    expect(p.totals.fundRemittance).toBe("100.00");
    expect(p.totals.balanceBf).toBe("2200.00"); // March 3000 − 800
    expect(p.totals.balanceCf).toBe("4900.00"); // 2200 + 2700
    expect(p.totals.leaveBf).toBe("250.00");
    expect(p.totals.leaveThisMonth).toBe("250.00");
    expect(p.totals.leaveCf).toBe("500.00");
    expect(p.meta.portageUuid).toBe(portageApr);
    expect(p.meta.isDraft).toBe(false); // approved portage → final
  });

  it("single payslip by crewUuid resolves the engagement", async () => {
    const r = await get(`/reports/payslip?crewUuid=${crewA}&period=2026-04`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.engagementUuid).toBe(engA);
    expect(r.body.totals.netOnBoard).toBe("2700.00");
  });

  it("March payslip is DRAFT (no portage bill)", async () => {
    const r = await get(`/reports/payslip?engagementUuid=${engA}&period=2026-03`);
    expect(r.status).toBe(200);
    expect(r.body.meta.isDraft).toBe(true);
    expect(r.body.meta.portageUuid).toBeNull();
    expect(r.body.totals.earnedGross).toBe("3000.00");
    expect(r.body.totals.netOnBoard).toBe("2200.00");
    expect(r.body.totals.balanceBf).toBe("0.00");
    expect(r.body.totals.leaveBf).toBe("0.00");
    expect(r.body.totals.leaveCf).toBe("250.00");
  });

  it("batch payslips return both crew sorted by name with batch flags", async () => {
    const r = await get(`/reports/payslips?vesselUuid=${vsl}&period=2026-04`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.portageStatus).toBe("approved");
    expect(r.body.isDraft).toBe(false);
    expect(r.body.payslips).toHaveLength(2);
    expect(r.body.payslips.map((p: any) => p.crewName)).toEqual([
      "RPT Alice",
      "RPT Bob",
    ]);
    const bob = r.body.payslips[1];
    expect(bob.totals.earnedGross).toBe("2000.00");
    expect(bob.totals.deductions).toBe("0.00");
    expect(bob.totals.netOnBoard).toBe("2000.00");
    expect(bob.totals.balanceBf).toBe("0.00");
    expect(bob.totals.balanceCf).toBe("2000.00");
  });

  // ==========================================================================
  // GL export
  // ==========================================================================
  it("GL export produces a balanced DR/CR journal with UNMAPPED aggregation", async () => {
    const r = await get(`/reports/gl-export?vesselUuid=${vsl}&period=2026-04`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const g = r.body;

    expect(g.totals.dr).toBe("5500.00"); // 5000 + 500 (preview 999 superseded)
    expect(g.totals.cr).toBe("5500.00"); // 800 + 4700
    expect(g.totals.balanced).toBe(true);

    const byCode = new Map(g.rows.map((row: any) => [row.glCode, row]));
    expect((byCode.get("5100") as any).dr).toBe("5000.00"); // BAS 3000 + 2000
    expect((byCode.get("5100") as any).cr).toBe("0.00");
    expect((byCode.get("2400") as any).cr).toBe("800.00"); // ALT
    expect((byCode.get(WAGES_PAYABLE) as any).cr).toBe("4700.00"); // net payable
    expect((byCode.get("UNMAPPED") as any).dr).toBe("500.00"); // OTF no gl_code
    expect(g.rows[g.rows.length - 1].glCode).toBe("UNMAPPED"); // sorted last

    // settlement accrual + fund remittance are memo-only, never journaled
    expect(g.memo.settlementAccrual).toBe("250.00");
    expect(g.memo.fundRemittance).toBe("100.00");
    expect(byCode.has("5300")).toBe(false); // PF (fund) not journaled

    expect(g.warnings).toHaveLength(1); // unmapped elements only (config set)
    expect(g.warnings[0]).toContain(`RPTOTF_${S}`);
    expect(g.meta.finalized).toBe(true);
    expect(g.meta.portageStatus).toBe("approved");
  });

  it("GL export flags a missing wages-payable account", async () => {
    const cfg = await db.query(
      "SELECT config_uuid FROM acc_tenant_config_v2 LIMIT 1",
    );
    await db.query(
      "UPDATE acc_tenant_config_v2 SET gl_wages_payable_code = NULL WHERE config_uuid = $1",
      [cfg.rows[0].config_uuid],
    );
    try {
      const r = await get(`/reports/gl-export?vesselUuid=${vsl}&period=2026-04`);
      expect(r.status).toBe(200);
      expect(r.body.totals.balanced).toBe(true); // net CR folds into UNMAPPED
      const unmapped = r.body.rows.find((x: any) => x.glCode === "UNMAPPED");
      expect(unmapped.dr).toBe("500.00");
      expect(unmapped.cr).toBe("4700.00");
      expect(r.body.warnings).toHaveLength(2);
    } finally {
      await db.query(
        "UPDATE acc_tenant_config_v2 SET gl_wages_payable_code = $1 WHERE config_uuid = $2",
        [WAGES_PAYABLE, cfg.rows[0].config_uuid],
      );
    }
  });

  // ==========================================================================
  // Fleet summary
  // ==========================================================================
  it("fleet summary aggregates the vessel month exactly", async () => {
    const r = await get(`/reports/fleet-summary?period=2026-04&vesselUuid=${vsl}`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.rows).toHaveLength(1);
    const row = r.body.rows[0];
    expect(row.vesselUuid).toBe(vsl);
    expect(row.crewCount).toBe(2);
    expect(row.earnedGross).toBe("5500.00");
    expect(row.employerContributions).toBe("100.00");
    expect(row.deductions).toBe("800.00");
    expect(row.netPayable).toBe("4700.00");
    expect(row.settlementAccrual).toBe("250.00");
    expect(r.body.totals.crewCount).toBe(2);
    expect(r.body.totals.netPayable).toBe("4700.00");
  });

  it("fleet summary without vessel filter includes the vessel row", async () => {
    const r = await get(`/reports/fleet-summary?period=2026-04`);
    expect(r.status).toBe(200);
    const row = r.body.rows.find((x: any) => x.vesselUuid === vsl);
    expect(row).toBeDefined();
    expect(row.earnedGross).toBe("5500.00");
    expect(row.netPayable).toBe("4700.00");
  });

  // ==========================================================================
  // Validation + not-found
  // ==========================================================================
  it("rejects bad input and unknown records", async () => {
    expect((await get(`/reports/payslip?period=2026-04`)).status).toBe(400); // no crew/engagement
    expect(
      (await get(`/reports/payslip?engagementUuid=${engA}&period=202604`)).status,
    ).toBe(400); // bad period
    expect((await get(`/reports/payslips?period=2026-04`)).status).toBe(400); // no vessel
    expect((await get(`/reports/fleet-summary?period=`)).status).toBe(400);
    expect(
      (await get(`/reports/payslip?engagementUuid=${u()}&period=2026-04`)).status,
    ).toBe(404); // unknown engagement
    expect(
      (await get(`/reports/payslip?crewUuid=${u()}&period=2026-04`)).status,
    ).toBe(404); // unknown crew
    expect(
      (await get(`/reports/payslip?engagementUuid=${engB}&period=2026-03`)).status,
    ).toBe(404); // engagement exists but no lines that month
  });
});
