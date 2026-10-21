/**
 * PILOT TRIAL — direct endpoint checks (no assistant, no widget, no model).
 *
 * Expected values are written BY HAND from the fixture design in setup-trial-dbs.ts (as-of 2026-11-01); they are
 * not computed from the database. Needs both trial servers (see the trial report): single :6100 (crew_trial_a) and
 * multi-tenant :6101 (crew_trial_master → crew_trial_a / crew_trial_b / inactive X).
 *
 * Usage: npx tsx scripts/assistant-trial/direct-checks.ts [--phase=external]   (external = server started with
 *        ASSISTANT_ALLOWED_ROLES="Sail Admin,External 1" to test per-area menu permissions)
 */
import { call, manifest, mint, targets, type Target } from "./trialClient";

const results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail?: unknown) {
  results.push({ name, pass, detail: pass ? undefined : JSON.stringify(detail)?.slice(0, 600) });
}
const A = { tenantDomain: "trial-a.local", tuid: "crew_trial_a" };
const B = { tenantDomain: "trial-b.local", tuid: "crew_trial_b" };
const next = (amount: number, unit: "days" | "months" = "days") => ({ direction: "next", amount, unit });

async function q(t: Target, tool: string, args: unknown, who: object = A) {
  return (await call(t, tool, args, { who })).body;
}

