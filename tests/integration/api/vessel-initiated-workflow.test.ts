import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "crypto";
import type { Server } from "http";

/**
 * Vessel-initiated monthly workflow (task #179) integration tests.
 *
 * Boots its own express app with the production authMiddleware (real signed
 * JWTs, AUTH_BYPASS off) so Ship-identity scoping can be exercised, sharing
 * the dev database (single-tenant getDb fallback).
 *
 * Covers:
 *  (a) auto-create on load: creates missing engagements, create-only
 *      (existing rows untouched), idempotent
 *  (b) auto-create skips an approved/locked month entirely
 *  (c) vessel sign-off endpoint: sets end date + endDateManual; Ship user
 *      own-vessel OK, cross-vessel 403, fail-closed with no vessels claim
 *  (d) sign-off refused once the month is submitted, and on an engagement
 *      frozen by a submitted settlement
 *  (e) vessel submit auto-runs the calculation; proration figure: 30-day
 *      month, monthly 3,000.00, sign-off day 20 ⇒ 2,000.00
 *  (f) a failing auto-calc does NOT block the vessel submit; the failure is
 *      recorded on a failed calc run visible in the Payroll Run workspace
 *  (g) broadened stale indicator: a monthly transaction / allotment change
 *      after the run flips staleInputs
 */

const TEST_SECRET = "task179-test-secret";
const S = `VW${Date.now()}`;
const u = () => randomUUID();

const RANK = `AB_${S}`;
const elBAS = u();
const elRTQ = u(); // rate_times_qty element used to force a calc failure
const scaleUuid = u();

// Vessel A — happy path (auto-create, sign-off, submit + calc)
const vslA = u();
const crew1 = u(); // via crew_assignments only → auto-created
const assign1 = u();
const crew2 = u(); // existing engagement → must be untouched
const eng2 = u();
const assign2 = u();

// Vessel B — failing calc (rank with no scale line)
const vslB = u();
const crewB = u();
const engB = u();
const RANK_NOSCALE = `NS_${S}`;

// Frozen-settlement engagement (vessel A)
const crewF = u();
const engF = u();
const settlementF = u();

const PERIOD = "2026-06"; // June 2026 — 30 days

// Dedicated vessel type binding the scale to OUR vessels, so concurrent
// suites' fleet-wide scales can never win resolution during auto-create.
const vtUuid = u();
const VESSEL_TYPE = `VT_${S}`;

let db: Client;
let server: Server;
let base: string;

