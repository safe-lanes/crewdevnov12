/**
 * PILOT TRIAL — direct endpoint checks (no assistant, no widget, no model). Version 2 (29-Oct-2026): expectations follow
 * Sahil's confirmed rules (A1 handover, A4 expired listed with expiring, A5 Rank Administration groups, A6 terminated
 * excluded / inactive included) and fixture v2 of setup-trial-dbs.ts.
 *
 * Expected values are written BY HAND from the fixture design (as-of 2026-11-01); they are not computed from the
 * database (expected-results.ts re-derives them with separate SQL). Needs both trial servers: single :6100
 * (crew_trial_a) and multi-tenant :6101 (crew_trial_master → crew_trial_a / crew_trial_b / crew_trial_c / inactive X).
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

  // ── on board (A1) ──
  let r = await as({ vessels: ["MV Alpha Star"] });
  check("A1 Alpha Star on board = 8 people / 8 assignments (planned reliever Kestrel not counted)", r.totals?.people === 8 && r.totals?.assignments === 8, r);
  r = await as({ vessels: ["mv beta ocean"] });
  check("A2 Beta Ocean = 7 people / 7 assignments (6 primary + Oswin, the signed-on reliever in handover)", r.totals?.people === 7 && r.totals?.assignments === 7, r);
  r = await as({});
  check("A3 fleet on board = 20 people / 20 assignments", r.totals?.people === 20 && r.totals?.assignments === 20, r);
  r = await as({ vessels: ["MV Gamma Bay"] });
  check("A4 Gamma Bay valid zero (ok, 0)", r.ok === true && r.totals?.people === 0, r);
  r = await as({ crewStatus: ["secondary"] });
  check("A14 secondary (signed-on relievers) fleet = 1 (Oswin)", r.totals?.people === 1 && r.totals?.assignments === 1, r);
  r = await as({ vessels: ["MV Beta Ocean"], crewStatus: ["primary"] });
  check("A14b Beta Ocean primary only = 6 (handover reliever excluded on request)", r.totals?.people === 6, r);
  r = await q(t, "crewing_find_crew", { name: "kestrel" });
  check("A17 planned reliever (not signed on) is found but has no vessel", r.total === 1 && r.matches?.[0]?.vesselName === null, r);
  r = await as({ ranks: ["Second Officer"] });
  check("A17b Second Officers on board = 1 (Corvina; Kestrel is only planned)", r.totals?.people === 1, r);

  // ── rank groups from Rank Administration (A5) ──
  r = await as({ rankGroups: ["engine_officers"] });
  check("A5 fleet engine officers (Eng Officer flag) = 7 people / 7 assignments", r.totals?.people === 7 && r.totals?.assignments === 7, r);
  check("A5b …and 2 on-board people hold ranks the Company tab does not classify (Gas Engineer, Deck Cadet)",
    r.rankConfig?.unclassifiedOnBoard?.people === 2 && JSON.stringify([...(r.rankConfig?.unclassifiedOnBoard?.ranks ?? [])].sort()) === JSON.stringify(["Deck Cadet", "Gas Engineer"]), r.rankConfig);
  check("A18 configured ranks without a category are named (local Company tab)",
    JSON.stringify(r.rankConfig?.unclassifiedConfiguredRanks) === JSON.stringify(["Deck Cadet", "Engine Cadet", "Fifth Engineer", "Gas Engineer", "Motorman", "Wiper"]) && !r.rankConfig?.issues, r.rankConfig);
  r = await as({ rankGroups: ["engineers"] });
  check("A12 'engineers' = engine officers → 7 people (Oiler, Bosun, Gas Engineer not counted)", r.totals?.people === 7 && r.totals?.assignments === 7, r);
  r = await as({ vessels: ["MV Beta Ocean"], rankGroups: ["engineers"] });
  check("A13 Beta Ocean engineers = 3 (Orrin, Petra, Quillon — Electrical Officer is flagged Eng Officer)", r.totals?.people === 3, r);
  r = await as({ vessels: ["MV Alpha Trader"], rankGroups: ["engineers"] });
  check("A13b Alpha Trader engineers = 1 (Tamsin) with 2 unclassified on board", r.totals?.people === 1 && r.rankConfig?.unclassifiedOnBoard?.people === 2, r);
  r = await as({ rankGroups: ["deck_ratings"] });
  check("A15 deck ratings = 2 (Bosun; AB_1 matched by name after the mistyped rank_id RO15)", r.totals?.people === 2, r);
  r = await as({ rankGroups: ["officers"] });
  check("A16 officers (Officer flag) = 14", r.totals?.people === 14, r);
  r = await as({ rankGroups: ["ratings"] });
  check("A16b ratings (Rating flag) = 4", r.totals?.people === 4, r);
  r = await as({ rankGroups: ["catering_ratings"] });
  check("A16c catering ratings = 1 (Chief Cook)", r.totals?.people === 1, r);
  r = await q(t, "crewing_query_assignments", { mode: "group", groupBy: ["rankGroup"] });
  const rg = Object.fromEntries((r.groups ?? []).map((g: any) => [g.rankGroup, g.people]));
  check("A19 group by rankGroup: deck_officers 7, engine_officers 7, deck_ratings 2, engine_ratings 1, catering_ratings 1, unclassified 2",
    rg.deck_officers === 7 && rg.engine_officers === 7 && rg.deck_ratings === 2 && rg.engine_ratings === 1 && rg.catering_ratings === 1 && rg.unclassified === 2, r.groups);

  r = await as({ nationalities: ["Indian"] });
  check("A6 nationality 'Indian' → 5 people", r.totals?.people === 5, r);
  r = await as({ ranks: ["Captain"] });
  check("A7 rank 'Captain' = Master → 3", r.totals?.people === 3, r);
  r = await as({ signOnWithin: { direction: "last", amount: 30, unit: "days" } });
  check("A8 signed on in last 30 days = 4 people / 4 assignments (Tobiah 1-Oct outside); 1 unreadable sign-on date reported",
    r.totals?.people === 4 && r.totals?.assignments === 4 && r.excluded?.unreadableSignOnDate === 1, r);
  r = await as({ hasDocument: { expiryWithin: next(30) } });
  check("A9 on board with a document expiring in 30 days (expired included by default) = 9 people; breakdown 2 expired / 7 upcoming",
    r.totals?.people === 9 && r.breakdown?.expired?.people === 2 && r.breakdown?.upcoming?.people === 7 && r.expiryWindow?.state === "expired_or_expiring", r);
  r = await as({ hasDocument: { expiryState: "not_expired", expiryWithin: next(30) } });
  check("A9b …upcoming only = 7 people", r.totals?.people === 7, r);

  r = await q(t, "crewing_query_assignments", { mode: "group", groupBy: ["nationality"] });
  const nat = Object.fromEntries((r.groups ?? []).map((g: any) => [g.nationality, g.people]));
  check("A10 group by nationality: INDIA 5, PHILIPPINES 8, UKRAINE 3, GB 3, CROATIA 1",
    nat.INDIA === 5 && nat.PHILIPPINES === 8 && nat.UKRAINE === 3 && nat["UNITED KINGDOM"] === 3 && nat.CROATIA === 1, r.groups);
  r = await q(t, "crewing_query_assignments", { mode: "group", groupBy: ["vesselName"], unit: "assignments" });
  const sumAssign = (r.groups ?? []).reduce((s: number, g: any) => s + g.assignments, 0);
  check("A11 property: sum of assignment groups (20) == total assignments", sumAssign === r.totals?.assignments && sumAssign === 20, r);

  // ── documents (A2, A4, A6) ──
  r = await ds({});
  check("D1 all documents = 24 docs / 18 people (archived licence, archived crew, 2 terminated crew excluded; inactive included)", r.totals?.documents === 24 && r.totals?.people === 18, r);
  r = await ds({ expiryState: "expired" });
  check("D2 expired = 3 docs / 3 people (incl. a 2024 training certificate)", r.totals?.documents === 3 && r.totals?.people === 3, r);
  r = await ds({ expiryWithin: next(30) });
  check("D3 expiring 30 days (default = expired + upcoming) = 13 docs / 12 people; breakdown 3 expired, 10 upcoming; excluded unreadable 1, missing 1",
    r.totals?.documents === 13 && r.totals?.people === 12 && r.breakdown?.expired?.documents === 3 && r.breakdown?.upcoming?.documents === 10 &&
    r.excluded?.unreadableExpiryDate === 1 && r.excluded?.noExpiryDate === 1 && r.query?.expiryState === "expired_or_expiring" && r.expiryWindow?.to === "2026-12-01", r);
  r = await ds({ expiryState: "not_expired", expiryWithin: next(30) });
  check("D3b upcoming only, 30 days = 10 / 10", r.totals?.documents === 10 && r.totals?.people === 10, r);
  r = await ds({ expiryWithin: next(60) });
  check("D4 expiring 60 days (default) = 18 docs / 14 people, 15 upcoming", r.totals?.documents === 18 && r.totals?.people === 14 && r.breakdown?.upcoming?.documents === 15, r);
  r = await ds({ expiryState: "not_expired", expiryWithin: next(60) });
  check("D4b upcoming only, 60 days = 15 docs / 12 people", r.totals?.documents === 15 && r.totals?.people === 12, r);
  r = await ds({ expiryWithin: next(2, "months") });
  check("D5 expiring 2 calendar months (default) = 19 docs (1-Jan-2027 boundary differs from 60 days)", r.totals?.documents === 19, r);
  r = await ds({ crewOnBoard: true, expiryWithin: next(60) });
  check("D6 on board, 60 days (default) = 14 docs / 11 people", r.totals?.documents === 14 && r.totals?.people === 11, r);
  r = await ds({ crewOnBoard: true, expiryState: "not_expired", expiryWithin: next(60) });
  check("D6b on board, 60 days, upcoming only = 12 docs / 9 people", r.totals?.documents === 12 && r.totals?.people === 9, r);
  r = await ds({ vessels: ["MV Beta Ocean"], rankGroups: ["engine_officers"], expiryWithin: next(60) });
  check("D7 Beta Ocean engineers, 60 days = 5 certificates held by 2 crew; no unclassified in that population", r.totals?.documents === 5 && r.totals?.people === 2 && r.rankConfig?.unclassifiedInResult?.people === 0, r);
  r = await ds({ vessels: ["MV Gamma Bay"], expiryWithin: next(60) });
  check("D8 Gamma Bay documents valid zero", r.ok === true && r.totals?.documents === 0, r);
  r = await ds({ documentNameContains: "fire", expiryWithin: next(60) });
  check("D9 'fire' courses expiring 60 days = 2", r.totals?.documents === 2, r);
  r = await ds({ documentNameContains: "Third Officer" });
  check("D15 terminated crew's CoC Third Officer is never listed → 0", r.ok === true && r.totals?.documents === 0, r);
  r = await ds({ documentNameContains: "Medical First Aid" });
  check("D15b inactive crew's Medical First Aid IS listed → 2 (Orrin + Rowena)", r.totals?.documents === 2, r);
  r = await q(t, "crewing_query_documents", { mode: "group", groupBy: ["expiryState"], expiryWithin: next(60) });
  const es = Object.fromEntries((r.groups ?? []).map((g: any) => [g.expiryState, g.documents]));
  check("D16 group by expiryState, 60 days: expired 3, upcoming 15", es.expired === 3 && es.upcoming === 15, r.groups);

  r = await q(t, "crewing_query_documents", { mode: "group", groupBy: ["vesselName"], crewOnBoard: true, expiryWithin: next(60) });
  const byV = Object.fromEntries((r.groups ?? []).map((g: any) => [g.vesselName, [g.documents, g.people]]));
  check("D10 by vessel (default): Alpha Star 4/4, Beta Ocean 7/4, Alpha Trader 3/3",
    JSON.stringify(byV["MV Alpha Star"]) === "[4,4]" && JSON.stringify(byV["MV Beta Ocean"]) === "[7,4]" && JSON.stringify(byV["MV Alpha Trader"]) === "[3,3]", r.groups);
  const sumDocs = (r.groups ?? []).reduce((s: number, g: any) => s + g.documents, 0);
  check("D11 property: sum of document groups == total documents (14)", sumDocs === r.totals?.documents && sumDocs === 14, r);

  // paging: stable, complete, no duplicates
  const seen = new Set<string>();
  let offset = 0;
  let pages = 0;
  let total = -1;
  while (offset !== null && pages < 10) {
    const p = await q(t, "crewing_query_documents", { mode: "list", expiryWithin: next(60), limit: 4, offset });
    total = p.total;
    for (const row of p.rows ?? []) seen.add(`${row.crewId}|${row.documentName}|${row.expiryDate}`);
    pages++;
    offset = p.nextOffset;
  }
  check("D12 paging 4+4+4+4+2: 5 pages, 18 distinct rows == total", pages === 5 && seen.size === 18 && total === 18, { pages, n: seen.size, total });
  let p1 = await q(t, "crewing_query_documents", { mode: "list", unit: "people", expiryState: "not_expired", expiryWithin: next(60) });
  check("D13 people list (upcoming only): 12 people, earliest first = Corvina (expires on the as-of day)", p1.total === 12 && p1.rows?.[0]?.fullName === "Corvina Tallowind", p1.rows?.[0]);
  p1 = await q(t, "crewing_query_documents", { mode: "list", unit: "people", expiryWithin: next(60) });
  check("D13b people list (default): 14 people, earliest first = Ulric (2024 expired), row marks expired documents",
    p1.total === 14 && p1.rows?.[0]?.fullName === "Ulric Penhallow" && p1.rows?.[0]?.expiredDocuments === 1 && /\(expired\)/.test(p1.rows?.[0]?.documentNames ?? ""), p1.rows?.[0]);
  const cnt = await ds({ expiryWithin: next(60) });
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
  r = await as({ rankGroups: ["cadets"] });
  check("U7 'cadets' is no longer a group (no category flag exists) → invalid_args", r.ok === false && r.code === "invalid_args", r);

  // injection / schema
  r = await ds({ documentNameContains: "x'; DELETE FROM crew_licenses; --" });
  const after = await ds({});
  check("S1 injection text is a value: 0 matches, documents still 24", r.ok === true && r.totals?.documents === 0 && after.totals?.documents === 24, r);
  r = await q(t, "crewing_query_documents", { mode: "list", limit: 50 });
  check("S2 limit 50 → invalid_args", r.ok === false && r.code === "invalid_args", r);
  r = await q(t, "crewing_query_documents", { mode: "list", sql: "select 1" });
  check("S3 unknown argument → invalid_args (strict schema)", r.ok === false && r.code === "invalid_args", r);
  r = await q(t, "crewing_query_documents", { mode: "group", groupBy: ["crew_uuid"] });
  check("S4 group key outside the allow-list → invalid_args", r.ok === false && r.code === "invalid_args", r);
  r = await ds({ documentNameContains: "", vessels: [], expiryState: "expired", expiryWithin: null });
  check("S6 empty optional values are ignored (not invalid, not zero): expired = 3", r.ok === true && r.totals?.documents === 3, r);
  r = await q(t, "crewing_run_sql", { sql: "select 1" });
  check("S5 unknown tool → unknown_tool", r.ok === false && r.code === "unknown_tool", r);
}

/** Part B (30-Oct-2026) — hand-derived from fixture v3, as-of 2026-11-01. */
async function partB(t: Target) {
  const av = (args: object) => q(t, "crewing_query_availability", { mode: "count", ...args });
  const rd = (args: object) => q(t, "crewing_query_relief_due", { mode: "count", ...args });
  const mn = (args: object) => q(t, "crewing_query_manning", { mode: "count", ...args });
  const rt = (args: object) => q(t, "crewing_query_rotation_approvals", { mode: "count", ...args });
  const rh = (args: object) => q(t, "crewing_query_rest_hours", { mode: "count", ...args });
  const ap = (args: object) => q(t, "crewing_query_appraisals", { mode: "count", ...args });

  // B1 availability
  let r = await av({});
  check("B1-1 available NOW = 1 (Ulric, available since 20-Oct); Verity (not for rehire), Rowena (inactive), Pelham (terminated) never",
    r.totals?.people === 1 && r.excluded?.noAvailabilityDate === 1, r);
  r = await av({ availableBy: "2026-11-30" });
  check("B1-2 available by 30-Nov = 3 (Ulric, Kestrel 5-Nov, Ilvar 15-Nov)", r.totals?.people === 3, r);
  r = await q(t, "crewing_query_availability", { mode: "list", availableWithin: next(2, "months") });
  check("B1-3 available within 2 months = 5 incl. Nadira ON BOARD with Next Availability 5-Dec (Sahil's case); earliest first = Ulric",
    r.totals?.people === 5 && r.rows?.some((x: any) => x.fullName === "Nadira Sklemmon" && x.crewStatus === "on_board") && r.rows?.[0]?.fullName === "Ulric Penhallow", r.rows);
  r = await av({ availableBy: "2026-12-31", ranks: ["Chief Officer"] });
  check("B1-4 Chief Officers available by 31-Dec = 3 (Ulric, Jorund, Nadira)", r.totals?.people === 3, r);
  r = await av({ availableBy: "2026-11-30", includeNotForHire: true });
  check("B1-5 …including not-for-rehire on request = 4 (Verity added)", r.totals?.people === 4, r);
  r = await av({ availableBy: "2026-11-30", crewStatus: ["on_board"] });
  check("B1-6 on-board crew available by 30-Nov = 0 (Nadira's date is 5-Dec)", r.ok === true && r.totals?.people === 0, r);
  r = await q(t, "crewing_query_availability", { mode: "list", availableWithin: { direction: "last", amount: 1, unit: "months" } });
  check("B1-7 a backward window → invalid_args", r.ok === false && r.code === "invalid_args", r);

  // B2 relief due (Due Crew rule)
  r = await rd({ dueState: "overdue" });
  check("B2-1 overdue = 2 (Aldric contract end 1-Oct, Marek 1-Oct); Hadrian without any date is in excluded.noDueDate", r.totals?.assignments === 2 && r.excluded?.noDueDate === 1, r);
  r = await rd({ dueWithin: next(1, "months") });
  check("B2-2 due within 1 month = 4 (Dagny 10-Nov, Nadira 20-Nov + 2 overdue)", r.totals?.assignments === 4, r);
  r = await q(t, "crewing_query_relief_due", { mode: "list", dueWithin: next(3, "months") });
  check("B2-3 due within 3 months = 9 incl. Corvina on the 1-Feb boundary; Aldric's recorded relief-due (20-Oct) differs from the contract end (1-Oct)",
    r.totals?.assignments === 9 && r.rows?.some((x: any) => x.fullName === "Aldric Vexmoor" && x.reliefDueDiffers === true && x.contractEndDate === "2026-10-01" && x.reliefDueDate === "2026-10-20") &&
    Array.isArray(r.notes) && /2 assignment/.test(r.notes[0]), r);
  r = await q(t, "crewing_query_relief_due", { mode: "list", vessels: ["MV Alpha Star"], ranks: ["2nd Engineer"] });
  check("B2-4 tolerance range: Elsbet contract end 1-Feb (sign-on + 5), range end 1-Apr (sign-on + 7), recorded 1-Mar → differs",
    r.rows?.[0]?.contractEndDate === "2027-02-01" && r.rows?.[0]?.rangeEndDate === "2027-04-01" && r.rows?.[0]?.reliefDueDiffers === true, r.rows?.[0]);
  r = await q(t, "crewing_query_relief_due", { mode: "group", groupBy: ["dueState"], dueWithin: next(1, "months"), dueState: "any" });
  const ds = Object.fromEntries((r.groups ?? []).map((g: any) => [g.dueState, g.assignments]));
  check("B2-5 group by dueState (1-month window, any): overdue 2, due 2, not_due 16", ds.overdue === 2 && ds.due === 2 && ds.not_due === 16, r.groups);

  // B5 manning
  r = await mn({});
  check("B5-1 positions on active vessels 22: filled 19, vacant 2 (Alpha Star 4th Engineer slot, Gamma Bay Master), vacant_not_signed_on 1 (Ilvar); inactive Epsilon Reef ignored",
    r.summary?.positions === 22 && r.summary?.filled === 19 && r.summary?.vacant === 2 && r.summary?.vacantNotSignedOn === 1, r.summary);
  r = await q(t, "crewing_query_manning", { mode: "list", state: "vacant" });
  check("B5-2 vacancies listed = 3 rows (2 empty + Ilvar planned-not-signed-on)", r.total === 3 && r.rows?.some((x: any) => x.state === "vacant_not_signed_on" && x.fullName === "Ilvar Strandquist"), r.rows);
  r = await mn({ vessels: ["MV Beta Ocean"] });
  check("B5-3 Beta Ocean: 6 positions all filled (the handover reliever is not an extra position)", r.summary?.positions === 6 && r.summary?.filled === 6, r.summary);
  r = await mn({ rankGroups: ["engineers"], state: "vacant" });
  check("B5-4 vacant engineer positions = 1 (Alpha Star 4th Engineer)", r.summary?.vacant === 1 && r.total === 1, r);

  // B4 rotation approvals
  r = await q(t, "crewing_query_rotation_approvals", { mode: "list" });
  check("B4-1 waiting plans = 2 (RP-2026-01 Proposed, RP-2026-02 Partially Approved); drafts 1; entries waiting 3 / approved 2 / rejected 1",
    r.total === 2 && r.summary?.waiting === 2 && r.summary?.drafts === 1 && r.rows?.reduce((s: number, x: any) => s + x.entriesWaiting, 0) === 3 &&
    r.rows?.reduce((s: number, x: any) => s + x.entriesApproved, 0) === 2 && r.rows?.reduce((s: number, x: any) => s + x.entriesRejected, 0) === 1, r);
  r = await rt({ vessels: ["MV Alpha Star"] });
  check("B4-2 waiting plans including Alpha Star = 1", r.total === 1, r);
  r = await rt({ status: "draft" });
  check("B4-3 drafts = 1 (RP-2026-03)", r.total === 1, r);
  r = await rt({ forMe: true });
  check("B4-4 'for me' as Sail Admin (holds the Rotation permission) = the 2 waiting plans + a note saying so", r.total === 2 && Array.isArray(r.notes) && /You hold it/.test(r.notes[0]), r);
  r = await q(t, "crewing_query_rotation_approvals", { mode: "count", forMe: true }, { ...A, userId: "6", role: "User" });
  check("B4-5 'for me' as a user WITHOUT the permission → refused by the Rotation view right or 0 with a note", (r.ok === false && r.code === "not_allowed") || (r.total === 0 && /does not hold/.test(r.notes?.[0] ?? "")), r);

  // B3 rest hours (live from daily records; stored totals never read)
  r = await rh({ months: ["2026-10"] });
  check("B3-1 Oct-2026 rest mode: 4 records with violations (Marek 3 days, Orrin 1 (code C), Rasmine 1, Dagny 2); violations 7; NCs 2; Petra's OPA-only day not counted",
    r.totals?.records === 4 && r.totals?.violations === 7 && r.totals?.ncs === 2 && r.opa === false && r.lastUpdated === "2026-10-31", r);
  r = await rh({ months: ["2026-10"], opa: true });
  check("B3-2 …with OPA: 5 records, violations 8 (Petra day 20, inside her applicable window from 15-Oct)", r.totals?.records === 5 && r.totals?.violations === 8, r);
  r = await rh({});
  check("B3-3 default month = the as-of month (2026-11) → 0 records, months echoed", r.ok === true && r.totals?.records === 0 && JSON.stringify(r.months) === JSON.stringify(["2026-11"]), r);
  r = await rh({ lastMonths: 3, vessels: ["MV Beta Ocean"] });
  check("B3-4 Beta Ocean last 3 months (Sep–Nov): 4 records (Marek Sep + Marek, Orrin, Rasmine Oct), violations 6", r.totals?.records === 4 && r.totals?.violations === 6, r);
  r = await q(t, "crewing_query_rest_hours", { mode: "group", groupBy: ["vesselName"], months: ["2026-10"] });
  const rv = Object.fromEntries((r.groups ?? []).map((g: any) => [g.vesselName, g.violations]));
  check("B3-5 group by vessel: Beta Ocean 5, Alpha Star 2", rv["MV Beta Ocean"] === 5 && rv["MV Alpha Star"] === 2, r.groups);
  r = await q(t, "crewing_query_rest_hours", { mode: "list", months: ["2026-10"], violationsOnly: false });
  check("B3-6 violationsOnly false lists all 6 Oct records", r.total === 6, r);

  // B6 appraisals
  r = await ap({ statusClass: "any" });
  check("B6-1 pending 3 (Benedek, Ulric, Nadira) / drafts 1 (Corvina) / completed 2 (Aldric, Orrin); terminated Pelham + archived Vesna excluded",
    r.summary?.pending === 3 && r.summary?.drafts === 1 && r.summary?.completed === 2 && r.totals?.appraisals === 6, r);
  r = await q(t, "crewing_query_appraisals", { mode: "list" });
  check("B6-2 default = pending list of 3, no score column", r.total === 3 && r.rows?.every((x: any) => !("overallScore" in x)), r.rows);
  r = await q(t, "crewing_query_appraisals", { mode: "list", statusClass: "completed", includeScores: true });
  check("B6-3 Sail Admin (Appraisals All): completed with scores — Aldric B, Orrin A; no competence rating, no remarks anywhere",
    r.total === 2 && r.rows?.find((x: any) => x.fullName === "Aldric Vexmoor")?.overallScore === "B" && r.rows?.find((x: any) => x.fullName === "Orrin Haverlock")?.overallScore === "A" &&
    !JSON.stringify(r).includes("CONFIDENTIAL") && !JSON.stringify(r).includes("competence"), r.rows);
  r = await q(t, "crewing_query_appraisals", { mode: "list", statusClass: "pending", includeScores: true });
  check("B6-4 scores requested on PENDING appraisals → rows carry null (Benedek's C is never shown)", r.total === 3 && r.rows?.every((x: any) => x.overallScore === null), r.rows);
  r = await q(t, "crewing_query_appraisals", { mode: "list", statusClass: "draft", includeScores: true });
  check("B6-5 draft score (Corvina B) never shown", r.total === 1 && r.rows?.[0]?.overallScore === null, r.rows);
  r = await q(t, "crewing_query_appraisals", { mode: "count", own: true });
  check("B6-6 'my appraisal' → identity_mapping_unavailable (no trusted login → crew link in Crewing)", r.ok === false && r.code === "identity_mapping_unavailable", r);
  r = await q(t, "crewing_query_appraisals", { mode: "count", statusClass: "completed", includeScores: true }, { ...A, userId: "6", role: "User" });
  check("B6-7 a 'User' (no Appraisals All right) asking for scores → not_allowed", r.ok === false && r.code === "not_allowed", r);
  r = await ap({ vessels: ["MV Beta Ocean"], statusClass: "any" });
  check("B6-8 vessel by RECORD (crew on board Beta Ocean): Orrin + Nadira = 2 appraisals", r.totals?.appraisals === 2, r);
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
  // assistant contract (agent.call_tool hands only `data` to the model): authenticated → {ok:true, data}
  const env1 = await call(t, tool, args, { who: A });
  const env2 = await call(t, tool, { mode: "count", vessels: ["MV Zeta"] }, { who: A });
  check("X11 envelope: success and refusal both arrive as {ok:true, data}; refusal code inside data",
    env1.raw?.ok === true && env1.raw?.data?.ok === true && env2.raw?.ok === true && env2.raw?.data?.code === "vessel_not_found", { env1: env1.raw?.ok, env2: env2.raw });
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
  check("I1 same vessel name in two companies: A sees 8, B sees 5", a.totals?.people === 8 && b.totals?.people === 5, { a: a.totals, b: b.totals });
  let r = await q(t, "crewing_query_assignments", { mode: "count", vessels: ["MV Delta Sky"] }, A);
  check("I2 A asking for B's vessel → vessel_not_found", r.ok === false && r.code === "vessel_not_found", r);
  r = await q(t, "crewing_find_crew", { name: "Orrin" }, B);
  check("I3 B searching A's crew name → 0 matches", r.ok === true && r.total === 0, r);
  r = await q(t, "crewing_query_documents", { mode: "count", expiryWithin: next(60) }, B);
  check("I4 B documents expiring 60 days = 2 (A has 18)", r.totals?.documents === 2, r);
  r = await q(t, "crewing_query_assignments", { mode: "count" }, B);
  check("I5 B fleet on board = 8 people / 9 assignments (INVALID-DATA case: one person signed on on two vessels)", r.totals?.people === 8 && r.totals?.assignments === 9, r);
  r = await q(t, "crewing_query_assignments", { mode: "list", unit: "people", ranks: ["Second Officer"] }, B);
  check("I6 …that person is listed once with 2 assignments and both vessels", r.total === 1 && r.rows?.[0]?.assignments === 2 && /Alpha Star.*Delta Sky|Delta Sky.*Alpha Star/.test(r.rows?.[0]?.vesselName ?? ""), r.rows?.[0]);
  // Part B isolation: company B's data never reaches company A and vice versa
  const avA = await q(t, "crewing_query_availability", { mode: "list", availableBy: "2026-11-30" }, A);
  const avB = await q(t, "crewing_query_availability", { mode: "list", availableBy: "2026-11-30" }, B);
  check("I7 availability by 30-Nov: A 3 (no Edric), B 1 (Edric only)", avA.total === 3 && !avA.rows?.some((x: any) => /Edric/.test(x.fullName)) && avB.total === 1 && /Edric/.test(avB.rows?.[0]?.fullName ?? ""), { a: avA.total, b: avB.rows });
  r = await q(t, "crewing_query_relief_due", { mode: "count", dueWithin: next(1, "months") }, B);
  check("I8 B relief due within 1 month = 1 (Xanthe 15-Nov)", r.totals?.assignments === 1, r);
  r = await q(t, "crewing_query_manning", { mode: "count" }, B);
  check("I9 B positions 9: filled 8, vacant 1 (Oiler)", r.summary?.positions === 9 && r.summary?.filled === 8 && r.summary?.vacant === 1, r.summary);
  r = await q(t, "crewing_query_rotation_approvals", { mode: "list" }, B);
  check("I10 B waiting plans = 1 (RP-B-2026-01); A's plans absent", r.total === 1 && r.rows?.[0]?.planId === "RP-B-2026-01", r.rows);
  r = await q(t, "crewing_query_rest_hours", { mode: "count", months: ["2026-10"] }, B);
  check("I11 B rest hours Oct = 1 record / 1 violation", r.totals?.records === 1 && r.totals?.violations === 1, r);
  r = await q(t, "crewing_query_appraisals", { mode: "list", statusClass: "completed", includeScores: true }, B);
  check("I12 B completed appraisal with score = Wendel B; A's crew absent", r.total === 1 && r.rows?.[0]?.fullName === "Wendel Crossfeather" && r.rows?.[0]?.overallScore === "B", r.rows);
  r = await q(t, "crewing_query_appraisals", { mode: "list", statusClass: "completed", includeScores: true, crewIds: ["00000000-0000-4000-a200-000000000001"] }, B);
  check("I13 B asking for A's crew id (Aldric) → nothing (0 appraisals), never a cross-company score", r.ok === true && r.total === 0, r);
}

async function external(t: Target) {
  const E = { ...A, userId: "8", role: "External 1" };
  let r = await q(t, "crewing_query_documents", { mode: "count", expiryState: "expired" }, E);
  check("E1 External 1 (CP Training Certificates only): documents without vessel facts allowed", r.ok === true && r.totals?.documents === 3, r);
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
    await partB(mt);
    await security(mt, single);
    await isolation(mt);
    const s1 = await q(single, "crewing_query_assignments", { mode: "count" }, {});
    check("T1 single-tenant instance (crew_trial_a) fleet = 20 people", s1.totals?.people === 20, s1);
  }
  const failed = results.filter((r) => !r.pass);
  for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : "  → " + r.detail}`);
  console.log(`\n${results.length - failed.length}/${results.length} passed (phase ${phase})`);
  process.exit(failed.length ? 1 : 0);
})();