async function counts(t: Target) {
  const as = (args: object) => q(t, "crewing_query_assignments", { mode: "count", ...args });
  const ds = (args: object) => q(t, "crewing_query_documents", { mode: "count", ...args });

  let r = await as({ vessels: ["MV Alpha Star"] });
  check("A1 Alpha Star on board = 8 people / 8 assignments", r.totals?.people === 8 && r.totals?.assignments === 8, r);
  r = await as({ vessels: ["mv beta ocean"] });
  check("A2 Beta Ocean = 7 people / 7 assignments (incl. one secondary)", r.totals?.people === 7 && r.totals?.assignments === 7, r);
  r = await as({});
  check("A3 fleet on board = 16 people / 17 assignments", r.totals?.people === 16 && r.totals?.assignments === 17, r);
  r = await as({ vessels: ["MV Gamma Bay"] });
  check("A4 Gamma Bay valid zero (ok, 0)", r.ok === true && r.totals?.people === 0, r);
  r = await as({ rankGroups: ["engine_officers"] });
  check("A5 fleet engine officers = 7 people / 8 assignments", r.totals?.people === 7 && r.totals?.assignments === 8, r);
  r = await as({ nationalities: ["Indian"] });
  check("A6 nationality 'Indian' → 5 people", r.totals?.people === 5, r);
  r = await as({ ranks: ["Captain"] });
  check("A7 rank 'Captain' = Master → 3", r.totals?.people === 3, r);
  r = await as({ signOnWithin: { direction: "last", amount: 30, unit: "days" } });
  check("A8 signed on in last 30 days = 3 people / 4 assignments; 1 unreadable sign-on date reported",
    r.totals?.people === 3 && r.totals?.assignments === 4 && r.excluded?.unreadableSignOnDate === 1, r);
  r = await as({ hasDocument: { expiryState: "not_expired", expiryWithin: next(30) } });
  check("A9 on board with a document expiring in 30 days = 5 people", r.totals?.people === 5, r);

  r = await q(t, "crewing_query_assignments", { mode: "group", groupBy: ["nationality"] });
  const nat = Object.fromEntries((r.groups ?? []).map((g: any) => [g.nationality, g.people]));
  check("A10 group by nationality: INDIA 5, PHILIPPINES 5, UKRAINE 3, GB 2, CROATIA 1",
    nat.INDIA === 5 && nat.PHILIPPINES === 5 && nat.UKRAINE === 3 && nat["UNITED KINGDOM"] === 2 && nat.CROATIA === 1, r.groups);
  r = await q(t, "crewing_query_assignments", { mode: "group", groupBy: ["vesselName"], unit: "assignments" });
  const sumAssign = (r.groups ?? []).reduce((s: number, g: any) => s + g.assignments, 0);
  check("A11 property: sum of assignment groups (17) == total assignments", sumAssign === r.totals?.assignments && sumAssign === 17, r);

  r = await ds({});
  check("D1 all documents = 18 docs / 14 people (archived licence + archived crew excluded)", r.totals?.documents === 18 && r.totals?.people === 14, r);
  r = await ds({ expiryState: "expired" });
  check("D2 expired = 2 docs / 2 people", r.totals?.documents === 2 && r.totals?.people === 2, r);
  r = await ds({ expiryState: "not_expired", expiryWithin: next(30) });
  check("D3 expiring 30 days = 7 / 7; excluded unreadable 1, missing 1",
    r.totals?.documents === 7 && r.totals?.people === 7 && r.excluded?.unreadableExpiryDate === 1 && r.excluded?.noExpiryDate === 1, r);
  r = await ds({ expiryState: "not_expired", expiryWithin: next(60) });
  check("D4 expiring 60 days = 10 docs / 7 people", r.totals?.documents === 10 && r.totals?.people === 7, r);
  r = await ds({ expiryState: "not_expired", expiryWithin: next(2, "months") });
  check("D5 expiring 2 calendar months = 11 docs (1-Jan-2027 boundary differs from 60 days)", r.totals?.documents === 11, r);
  r = await ds({ crewOnBoard: true, expiryState: "not_expired", expiryWithin: next(60) });
  check("D6 on board, 60 days = 8 docs / 5 people", r.totals?.documents === 8 && r.totals?.people === 5, r);
  r = await ds({ vessels: ["MV Beta Ocean"], rankGroups: ["engine_officers"], expiryState: "not_expired", expiryWithin: next(60) });
  check("D7 Beta Ocean engineers, 60 days = 5 certificates held by 2 crew", r.totals?.documents === 5 && r.totals?.people === 2, r);
  r = await ds({ vessels: ["MV Gamma Bay"], expiryState: "not_expired", expiryWithin: next(60) });
  check("D8 Gamma Bay documents valid zero", r.ok === true && r.totals?.documents === 0, r);
  r = await ds({ documentNameContains: "fire", expiryState: "not_expired", expiryWithin: next(60) });
  check("D9 'fire' courses expiring 60 days = 2", r.totals?.documents === 2, r);

  r = await q(t, "crewing_query_documents", { mode: "group", groupBy: ["vesselName"], crewOnBoard: true, expiryState: "not_expired", expiryWithin: next(60) });
  const byV = Object.fromEntries((r.groups ?? []).map((g: any) => [g.vesselName, [g.documents, g.people]]));
  check("D10 by vessel: Alpha Star 2/2, Beta Ocean 5/2, Alpha Trader 1/1",
    JSON.stringify(byV["MV Alpha Star"]) === "[2,2]" && JSON.stringify(byV["MV Beta Ocean"]) === "[5,2]" && JSON.stringify(byV["MV Alpha Trader"]) === "[1,1]", r.groups);
  const sumDocs = (r.groups ?? []).reduce((s: number, g: any) => s + g.documents, 0);
  check("D11 property: sum of document groups == total documents (8)", sumDocs === r.totals?.documents && sumDocs === 8, r);

  // paging: stable, complete, no duplicates
  const seen = new Set<string>();
  let offset = 0;
  let pages = 0;
  let total = -1;
  while (offset !== null && pages < 10) {
    const p = await q(t, "crewing_query_documents", { mode: "list", expiryState: "not_expired", expiryWithin: next(60), limit: 4, offset });
    total = p.total;
    for (const row of p.rows ?? []) seen.add(`${row.crewId}|${row.documentName}|${row.expiryDate}`);
    pages++;
    offset = p.nextOffset;
  }
  check("D12 paging 4+4+2: 3 pages, 10 distinct rows == total", pages === 3 && seen.size === 10 && total === 10, { pages, n: seen.size, total });
  const p1 = await q(t, "crewing_query_documents", { mode: "list", unit: "people", expiryState: "not_expired", expiryWithin: next(60) });
  check("D13 people list: 7 people, earliest first = Benedek (5-Nov)", p1.total === 7 && p1.rows?.[0]?.fullName === "Benedek Quorrlyn", p1.rows?.[0]);
  const cnt = await ds({ expiryState: "not_expired", expiryWithin: next(60) });
  check("D14 property: count mode total == list mode total", cnt.total === total, { cnt: cnt.total, total });

  // unknown / ambiguous are never zero
  r = await as({ vessels: ["MV Zeta"] });
  check("U1 unknown vessel → vessel_not_found", r.ok === false && r.code === "vessel_not_found", r);
  r = await as({ vessels: ["Alpha"] });
  check("U2 'Alpha' → vessel_ambiguous with 2 candidates", r.ok === false && r.code === "vessel_ambiguous" && r.details?.candidates?.length === 2, r);
  r = await as({ ranks: ["Admiral"] });
  check("U3 unknown rank → rank_not_recognised", r.ok === false && r.code === "rank_not_recognised", r);
  r = await as({ nationalities: ["Martian"] });
  check("U4 unknown nationality → nationality_not_recognised", r.ok === false && r.code === "nationality_not_recognised", r);
  r = await q(t, "crewing_find_crew", { name: "orrin" });
  check("U5 find_crew 'orrin' → 1 match on Beta Ocean", r.total === 1 && r.matches?.[0]?.vesselName === "MV Beta Ocean", r);
  r = await q(t, "crewing_resolve_vessel", { name: "alpha" });
  check("U6 resolve 'alpha' → 2 matches", r.total === 2, r);

  // injection / schema
  r = await ds({ documentNameContains: "x'; DELETE FROM crew_licenses; --" });
  const after = await ds({});
  check("S1 injection text is a value: 0 matches, documents still 18", r.ok === true && r.totals?.documents === 0 && after.totals?.documents === 18, r);
  r = await q(t, "crewing_query_documents", { mode: "list", limit: 50 });
  check("S2 limit 50 → invalid_args", r.ok === false && r.code === "invalid_args", r);
  r = await q(t, "crewing_query_documents", { mode: "list", sql: "select 1" });
  check("S3 unknown argument → invalid_args (strict schema)", r.ok === false && r.code === "invalid_args", r);
  r = await q(t, "crewing_query_documents", { mode: "group", groupBy: ["crew_uuid"] });
  check("S4 group key outside the allow-list → invalid_args", r.ok === false && r.code === "invalid_args", r);
  r = await q(t, "crewing_run_sql", { sql: "select 1" });
  check("S5 unknown tool → unknown_tool", r.ok === false && r.code === "unknown_tool", r);
}

