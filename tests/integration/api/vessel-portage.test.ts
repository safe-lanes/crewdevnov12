import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { randomUUID } from "crypto";

const API_BASE = "http://localhost:5000";
const V2_BASE = `${API_BASE}/api/v2/accounts`;

/**
 * Prompt 06 — Vessel-side submission package & CTM cash account.
 *
 * Five spec test groups:
 *  1. Lifecycle: draft → submit → accept/reject → run (accepted only) →
 *     return → re-open → resubmit → accept → run → lock ⇒ vessel 409/403
 *  2. CTM math (exact): closing 13,825.00; after deleting the 300.00 draft
 *     advance ⇒ 14,125.00
 *  3. Advance linkage: one txn ⇔ one CTM line; accept no-dup; reject removes
 *  4. Scope guard: vessel-scoped request against another vessel ⇒ 403
 *  5. Wage-integrity guard: vessel + scale_lookup element ⇒ 400
 *
 * Vessel ("Ship") users are simulated with an unsigned Bearer JWT which the
 * dev AUTH_BYPASS path decodes (unverified) into req.user.
 */

const S = `${Date.now()}`;
const u = () => randomUUID();

const PERIOD = "2026-03";
const PRIOR = "2026-02";

// ---- fixture ids -----------------------------------------------------------
const elBAS = u(); // scale_lookup basic — forbidden to vessel
const elVOT = u(); // rate_times_qty overtime
const elADV = u(); // advance_recovery deduction (dual-record trigger)
const elBND = u(); // bond_slop_chest deduction
const elBON = u(); // manual_entry bonus — non-vessel category, forbidden to vessel

const vslA = `VSL_VPA_${S}`; // lifecycle
const vslB = `VSL_VPB_${S}`; // CTM math
const vslC = `VSL_VPC_${S}`; // advance linkage

const RANK_A = `VP_MST_${S}`;
const scaleA = u();
const crewA = u();
const engA = u();

let db: Client;
const runUuids: string[] = [];

// ---- helpers ----------------------------------------------------------------
function shipToken(vessels: string[]): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    id: 990001,
    domain: "test",
    userType: "Ship",
    vessels,
  })}.devsig`;
}

const tokenA = shipToken([vslA]);
const tokenB = shipToken([vslB]);
const tokenC = shipToken([vslC]);
const tokenNoVessels = shipToken([]);

let cacheBust = 0;

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: any }> {
  // happy-dom's fetch caches GET responses per URL (ignoring auth headers),
  // so repeated URLs would replay stale responses. A unique cache-busting
  // query param forces every request to hit the server.
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${V2_BASE}${path}${sep}_cb=${cacheBust++}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

async function insert(table: string, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const vals = Object.values(row);
  const params = cols.map((_, i) => `$${i + 1}`).join(", ");
  await db.query(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${params})`,
    vals,
  );
}

function txnBody(overrides: Record<string, unknown> = {}) {
  return {
    engagementUuid: u(),
    crewUuid: u(),
    vesselUuid: vslB,
    period: PERIOD,
    payElementUuid: elADV,
    amount: "100.00",
    currency: "USD",
    origin: "vessel",
    ...overrides,
  };
}

