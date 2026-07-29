import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "crypto";
import type { Server } from "http";

/**
 * Task #187 regression — Ship reference-data reads for the Vessel Portage
 * screen. A real signed Ship JWT (AUTH_BYPASS off) must be able to read:
 *   GET /pay-elements        (glCode stripped)
 *   GET /config              (trimmed to the extra-tab fields only)
 *   GET /allotments          (own vessel's crew only)
 *   GET /wage-scales/:uuid   (only scales referenced by own-vessel engagements)
 * while every pay-element / wage-scale mutation and the calc runs stay 403.
 *
 * These reads feed the category entry tabs (Overtime, Cash advances,
 * Allotments, Bond/slop chest, Other deductions, extra configured tabs) and
 * the element-code chips on VesselPortagePage — the tabs are derivable iff
 * active elements for these categories come back with their codes.
 */

const TEST_SECRET = "task187-test-secret";
const S = `SR${Date.now()}`;
const u = () => randomUUID();

const SHIP_VESSEL = u();
const OTHER_VESSEL = u();

// Pay elements covering each category tab the screen derives.
const el = {
  OT: u(), // overtime_variable
  GOT: u(), // overtime_fixed
  ADV: u(), // advance_recovery
  ALLOT: u(), // allotment
  BOND: u(), // bond_slop_chest
  OTHER: u(), // one_off
};
const scaleOwn = u(); // referenced by an engagement on SHIP_VESSEL
const scaleOther = u(); // referenced only on OTHER_VESSEL
const engOwn = u();
const engOther = u();
const crewOwn = u();
const crewOther = u();
const allotOwn = u();
const allotOther = u();
// No engagement_uuid — vessel resolved via the crew's latest engagement.
const allotOwnFallback = u();

let db: Client;
let server: Server;