async function security(t: Target, s: Target) {
  const args = { mode: "count" };
  const tool = "crewing_query_assignments";
  const st = async (o: Parameters<typeof call>[3]) => (await call(t, tool, args, o)).status;
  check("X1 no secret → 401", (await st({ secret: null, who: A })) === 401);
  check("X2 wrong secret → 401", (await st({ secret: "nope", who: A })) === 401);
  check("X3 no identity → 401", (await st({ token: null })) === 401);
  const good = mint(t, A);
  const tampered = good.slice(0, 10) + (good[10] === "A" ? "B" : "A") + good.slice(11);
  check("X4 tampered identity → 401", (await st({ token: tampered })) === 401);
  check("X5 expired identity (-200 s) → 401", (await st({ who: { ...A, ttlSec: -200 } })) === 401);
  check("X6 identity signed with another instance's key → 401", (await st({ token: mint(s, A) })) === 401);
  check("X7 right key, wrong issuer → 401", (await st({ who: { ...A, iss: "crewing-dev" } })) === 401);
  check("X8 identity domain A with tuid B → 401", (await st({ who: { tenantDomain: "trial-a.local", tuid: "crew_trial_b" } })) === 401);
  const browser = await fetch(`${t.base}/assistant/execute`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer x.y.z" }, body: JSON.stringify({ tool, args }) });
  check("X9 browser-style Bearer call → 401", browser.status === 401);
  check("X10 manifest without secret → 401", (await manifest(t, null)).status === 401);
  const ref = async (who: object) => (await call(t, tool, args, { who })).body;
  let r = await ref({ ...A, userId: "37", userType: "Ship", role: "Vessel Admin" });
  check("R1 Ship user → 200 not_allowed", r.ok === false && r.code === "not_allowed", r);
  r = await ref({ ...A, userId: "6", role: "Sail Admin" });
  check("R2 token says Sail Admin but user 6 is 'User' → not_allowed (server re-check)", r.ok === false && r.code === "not_allowed", r);
  r = await ref({ ...A, userId: "99999" });
  check("R3 unknown user → not_allowed (role unresolved)", r.ok === false && r.code === "not_allowed", r);
  r = await ref({ tenantDomain: "trial-x.local" });
  check("R4 inactive company X → company_unavailable", r.ok === false && r.code === "company_unavailable", r);
  r = await ref({ tenantDomain: "nobody.local" });
  check("R5 unknown company → company_unavailable", r.ok === false && r.code === "company_unavailable", r);
  r = await ref({ tenantDomain: null });
  check("R6 no company in identity (multi-tenant) → company_unavailable", r.ok === false && r.code === "company_unavailable", r);
}

async function isolation(t: Target) {
  const a = await q(t, "crewing_query_assignments", { mode: "count", vessels: ["MV Alpha Star"] }, A);
  const b = await q(t, "crewing_query_assignments", { mode: "count", vessels: ["MV Alpha Star"] }, B);
  check("I1 same vessel name in two companies: A sees 8, B sees 4", a.totals?.people === 8 && b.totals?.people === 4, { a: a.totals, b: b.totals });
  let r = await q(t, "crewing_query_assignments", { mode: "count", vessels: ["MV Delta Sky"] }, A);
  check("I2 A asking for B's vessel → vessel_not_found", r.ok === false && r.code === "vessel_not_found", r);
  r = await q(t, "crewing_find_crew", { name: "Orrin" }, B);
  check("I3 B searching A's crew name → 0 matches", r.ok === true && r.total === 0, r);
  r = await q(t, "crewing_query_documents", { mode: "count", expiryState: "not_expired", expiryWithin: next(60) }, B);
  check("I4 B documents expiring 60 days = 2 (A has 10)", r.totals?.documents === 2, r);
  r = await q(t, "crewing_query_assignments", { mode: "count" }, B);
  check("I5 B fleet on board = 7", r.totals?.people === 7, r);
}

async function external(t: Target) {
  const E = { ...A, userId: "8", role: "External 1" };
  let r = await q(t, "crewing_query_documents", { mode: "count", expiryState: "expired" }, E);
  check("E1 External 1 (CP Training Certificates only): documents without vessel facts allowed", r.ok === true && r.totals?.documents === 2, r);
  r = await q(t, "crewing_query_documents", { mode: "list", expiryState: "expired" }, E);
  check("E2 …and its rows carry no vessel name", r.ok === true && r.rows?.every((x: any) => x.vesselName === null), r.rows);
  r = await q(t, "crewing_query_documents", { mode: "count", crewOnBoard: true }, E);
  check("E3 documents + on-board filter needs Vessel → not_allowed", r.ok === false && r.code === "not_allowed", r);
  r = await q(t, "crewing_query_assignments", { mode: "count" }, E);
  check("E4 assignments need Vessel → not_allowed", r.ok === false && r.code === "not_allowed", r);
  r = await q(t, "crewing_query_assignments", { mode: "count", hasDocument: { expiryState: "expired" } }, E);
  check("E5 combined assignments+documents → not_allowed (every area checked)", r.ok === false && r.code === "not_allowed", r);
}

(async () => {
  const { single, mt } = targets();
  const phase = process.argv.find((x) => x.startsWith("--phase="))?.split("=")[1] ?? "main";
  if (phase === "external") {
    await external(mt);
  } else {
    await counts(mt);
    await security(mt, single);
    await isolation(mt);
    const s1 = await q(single, "crewing_query_assignments", { mode: "count" }, {});
    check("T1 single-tenant instance (crew_trial_a) fleet = 16 people", s1.totals?.people === 16, s1);
  }
  const failed = results.filter((r) => !r.pass);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "  → " + r.detail}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed (phase ${phase})`);
  process.exit(failed.length ? 1 : 0);
})();