function shipToken(vessels: string[] | undefined = [vslA]): string {
  return jwt.sign(
    { id: 990179, domain: "test", userType: "Ship", ...(vessels ? { vessels } : {}) },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}
function officeToken(): string {
  return jwt.sign(
    { id: 990180, domain: "test", userType: "Admin" },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  // supertest (in-process) — happy-dom fetch enforces same-origin CORS.
  let req = (request(server) as any)[method.toLowerCase()](
    `/api/v2/accounts${path}`,
  );
  if (opts.token) req = req.set("Authorization", `Bearer ${opts.token}`);
  if (opts.body !== undefined) req = req.send(opts.body);
  const res = await req;
  return { status: res.status, body: res.body };
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

let savedConfig: Array<Record<string, unknown>> = [];
let insertedConfigUuid: string | null = null;
let createdEngagementUuid: string | null = null;

beforeAll(async () => {
  db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  // Real-auth app (must configure env BEFORE importing authMiddleware).
  process.env.JWT_SECRET = TEST_SECRET;
  delete process.env.AUTH_BYPASS;
  const { authMiddleware } = await import("@server/middleware/authMiddleware");
  const { default: accountsRouter } = await import(
    "@server/v2/accounts/routes"
  );
  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use("/api/v2/accounts", accountsRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const addr = server.address() as { port: number };
  base = `http://127.0.0.1:${addr.port}/api/v2/accounts`;

  // Tenant config: 30-day month, both-inclusive → sign-off day 20 of a
  // 30-day month prorates monthly 3,000.00 to exactly 2,000.00.
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

  await insert("acc_pay_elements_v2", {
    pay_element_uuid: elBAS,
    code: `BAS_${S}`,
    name: "Basic",
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
    pay_element_uuid: elRTQ,
    code: `RTQ_${S}`,
    name: "Rate x Qty",
    type: "earning",
    category: "overtime",
    calc_method: "rate_times_qty",
    prorate: false,
    payment_timing: "paid_on_board",
    rounding_rule: "nearest",
    rounding_precision: "0.01",
    status: "active",
  });
  await insert("master_vessel_types", {
    vt_uuid: vtUuid,
    vessel_type: VESSEL_TYPE,
  });
  await insert("master_vessels", {
    vessel_uuid: vslA,
    vessel: `MV A ${S}`,
    vessel_type: VESSEL_TYPE,
  });
  await insert("master_vessels", {
    vessel_uuid: vslB,
    vessel: `MV B ${S}`,
    vessel_type: VESSEL_TYPE,
  });
  await insert("acc_wage_scales_v2", {
    scale_uuid: scaleUuid,
    scale_name: `VW Scale ${S}`,
    vessel_type_uuid: vtUuid,
    currency: "USD",
    effective_from: "2025-01-01",
    status: "active",
  });
  await insert("acc_wage_scale_lines_v2", {
    scale_line_uuid: u(),
    scale_uuid: scaleUuid,
    rank_id: RANK,
    pay_element_uuid: elBAS,
    experience_min_months: 0,
    experience_max_months: 11,
    amount: "3000",
  });

  // Rank master so auto-create can resolve crew present_rank → rank_id.
  // `id` is a NOT NULL text column without a default in this table.
  await insert("adm_company_ranks_v2", {
    id: `id_${S}_1`,
    cr_uuid: u(),
    rank: RANK,
    rank_id: RANK,
  });
  await insert("adm_company_ranks_v2", {
    id: `id_${S}_2`,
    cr_uuid: u(),
    rank: RANK_NOSCALE,
    rank_id: RANK_NOSCALE,
  });

  // Crew members
  const crewMember = (crewUuid: string, name: string, rank: string) =>
    insert("crew_members_v2", {
      crew_uuid: crewUuid,
      emp_no: `${name}_${S}`,
      first_name: name,
      family_name: "TEST",
      present_rank: rank,
    });
  await crewMember(crew1, "AUTOCREATE", RANK);
  await crewMember(crew2, "EXISTING", RANK);
  await crewMember(crewB, "NOSCALE", RANK_NOSCALE);
  await crewMember(crewF, "FROZEN", RANK);

  // Vessel A assignments: crew1 has no engagement (auto-create target),
  // crew2 already has one (must be skipped, not updated).
  await insert("crew_assignments", {
    assign_uuid: assign1,
    crew_uuid: crew1,
    vessel_uuid: vslA,
    sign_on_date: "2026-06-01",
  });
  await insert("crew_assignments", {
    assign_uuid: assign2,
    crew_uuid: crew2,
    vessel_uuid: vslA,
    sign_on_date: "2026-06-01",
  });
  const eng = (
    uuid: string,
    crewUuid: string,
    vesselUuid: string,
    extra: Record<string, unknown> = {},
  ) =>
    insert("acc_engagements_v2", {
      engagement_uuid: uuid,
      crew_uuid: crewUuid,
      engagement_type: "voyage_contract",
      vessel_uuid: vesselUuid,
      start_date: "2026-06-01",
      end_date: null,
      wage_scale_uuid: scaleUuid,
      rank_id_at_start: RANK,
      currency: "USD",
      status: "active",
      scale_year_at_start: 1,
      next_step_date: "2027-06-01",
      ...extra,
    });
  await eng(eng2, crew2, vslA, { assignment_uuid: assign2 });

  // Vessel B: engagement whose rank has no scale line → calc fails.
  await eng(engB, crewB, vslB, { rank_id_at_start: RANK_NOSCALE });

  // Frozen engagement on its own past window (vessel A, ended May) with a
  // submitted settlement.
  await eng(engF, crewF, vslA, {
    start_date: "2026-05-01",
    end_date: "2026-05-31",
    status: "completed",
  });
  await insert("acc_settlements_v2", {
    settlement_uuid: settlementF,
    engagement_uuid: engF,
    crew_uuid: crewF,
    status: "submitted",
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  // Cleanup in dependency order.
  await db.query(
    `DELETE FROM acc_wage_ledger_v2 WHERE engagement_uuid IN (
       SELECT engagement_uuid FROM acc_engagements_v2 WHERE vessel_uuid IN ($1,$2))`,
    [vslA, vslB],
  );
  await db.query(
    `DELETE FROM acc_calculation_runs_v2 WHERE portage_uuid IN (
       SELECT portage_uuid FROM acc_portage_bills_v2 WHERE vessel_uuid IN ($1,$2))`,
    [vslA, vslB],
  );
  await db.query(
    `DELETE FROM acc_monthly_transactions_v2 WHERE vessel_uuid IN ($1,$2)`,
    [vslA, vslB],
  );
  await db.query(`DELETE FROM acc_ctm_lines_v2 WHERE ctm_uuid IN (
      SELECT ctm_uuid FROM acc_ctm_v2 WHERE vessel_uuid IN ($1,$2))`, [vslA, vslB]);
  await db.query(`DELETE FROM acc_ctm_v2 WHERE vessel_uuid IN ($1,$2)`, [vslA, vslB]);
  await db.query(`DELETE FROM acc_portage_bills_v2 WHERE vessel_uuid IN ($1,$2)`, [vslA, vslB]);
  await db.query(`DELETE FROM acc_settlements_v2 WHERE settlement_uuid = $1`, [settlementF]);
  await db.query(`DELETE FROM acc_allotments_v2 WHERE crew_uuid IN ($1,$2,$3,$4)`, [crew1, crew2, crewB, crewF]);
  await db.query(`DELETE FROM acc_engagements_v2 WHERE vessel_uuid IN ($1,$2)`, [vslA, vslB]);
  await db.query(`DELETE FROM crew_assignments WHERE assign_uuid IN ($1,$2)`, [assign1, assign2]);
  await db.query(`DELETE FROM crew_members_v2 WHERE crew_uuid IN ($1,$2,$3,$4)`, [crew1, crew2, crewB, crewF]);
  await db.query(`DELETE FROM adm_company_ranks_v2 WHERE rank IN ($1,$2)`, [RANK, RANK_NOSCALE]);
  await db.query(`DELETE FROM acc_wage_scale_lines_v2 WHERE scale_uuid = $1`, [scaleUuid]);
  await db.query(`DELETE FROM acc_wage_scales_v2 WHERE scale_uuid = $1`, [scaleUuid]);
  await db.query(`DELETE FROM master_vessels WHERE vessel_uuid IN ($1,$2)`, [vslA, vslB]);
  await db.query(`DELETE FROM master_vessel_types WHERE vt_uuid = $1`, [vtUuid]);
  await db.query(`DELETE FROM acc_pay_elements_v2 WHERE pay_element_uuid IN ($1,$2)`, [elBAS, elRTQ]);
  if (insertedConfigUuid) {
    await db.query(`DELETE FROM acc_tenant_config_v2 WHERE config_uuid = $1`, [insertedConfigUuid]);
  } else if (savedConfig.length > 0) {
    const c = savedConfig[0] as any;
    await db.query(
      `UPDATE acc_tenant_config_v2
       SET proration_basis = $1, functional_currency = $2, day_inclusion_rule = $3`,
      [c.proration_basis, c.functional_currency, c.day_inclusion_rule],
    );
  }
  await db.end();
});

describe("auto-create on load (create-only)", () => {
  it("creates the missing engagement and skips the existing one", async () => {
    const r = await call("POST", "/engagements/auto-create", {
      token: officeToken(),
      body: { vesselUuid: vslA, period: PERIOD },
    });
    expect(r.status).toBe(200);
    expect(r.body.skippedLockedMonth).toBe(false);
    expect(r.body.created).toHaveLength(1);
    expect(r.body.created[0].crewUuid).toBe(crew1);
    createdEngagementUuid = r.body.created[0].engagementUuid;
    // Create-only: no updates / cancellations ever.
    expect(r.body.updated).toHaveLength(0);
    expect(r.body.cancelled).toHaveLength(0);
    // Existing engagement untouched.
    const eng = await db.query(
      `SELECT status, start_date, end_date FROM acc_engagements_v2 WHERE engagement_uuid = $1`,
      [eng2],
    );
    expect(eng.rows[0].status).toBe("active");
    expect(eng.rows[0].end_date).toBeNull();
  });

  it("is idempotent — second call creates nothing", async () => {
    const r = await call("POST", "/engagements/auto-create", {
      token: officeToken(),
      body: { vesselUuid: vslA, period: PERIOD },
    });
    expect(r.status).toBe(200);
    expect(r.body.created).toHaveLength(0);
    expect(r.body.skippedExisting).toBeGreaterThanOrEqual(2);
  });

  it("Ship user may auto-create own vessel; cross-vessel → 403", async () => {
    const own = await call("POST", "/engagements/auto-create", {
      token: shipToken([vslA]),
      body: { vesselUuid: vslA, period: PERIOD },
    });
    expect(own.status).toBe(200);
    const cross = await call("POST", "/engagements/auto-create", {
      token: shipToken([vslB]),
      body: { vesselUuid: vslA, period: PERIOD },
    });
    expect(cross.status).toBe(403);
  });

  it("skips entirely when the month is approved or locked", async () => {
    const portageUuid = u();
    await insert("acc_portage_bills_v2", {
      portage_uuid: portageUuid,
      vessel_uuid: vslA,
      period: PERIOD,
      status: "approved",
      currency: "USD",
    });
    try {
      const r = await call("POST", "/engagements/auto-create", {
        token: officeToken(),
        body: { vesselUuid: vslA, period: PERIOD },
      });
      expect(r.status).toBe(200);
      expect(r.body.skippedLockedMonth).toBe(true);
      expect(r.body.created).toHaveLength(0);
      expect(r.body.skippedExisting).toBe(0); // did not even scan
    } finally {
      await db.query(
        `DELETE FROM acc_portage_bills_v2 WHERE portage_uuid = $1`,
        [portageUuid],
      );
    }
  });
});

describe("vessel sign-off date", () => {
  it("Ship cross-vessel sign-off → 403; no-vessels claim fail-closed", async () => {
    const cross = await call(
      "POST",
      `/engagements/${createdEngagementUuid}/sign-off`,
      {
        token: shipToken([vslB]),
        body: { period: PERIOD, endDate: "2026-06-20" },
      },
    );
    expect(cross.status).toBe(403);
    const noClaim = await call(
      "POST",
      `/engagements/${createdEngagementUuid}/sign-off`,
      {
        token: shipToken([]),
        body: { period: PERIOD, endDate: "2026-06-20" },
      },
    );
    expect(noClaim.status).toBe(403);
  });

  it("rejects a period that does not match the endDate month (lock-bypass attempt)", async () => {
    // Sending an open period with an endDate in another month must not work.
    const r = await call(
      "POST",
      `/engagements/${createdEngagementUuid}/sign-off`,
      {
        token: shipToken([vslA]),
        body: { period: "2026-07", endDate: "2026-06-20" },
      },
    );
    expect(r.status).toBe(400);
  });

  it("rejects a sign-off before the engagement start", async () => {
    const r = await call(
      "POST",
      `/engagements/${createdEngagementUuid}/sign-off`,
      {
        token: shipToken([vslA]),
        body: { period: "2026-05", endDate: "2026-05-20" },
      },
    );
    expect(r.status).toBe(400);
  });

  it("refuses sign-off on an engagement frozen by a submitted settlement", async () => {
    const r = await call("POST", `/engagements/${engF}/sign-off`, {
      token: shipToken([vslA]),
      body: { period: "2026-05", endDate: "2026-05-20" },
    });
    expect(r.status).toBe(409);
  });

  it("Ship own-vessel sign-off sets end date + endDateManual", async () => {
    const r = await call(
      "POST",
      `/engagements/${createdEngagementUuid}/sign-off`,
      {
        token: shipToken([vslA]),
        body: { period: PERIOD, endDate: "2026-06-20" },
      },
    );
    expect(r.status).toBe(200);
    expect(r.body.endDate).toBe("2026-06-20");
    expect(r.body.endDateManual).toBe(true);
  });
});

describe("vessel submit auto-runs the calculation", () => {
  it("submit succeeds, calc completes, sign-off prorates 3,000 → 2,000.00", async () => {
    const r = await call("POST", `/vessel-portage/${vslA}/${PERIOD}/submit`, {
      token: shipToken([vslA]),
    });
    expect(r.status).toBe(200);
    expect(r.body.portage.status).toBe("submitted");
    expect(r.body.calc?.status).toBe("completed");

    // Proration figure (task spec): 30-day June, sign-off day 20,
    // monthly 3,000.00 ⇒ 2,000.00 for the auto-created crew1.
    const lines = await db.query(
      `SELECT amount FROM acc_wage_ledger_v2
        WHERE engagement_uuid = $1 AND is_deleted = false`,
      [createdEngagementUuid],
    );
    expect(lines.rows).toHaveLength(1);
    expect(Number(lines.rows[0].amount).toFixed(2)).toBe("2000.00");
    // Full-month crew2 gets the unprorated 3,000.00.
    const lines2 = await db.query(
      `SELECT amount FROM acc_wage_ledger_v2
        WHERE engagement_uuid = $1 AND is_deleted = false`,
      [eng2],
    );
    expect(Number(lines2.rows[0].amount).toFixed(2)).toBe("3000.00");
  });

  it("sign-off is refused once the month is submitted", async () => {
    const r = await call(
      "POST",
      `/engagements/${createdEngagementUuid}/sign-off`,
      {
        token: shipToken([vslA]),
        body: { period: PERIOD, endDate: "2026-06-25" },
      },
    );
    expect(r.status).toBe(409);
  });

  it("a failing calc does NOT block the submit and is recorded as a failed run", async () => {
    // Force a per-crew validation failure on vessel B: an accepted monthly
    // txn on a rate_times_qty element with no qty.
    await insert("acc_monthly_transactions_v2", {
      txn_uuid: u(),
      engagement_uuid: engB,
      crew_uuid: crewB,
      vessel_uuid: vslB,
      period: PERIOD,
      pay_element_uuid: elRTQ,
      qty: null,
      amount: "10.00",
      origin: "office",
      status: "accepted",
    });
    const r = await call("POST", `/vessel-portage/${vslB}/${PERIOD}/submit`, {
      token: shipToken([vslB]),
    });
    expect(r.status).toBe(200);
    expect(r.body.portage.status).toBe("submitted");
    expect(r.body.calc?.status).toBe("failed");
    expect(r.body.calc?.error).toBeTruthy();

    // The office sees the failure on the Payroll Run workspace.
    const ws = await call(
      "GET",
      `/portage?vesselUuid=${vslB}&period=${PERIOD}&cb=${Date.now()}`,
      { token: officeToken() },
    );
    expect(ws.status).toBe(200);
    expect(ws.body.latestRun?.status).toBe("failed");
    expect(ws.body.latestRun?.errorDetail).toBeTruthy();
  });
});

describe("broadened stale-calculation indicator", () => {
  it("fresh run is not stale; a new monthly transaction flips staleInputs", async () => {
    const before = await call(
      "GET",
      `/portage?vesselUuid=${vslA}&period=${PERIOD}&cb=${Date.now()}`,
      { token: officeToken() },
    );
    expect(before.status).toBe(200);
    expect(before.body.staleInputs).toBe(false);

    await insert("acc_monthly_transactions_v2", {
      txn_uuid: u(),
      engagement_uuid: eng2,
      crew_uuid: crew2,
      vessel_uuid: vslA,
      period: PERIOD,
      pay_element_uuid: elBAS,
      amount: "10.00",
      origin: "office",
      status: "accepted",
    });
    const after = await call(
      "GET",
      `/portage?vesselUuid=${vslA}&period=${PERIOD}&cb=${Date.now()}`,
      { token: officeToken() },
    );
    expect(after.body.staleInputs).toBe(true);
  });

  it("an allotment change for the vessel's crew also flips staleInputs (after re-run)", async () => {
    // Re-run to clear staleness (office).
    const run = await call("POST", "/calc/run", {
      token: officeToken(),
      body: { vesselUuid: vslA, period: PERIOD },
    });
    expect(run.status).toBe(200);
    const cleared = await call(
      "GET",
      `/portage?vesselUuid=${vslA}&period=${PERIOD}&cb=${Date.now()}`,
      { token: officeToken() },
    );
    expect(cleared.body.staleInputs).toBe(false);

    await insert("acc_allotments_v2", {
      allotment_uuid: u(),
      crew_uuid: crew2,
      beneficiary_name: "Test Beneficiary",
      allotment_type: "fixed",
      value: "100.00",
      status: "active",
    });
    const after = await call(
      "GET",
      `/portage?vesselUuid=${vslA}&period=${PERIOD}&cb=${Date.now()}`,
      { token: officeToken() },
    );
    expect(after.body.staleInputs).toBe(true);
  });
});
