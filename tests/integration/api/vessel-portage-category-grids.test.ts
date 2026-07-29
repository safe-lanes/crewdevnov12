import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { randomUUID } from "crypto";

const API_BASE = "http://localhost:5000";
const V2_BASE = `${API_BASE}/api/v2/accounts`;

/**
 * Vessel Portage category-major grids — batch entry, dated advances,
 * additive allotments, locking and configurable extra tabs.
 *
 * Groups:
 *  1. Overtime batch round-trip: one POST /monthly-transactions/batch call
 *     creates/updates/deletes OT qty entries.
 *  2. Dated cash advance: txn_date stored + CTM auto-line create/update/
 *     delete stays in sync through the batch path.
 *  3. Allotment additive proof: standing 800.00 register allotment + 500.00
 *     this-month-extra vessel txn ⇒ TWO ledger lines totalling exactly
 *     1,300.00 after a calc run.
 *  4. Locking: a locked month refuses batch writes (409, nothing applied).
 *  5. Tenant-config extra tab slots: validation rules + posting through the
 *     bound element.
 *  6. Partial failure: applied ops are reported, failed op identified.
 */

const S = `${Date.now()}`;
const u = () => randomUUID();

const PERIOD = "2026-04";

// ---- fixture ids -----------------------------------------------------------
const elBAS = u(); // scale_lookup basic — forbidden to vessel (failure case)
const elOT = u(); // rate_times_qty variable overtime
const elADV = u(); // advance_recovery (dated, CTM dual-record)
const elALT = u(); // allotment (this-month extra)
const elCOM = u(); // manual communication — extra-tab binding target

const vslA = `VSL_CG_${S}`;

const RANK = `CG_MST_${S}`;
const scaleU = u();
const crewA = u();
const engA = u();
const allotU = u();

let db: Client;
const runUuids: string[] = [];

