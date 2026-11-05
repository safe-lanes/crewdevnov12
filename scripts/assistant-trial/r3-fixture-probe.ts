/**
 * PILOT TRIAL (Astra round 3) — verifies, DIRECTLY against Crewing (no model), the expected values written into
 * test-set-context-r3.json before the chat runs: the primary-only vs primary+secondary difference and the other totals.
 * Usage: npx tsx scripts/assistant-trial/r3-fixture-probe.ts
 */
import { call, targets } from "./trialClient";

const t = targets().single;
const W60 = { direction: "next", amount: 60, unit: "days" };
const cases: [string, string, Record<string, unknown>, (d: Record<string, any>) => boolean][] = [
  ["Beta engineers on board (primary+secondary) people=4", "crewing_query_assignments", { mode: "count", vessels: ["MV Beta Ocean"], rankGroups: ["engineers"] }, (d) => d.totals?.people === 4],
  ["Beta engineers primary only people=3", "crewing_query_assignments", { mode: "count", vessels: ["MV Beta Ocean"], rankGroups: ["engineers"], crewStatus: ["primary"] }, (d) => d.totals?.people === 3],
  ["Fleet engineers on board people=7", "crewing_query_assignments", { mode: "count", rankGroups: ["engineers"] }, (d) => d.totals?.people === 7],
  ["Everyone on board people=16", "crewing_query_assignments", { mode: "count" }, (d) => d.totals?.people === 16],
  ["Alpha Star on board people=8, 5 per page", "crewing_query_assignments", { mode: "list", vessels: ["MV Alpha Star"], limit: 5 }, (d) => d.totals?.people === 8 && d.returned === 5 && d.nextOffset === 5],
  ["Alpha Star page 2 returned=3", "crewing_query_assignments", { mode: "list", vessels: ["MV Alpha Star"], limit: 5, offset: 5 }, (d) => d.returned === 3 && d.nextOffset === null],
  ["Gamma Bay on board people=0", "crewing_query_assignments", { mode: "count", vessels: ["MV Gamma Bay"] }, (d) => d.totals?.people === 0],
  ["Alpha Trader on board people=2", "crewing_query_assignments", { mode: "count", vessels: ["MV Alpha Trader"] }, (d) => d.totals?.people === 2],
  ["Beta engineers docs expiring 60d people=2 docs=5", "crewing_query_documents", { mode: "count", vessels: ["MV Beta Ocean"], rankGroups: ["engineers"], expiryState: "not_expired", expiryWithin: W60 }, (d) => d.totals?.people === 2 && d.totals?.documents === 5],
  ["Alpha engineers docs expiring 60d docs=0", "crewing_query_documents", { mode: "count", vessels: ["MV Alpha Star"], rankGroups: ["engineers"], expiryState: "not_expired", expiryWithin: W60 }, (d) => d.totals?.documents === 0],
  ["Alpha engineers expired docs=1", "crewing_query_documents", { mode: "count", vessels: ["MV Alpha Star"], rankGroups: ["engineers"], expiryState: "expired" }, (d) => d.totals?.documents === 1],
  ["Beta engineers training expiring 2 months people=2", "crewing_query_documents", { mode: "count", vessels: ["MV Beta Ocean"], rankGroups: ["engineers"], documentTypes: ["training"], expiryState: "not_expired", expiryWithin: { direction: "next", amount: 2, unit: "months" } }, (d) => d.totals?.people === 2],
];
(async () => {
  let pass = 0;
  for (const [label, tool, args, ok] of cases) {
    const r = await call(t, tool, args);
    const good = r.status === 200 && r.body?.ok === true && ok(r.body);
    pass += good ? 1 : 0;
    console.log(`${good ? "PASS" : "FAIL"} ${label}  → totals=${JSON.stringify(r.body?.totals)} returned=${r.body?.returned ?? "-"} next=${r.body?.nextOffset ?? "-"} code=${r.body?.code ?? "-"}`);
  }
  console.log(`fixture probe: ${pass}/${cases.length}`);
})();