const shipToken = () =>
  jwt.sign(
    { id: 990187, domain: "test", userType: "Ship", vessels: [SHIP_VESSEL] },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
const officeToken = () =>
  jwt.sign({ id: 990188, domain: "test", userType: "Admin" }, TEST_SECRET, {
    expiresIn: "1h",
  });

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const m = method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
  let req = request(server)[m](`/api/v2/accounts${path}`);
  if (opts.token) req = req.set("Authorization", `Bearer ${opts.token}`);
  if (opts.body !== undefined) {
    req = req.set("Content-Type", "application/json").send(opts.body as any);
  }
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

function payElement(uuid: string, code: string, category: string) {
  return insert("acc_pay_elements_v2", {
    pay_element_uuid: uuid,
    code: `${code}_${S}`,
    name: code,
    type: category === "advance_recovery" || category === "allotment" || category === "bond_slop_chest" ? "deduction" : "earning",
    category,
    calc_method: "fixed_amount",
    prorate: false,
    payment_timing: "paid_on_board",
    rounding_rule: "nearest",
    rounding_precision: "0.01",
    status: "active",
    gl_code: `GL-${code}-${S}`,
  });
}

beforeAll(async () => {
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

  db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  await payElement(el.OT, "OT", "overtime_variable");
  await payElement(el.GOT, "GOT", "overtime_fixed");
  await payElement(el.ADV, "ADV", "advance_recovery");
  await payElement(el.ALLOT, "ALLOT", "allotment");
  await payElement(el.BOND, "BOND", "bond_slop_chest");
  await payElement(el.OTHER, "OTHER", "one_off");

  for (const [scale, name] of [
    [scaleOwn, `Ship Ref Own ${S}`],
    [scaleOther, `Ship Ref Other ${S}`],
  ] as const) {
    await insert("acc_wage_scales_v2", {
      scale_uuid: scale,
      scale_name: name,
      currency: "USD",
      effective_from: "2025-01-01",
      status: "active",
    });
  }
  await insert("acc_wage_scale_lines_v2", {
    scale_line_uuid: u(),
    scale_uuid: scaleOwn,
    rank_id: `AB_${S}`,
    pay_element_uuid: el.OT,
    experience_min_months: 0,
    experience_max_months: 11,
    rate: "5.2500",
  });

  const eng = (
    uuid: string,
    crewUuid: string,
    vesselUuid: string,
    wageScaleUuid: string,
  ) =>
    insert("acc_engagements_v2", {
      engagement_uuid: uuid,
      crew_uuid: crewUuid,
      engagement_type: "voyage_contract",
      vessel_uuid: vesselUuid,
      start_date: "2026-07-01",
      wage_scale_uuid: wageScaleUuid,
      rank_id_at_start: `AB_${S}`,
      currency: "USD",
      status: "active",
    });
  await eng(engOwn, crewOwn, SHIP_VESSEL, scaleOwn);
  await eng(engOther, crewOther, OTHER_VESSEL, scaleOther);

  const allot = (uuid: string, crewUuid: string, engagementUuid: string | null) =>
    insert("acc_allotments_v2", {
      allotment_uuid: uuid,
      crew_uuid: crewUuid,
      beneficiary_name: `Beneficiary ${S}`,
      allotment_type: "fixed",
      value: "100.00",
      currency: "USD",
      status: "active",
      engagement_uuid: engagementUuid,
    });
  await allot(allotOwn, crewOwn, engOwn);
  await allot(allotOther, crewOther, engOther);
  await allot(allotOwnFallback, crewOwn, null);
});

afterAll(async () => {
  await db.query(
    `DELETE FROM acc_allotments_v2 WHERE allotment_uuid = ANY($1)`,
    [[allotOwn, allotOther, allotOwnFallback]],
  );
  await db.query(
    `DELETE FROM acc_engagements_v2 WHERE engagement_uuid = ANY($1)`,
    [[engOwn, engOther]],
  );
  await db.query(
    `DELETE FROM acc_wage_scale_lines_v2 WHERE scale_uuid = ANY($1)`,
    [[scaleOwn, scaleOther]],
  );
  await db.query(`DELETE FROM acc_wage_scales_v2 WHERE scale_uuid = ANY($1)`, [
    [scaleOwn, scaleOther],
  ]);
  await db.query(
    `DELETE FROM acc_pay_elements_v2 WHERE pay_element_uuid = ANY($1)`,
    [Object.values(el)],
  );
  await db.end();
  await new Promise<void>((resolve) => server?.close(() => resolve()));
});

describe("Ship pay-elements read (category tabs + chips)", () => {
  it("GET /pay-elements → 200 with every category tab element and its code, glCode stripped", async () => {
    const r = await call("GET", "/pay-elements", { token: shipToken() });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const rows: any[] = r.body;
    // All six category-tab elements derivable, codes present (chips show
    // the code, never "?").
    for (const [uuid, code, category] of [
      [el.OT, `OT_${S}`, "overtime_variable"],
      [el.GOT, `GOT_${S}`, "overtime_fixed"],
      [el.ADV, `ADV_${S}`, "advance_recovery"],
      [el.ALLOT, `ALLOT_${S}`, "allotment"],
      [el.BOND, `BOND_${S}`, "bond_slop_chest"],
      [el.OTHER, `OTHER_${S}`, "one_off"],
    ] as const) {
      const row = rows.find((e) => e.payElementUuid === uuid);
      expect(row, `element ${code} present`).toBeTruthy();
      expect(row.code).toBe(code);
      expect(row.category).toBe(category);
      expect(row.status).toBe("active");
    }
    // GL account codes never leave the office.
    expect(rows.some((e) => "glCode" in e)).toBe(false);
  });

  it("office GET /pay-elements still includes glCode", async () => {
    const r = await call("GET", "/pay-elements", { token: officeToken() });
    expect(r.status).toBe(200);
    const row = (r.body as any[]).find((e) => e.payElementUuid === el.OT);
    expect(row?.glCode).toBe(`GL-OT-${S}`);
  });
});

describe("Ship config read (trimmed view)", () => {
  it("GET /config → 200 with ONLY the extra-tab fields", async () => {
    const r = await call("GET", "/config", { token: shipToken() });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(Object.keys(r.body).sort()).toEqual([
      "extraTab1Enabled",
      "extraTab1Label",
      "extraTab1PayElementUuid",
      "extraTab2Enabled",
      "extraTab2Label",
      "extraTab2PayElementUuid",
    ]);
  });

  it("PUT /config → 403 for Ship", async () => {
    const r = await call("PUT", "/config", { token: shipToken(), body: {} });
    expect(r.status).toBe(403);
  });
});

describe("Ship allotments read (own vessel only)", () => {
  it("GET /allotments?status=active returns own-vessel allotments and none from other vessels", async () => {
    const r = await call("GET", "/allotments?status=active", {
      token: shipToken(),
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const uuids = (r.body as any[]).map((a) => a.allotmentUuid);
    expect(uuids).toContain(allotOwn);
    // Allotment with NO explicit engagement link is still scoped correctly
    // via the crew's latest engagement vessel (enrichment fallback).
    expect(uuids).toContain(allotOwnFallback);
    expect(uuids).not.toContain(allotOther);
    for (const a of r.body as any[]) {
      expect(a.vesselUuid).toBe(SHIP_VESSEL);
    }
  });

  it("GET /allotments?vesselUuid=<other> → 403 scope error for Ship", async () => {
    const r = await call("GET", `/allotments?vesselUuid=${OTHER_VESSEL}`, {
      token: shipToken(),
    });
    expect(r.status).toBe(403);
  });

  it("Ship with NO vessels claim gets an empty list (fail-closed)", async () => {
    const bare = jwt.sign(
      { id: 990189, domain: "test", userType: "Ship", vessels: [] },
      TEST_SECRET,
      { expiresIn: "1h" },
    );
    const r = await call("GET", "/allotments?status=active", { token: bare });
    expect(r.status).toBe(200);
    expect(r.body).toEqual([]);
  });
});

describe("Ship wage-scale detail read (own vessel's scales only)", () => {
  it("GET /wage-scales/:uuid → 200 with lines for a scale referenced on own vessel", async () => {
    const r = await call("GET", `/wage-scales/${scaleOwn}`, {
      token: shipToken(),
    });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.scale?.scaleUuid).toBe(scaleOwn);
    const lines: any[] = r.body.lines;
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0].payElementUuid).toBe(el.OT);
    expect(lines[0].rate).toBeTruthy();
  });

  it("GET /wage-scales/:uuid → 403 for a scale NOT referenced on own vessel", async () => {
    const r = await call("GET", `/wage-scales/${scaleOther}`, {
      token: shipToken(),
    });
    expect(r.status).toBe(403);
    expect(String(r.body?.error)).toMatch(/not used on your vessel/i);
  });

  it("GET /wage-scales (list) stays 403 for Ship", async () => {
    const r = await call("GET", "/wage-scales", { token: shipToken() });
    expect(r.status).toBe(403);
  });
});

describe("office-only mutations stay refused for Ship", () => {
  const cases: Array<[string, string]> = [
    ["POST", "/pay-elements"],
    ["PUT", `/pay-elements/${el.OT}`],
    ["DELETE", `/pay-elements/${el.OT}`],
    ["POST", "/wage-scales"],
    ["PUT", `/wage-scales/${scaleOwn}`],
    ["DELETE", `/wage-scales/${scaleOwn}`],
    ["PUT", `/wage-scales/${scaleOwn}/lines`],
    ["POST", "/calc/run"],
    ["POST", "/calc/run-engagement"],
  ];
  for (const [method, path] of cases) {
    it(`${method} ${path} → 403 for Ship`, async () => {
      const r = await call(method, path, { token: shipToken(), body: {} });
      expect(r.status, JSON.stringify(r.body)).toBe(403);
    });
  }
});
