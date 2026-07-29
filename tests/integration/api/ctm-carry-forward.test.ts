import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { randomUUID } from "crypto";

/**
 * CTM carry-forward: most-recent prior month, not just preceding.
 *
 * Three test cases:
 *  1. Immediately preceding month present  → carries from that month (unchanged behaviour)
 *  2. Gap of two months                    → carries from the correct earlier month
 *  3. No prior records at all              → opens at 0.00; field null
 */

const API_BASE = "http://localhost:5000";
const V2_BASE = `${API_BASE}/api/v2/accounts`;

const S = `${Date.now()}`;
const u = () => randomUUID();

// Three independent vessels, one per scenario
const vslAdj = `VSL_CTMCF_ADJ_${S}`; // adjacent prior
const vslGap = `VSL_CTMCF_GAP_${S}`; // gap of two months
const vslNone = `VSL_CTMCF_NONE_${S}`; // no prior at all

let db: Client;
let cacheBust = 0;

function shipToken(vessels: string[]): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({
    id: 990099,
    domain: "test",
    userType: "Ship",
    vessels,
  })}.devsig`;
}

const tokenAdj = shipToken([vslAdj]);
const tokenGap = shipToken([vslGap]);
const tokenNone = shipToken([vslNone]);

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: any }> {
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

async function insertCtm(
  vesselUuid: string,
  period: string,
  closingBalance: string,
) {
  await db.query(
    `INSERT INTO acc_ctm_v2
       (ctm_uuid, vessel_uuid, period,
        opening_balance, received_amount, closing_balance,
        currency, status)
     VALUES ($1,$2,$3,$4,$5,$6,'USD','locked')`,
    [u(), vesselUuid, period, "0.00", closingBalance, closingBalance],
  );
}

describe("CTM carry-forward: most-recent prior month", () => {
  beforeAll(async () => {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error("Server not running");

    db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();

    // Scenario 1: immediately preceding month (2026-05) → open 2026-06
    await insertCtm(vslAdj, "2026-05", "1234.56");

    // Scenario 2: gap — 2026-03 exists, 2026-04 skipped → open 2026-05
    await insertCtm(vslGap, "2026-03", "7500.00");

    // Scenario 3: nothing inserted — open 2026-06 should be 0.00
  });

  afterAll(async () => {
    const vsls = [vslAdj, vslGap, vslNone];
    try {
      await db.query(
        `DELETE FROM acc_ctm_lines_v2
           WHERE ctm_uuid IN (SELECT ctm_uuid FROM acc_ctm_v2 WHERE vessel_uuid = ANY($1))`,
        [vsls],
      );
    } catch { /* best-effort */ }
    try {
      await db.query("DELETE FROM acc_ctm_v2 WHERE vessel_uuid = ANY($1)", [vsls]);
    } catch { /* best-effort */ }
    await db.end();
  });

  // --------------------------------------------------------------------------
  it("Case 1: adjacent prior month carries opening balance and sets provenance", async () => {
    const res = await api("GET", `/ctm/${vslAdj}/2026-06`, undefined, tokenAdj);
    expect(res.status).toBe(200);

    const { ctm, openingCarried, openingCarriedFromPeriod } = res.body;
    expect(Number(ctm.openingBalance).toFixed(2)).toBe("1234.56");
    expect(openingCarried).toBe(true);
    expect(openingCarriedFromPeriod).toBe("2026-05");
  });

  it("Case 1: editing the opening balance is rejected (guard applies)", async () => {
    const res = await api(
      "PUT",
      `/ctm/${vslAdj}/2026-06`,
      { openingBalance: "999.00" },
      tokenAdj,
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/carried/i);
  });

  // --------------------------------------------------------------------------
  it("Case 2: two-month gap — balance carries from 2026-03, not 0.00", async () => {
    const res = await api("GET", `/ctm/${vslGap}/2026-05`, undefined, tokenGap);
    expect(res.status).toBe(200);

    const { ctm, openingCarried, openingCarriedFromPeriod } = res.body;
    expect(Number(ctm.openingBalance).toFixed(2)).toBe("7500.00");
    expect(openingCarried).toBe(true);
    // skipped 2026-04 — source must be 2026-03
    expect(openingCarriedFromPeriod).toBe("2026-03");
  });

  it("Case 2: editing the opening balance is also rejected for non-adjacent carry", async () => {
    const res = await api(
      "PUT",
      `/ctm/${vslGap}/2026-05`,
      { openingBalance: "0.01" },
      tokenGap,
    );
    expect(res.status).toBe(400);
  });

  // --------------------------------------------------------------------------
  it("Case 3: no prior records — opening is 0.00 and provenance is null", async () => {
    const res = await api("GET", `/ctm/${vslNone}/2026-06`, undefined, tokenNone);
    expect(res.status).toBe(200);

    const { ctm, openingCarried, openingCarriedFromPeriod } = res.body;
    expect(Number(ctm.openingBalance).toFixed(2)).toBe("0.00");
    expect(openingCarried).toBe(false);
    expect(openingCarriedFromPeriod).toBeNull();
  });

  it("Case 3: opening balance is editable when no prior exists", async () => {
    const res = await api(
      "PUT",
      `/ctm/${vslNone}/2026-06`,
      { openingBalance: "500.00" },
      tokenNone,
    );
    expect(res.status).toBe(200);
    expect(Number(res.body.ctm.openingBalance).toFixed(2)).toBe("500.00");
  });
});