function shipToken(vessels: string[]): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    id: 990002,
    domain: "test",
    userType: "Ship",
    vessels,
  })}.devsig`;
}
const tokenA = shipToken([vslA]);

let cacheBust = 0;

/**
 * Assert no two non-adjustment lines share (elementCode, periodFrom,
 * sourceType) for a given engagement+period.  Returns the non-adjustment
 * line count so callers can further assert on totals.
 */
async function assertNoDuplicateLines(
  engUuid: string,
  period: string,
): Promise<number> {
  const led = await api(
    "GET",
    `/ledger?engagementUuid=${engUuid}&period=${period}`,
  );
  expect(led.status, `ledger fetch failed for period ${period}`).toBe(200);
  const lines = (led.body as any[]).filter((l) => !l.isAdjustment);
  const seen = new Set<string>();
  for (const l of lines) {
    const key = `${l.elementCode}|${String(l.periodFrom)}|${l.sourceType}`;
    expect(
      seen.has(key),
      `Duplicate ledger line: "${key}" in period ${period}`,
    ).toBe(false);
    seen.add(key);
  }
  return lines.length;
}

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: any }> {
  // happy-dom fetch caches GETs per URL — cache-bust every request.
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

function element(uuid: string, code: string, extra: Record<string, unknown>) {
  return {
    pay_element_uuid: uuid,
    code,
    name: code,
    prorate: false,
    payment_timing: "paid_on_board",
    rounding_rule: "nearest",
    rounding_precision: "0.01",
    status: "active",
    ...extra,
  };
}

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    engagementUuid: engA,
    crewUuid: crewA,
    vesselUuid: vslA,
    period: PERIOD,
    payElementUuid: elADV,
    amount: "100.00",
    currency: "USD",
    origin: "vessel",
    status: "draft",
    sourceType: "manual",
    ...overrides,
  };
}

describe("Vessel Portage category-major grids", () => {
  let savedConfig: any;

  beforeAll(async () => {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error("Server not running");
    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    await insert(
      "acc_pay_elements_v2",
      element(elBAS, `CG_BAS_${S}`, {
        type: "earning",
        category: "basic",
        calc_method: "scale_lookup",
        prorate: true,
      }),
    );
    await insert(
      "acc_pay_elements_v2",
      element(elOT, `CG_OT_${S}`, {
        type: "earning",
        category: "overtime_variable",
        calc_method: "rate_times_qty",
      }),
    );
    await insert(
      "acc_pay_elements_v2",
      element(elADV, `CG_ADV_${S}`, {
        type: "deduction",
        category: "advance_recovery",
        calc_method: "fixed_amount",
      }),
    );
    await insert(
      "acc_pay_elements_v2",
      element(elALT, `CG_ALT_${S}`, {
        type: "deduction",
        category: "allotment",
        calc_method: "manual_entry",
      }),
    );
    await insert(
      "acc_pay_elements_v2",
      element(elCOM, `CG_COM_${S}`, {
        type: "deduction",
        category: "communication",
        calc_method: "manual_entry",
      }),
    );

    await insert("acc_wage_scales_v2", {
      scale_uuid: scaleU,
      scale_name: `CG Scale ${S}`,
      currency: "USD",
      effective_from: "2025-01-01",
      status: "active",
    });
    await insert("acc_wage_scale_lines_v2", {
      scale_line_uuid: u(),
      scale_uuid: scaleU,
      rank_id: RANK,
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
      start_date: "2026-04-01",
      end_date: null,
      wage_scale_uuid: scaleU,
      rank_id_at_start: RANK,
      currency: "USD",
      status: "active",
      scale_year_at_start: 1,
      next_step_date: "2027-04-01",
    });

    // Standing register allotment: fixed 800.00, valid over the month.
    await insert("acc_allotments_v2", {
      allotment_uuid: allotU,
      crew_uuid: crewA,
      beneficiary_name: "CG Beneficiary",
      allotment_type: "fixed",
      value: "800.00",
      currency: "USD",
      valid_from: "2026-01-01",
      valid_to: null,
      status: "active",
    });

    const cfg = await api("GET", "/config");
    savedConfig = cfg.body;
  });

  afterAll(async () => {
    const tryQuery = async (sql: string, params: unknown[]) => {
      try {
        await db.query(sql, params);
      } catch {
        /* best-effort */
      }
    };
    // Restore tenant-config extra-tab slots.
    try {
      await api("PUT", "/config", {
        extraTab1Enabled: savedConfig?.extraTab1Enabled ?? false,
        extraTab1Label: savedConfig?.extraTab1Label ?? null,
        extraTab1PayElementUuid: savedConfig?.extraTab1PayElementUuid ?? null,
        extraTab2Enabled: savedConfig?.extraTab2Enabled ?? false,
        extraTab2Label: savedConfig?.extraTab2Label ?? null,
        extraTab2PayElementUuid: savedConfig?.extraTab2PayElementUuid ?? null,
      });
    } catch {
      /* best-effort */
    }
    await tryQuery(
      `DELETE FROM acc_ctm_lines_v2 WHERE ctm_uuid IN
         (SELECT ctm_uuid FROM acc_ctm_v2 WHERE vessel_uuid = $1)`,
      [vslA],
    );
    await tryQuery("DELETE FROM acc_ctm_v2 WHERE vessel_uuid = $1", [vslA]);
    await tryQuery(
      "DELETE FROM acc_monthly_transactions_v2 WHERE vessel_uuid = $1",
      [vslA],
    );
    await tryQuery("DELETE FROM acc_wage_ledger_v2 WHERE engagement_uuid = $1", [
      engA,
    ]);
    if (runUuids.length > 0) {
      await tryQuery(
        "DELETE FROM acc_calculation_runs_v2 WHERE calc_run_uuid = ANY($1)",
        [runUuids],
      );
    }
    await tryQuery("DELETE FROM acc_portage_bills_v2 WHERE vessel_uuid = $1", [
      vslA,
    ]);
    await tryQuery("DELETE FROM acc_allotments_v2 WHERE allotment_uuid = $1", [
      allotU,
    ]);
    await tryQuery("DELETE FROM acc_engagements_v2 WHERE engagement_uuid = $1", [
      engA,
    ]);
    await tryQuery("DELETE FROM acc_wage_scale_lines_v2 WHERE scale_uuid = $1", [
      scaleU,
    ]);
    await tryQuery("DELETE FROM acc_wage_scales_v2 WHERE scale_uuid = $1", [
      scaleU,
    ]);
    await tryQuery(
      "DELETE FROM acc_pay_elements_v2 WHERE pay_element_uuid = ANY($1)",
      [[elBAS, elOT, elADV, elALT, elCOM]],
    );
    await db.end();
  });

  // ==========================================================================
  // Group 1 — overtime batch round-trip
  // ==========================================================================
  describe("overtime batch round-trip", () => {
    let otUuid: string;

    it("creates an OT qty entry through the batch endpoint", async () => {
      const res = await api(
        "POST",
        "/monthly-transactions/batch",
        {
          creates: [
            createBody({
              payElementUuid: elOT,
              qty: "12.5",
              rate: "4.0000",
              amount: "50.00",
            }),
          ],
        },
        tokenA,
      );
      expect(res.status).toBe(200);
      expect(res.body.created).toHaveLength(1);
      otUuid = res.body.created[0].txnUuid;
      expect(res.body.created[0].origin).toBe("vessel");
      expect(res.body.created[0].status).toBe("draft");
      expect(Number(res.body.created[0].qty)).toBe(12.5);
    });

    it("updates and then deletes the entry in single batch calls", async () => {
      const upd = await api(
        "POST",
        "/monthly-transactions/batch",
        { updates: [{ txnUuid: otUuid, qty: "15", amount: "60.00" }] },
        tokenA,
      );
      expect(upd.status).toBe(200);
      expect(upd.body.updated).toHaveLength(1);
      expect(Number(upd.body.updated[0].qty)).toBe(15);
      expect(upd.body.updated[0].amount).toBe("60.00");

      const del = await api(
        "POST",
        "/monthly-transactions/batch",
        { deletes: [otUuid] },
        tokenA,
      );
      expect(del.status).toBe(200);
      expect(del.body.deleted).toEqual([otUuid]);

      const list = await api(
        "GET",
        `/monthly-transactions?vesselUuid=${vslA}&period=${PERIOD}`,
        undefined,
        tokenA,
      );
      expect(
        (list.body as any[]).some((t) => t.txnUuid === otUuid),
      ).toBe(false);
    });
  });

  // ==========================================================================
  // Group 2 — dated cash advance + CTM sync
  // ==========================================================================
  describe("dated cash advance", () => {
    let advUuid: string;
    let ctmLineUuid: string;

    it("stores txn_date and auto-creates the linked CTM line", async () => {
      const res = await api(
        "POST",
        "/monthly-transactions/batch",
        { creates: [createBody({ amount: "250.00", txnDate: "2026-04-12" })] },
        tokenA,
      );
      expect(res.status).toBe(200);
      const txn = res.body.created[0];
      advUuid = txn.txnUuid;
      ctmLineUuid = txn.ctmLineUuid;
      expect(txn.txnDate).toBe("2026-04-12");
      expect(ctmLineUuid).toBeTruthy();

      const ctm = await api("GET", `/ctm/${vslA}/${PERIOD}`, undefined, tokenA);
      const line = ctm.body.lines.find(
        (l: any) => l.ctmLineUuid === ctmLineUuid,
      );
      expect(line).toBeTruthy();
      expect(line.amount).toBe("250.00");
      // Regression: the mirrored CTM line carries the advance's dated
      // column (txn_date), not the entry date (today).
      expect(line.lineDate).toBe("2026-04-12");
    });

    it("batch update syncs the CTM line amount and date", async () => {
      const upd = await api(
        "POST",
        "/monthly-transactions/batch",
        {
          updates: [
            { txnUuid: advUuid, amount: "275.00", txnDate: "2026-04-15" },
          ],
        },
        tokenA,
      );
      expect(upd.status).toBe(200);

      const ctm = await api("GET", `/ctm/${vslA}/${PERIOD}`, undefined, tokenA);
      const line = ctm.body.lines.find(
        (l: any) => l.ctmLineUuid === ctmLineUuid,
      );
      expect(line.amount).toBe("275.00");
      expect(line.lineDate).toBe("2026-04-15");
    });

    it("batch delete removes the CTM line too", async () => {
      const del = await api(
        "POST",
        "/monthly-transactions/batch",
        { deletes: [advUuid] },
        tokenA,
      );
      expect(del.status).toBe(200);

      const ctm = await api("GET", `/ctm/${vslA}/${PERIOD}`, undefined, tokenA);
      expect(
        ctm.body.lines.some((l: any) => l.ctmLineUuid === ctmLineUuid),
      ).toBe(false);
    });
  });

  // ==========================================================================
  // Group 3 — allotment additive proof (exact figures)
  // ==========================================================================
  describe("allotments are additive (standing + extra)", () => {
    let extraUuid: string;

    it("standing 800.00 + extra 500.00 ⇒ TWO ledger lines totalling 1,300.00", async () => {
      const create = await api(
        "POST",
        "/monthly-transactions/batch",
        {
          creates: [
            createBody({ payElementUuid: elALT, amount: "500.00" }),
          ],
        },
        tokenA,
      );
      expect(create.status).toBe(200);
      extraUuid = create.body.created[0].txnUuid;

      // submit + office-accept so the run includes the extra
      const sub = await api(
        "POST",
        `/vessel-portage/${vslA}/${PERIOD}/submit`,
        {},
        tokenA,
      );
      expect(sub.status).toBe(200);
      const acc = await api(
        "POST",
        `/monthly-transactions/${extraUuid}/accept`,
        {},
      );
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

      const standing = lines.filter((l) => l.sourceType === "allotment");
      expect(standing).toHaveLength(1);
      expect(standing[0].amount).toBe("800.00");

      const extra = lines.filter(
        (l) => l.sourceType === "monthly_txn" && l.sourceUuid === extraUuid,
      );
      expect(extra).toHaveLength(1);
      expect(extra[0].amount).toBe("500.00");

      const total =
        Number(standing[0].amount) + Number(extra[0].amount);
      expect(total.toFixed(2)).toBe("1300.00");
    });
  });

  // ==========================================================================
  // Group 3b — structural safeguard: no duplicate lines across run orderings
  //
  // Covers the two root-cause directions for the duplicate-lines defect:
  //  Order A: vessel-period run THEN single-engagement run
  //  Order B: single-engagement run THEN vessel-period run
  //
  // Both orderings must leave exactly one line per (engagement, element,
  // sub-period, sourceType) and the crew member must remain on the portage
  // bill (crew_count > 0).
  // ==========================================================================

  // --- Order A: vessel-period run then single-engagement run ----------------
  describe("order A — vessel-period then single-engagement: no duplicates, crew in portage", () => {
    const PERIOD2 = "2026-05";

    it("vessel-period run creates portage-attached lines without duplicates", async () => {
      const run = await api("POST", "/calc/run", {
        vesselUuid: vslA,
        period: PERIOD2,
      });
      expect(run.status).toBe(200);
      if (run.body?.run?.calcRunUuid) runUuids.push(run.body.run.calcRunUuid);

      const count = await assertNoDuplicateLines(engA, PERIOD2);
      expect(count).toBeGreaterThan(0);

      const portage = await db.query(
        `SELECT crew_count FROM acc_portage_bills_v2
           WHERE vessel_uuid = $1 AND period = $2 AND is_deleted = false`,
        [vslA, PERIOD2],
      );
      expect(
        portage.rows[0]?.crew_count,
        "crew_count must be > 0 after vessel-period run",
      ).toBeGreaterThan(0);
    });

    it("single-engagement re-run keeps exactly one set of lines and crew stays in portage", async () => {
      // Record pre-run line count to verify the re-run doesn't inflate it.
      const beforeCount = await assertNoDuplicateLines(engA, PERIOD2);

      const run = await api("POST", "/calc/run-engagement", {
        engagementUuid: engA,
        period: PERIOD2,
      });
      expect(run.status).toBe(200);
      if (run.body?.run?.calcRunUuid) runUuids.push(run.body.run.calcRunUuid);

      // No new lines should have been added — same line count, no duplicates.
      const afterCount = await assertNoDuplicateLines(engA, PERIOD2);
      expect(afterCount).toBe(beforeCount);

      // Crew member must still be present in the portage bill totals.
      const portage = await db.query(
        `SELECT crew_count FROM acc_portage_bills_v2
           WHERE vessel_uuid = $1 AND period = $2 AND is_deleted = false`,
        [vslA, PERIOD2],
      );
      expect(
        portage.rows[0]?.crew_count,
        "crew_count must remain > 0 after single-engagement re-run",
      ).toBeGreaterThan(0);
    });
  });

  // --- Order B: single-engagement run then vessel-period run ----------------
  describe("order B — single-engagement then vessel-period: no duplicates, crew in portage", () => {
    const PERIOD3 = "2026-06";

    it("single-engagement run before any portage creates preview lines without duplicates", async () => {
      const run = await api("POST", "/calc/run-engagement", {
        engagementUuid: engA,
        period: PERIOD3,
      });
      expect(run.status).toBe(200);
      if (run.body?.run?.calcRunUuid) runUuids.push(run.body.run.calcRunUuid);

      const count = await assertNoDuplicateLines(engA, PERIOD3);
      expect(count).toBeGreaterThan(0);
    });

    it("vessel-period run cleans up preview lines, leaves one set, crew in portage", async () => {
      const beforeCount = await assertNoDuplicateLines(engA, PERIOD3);

      const run = await api("POST", "/calc/run", {
        vesselUuid: vslA,
        period: PERIOD3,
      });
      expect(run.status).toBe(200);
      if (run.body?.run?.calcRunUuid) runUuids.push(run.body.run.calcRunUuid);

      // Preview lines must have been replaced by portage-attached lines —
      // same element count, zero duplicates.
      const afterCount = await assertNoDuplicateLines(engA, PERIOD3);
      expect(afterCount).toBe(beforeCount);

      // Crew member must now appear on the portage bill.
      const portage = await db.query(
        `SELECT crew_count FROM acc_portage_bills_v2
           WHERE vessel_uuid = $1 AND period = $2 AND is_deleted = false`,
        [vslA, PERIOD3],
      );
      expect(
        portage.rows[0]?.crew_count,
        "crew_count must be > 0 after vessel-period run",
      ).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Group 4 — locking blocks batch writes
  // ==========================================================================
  describe("locking", () => {
    it("locked month refuses batch creates with 409 and reports the failed op", async () => {
      await db.query(
        `UPDATE acc_portage_bills_v2
           SET status = 'locked', is_locked = true
         WHERE vessel_uuid = $1 AND period = $2`,
        [vslA, PERIOD],
      );

      const res = await api(
        "POST",
        "/monthly-transactions/batch",
        { creates: [createBody({ amount: "10.00" })] },
        tokenA,
      );
      expect(res.status).toBe(409);
      expect(res.body.batchResult).toBeTruthy();
      expect(res.body.batchResult.created).toHaveLength(0);
      expect(res.body.batchResult.failed?.op).toBe("create");

      // unlock so remaining groups can write
      await db.query(
        `UPDATE acc_portage_bills_v2
           SET status = 'returned', is_locked = false
         WHERE vessel_uuid = $1 AND period = $2`,
        [vslA, PERIOD],
      );
    });
  });

  // ==========================================================================
  // Group 5 — tenant-config extra tab slots
  // ==========================================================================
  describe("configurable extra tabs", () => {
    it("rejects an enabled slot without label or element", async () => {
      const noLabel = await api("PUT", "/config", {
        extraTab1Enabled: true,
        extraTab1Label: "",
        extraTab1PayElementUuid: elCOM,
      });
      expect(noLabel.status).toBe(400);

      const noElement = await api("PUT", "/config", {
        extraTab1Enabled: true,
        extraTab1Label: "Radio / Telephone",
        extraTab1PayElementUuid: null,
      });
      expect(noElement.status).toBe(400);
    });

    it("rejects binding to a scale_lookup element", async () => {
      const res = await api("PUT", "/config", {
        extraTab1Enabled: true,
        extraTab1Label: "Radio / Telephone",
        extraTab1PayElementUuid: elBAS,
      });
      expect(res.status).toBe(400);
    });

    it("accepts a valid slot, round-trips it, and the bound element accepts vessel entries", async () => {
      const res = await api("PUT", "/config", {
        extraTab1Enabled: true,
        extraTab1Label: "Radio / Telephone",
        extraTab1PayElementUuid: elCOM,
      });
      expect(res.status).toBe(200);

      const got = await api("GET", "/config");
      expect(got.body.extraTab1Enabled).toBe(true);
      expect(got.body.extraTab1Label).toBe("Radio / Telephone");
      expect(got.body.extraTab1PayElementUuid).toBe(elCOM);

      const post = await api(
        "POST",
        "/monthly-transactions/batch",
        { creates: [createBody({ payElementUuid: elCOM, amount: "35.00" })] },
        tokenA,
      );
      expect(post.status).toBe(200);
      expect(post.body.created).toHaveLength(1);

      const del = await api(
        "POST",
        "/monthly-transactions/batch",
        { deletes: [post.body.created[0].txnUuid] },
        tokenA,
      );
      expect(del.status).toBe(200);
    });
  });

  // ==========================================================================
  // Group 6 — partial failure reporting
  // ==========================================================================
  describe("batch partial failure", () => {
    it("applies ops before the failure and reports both applied and failed", async () => {
      const res = await api(
        "POST",
        "/monthly-transactions/batch",
        {
          creates: [
            createBody({ amount: "111.00" }), // valid
            createBody({ payElementUuid: elBAS, amount: "3000.00" }), // forbidden
          ],
        },
        tokenA,
      );
      expect(res.status).toBe(400);
      expect(res.body.batchResult.created).toHaveLength(1);
      expect(res.body.batchResult.failed?.op).toBe("create");

      const appliedUuid = res.body.batchResult.created[0].txnUuid;
      const list = await api(
        "GET",
        `/monthly-transactions?vesselUuid=${vslA}&period=${PERIOD}`,
        undefined,
        tokenA,
      );
      expect(
        (list.body as any[]).some((t) => t.txnUuid === appliedUuid),
      ).toBe(true);

      // clean up the applied op
      const del = await api(
        "POST",
        "/monthly-transactions/batch",
        { deletes: [appliedUuid] },
        tokenA,
      );
      expect(del.status).toBe(200);
    });
  });
});
