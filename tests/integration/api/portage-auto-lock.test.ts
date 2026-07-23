import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { randomUUID } from "crypto";

const API_BASE = "http://localhost:5000";
const V2_BASE = `${API_BASE}/api/v2/accounts`;

/**
 * Task: portage auto-lock on final approval.
 *
 * Covers the terminal approval transition end-to-end against the live server:
 *  1. Auto-lock ON: decide all approvers → portage locked (status, is_locked,
 *     locked_date) + linked CTM locked, then every mutation guard refuses
 *     (calc re-run, monthly transaction create/update, bond add, re-decide).
 *  2. Concurrency: two approvers deciding in parallel still produce exactly
 *     one terminal transition (row locked once, CTM locked).
 *  3. Auto-lock OFF: terminal approval → status 'approved' only; month stays
 *     unlocked and editable (guards do not refuse).
 *  4. Rejection: any Rejected decision returns the bill to 'returned'.
 *  5. Locked-month correction path: no unlock endpoint exists; the refusal
 *     message directs corrections to an adjustment run in a later period.
 */

const S = `${Date.now()}`;
const u = () => randomUUID();

// Real pay element (guards resolve the element before the lock check).
const elMAN = u();

let db: Client;
let cacheBust = 0;

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  // happy-dom's fetch caches GET responses per URL, so bust the cache.
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${V2_BASE}${path}${sep}_cb=${cacheBust++}`, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
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

/** Portage bill in office_review + N pending approvals + a submitted CTM. */
async function makeFixture(vessel: string, period: string, approvers: string[]) {
  const portageUuid = u();
  const ctmUuid = u();
  await insert("acc_portage_bills_v2", {
    portage_uuid: portageUuid,
    vessel_uuid: vessel,
    period,
    status: "office_review",
    prepared_mode: "vessel_prepares",
    crew_count: 1,
    currency: "USD",
  });
  const approvalUuids: string[] = [];
  for (const approver of approvers) {
    const a = u();
    approvalUuids.push(a);
    await insert("acc_portage_approvals_v2", {
      pb_approval_uuid: a,
      portage_uuid: portageUuid,
      approver,
      status: "Pending",
    });
  }
  await insert("acc_ctm_v2", {
    ctm_uuid: ctmUuid,
    vessel_uuid: vessel,
    period,
    status: "submitted",
    currency: "USD",
    portage_uuid: portageUuid,
  });
  const engagementUuid = u();
  const crewUuid = u();
  await insert("acc_engagements_v2", {
    engagement_uuid: engagementUuid,
    crew_uuid: crewUuid,
    engagement_type: "voyage_contract",
    vessel_uuid: vessel,
    start_date: `${period}-01`,
    currency: "USD",
    status: "active",
  });
  return { portageUuid, ctmUuid, approvalUuids, engagementUuid, crewUuid };
}

async function portageRow(portageUuid: string) {
  const r = await db.query(
    "SELECT status, is_locked, locked_date FROM acc_portage_bills_v2 WHERE portage_uuid = $1",
    [portageUuid],
  );
  return r.rows[0];
}

async function ctmStatus(ctmUuid: string): Promise<string> {
  const r = await db.query(
    "SELECT status FROM acc_ctm_v2 WHERE ctm_uuid = $1",
    [ctmUuid],
  );
  return r.rows[0].status;
}

async function setAutoLock(on: boolean) {
  await db.query(
    "UPDATE acc_tenant_config_v2 SET auto_lock_on_approval = $1 WHERE is_deleted = false",
    [on],
  );
}

function txnBody(vessel: string, period: string) {
  return {
    engagementUuid: u(),
    crewUuid: u(),
    vesselUuid: vessel,
    period,
    payElementUuid: elMAN,
    amount: "50.00",
    currency: "USD",
    origin: "office",
  };
}

describe("Portage auto-lock on final approval", () => {
  beforeAll(async () => {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error("Server not running");
    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    await setAutoLock(true);
    await insert("acc_pay_elements_v2", {
      pay_element_uuid: elMAN,
      code: `PAL_MAN_${S}`,
      name: "PAL Manual Bonus",
      type: "earning",
      category: "bonus",
      calc_method: "manual_entry",
      prorate: false,
      payment_timing: "paid_on_board",
      rounding_rule: "nearest",
      rounding_precision: "0.01",
      status: "active",
    });
  });

  afterAll(async () => {
    await setAutoLock(true);
    await db.end();
  });

  it("locks the month + CTM after the final approval, then all guards refuse", async () => {
    const vessel = `VSL_PAL_A_${S}`;
    const period = "2026-04";
    const fx = await makeFixture(vessel, period, ["S1", "S2"]);

    // First approver: month must NOT lock yet.
    const d1 = await api(
      "POST",
      `/portage/approvals/${fx.approvalUuids[0]}/decision`,
      { decision: "Approved", comments: "ok S1" },
    );
    expect(d1.status).toBe(200);
    expect(d1.body.portage.status).toBe("office_review");
    expect(d1.body.portage.isLocked).toBe(false);

    // Final approver: terminal transition fires — lock + CTM lock.
    const d2 = await api(
      "POST",
      `/portage/approvals/${fx.approvalUuids[1]}/decision`,
      { decision: "Approved", comments: "ok S2" },
    );
    expect(d2.status).toBe(200);
    expect(d2.body.portage.status).toBe("locked");
    expect(d2.body.portage.isLocked).toBe(true);
    expect(d2.body.portage.lockedDate).toBeTruthy();

    const row = await portageRow(fx.portageUuid);
    expect(row.status).toBe("locked");
    expect(row.is_locked).toBe(true);
    expect(row.locked_date).toBeTruthy();
    expect(await ctmStatus(fx.ctmUuid)).toBe("locked");

    // Guards: calc re-run refused.
    const rerun = await api("POST", "/calc/run", {
      vesselUuid: vessel,
      period,
    });
    expect(rerun.status).toBe(409);
    expect(rerun.body.error).toMatch(/locked/i);

    // Guards: monthly transaction create refused.
    const txn = await api("POST", "/monthly-transactions", txnBody(vessel, period));
    expect(txn.status).toBe(409);
    expect(txn.body.error).toMatch(/locked/i);

    // Guards: bond item add refused.
    const bond = await api("POST", "/bond-items", {
      vesselUuid: vessel,
      period,
      crewUuid: fx.crewUuid,
      engagementUuid: fx.engagementUuid,
      itemName: "Test item",
      quantity: "1",
      unitPrice: "5.00",
      amount: "5.00",
    });
    expect(bond.status).toBe(409);
    expect(bond.body.error).toMatch(/locked/i);

    // Guards: deciding again on a locked bill refused.
    const again = await api(
      "POST",
      `/portage/approvals/${fx.approvalUuids[0]}/decision`,
      { decision: "Approved" },
    );
    expect(again.status).toBe(409);
  });

  it("two concurrent final decisions still lock exactly once", async () => {
    const vessel = `VSL_PAL_C_${S}`;
    const period = "2026-04";
    const fx = await makeFixture(vessel, period, ["S1", "S2"]);

    const [r1, r2] = await Promise.all([
      api("POST", `/portage/approvals/${fx.approvalUuids[0]}/decision`, {
        decision: "Approved",
      }),
      api("POST", `/portage/approvals/${fx.approvalUuids[1]}/decision`, {
        decision: "Approved",
      }),
    ]);
    // Both decisions target distinct approval rows: each should either
    // succeed or (if it lost the race after terminal lock) get a 409.
    for (const r of [r1, r2]) expect([200, 409]).toContain(r.status);

    const row = await portageRow(fx.portageUuid);
    const approvals = await db.query(
      "SELECT status FROM acc_portage_approvals_v2 WHERE portage_uuid = $1 AND is_deleted = false",
      [fx.portageUuid],
    );
    const allDecided = approvals.rows.every(
      (a: { status: string }) => a.status === "Approved",
    );
    if (allDecided) {
      expect(row.status).toBe("locked");
      expect(row.is_locked).toBe(true);
      expect(await ctmStatus(fx.ctmUuid)).toBe("locked");
    } else {
      // One decision lost the race entirely; the bill must not be locked.
      expect(row.is_locked).toBe(false);
    }
  });

  it("auto-lock OFF: terminal approval marks approved but leaves the month unlocked", async () => {
    const vessel = `VSL_PAL_B_${S}`;
    const period = "2026-04";
    const fx = await makeFixture(vessel, period, ["S1"]);

    await setAutoLock(false);
    try {
      const d = await api(
        "POST",
        `/portage/approvals/${fx.approvalUuids[0]}/decision`,
        { decision: "Approved" },
      );
      expect(d.status).toBe(200);
      expect(d.body.portage.status).toBe("approved");
      expect(d.body.portage.isLocked).toBe(false);

      const row = await portageRow(fx.portageUuid);
      expect(row.status).toBe("approved");
      expect(row.is_locked).toBe(false);
      expect(await ctmStatus(fx.ctmUuid)).toBe("submitted");

      // Month still editable: the lock guard must NOT refuse (validation of
      // the phantom fixture uuids may still 4xx, but never the 409 lock).
      const txn = await api(
        "POST",
        "/monthly-transactions",
        txnBody(vessel, period),
      );
      expect(txn.status).not.toBe(409);
    } finally {
      await setAutoLock(true);
    }
  });

  it("a rejection returns the bill to 'returned' without locking", async () => {
    const vessel = `VSL_PAL_R_${S}`;
    const period = "2026-04";
    const fx = await makeFixture(vessel, period, ["S1", "S2"]);

    const d = await api(
      "POST",
      `/portage/approvals/${fx.approvalUuids[0]}/decision`,
      { decision: "Rejected", comments: "figures off" },
    );
    expect(d.status).toBe(200);
    expect(d.body.portage.status).toBe("returned");

    const row = await portageRow(fx.portageUuid);
    expect(row.status).toBe("returned");
    expect(row.is_locked).toBe(false);
    expect(await ctmStatus(fx.ctmUuid)).toBe("submitted");
  });

  it("locked-month correction path: no unlock endpoint; refusal points to adjustment run", async () => {
    const vessel = `VSL_PAL_L_${S}`;
    const period = "2026-04";
    const fx = await makeFixture(vessel, period, ["S1"]);
    const d = await api(
      "POST",
      `/portage/approvals/${fx.approvalUuids[0]}/decision`,
      { decision: "Approved" },
    );
    expect(d.status).toBe(200);
    expect(d.body.portage.status).toBe("locked");

    // No unlock/reopen endpoint exists: an unlock POST never reaches an API
    // handler (the SPA fallback serves HTML instead of a JSON API response).
    const unlock = await api("POST", `/portage/${fx.portageUuid}/unlock`, {});
    expect(typeof unlock.body).toBe("string");
    const rowAfter = await portageRow(fx.portageUuid);
    expect(rowAfter.status).toBe("locked");
    expect(rowAfter.is_locked).toBe(true);

    // The re-run refusal directs the office to the adjustment flow.
    const rerun = await api("POST", "/calc/run", {
      vesselUuid: vessel,
      period,
    });
    expect(rerun.status).toBe(409);
    expect(rerun.body.error).toMatch(/adjustment run/i);
  });
});
