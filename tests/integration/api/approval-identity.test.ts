import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { randomUUID } from "crypto";

const API_BASE = "http://localhost:5000";
const V2_BASE = `${API_BASE}/api/v2/accounts`;

/**
 * Task: Vessel approval segregation of duties.
 *
 * Approval decisions (portage bills AND settlements) must be identity-bound:
 *  1. Ship-identity callers get 403 on both decide endpoints.
 *  2. A pre-assigned approver slot (approver_id set) can only be decided by
 *     that approver; anyone else gets 403.
 *  3. An unassigned (free-text) slot is claimed by the office decider; the
 *     same caller then cannot decide a second slot on the same bill /
 *     settlement (403) — one user can never satisfy two approver slots.
 *  4. The assigned approver succeeds, and distinct approvers can complete
 *     the flow normally.
 *
 * Auth uses the dev AUTH_BYPASS path: unsigned Bearer JWTs are decoded
 * (unverified) into req.user, so tokens forge identities for the test.
 */

const S = `${Date.now()}`;
const u = () => randomUUID();

let db: Client;
let cacheBust = 0;

function token(id: number, userType: "Ship" | "Office", vessels: string[] = []) {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    id,
    domain: "test",
    userType,
    vessels,
  })}.devsig`;
}

const shipTok = token(880001, "Ship", []);
const officeA = token(880011, "Office"); // id "880011"
const officeB = token(880012, "Office");
const officeC = token(880013, "Office");

async function api(
  method: string,
  path: string,
  body?: unknown,
  tok?: string,
): Promise<{ status: number; body: any }> {
  // happy-dom's fetch caches GET responses per URL; bust the cache.
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${V2_BASE}${path}${sep}_cb=${cacheBust++}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
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

/** Portage bill in office_review + pending approvals (optionally assigned). */
async function makePortageFixture(
  approvers: Array<{ approver: string; approverId?: string }>,
) {
  const portageUuid = u();
  const vessel = `VSL_SEG_${u()}`;
  await insert("acc_portage_bills_v2", {
    portage_uuid: portageUuid,
    vessel_uuid: vessel,
    period: "2026-05",
    status: "office_review",
    prepared_mode: "vessel_prepares",
    crew_count: 1,
    currency: "USD",
  });
  const approvalUuids: string[] = [];
  for (const a of approvers) {
    const id = u();
    approvalUuids.push(id);
    await insert("acc_portage_approvals_v2", {
      pb_approval_uuid: id,
      portage_uuid: portageUuid,
      approver: a.approver,
      approver_id: a.approverId ?? null,
      status: "Pending",
    });
  }
  return { portageUuid, vessel, approvalUuids };
}

/** Settlement in submitted + pending approvals (optionally assigned). */
async function makeSettlementFixture(
  approvers: Array<{ approver: string; approverId?: string }>,
) {
  const settlementUuid = u();
  const engagementUuid = u();
  const crewUuid = u();
  await insert("acc_engagements_v2", {
    engagement_uuid: engagementUuid,
    crew_uuid: crewUuid,
    engagement_type: "voyage_contract",
    vessel_uuid: `VSL_SEG_${u()}`,
    start_date: "2026-05-01",
    currency: "USD",
    status: "active",
  });
  await insert("acc_settlements_v2", {
    settlement_uuid: settlementUuid,
    engagement_uuid: engagementUuid,
    crew_uuid: crewUuid,
    status: "submitted",
    currency: "USD",
  });
  const approvalUuids: string[] = [];
  for (const a of approvers) {
    const id = u();
    approvalUuids.push(id);
    await insert("acc_settlement_approvals_v2", {
      st_approval_uuid: id,
      settlement_uuid: settlementUuid,
      approver: a.approver,
      approver_id: a.approverId ?? null,
      status: "Pending",
    });
  }
  return { settlementUuid, approvalUuids };
}

describe("Approval identity binding (segregation of duties)", () => {
  beforeAll(async () => {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error("Server not running");
    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  // The tenant-wide auto_lock_on_approval flag is owned by the auto-lock
  // suite (which may run in parallel); terminal-state assertions therefore
  // accept either terminal status ('approved' or 'locked').
  const TERMINAL = ["approved", "locked"];

  // ---- portage --------------------------------------------------------------

  it("403s a Ship-identity caller on the portage decide endpoint", async () => {
    const fx = await makePortageFixture([{ approver: "Office One" }]);
    const r = await api(
      "POST",
      `/portage/approvals/${fx.approvalUuids[0]}/decision`,
      { decision: "Approved" },
      shipTok,
    );
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/office/i);
    const row = await db.query(
      "SELECT status FROM acc_portage_approvals_v2 WHERE pb_approval_uuid = $1",
      [fx.approvalUuids[0]],
    );
    expect(row.rows[0].status).toBe("Pending");
  });

  it("403s a non-assigned office caller on a pre-assigned portage slot", async () => {
    const fx = await makePortageFixture([
      { approver: "Office A", approverId: "880011" },
    ]);
    const r = await api(
      "POST",
      `/portage/approvals/${fx.approvalUuids[0]}/decision`,
      { decision: "Approved" },
      officeB,
    );
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/assigned to a different approver/i);
  });

  it("lets the assigned approver decide their portage slot", async () => {
    const fx = await makePortageFixture([
      { approver: "Office A", approverId: "880011" },
    ]);
    const r = await api(
      "POST",
      `/portage/approvals/${fx.approvalUuids[0]}/decision`,
      { decision: "Approved", comments: "ok" },
      officeA,
    );
    expect(r.status).toBe(200);
    expect(TERMINAL).toContain(r.body.portage.status);
  });

  it("blocks one office user from filling two portage slots (claim binding)", async () => {
    const fx = await makePortageFixture([
      { approver: "First Approver" },
      { approver: "Second Approver" },
    ]);
    // Office A claims slot 1 (free-text slot → approver_id stamped).
    const d1 = await api(
      "POST",
      `/portage/approvals/${fx.approvalUuids[0]}/decision`,
      { decision: "Approved" },
      officeA,
    );
    expect(d1.status).toBe(200);
    const claimed = await db.query(
      "SELECT approver_id FROM acc_portage_approvals_v2 WHERE pb_approval_uuid = $1",
      [fx.approvalUuids[0]],
    );
    expect(claimed.rows[0].approver_id).toBe("880011");

    // Office A cannot also decide slot 2.
    const d2 = await api(
      "POST",
      `/portage/approvals/${fx.approvalUuids[1]}/decision`,
      { decision: "Approved" },
      officeA,
    );
    expect(d2.status).toBe(403);
    expect(d2.body.error).toMatch(/already hold another approver slot/i);

    // A different office user completes the bill.
    const d3 = await api(
      "POST",
      `/portage/approvals/${fx.approvalUuids[1]}/decision`,
      { decision: "Approved" },
      officeB,
    );
    expect(d3.status).toBe(200);
    expect(TERMINAL).toContain(d3.body.portage.status);
  });

  // ---- settlements ------------------------------------------------------------

  it("403s a Ship-identity caller on the settlement decide endpoint", async () => {
    const fx = await makeSettlementFixture([{ approver: "Office One" }]);
    const r = await api(
      "POST",
      `/settlements/approvals/${fx.approvalUuids[0]}/decision`,
      { decision: "Approved" },
      shipTok,
    );
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/office/i);
  });

  it("403s a non-assigned office caller on a pre-assigned settlement slot", async () => {
    const fx = await makeSettlementFixture([
      { approver: "Office A", approverId: "880011" },
    ]);
    const r = await api(
      "POST",
      `/settlements/approvals/${fx.approvalUuids[0]}/decision`,
      { decision: "Approved" },
      officeC,
    );
    expect(r.status).toBe(403);
    expect(r.body.error).toMatch(/assigned to a different approver/i);
  });

  it("blocks one office user from filling two settlement slots and lets distinct approvers finish", async () => {
    const fx = await makeSettlementFixture([
      { approver: "First Approver" },
      { approver: "Second Approver" },
    ]);
    const d1 = await api(
      "POST",
      `/settlements/approvals/${fx.approvalUuids[0]}/decision`,
      { decision: "Approved" },
      officeA,
    );
    expect(d1.status).toBe(200);
    const claimed = await db.query(
      "SELECT approver_id FROM acc_settlement_approvals_v2 WHERE st_approval_uuid = $1",
      [fx.approvalUuids[0]],
    );
    expect(claimed.rows[0].approver_id).toBe("880011");

    const d2 = await api(
      "POST",
      `/settlements/approvals/${fx.approvalUuids[1]}/decision`,
      { decision: "Approved" },
      officeA,
    );
    expect(d2.status).toBe(403);
    expect(d2.body.error).toMatch(/already hold another approver slot/i);

    const d3 = await api(
      "POST",
      `/settlements/approvals/${fx.approvalUuids[1]}/decision`,
      { decision: "Approved" },
      officeB,
    );
    expect(d3.status).toBe(200);
    expect(d3.body.settlement.status).toBe("approved");
  });

  it("serializes concurrent settlement decisions by the same user (exactly one slot claimed)", async () => {
    const fx = await makeSettlementFixture([
      { approver: "First Approver" },
      { approver: "Second Approver" },
    ]);
    const [r1, r2] = await Promise.all([
      api(
        "POST",
        `/settlements/approvals/${fx.approvalUuids[0]}/decision`,
        { decision: "Approved" },
        officeA,
      ),
      api(
        "POST",
        `/settlements/approvals/${fx.approvalUuids[1]}/decision`,
        { decision: "Approved" },
        officeA,
      ),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 403]);
    const held = await db.query(
      "SELECT COUNT(*)::int AS n FROM acc_settlement_approvals_v2 WHERE settlement_uuid = $1 AND approver_id = '880011' AND is_deleted = false",
      [fx.settlementUuid],
    );
    expect(held.rows[0].n).toBe(1);
  });
});