// ---- suite -------------------------------------------------------------------
describe("Vessel submission package & CTM cash account (Prompt 06)", () => {
  beforeAll(async () => {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error("Server not running");

    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    // -- pay elements -------------------------------------------------------
    await insert("acc_pay_elements_v2", {
      pay_element_uuid: elBAS,
      code: `VP_BAS_${S}`,
      name: "VP Basic",
      type: "earning",
      category: "basic",
      calc_method: "scale_lookup",
      prorate: true,
      payment_timing: "paid_on_board",
      rounding_rule: "nearest",
      rounding_precision: "0.01",
      status: "active",
    });
    await insert("acc_pay_elements_v2", {
      pay_element_uuid: elVOT,
      code: `VP_VOT_${S}`,
      name: "VP Variable OT",
      type: "earning",
      category: "overtime_variable",
      calc_method: "rate_times_qty",
      prorate: false,
      payment_timing: "paid_on_board",
      rounding_rule: "nearest",
      rounding_precision: "0.01",
      status: "active",
    });
    await insert("acc_pay_elements_v2", {
      pay_element_uuid: elADV,
      code: `VP_ADV_${S}`,
      name: "VP Advance Recovery",
      type: "deduction",
      category: "advance_recovery",
      calc_method: "fixed_amount",
      prorate: false,
      payment_timing: "paid_on_board",
      rounding_rule: "nearest",
      rounding_precision: "0.01",
      status: "active",
    });
    await insert("acc_pay_elements_v2", {
      pay_element_uuid: elBND,
      code: `VP_BND_${S}`,
      name: "VP Bond",
      type: "deduction",
      category: "bond_slop_chest",
      calc_method: "fixed_amount",
      prorate: false,
      payment_timing: "paid_on_board",
      rounding_rule: "nearest",
      rounding_precision: "0.01",
      status: "active",
    });
    await insert("acc_pay_elements_v2", {
      pay_element_uuid: elBON,
      code: `VP_BON_${S}`,
      name: "VP Bonus",
      type: "earning",
      category: "bonus",
      calc_method: "manual_entry",
      prorate: false,
      payment_timing: "paid_on_board",
      rounding_rule: "nearest",
      rounding_precision: "0.01",
      status: "active",
    });

    // -- wage scale + engagement for the lifecycle run (vessel A) ------------
    await insert("acc_wage_scales_v2", {
      scale_uuid: scaleA,
      scale_name: `VP Test Scale ${S}`,
      currency: "USD",
      effective_from: "2025-01-01",
      status: "active",
    });
    await insert("acc_wage_scale_lines_v2", {
      scale_line_uuid: u(),
      scale_uuid: scaleA,
      rank_id: RANK_A,
      pay_element_uuid: elBAS,
      experience_min_months: 0,
      experience_max_months: 11,
      amount: "3000.00",
    });
    await insert("acc_engagements_v2", {
      engagement_uuid: engA,
      crew_uuid: crewA,
      engagement_type: "voyage_contract",
      vessel_uuid: vslA,
      start_date: "2026-03-01",
      end_date: null,
      wage_scale_uuid: scaleA,
      rank_id_at_start: RANK_A,
      currency: "USD",
      status: "active",
      scale_year_at_start: 1,
      next_step_date: "2027-03-01",
    });

    // -- prior-month CTM for the opening-carry check (vessel B) --------------
    await insert("acc_ctm_v2", {
      ctm_uuid: u(),
      vessel_uuid: vslB,
      period: PRIOR,
      opening_balance: "0.00",
      received_amount: "5000.00",
      closing_balance: "5000.00",
      currency: "USD",
      status: "locked",
    });
  });

  afterAll(async () => {
    const vsls = [vslA, vslB, vslC];
    const tryQuery = async (sql: string, params: unknown[]) => {
      try {
        await db.query(sql, params);
      } catch {
        /* best-effort cleanup */
      }
    };
    await tryQuery(
      `DELETE FROM acc_ctm_lines_v2 WHERE ctm_uuid IN
         (SELECT ctm_uuid FROM acc_ctm_v2 WHERE vessel_uuid = ANY($1))`,
      [vsls],
    );
    await tryQuery("DELETE FROM acc_ctm_v2 WHERE vessel_uuid = ANY($1)", [vsls]);
    await tryQuery(
      "DELETE FROM acc_monthly_transactions_v2 WHERE vessel_uuid = ANY($1)",
      [vsls],
    );
    await tryQuery(
      "DELETE FROM acc_wage_ledger_v2 WHERE engagement_uuid = $1",
      [engA],
    );
    if (runUuids.length > 0) {
      await tryQuery(
        "DELETE FROM acc_calculation_runs_v2 WHERE calc_run_uuid = ANY($1)",
        [runUuids],
      );
    }
    await tryQuery(
      "DELETE FROM acc_portage_bills_v2 WHERE vessel_uuid = ANY($1)",
      [vsls],
    );
    await tryQuery("DELETE FROM acc_engagements_v2 WHERE engagement_uuid = $1", [
      engA,
    ]);
    await tryQuery("DELETE FROM acc_wage_scale_lines_v2 WHERE scale_uuid = $1", [
      scaleA,
    ]);
    await tryQuery("DELETE FROM acc_wage_scales_v2 WHERE scale_uuid = $1", [
      scaleA,
    ]);
    await tryQuery(
      "DELETE FROM acc_pay_elements_v2 WHERE pay_element_uuid = ANY($1)",
      [[elBAS, elVOT, elADV, elBND, elBON]],
    );
    await db.end();
  });

  // ==========================================================================
  // Group 5 — wage-integrity guard (independent; run first for clarity)
  // ==========================================================================
  it("rejects a vessel transaction on a scale_lookup element with 400", async () => {
    const res = await api(
      "POST",
      "/monthly-transactions",
      txnBody({ vesselUuid: vslA, payElementUuid: elBAS, amount: "3000.00" }),
      tokenA,
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/scale-derived/i);
  });

  it("rejects a vessel transaction on a non-vessel category element with 400", async () => {
    const res = await api(
      "POST",
      "/monthly-transactions",
      txnBody({ vesselUuid: vslA, payElementUuid: elBON, amount: "250.00" }),
      tokenA,
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/bonus/i);
  });

  it("allows a vessel transaction on an allowed fixed-amount category (bond)", async () => {
    const create = await api(
      "POST",
      "/monthly-transactions",
      txnBody({ vesselUuid: vslA, payElementUuid: elBND, amount: "40.00" }),
      tokenA,
    );
    expect(create.status).toBe(201);
    expect(create.body.origin).toBe("vessel");
    expect(create.body.status).toBe("draft");
    // Clean up so the lifecycle group's counts are unaffected.
    const del = await api(
      "DELETE",
      `/monthly-transactions/${create.body.txnUuid}`,
      undefined,
      tokenA,
    );
    expect([200, 204]).toContain(del.status);
  });

  // ==========================================================================
  // Group 4 — vessel scope guard
  // ==========================================================================
  it("403s a vessel-scoped request against another vessel", async () => {
    const cross = await api(
      "POST",
      "/monthly-transactions",
      txnBody({ vesselUuid: vslB }),
      tokenA,
    );
    expect(cross.status).toBe(403);

    const ctmCross = await api("GET", `/ctm/${vslB}/${PERIOD}`, undefined, tokenA);
    expect(ctmCross.status).toBe(403);

    const submitCross = await api(
      "POST",
      `/vessel-portage/${vslB}/${PERIOD}/submit`,
      {},
      tokenA,
    );
    expect(submitCross.status).toBe(403);
  });

  it("403s a Ship user with no vessels claim (fail-closed)", async () => {
    const res = await api(
      "POST",
      "/monthly-transactions",
      txnBody({ vesselUuid: vslA }),
      tokenNoVessels,
    );
    expect(res.status).toBe(403);
  });

  // ==========================================================================
  // Group 2 — CTM math (exact figures)
  // ==========================================================================
  describe("CTM cash account math", () => {
    let adv300Uuid: string;

    it("carries opening 5,000.00 from the prior month and locks it", async () => {
      const got = await api("GET", `/ctm/${vslB}/${PERIOD}`, undefined, tokenB);
      expect(got.status).toBe(200);
      expect(Number(got.body.ctm.openingBalance).toFixed(2)).toBe("5000.00");
      expect(got.body.openingCarried).toBe(true);

      const editOpening = await api(
        "PUT",
        `/ctm/${vslB}/${PERIOD}`,
        { openingBalance: "1.00" },
        tokenB,
      );
      expect(editOpening.status).toBe(400);
    });

    it("rejects client-supplied closing balance", async () => {
      const res = await api(
        "PUT",
        `/ctm/${vslB}/${PERIOD}`,
        { closingBalance: "999999.00" },
        tokenB,
      );
      expect(res.status).toBe(400);
    });

    it("computes closing 13,825.00 server-side", async () => {
      const rec = await api(
        "PUT",
        `/ctm/${vslB}/${PERIOD}`,
        { receivedAmount: "10000.00" },
        tokenB,
      );
      expect(rec.status).toBe(200);

      // three on-board advances → auto CTM lines
      for (const amount of ["500.00", "300.00", "200.00"]) {
        const res = await api(
          "POST",
          "/monthly-transactions",
          txnBody({ amount }),
          tokenB,
        );
        expect(res.status).toBe(201);
        expect(res.body.origin).toBe("vessel");
        expect(res.body.status).toBe("draft");
        expect(res.body.ctmLineUuid).toBeTruthy();
        if (amount === "300.00") adv300Uuid = res.body.txnUuid;
      }

      const exp = await api(
        "POST",
        `/ctm/${vslB}/${PERIOD}/lines`,
        { lineType: "expense", amount: "250.00", description: "Port charges" },
        tokenB,
      );
      expect(exp.status).toBe(201);
      const rcp = await api(
        "POST",
        `/ctm/${vslB}/${PERIOD}/lines`,
        { lineType: "receipt", amount: "75.00", description: "Refund" },
        tokenB,
      );
      expect(rcp.status).toBe(201);

      const got = await api("GET", `/ctm/${vslB}/${PERIOD}`, undefined, tokenB);
      expect(got.status).toBe(200);
      expect(got.body.lines).toHaveLength(5);
      // 5,000 + 10,000 + 75 − 1,000 − 250 = 13,825.00
      expect(got.body.ctm.closingBalance).toBe("13825.00");
      expect(got.body.imbalance).toBe(false);
    });

    it("refuses direct edits to an advance-linked CTM line", async () => {
      const got = await api("GET", `/ctm/${vslB}/${PERIOD}`, undefined, tokenB);
      const autoLine = got.body.lines.find(
        (l: any) => l.lineType === "cash_advance_to_crew",
      );
      expect(autoLine).toBeTruthy();
      const res = await api(
        "PUT",
        `/ctm/lines/${autoLine.ctmLineUuid}`,
        { amount: "1.00" },
        tokenB,
      );
      expect(res.status).toBe(409);
    });

    it("deleting the 300.00 draft advance ⇒ closing 14,125.00, line removed", async () => {
      const del = await api(
        "DELETE",
        `/monthly-transactions/${adv300Uuid}`,
        undefined,
        tokenB,
      );
      expect(del.status).toBe(204);

      const got = await api("GET", `/ctm/${vslB}/${PERIOD}`, undefined, tokenB);
      expect(got.status).toBe(200);
      expect(got.body.lines).toHaveLength(4);
      expect(got.body.ctm.closingBalance).toBe("14125.00");
    });
  });

  // ==========================================================================
  // Group 3 — advance linkage (single entry, two records)
  // ==========================================================================
  describe("advance dual-record linkage", () => {
    let a1: string;
    let a2: string;

    it("creates exactly one CTM line per vessel advance", async () => {
      const r1 = await api(
        "POST",
        "/monthly-transactions",
        txnBody({ vesselUuid: vslC, amount: "500.00" }),
        tokenC,
      );
      const r2 = await api(
        "POST",
        "/monthly-transactions",
        txnBody({ vesselUuid: vslC, amount: "200.00" }),
        tokenC,
      );
      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
      a1 = r1.body.txnUuid;
      a2 = r2.body.txnUuid;
      expect(r1.body.ctmLineUuid).toBeTruthy();
      expect(r2.body.ctmLineUuid).toBeTruthy();
      expect(r1.body.ctmLineUuid).not.toBe(r2.body.ctmLineUuid);

      const got = await api("GET", `/ctm/${vslC}/${PERIOD}`, undefined, tokenC);
      expect(got.body.lines).toHaveLength(2);
    });

    it("accept does not duplicate; reject removes the CTM line", async () => {
      const sub = await api(
        "POST",
        `/vessel-portage/${vslC}/${PERIOD}/submit`,
        {},
        tokenC,
      );
      expect(sub.status).toBe(200);

      const acc = await api("POST", `/monthly-transactions/${a1}/accept`, {});
      expect(acc.status).toBe(200);
      expect(acc.body.status).toBe("accepted");

      let got = await api("GET", `/ctm/${vslC}/${PERIOD}`, undefined, tokenC);
      expect(got.body.lines).toHaveLength(2); // no duplicate on accept

      const rejNoComment = await api(
        "POST",
        `/monthly-transactions/${a2}/reject`,
        {},
      );
      expect(rejNoComment.status).toBe(400); // comment required

      const rej = await api("POST", `/monthly-transactions/${a2}/reject`, {
        reviewComment: "Not authorised",
      });
      expect(rej.status).toBe(200);
      expect(rej.body.status).toBe("rejected");
      expect(rej.body.reviewComment).toBe("Not authorised");
      expect(rej.body.ctmLineUuid).toBeNull();

      got = await api("GET", `/ctm/${vslC}/${PERIOD}`, undefined, tokenC);
      expect(got.body.lines).toHaveLength(1); // rejected advance line removed
    });
  });

  // ==========================================================================
  // Group 1 — full lifecycle
  // ==========================================================================
  describe("vessel-month lifecycle", () => {
    let txnVot: string;
    let txnAdv: string;
    let txnBnd: string;
    let portageUuid: string;

    it("vessel creates 3 draft transactions (origin/status forced)", async () => {
      const vot = await api(
        "POST",
        "/monthly-transactions",
        txnBody({
          vesselUuid: vslA,
          engagementUuid: engA,
          crewUuid: crewA,
          payElementUuid: elVOT,
          qty: "10.00",
          rate: "4.0000",
          amount: "40.00",
          origin: "office", // must be overridden to vessel
          status: "accepted", // must be overridden to draft
        }),
        tokenA,
      );
      expect(vot.status).toBe(201);
      expect(vot.body.origin).toBe("vessel");
      expect(vot.body.status).toBe("draft");
      txnVot = vot.body.txnUuid;

      const adv = await api(
        "POST",
        "/monthly-transactions",
        txnBody({
          vesselUuid: vslA,
          engagementUuid: engA,
          crewUuid: crewA,
          amount: "100.00",
        }),
        tokenA,
      );
      expect(adv.status).toBe(201);
      expect(adv.body.ctmLineUuid).toBeTruthy();
      txnAdv = adv.body.txnUuid;

      const bnd = await api(
        "POST",
        "/monthly-transactions",
        txnBody({
          vesselUuid: vslA,
          engagementUuid: engA,
          crewUuid: crewA,
          payElementUuid: elBND,
          amount: "60.00",
        }),
        tokenA,
      );
      expect(bnd.status).toBe(201);
      txnBnd = bnd.body.txnUuid;
    });

    it("submit flips drafts to submitted and the portage to submitted", async () => {
      const res = await api(
        "POST",
        `/vessel-portage/${vslA}/${PERIOD}/submit`,
        {},
        tokenA,
      );
      expect(res.status).toBe(200);
      expect(res.body.transactionsSubmitted).toBe(3);
      expect(res.body.portage.status).toBe("submitted");
      expect(res.body.ctm.status).toBe("submitted");
      portageUuid = res.body.portage.portageUuid;

      // submitted rows are immutable to the vessel
      const edit = await api(
        "PUT",
        `/monthly-transactions/${txnVot}`,
        { amount: "44.00" },
        tokenA,
      );
      expect(edit.status).toBe(409);
    });

    it("office rejects one (comment persisted) and accepts two", async () => {
      const rej = await api("POST", `/monthly-transactions/${txnBnd}/reject`, {
        reviewComment: "Wrong bond amount",
      });
      expect(rej.status).toBe(200);
      expect(rej.body.reviewComment).toBe("Wrong bond amount");

      for (const uuid of [txnVot, txnAdv]) {
        const acc = await api("POST", `/monthly-transactions/${uuid}/accept`, {});
        expect(acc.status).toBe(200);
        expect(acc.body.status).toBe("accepted");
      }

      // rejected rows are immutable to the vessel
      const vesselEdit = await api(
        "PUT",
        `/monthly-transactions/${txnBnd}`,
        { amount: "61.00" },
        tokenA,
      );
      expect(vesselEdit.status).toBe(409);
    });

    it("the run includes ONLY the accepted transactions", async () => {
      const run = await api("POST", "/calc/run-engagement", {
        engagementUuid: engA,
        period: PERIOD,
      });
      expect(run.status).toBe(200);
      if (run.body?.run?.calcRunUuid) runUuids.push(run.body.run.calcRunUuid);

      const led = await api(
        "GET",
        `/ledger?engagementUuid=${engA}&period=${PERIOD}`,
      );
      expect(led.status).toBe(200);
      const lines = led.body as Array<Record<string, any>>;
      expect(lines.some((l) => l.payElementUuid === elVOT)).toBe(true);
      expect(lines.some((l) => l.payElementUuid === elADV)).toBe(true);
      expect(lines.some((l) => l.payElementUuid === elBND)).toBe(false); // rejected
    });

    it("return → re-open rejected → vessel edits → resubmit → accept", async () => {
      const noComment = await api(
        "POST",
        `/vessel-portage/${portageUuid}/return`,
        {},
      );
      expect(noComment.status).toBe(400); // comment required

      const shipReturn = await api(
        "POST",
        `/vessel-portage/${portageUuid}/return`,
        { comment: "nope" },
        tokenA,
      );
      expect(shipReturn.status).toBe(403); // office action

      const ret = await api(
        "POST",
        `/vessel-portage/${portageUuid}/return`,
        { comment: "Please fix the bond entry" },
      );
      expect(ret.status).toBe(200);
      expect(ret.body.portage.status).toBe("returned");

      // CTM reopened for the vessel
      const ctm = await api("GET", `/ctm/${vslA}/${PERIOD}`, undefined, tokenA);
      expect(ctm.body.ctm.status).toBe("open");

      // office re-opens the rejected row to draft
      const reopen = await api("PUT", `/monthly-transactions/${txnBnd}`, {
        status: "draft",
      });
      expect(reopen.status).toBe(200);
      expect(reopen.body.status).toBe("draft");

      // drafts are editable by the vessel again
      const edit = await api(
        "PUT",
        `/monthly-transactions/${txnBnd}`,
        { amount: "55.00" },
        tokenA,
      );
      expect(edit.status).toBe(200);
      expect(edit.body.amount).toBe("55.00");

      const resub = await api(
        "POST",
        `/vessel-portage/${vslA}/${PERIOD}/submit`,
        {},
        tokenA,
      );
      expect(resub.status).toBe(200);
      expect(resub.body.transactionsSubmitted).toBe(1); // only the re-opened bond

      const acc = await api("POST", `/monthly-transactions/${txnBnd}/accept`, {});
      expect(acc.status).toBe(200);

      const run = await api("POST", "/calc/run-engagement", {
        engagementUuid: engA,
        period: PERIOD,
      });
      expect(run.status).toBe(200);
      if (run.body?.run?.calcRunUuid) runUuids.push(run.body.run.calcRunUuid);

      const led = await api(
        "GET",
        `/ledger?engagementUuid=${engA}&period=${PERIOD}`,
      );
      expect(led.status).toBe(200);
      const lines = led.body as Array<Record<string, any>>;
      expect(lines.some((l) => l.payElementUuid === elBND)).toBe(true);
    });

    it("reconciled CTM → return ⇒ CTM reopens and vessel can edit it", async () => {
      // Office reconciles the (resubmitted) month's CTM.
      const rec = await api("POST", `/ctm/${vslA}/${PERIOD}/reconcile`, {});
      expect(rec.status).toBe(200);
      expect(rec.body.status).toBe("reconciled");

      // Office returns the month — reconciliation is void once it reopens.
      const ret = await api(
        "POST",
        `/vessel-portage/${portageUuid}/return`,
        { comment: "Recheck the cash account" },
      );
      expect(ret.status).toBe(200);
      expect(ret.body.portage.status).toBe("returned");

      const ctm = await api("GET", `/ctm/${vslA}/${PERIOD}`, undefined, tokenA);
      expect(ctm.body.ctm.status).toBe("open");

      // A returned month is fully editable aboard, CTM included.
      const edit = await api(
        "PUT",
        `/ctm/${vslA}/${PERIOD}`,
        { receivedAmount: "5100.00" },
        tokenA,
      );
      expect(edit.status).toBe(200);
      expect(edit.body.ctm.receivedAmount).toBe("5100.00");
    });

    it("lock ⇒ vessel edits and creates are refused; CTM locked", async () => {
      await db.query(
        `UPDATE acc_portage_bills_v2
           SET status = 'locked', is_locked = true
         WHERE portage_uuid = $1`,
        [portageUuid],
      );
      await db.query(
        `UPDATE acc_ctm_v2 SET status = 'locked'
         WHERE vessel_uuid = $1 AND period = $2`,
        [vslA, PERIOD],
      );

      const editReal = await api(
        "PUT",
        `/monthly-transactions/${txnVot}`,
        { amount: "41.00" },
        tokenA,
      );
      expect(editReal.status).toBe(409);

      const create = await api(
        "POST",
        "/monthly-transactions",
        txnBody({
          vesselUuid: vslA,
          engagementUuid: engA,
          crewUuid: crewA,
          amount: "10.00",
        }),
        tokenA,
      );
      expect(create.status).toBe(409);

      const ctmLine = await api(
        "POST",
        `/ctm/${vslA}/${PERIOD}/lines`,
        { lineType: "expense", amount: "5.00" },
        tokenA,
      );
      expect(ctmLine.status).toBe(409);
    });
  });
});
