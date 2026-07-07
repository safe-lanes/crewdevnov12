// @vitest-environment node
// happy-dom's fetch caches GET responses per-URL and can serve stale ledger
// bodies when the same query is re-fetched after a re-run; the node
// environment uses native undici fetch (no HTTP cache).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { randomUUID } from "crypto";

const API_BASE = "http://localhost:5000";
const V2_BASE = `${API_BASE}/api/v2/accounts`;

/**
 * Crew Finance exact-figure tests (spec Prompt 07 acceptance criteria).
 *
 *  1. Bond / slop chest single posting path:
 *     items 25 + 25 + 30 ⇒ ONE rollup transaction 80.00 ⇒ delete the 30
 *     item ⇒ 50.00 (same rollup maintained) ⇒ engine posts exactly one
 *     bond ledger line ⇒ manual bond-category txn alongside the rollup
 *     raises the double-entry warning ⇒ removing all items removes the
 *     rollup.
 *  2. Advance recovery clamp: 900 total, 400/month from 2026-05
 *     ⇒ 400.00 / 400.00 / 100.00 (clamped) / none, summing 900.00, with
 *     replacement determinism on re-run of an unlocked month.
 *  3. Allotment lifecycle: active in May, suspended for June, reactivated
 *     for July ⇒ deduction lines in May & July only.
 *  4. Negative net warning: over-allotment (100 + 3500 vs gross 3000)
 *     ⇒ net −600.00 ⇒ run completes with a persisted
 *     {crewUuid, code: 'negative_net', message} warning — warn, never block.
 *  5. Settlement E2E: engagement Apr–May with allotment + advance + bond
 *     ⇒ nets 2700.00 / 2740.00 ⇒ settlement net payable 5440.00.
 */

const S = `${Date.now()}`;
const u = () => randomUUID();

// ---- fixture ids -----------------------------------------------------------
const el = { BAS: u(), ALT: u(), ADVR: u(), BND: u() };
const scaleCF = u();
const RANK_AB = `AB_CF_${S}`;

const crewBond = u();
const crewAdv = u();
const crewAlt = u();
const crewStl = u();
const vslBond = `VSL_CFB_${S}`;
const vslAdv = `VSL_CFA_${S}`;
const vslAlt = `VSL_CFL_${S}`;
const vslStl = `VSL_CFS_${S}`;
const engBond = u();
const engAdv = u();
const engAlt = u();
const engStl = u();

const manualBondTxn = u();

let db: Client;
const runUuids: string[] = [];
let insertedConfigUuid: string | null = null;

// created via the API during the tests
let bondItemA: string;
let bondItemB: string;
let bondItemC: string;
let advanceUuid: string;
let allotmentUuid: string;

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

async function api(
  method: string,
  path: string,
  body?: Record<string, unknown>,
) {
  const res = await fetch(`${V2_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

/** Mutation responses may be the record itself or { record, ... }. */
function record(body: any): any {
  return body?.record ?? body;
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

const bySource = (lines: Array<Record<string, any>>, t: string) =>
  lines.filter((l) => l.sourceType === t);

/** The live (non-deleted) bond rollup transaction for a crew-month. */
async function bondRollup(crewUuid: string, period: string) {
  const res = await db.query(
    `SELECT txn_uuid, amount, status, origin, source_type
     FROM acc_monthly_transactions_v2
     WHERE source_uuid = $1 AND is_deleted = false`,
    [`bond:${crewUuid}:${period}`],
  );
  return res.rows;
}

// ---- suite -------------------------------------------------------------------
describe("Crew Finance (Prompt 07): allotments, advances, bond", () => {
  beforeAll(async () => {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error("Server not running");

    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    // tenant config must exist (figures below are full-month fixed amounts,
    // so the proration basis does not matter)
    const cfg = await db.query("SELECT * FROM acc_tenant_config_v2");
    if (cfg.rows.length === 0) {
      insertedConfigUuid = u();
      await insert("acc_tenant_config_v2", {
        config_uuid: insertedConfigUuid,
        proration_basis: "thirty_day_month",
        functional_currency: "USD",
        day_inclusion_rule: "both_inclusive",
      });
    }

    // -- pay elements -----------------------------------------------------------
    await insert("acc_pay_elements_v2", {
      pay_element_uuid: el.BAS,
      code: `CFBAS_${S}`,
      name: "CF Basic",
      type: "earning",
      category: "basic",
      calc_method: "scale_lookup",
      prorate: true,
      payment_timing: "paid_on_board",
      rounding_rule: "nearest",
      rounding_precision: "0.01",
      status: "active",
    });
    for (const [uuid, code, category] of [
      [el.ALT, `CFALT_${S}`, "allotment"],
      [el.ADVR, `CFADVR_${S}`, "advance_recovery"],
      [el.BND, `CFBND_${S}`, "bond_slop_chest"],
    ] as const) {
      await insert("acc_pay_elements_v2", {
        pay_element_uuid: uuid,
        code,
        name: code,
        type: "deduction",
        category,
        calc_method: "fixed_amount",
        prorate: false,
        payment_timing: "paid_on_board",
        rounding_rule: "nearest",
        rounding_precision: "0.01",
        status: "active",
      });
    }

    // -- wage scale: AB basic 3000 ------------------------------------------------
    await insert("acc_wage_scales_v2", {
      scale_uuid: scaleCF,
      scale_name: `Test Scale CF ${S}`,
      currency: "USD",
      effective_from: "2025-01-01",
      status: "active",
    });
    await insert("acc_wage_scale_lines_v2", {
      scale_line_uuid: u(),
      scale_uuid: scaleCF,
      rank_id: RANK_AB,
      pay_element_uuid: el.BAS,
      experience_min_months: 0,
      experience_max_months: 120,
      amount: "3000",
    });

    // -- crew + engagements (Apr-2026 onwards, open-ended) -------------------------
    for (const [crew, tag] of [
      [crewBond, "BND"],
      [crewAdv, "ADV"],
      [crewAlt, "ALT"],
      [crewStl, "STL"],
    ] as const) {
      await insert("crew_members_v2", {
        crew_uuid: crew,
        emp_no: `TEST_CF_${S}_${tag}`,
        first_name: `CF ${tag}`,
      });
    }
    for (const [eng, crew, vsl, endDate] of [
      [engBond, crewBond, vslBond, null],
      [engAdv, crewAdv, vslAdv, null],
      [engAlt, crewAlt, vslAlt, null],
      // settlement E2E: signed off 31-May — exactly two service months
      [engStl, crewStl, vslStl, "2026-05-31"],
    ] as const) {
      await insert("acc_engagements_v2", {
        engagement_uuid: eng,
        crew_uuid: crew,
        engagement_type: "voyage_contract",
        vessel_uuid: vsl,
        start_date: "2026-04-01",
        end_date: endDate,
        wage_scale_uuid: scaleCF,
        rank_id_at_start: RANK_AB,
        currency: "USD",
        status: "active",
        scale_year_at_start: 1,
        next_step_date: "2027-04-01",
      });
    }
  }, 60_000);

  afterAll(async () => {
    const tryQuery = async (sql: string, params: unknown[] = []) => {
      try {
        await db.query(sql, params);
      } catch (e) {
        console.error("cleanup failed:", sql, e);
      }
    };
    const engs = [engBond, engAdv, engAlt, engStl];
    await tryQuery(
      `DELETE FROM acc_settlement_adjustments_v2 WHERE settlement_uuid IN
       (SELECT settlement_uuid FROM acc_settlements_v2 WHERE engagement_uuid = ANY($1))`,
      [engs],
    );
    await tryQuery(
      `DELETE FROM acc_settlement_approvals_v2 WHERE settlement_uuid IN
       (SELECT settlement_uuid FROM acc_settlements_v2 WHERE engagement_uuid = ANY($1))`,
      [engs],
    );
    await tryQuery(
      "DELETE FROM acc_settlements_v2 WHERE engagement_uuid = ANY($1)",
      [engs],
    );
    await tryQuery(
      "DELETE FROM acc_wage_ledger_v2 WHERE engagement_uuid = ANY($1)",
      [engs],
    );
    if (runUuids.length > 0) {
      await tryQuery(
        "DELETE FROM acc_calculation_runs_v2 WHERE calc_run_uuid = ANY($1)",
        [runUuids],
      );
    }
    await tryQuery(
      "DELETE FROM acc_calculation_runs_v2 WHERE engagement_uuid = ANY($1)",
      [engs],
    );
    await tryQuery(
      "DELETE FROM acc_monthly_transactions_v2 WHERE crew_uuid = ANY($1)",
      [[crewBond, crewAdv, crewAlt, crewStl]],
    );
    await tryQuery("DELETE FROM acc_bond_items_v2 WHERE crew_uuid = ANY($1)", [
      [crewBond, crewStl],
    ]);
    await tryQuery("DELETE FROM acc_advances_v2 WHERE crew_uuid = ANY($1)", [
      [crewAdv, crewStl],
    ]);
    await tryQuery("DELETE FROM acc_allotments_v2 WHERE crew_uuid = ANY($1)", [
      [crewAlt, crewStl],
    ]);
    await tryQuery(
      "DELETE FROM acc_engagements_v2 WHERE engagement_uuid = ANY($1)",
      [engs],
    );
    await tryQuery("DELETE FROM crew_members_v2 WHERE crew_uuid = ANY($1)", [
      [crewBond, crewAdv, crewAlt, crewStl],
    ]);
    await tryQuery("DELETE FROM acc_wage_scale_lines_v2 WHERE scale_uuid = $1", [
      scaleCF,
    ]);
    await tryQuery("DELETE FROM acc_wage_scales_v2 WHERE scale_uuid = $1", [
      scaleCF,
    ]);
    await tryQuery(
      "DELETE FROM acc_pay_elements_v2 WHERE pay_element_uuid = ANY($1)",
      [Object.values(el)],
    );
    if (insertedConfigUuid) {
      await tryQuery("DELETE FROM acc_tenant_config_v2 WHERE config_uuid = $1", [
        insertedConfigUuid,
      ]);
    }
    await db.end();
  }, 60_000);

  // ==========================================================================
  // 1. Bond / slop chest — single posting path
  // ==========================================================================
  it("bond items 25 + 25 + 30 roll up into ONE accepted transaction of 80.00", async () => {
    const a = await api("POST", "/bond-items", {
      crewUuid: crewBond,
      itemName: "Cigarettes",
      quantity: "1",
      unitPrice: "25.00",
      currency: "USD",
      period: "2026-06",
      autoDeduct: true,
      status: "pending",
    });
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    bondItemA = record(a.body).bondItemUuid;

    const b = await api("POST", "/bond-items", {
      crewUuid: crewBond,
      itemName: "Toiletries",
      quantity: "1",
      unitPrice: "25.00",
      currency: "USD",
      period: "2026-06",
      autoDeduct: true,
      status: "pending",
    });
    expect(b.status, JSON.stringify(b.body)).toBe(201);
    bondItemB = record(b.body).bondItemUuid;

    const c = await api("POST", "/bond-items", {
      crewUuid: crewBond,
      itemName: "Chocolate",
      quantity: "2",
      unitPrice: "15.00",
      currency: "USD",
      period: "2026-06",
      autoDeduct: true,
      status: "pending",
    });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    bondItemC = record(c.body).bondItemUuid;

    const rollup = await bondRollup(crewBond, "2026-06");
    expect(rollup.length).toBe(1); // exactly ONE rollup transaction
    expect(rollup[0].amount).toBe("80.00"); // 25 + 25 + 30
    expect(rollup[0].status).toBe("accepted");
    expect(rollup[0].origin).toBe("office");
    expect(rollup[0].source_type).toBe("bond");
  });

  it("deleting the 30.00 item re-rolls the same crew-month to 50.00", async () => {
    const del = await api("DELETE", `/bond-items/${bondItemC}`);
    expect(del.status, JSON.stringify(del.body)).toBe(204);

    const rollup = await bondRollup(crewBond, "2026-06");
    expect(rollup.length).toBe(1);
    expect(rollup[0].amount).toBe("50.00"); // 25 + 25
  });

  it("engine posts the bond ONCE via the rollup — single ledger line 50.00", async () => {
    const { status } = await runEngagement(engBond, "2026-06");
    expect(status).toBe(200);

    const lines = await ledgerLines(engBond, "2026-06");
    const bondLines = bySource(lines, "bond");
    expect(bondLines.length).toBe(1); // single posting path
    expect(bondLines[0].amount).toBe("50.00");

    // deductions total on the run reflects exactly one bond deduction
    const basic = lines.filter((l) => l.payElementUuid === el.BAS);
    expect(basic[0]?.amount).toBe("3000.00");
  });

  it("manual bond-category txn alongside the rollup raises the double-entry warning", async () => {
    await insert("acc_monthly_transactions_v2", {
      txn_uuid: manualBondTxn,
      engagement_uuid: engBond,
      crew_uuid: crewBond,
      vessel_uuid: vslBond,
      period: "2026-06",
      pay_element_uuid: el.BND,
      qty: null,
      amount: "10.00",
      currency: "USD",
      origin: "office",
      status: "accepted",
    });

    const { status, body } = await runEngagement(engBond, "2026-06");
    expect(status).toBe(200);
    const warnings = (body.warnings ?? []) as string[];
    expect(
      warnings.some((w) => w.includes("possible bond double entry")),
      `run warnings: ${JSON.stringify(warnings)}`,
    ).toBe(true);

    // warn — don't block: both post, so remove the manual txn again
    await db.query(
      "DELETE FROM acc_monthly_transactions_v2 WHERE txn_uuid = $1",
      [manualBondTxn],
    );
  });

  it("removing the remaining items removes the rollup transaction", async () => {
    for (const uuid of [bondItemA, bondItemB]) {
      const del = await api("DELETE", `/bond-items/${uuid}`);
      expect(del.status, JSON.stringify(del.body)).toBe(204);
    }
    const rollup = await bondRollup(crewBond, "2026-06");
    expect(rollup.length).toBe(0); // Σ = 0 ⇒ rollup removed

    const { status, body } = await runEngagement(engBond, "2026-06");
    expect(status).toBe(200);
    expect(body?.run?.status).toBe("completed");
    const lines = await ledgerLines(engBond, "2026-06");
    expect(bySource(lines, "bond").length).toBe(0);
  });

  // ==========================================================================
  // 2. Advance recovery clamp — 900 @ 400/month from 2026-05
  // ==========================================================================
  it("creates a 900.00 advance recovered at 400.00/month from 2026-05", async () => {
    const res = await api("POST", "/advances", {
      crewUuid: crewAdv,
      amount: "900",
      recoveryAmount: "400",
      currency: "USD",
      period: "2026-05",
      status: "approved",
      reason: "CF exact-figure test",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    advanceUuid = record(res.body).advanceUuid;
    expect(advanceUuid).toBeTruthy();
  });

  it("month 1 (2026-05): recovers 400.00", async () => {
    const { status } = await runEngagement(engAdv, "2026-05");
    expect(status).toBe(200);
    const rec = bySource(await ledgerLines(engAdv, "2026-05"), "advance_recovery");
    expect(rec.length).toBe(1);
    expect(rec[0].amount).toBe("400.00");
  });

  it("month 2 (2026-06): recovers 400.00", async () => {
    const { status } = await runEngagement(engAdv, "2026-06");
    expect(status).toBe(200);
    const rec = bySource(await ledgerLines(engAdv, "2026-06"), "advance_recovery");
    expect(rec.length).toBe(1);
    expect(rec[0].amount).toBe("400.00");
  });

  it("month 3 (2026-07): clamps to the 100.00 outstanding", async () => {
    const { status } = await runEngagement(engAdv, "2026-07");
    expect(status).toBe(200);
    const rec = bySource(await ledgerLines(engAdv, "2026-07"), "advance_recovery");
    expect(rec.length).toBe(1);
    expect(rec[0].amount).toBe("100.00"); // min(400, 900 − 800)
  });

  it("re-running month 3 is deterministic — still one line of 100.00", async () => {
    const { status } = await runEngagement(engAdv, "2026-07");
    expect(status).toBe(200);
    const rec = bySource(await ledgerLines(engAdv, "2026-07"), "advance_recovery");
    expect(rec.length).toBe(1); // replacement, not duplication
    expect(rec[0].amount).toBe("100.00");
  });

  it("month 4 (2026-08): fully recovered — no recovery line; total = 900.00", async () => {
    const { status } = await runEngagement(engAdv, "2026-08");
    expect(status).toBe(200);
    const rec = bySource(await ledgerLines(engAdv, "2026-08"), "advance_recovery");
    expect(rec.length).toBe(0);

    // Σ of the three posted months is exactly the advance amount
    let totalCents = 0;
    for (const period of ["2026-05", "2026-06", "2026-07"]) {
      const lines = bySource(await ledgerLines(engAdv, period), "advance_recovery");
      totalCents += Math.round(Number(lines[0].amount) * 100);
    }
    expect((totalCents / 100).toFixed(2)).toBe("900.00");

    const detail = await api("GET", `/advances/${advanceUuid}/detail`);
    expect(detail.status).toBe(200);
    expect(detail.body.recoveredToDate).toBe("900.00");
    expect(detail.body.outstanding).toBe("0.00");
    expect(detail.body.displayStatus).toBe("fully-recovered");
  });

  // ==========================================================================
  // 3. Allotment lifecycle — May & July only
  // ==========================================================================
  it("active allotment posts 100.00 in May", async () => {
    const res = await api("POST", "/allotments", {
      crewUuid: crewAlt,
      beneficiaryName: "Maria Santos",
      relationship: "spouse",
      allotmentType: "fixed",
      value: "100",
      currency: "USD",
      validFrom: "2026-05-01",
      status: "active",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    allotmentUuid = record(res.body).allotmentUuid;

    const { status } = await runEngagement(engAlt, "2026-05");
    expect(status).toBe(200);
    const alt = bySource(await ledgerLines(engAlt, "2026-05"), "allotment");
    expect(alt.length).toBe(1);
    expect(alt[0].amount).toBe("100.00");
  });

  it("suspended allotment posts nothing in June", async () => {
    const sus = await api("POST", `/allotments/${allotmentUuid}/suspend`);
    expect(sus.status, JSON.stringify(sus.body)).toBe(200);

    const { status } = await runEngagement(engAlt, "2026-06");
    expect(status).toBe(200);
    const alt = bySource(await ledgerLines(engAlt, "2026-06"), "allotment");
    expect(alt.length).toBe(0); // suspension gap
  });

  it("reactivated allotment posts 100.00 again in July — May & July only", async () => {
    const rea = await api("POST", `/allotments/${allotmentUuid}/reactivate`);
    expect(rea.status, JSON.stringify(rea.body)).toBe(200);

    const { status } = await runEngagement(engAlt, "2026-07");
    expect(status).toBe(200);
    const alt = bySource(await ledgerLines(engAlt, "2026-07"), "allotment");
    expect(alt.length).toBe(1);
    expect(alt[0].amount).toBe("100.00");

    // the gap month stays empty
    const june = bySource(await ledgerLines(engAlt, "2026-06"), "allotment");
    expect(june.length).toBe(0);
  });

  // ==========================================================================
  // 4. Negative net — warn, never block (Prompt 07 follow-up)
  // ==========================================================================
  it("over-allotment drives September net to −600.00 — run completes with a persisted negative_net warning", async () => {
    // second allotment 3500.00 valid for September only ⇒ deductions
    // 100.00 + 3500.00 = 3600.00 vs gross 3000.00 ⇒ net −600.00
    const res = await api("POST", "/allotments", {
      crewUuid: crewAlt,
      beneficiaryName: "Over Allotment",
      relationship: "other",
      allotmentType: "fixed",
      value: "3500",
      currency: "USD",
      validFrom: "2026-09-01",
      validTo: "2026-09-30",
      status: "active",
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(record(res.body).allotmentUuid).toBeTruthy();

    const { status, body } = await runEngagement(engAlt, "2026-09");
    expect(status).toBe(200);
    expect(body?.run?.status).toBe("completed"); // warn — never block

    // both allotments post in full (exact figures)
    const alt = bySource(await ledgerLines(engAlt, "2026-09"), "allotment");
    expect(alt.map((l) => l.amount).sort()).toEqual(["100.00", "3500.00"]);

    // session warnings carry the amount
    const warnings = (body.warnings ?? []) as string[];
    expect(
      warnings.some(
        (w) =>
          w.includes("negative net payable on board") && w.includes("-600.00"),
      ),
      `run warnings: ${JSON.stringify(warnings)}`,
    ).toBe(true);

    // persisted on the run row as {crewUuid, code, message} for Step 2
    const run = await db.query(
      "SELECT warnings FROM acc_calculation_runs_v2 WHERE calc_run_uuid = $1",
      [body.run.calcRunUuid],
    );
    const persisted = (run.rows[0]?.warnings ?? []) as Array<
      Record<string, any>
    >;
    const neg = persisted.find((w) => w.code === "negative_net");
    expect(neg, JSON.stringify(persisted)).toBeTruthy();
    expect(neg!.crewUuid).toBe(crewAlt);
    expect(neg!.message).toContain("-600.00");
  });

  // ==========================================================================
  // 5. Settlement E2E — allotment + advance + bond in the final settlement
  // ==========================================================================
  it("settlement reflects allotment, advance recovery and bond: net payable 5440.00", async () => {
    // allotment 100.00/month across the whole engagement
    const alt = await api("POST", "/allotments", {
      crewUuid: crewStl,
      beneficiaryName: "Stl Beneficiary",
      relationship: "spouse",
      allotmentType: "fixed",
      value: "100",
      currency: "USD",
      validFrom: "2026-04-01",
      status: "active",
    });
    expect(alt.status, JSON.stringify(alt.body)).toBe(201);

    // advance 300.00 recovered at 200.00/month from April ⇒ 200 / 100 (clamped)
    const adv = await api("POST", "/advances", {
      crewUuid: crewStl,
      amount: "300",
      recoveryAmount: "200",
      currency: "USD",
      period: "2026-04",
      status: "approved",
      reason: "CF settlement E2E",
    });
    expect(adv.status, JSON.stringify(adv.body)).toBe(201);

    // bond items 40.00 + 20.00 in May ⇒ one rollup deduction of 60.00
    for (const [itemName, unitPrice] of [
      ["Snacks", "40.00"],
      ["Phone card", "20.00"],
    ] as const) {
      const bi = await api("POST", "/bond-items", {
        crewUuid: crewStl,
        itemName,
        quantity: "1",
        unitPrice,
        currency: "USD",
        period: "2026-05",
        autoDeduct: true,
        status: "pending",
      });
      expect(bi.status, JSON.stringify(bi.body)).toBe(201);
    }

    // run both service months — exact nets:
    //   Apr: 3000 − (100 allotment + 200 advance)          = 2700.00
    //   May: 3000 − (100 allotment + 100 advance + 60 bond) = 2740.00
    for (const [period, expectedNet] of [
      ["2026-04", "2700.00"],
      ["2026-05", "2740.00"],
    ] as const) {
      const { status, body } = await runEngagement(engStl, period);
      expect(status).toBe(200);
      const totals = ((body.crewTotals ?? []) as any[]).find(
        (t) => t.crewUuid === crewStl,
      );
      expect(totals?.netOnBoard, `period ${period}`).toBe(expectedNet);
    }

    // per-source ledger check: all three deduction types present in May
    const may = await ledgerLines(engStl, "2026-05");
    expect(bySource(may, "allotment")[0]?.amount).toBe("100.00");
    expect(bySource(may, "advance_recovery")[0]?.amount).toBe("100.00");
    expect(bySource(may, "bond")[0]?.amount).toBe("60.00");

    // settlement: balance 2700 + 2740 = 5440.00, no settlement-timed accruals
    const res = await api("POST", "/settlements/compute", {
      engagementUuid: engStl,
    });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const settlement = res.body.settlement;
    expect(settlement.status).toBe("draft");
    expect(settlement.balancePaid).toBe("5440.00");
    expect(settlement.accrualsPaid).toBe("0.00");
    expect(settlement.netPayable).toBe("5440.00");
    expect(
      settlement.statementSnapshot.balance.byPeriod.map((p: any) => [
        p.period,
        p.netOnBoard,
      ]),
    ).toEqual([
      ["2026-04", "2700.00"],
      ["2026-05", "2740.00"],
    ]);
  });
});
