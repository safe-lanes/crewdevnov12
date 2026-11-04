/**
 * PILOT TRIAL — realistic-volume check (30-Oct-2026). Builds crew_trial_v (TEMPLATE of the local schema, business data wiped,
 * then GENERATED synthetic rows named "VOL …") and times every live-data tool through the multi-tenant trial server.
 *
 *   60 vessels · 4,000 crew · ~1,500 on-board assignments + empty slots · 16,000 licences/training · 1,200 rest-hour
 *   person-months · 300 rotation plans · 2,000 appraisals
 *
 * Usage: DATABASE_URL=<local admin url> npx tsx scripts/assistant-trial/volume-check.ts build
 *        npx tsx scripts/assistant-trial/volume-check.ts run        (needs the MT server :6101; tenant trial-v.local)
 * Refuses any database not starting with crew_trial_. Writes results/volume-check.json.
 */
import { Client } from "pg";
import { writeFileSync } from "fs";
import { call, targets } from "./trialClient";
import { dailyRecordsJson } from "./setup-trial-dbs";

const TEMPLATE = process.env.TRIAL_TEMPLATE_DB || "crew_management_local";
const DB = "crew_trial_v";
const KEEP = (t: string) =>
  (t.startsWith("adm_") || (t.startsWith("master_") && !t.startsWith("master_vessels"))) ||
  ["schema_migrations", "data_masters", "id_counters", "company_ranks", "oil_major_rules", "promo_criteria_master_v2", "alert_policies_v2"].includes(t);
const RANKS = [["Master", "R001"], ["Chief Officer", "R002"], ["2nd Officer", "R003"], ["3rd Officer", "R004"], ["Chief Engineer", "R005"], ["2nd Engineer", "R006"],
  ["3rd Engineer", "R007"], ["4th Engineer", "R008"], ["Electrical Officer", "R010"], ["Bosun", "R014"], ["AB_1", "R015"], ["OS_1", "R016"], ["Fitter", "R018"],
  ["Oiler_1", "R021"], ["Chief Cook", "R022"], ["Messman", "R023"]];
const id = (k: string, n: number) => `00000000-0000-4000-e${k}00-${String(n).padStart(12, "0")}`;
const day = (base: string, plus: number) => new Date(Date.parse(base + "T00:00:00Z") + plus * 86400000).toISOString().slice(0, 10);

function urlFor(db: string) { const u = new URL(process.env.DATABASE_URL || ""); u.pathname = `/${db}`; return u.toString(); }
async function withClient<T>(db: string, fn: (c: Client) => Promise<T>) { const c = new Client({ connectionString: urlFor(db) }); await c.connect(); try { return await fn(c); } finally { await c.end(); } }

async function build() {
  if (!DB.startsWith("crew_trial_")) throw new Error("refusing");
  await withClient("postgres", async (c) => {
    await c.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ($1,$2) AND pid <> pg_backend_pid()`, [DB, TEMPLATE]);
    await c.query(`DROP DATABASE IF EXISTS "${DB}"`);
    await c.query(`CREATE DATABASE "${DB}" TEMPLATE "${TEMPLATE}"`);
  });
  await withClient("crew_trial_master", (c) => c.query(`INSERT INTO tenants (tuid, domain, company_name, is_active) VALUES ('crew_trial_v','trial-v.local','Trial Company V (volume)',true) ON CONFLICT (tuid) DO NOTHING`));
  await withClient(DB, async (c) => {
    const { rows } = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
    await c.query(`TRUNCATE ${rows.map((r) => r.table_name as string).filter((n) => !KEEP(n)).map((n) => `"${n}"`).join(", ")} RESTART IDENTITY CASCADE`);
    const user = String((await c.query(`SELECT user_uuid FROM master_users ORDER BY id LIMIT 1`)).rows[0]?.user_uuid);
    await c.query("BEGIN");
    for (let v = 1; v <= 60; v++) await c.query(`INSERT INTO master_vessels (vessel_uuid, vessel, imo_number, is_active, is_deleted) VALUES ($1,$2,$3,true,false)`, [id("1", v), `VOL Vessel ${String(v).padStart(2, "0")}`, `95${String(v).padStart(5, "0")}`]);
    let plan = 0, lic = 0, trn = 0;
    for (let n = 1; n <= 4000; n++) {
      const [rank] = RANKS[n % RANKS.length];
      const onBoard = n <= 1440; // 60 vessels × 24 people
      const status = n % 97 === 0 ? "Terminated" : n % 41 === 0 ? "inactive" : "active";
      await c.query(`INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, present_rank, status, is_active, is_deleted, availability, next_availability, not_for_hire)
        VALUES ($1,$2,'VOL',$3,$4,$5,$6,false,$7,$8,$9)`, [id("2", n), `VOL-${n}`, `Crew${n}`, rank.replace(/_\d+$/, ""), status, status === "active",
        !onBoard && n % 3 === 0 ? day("2026-10-01", n % 90) : null, onBoard && n % 10 === 0 ? day("2026-11-01", n % 120) : null, n % 53 === 0]);
      if (onBoard) {
        plan++;
        const [r, rid] = RANKS[(n - 1) % 24 < RANKS.length ? (n - 1) % 24 % RANKS.length : 0];
        await c.query(`INSERT INTO vessel_planning_v2 (plan_uuid, vessel_uuid, rank_id, rank, crew_uuid, crew_status, sign_on_date, relief_due, contract_period_months, is_archived, is_deleted)
          VALUES ($1,$2,$3,$4,$5,'primary',$6,$7,6,false,false)`, [id("3", plan), id("1", Math.ceil(n / 24)), rid, r, id("2", n), day("2026-04-01", n % 200), day("2026-10-01", n % 200)]);
      }
      for (let d = 0; d < 4; d++) {
        const exp = day("2026-06-01", (n * 7 + d * 61) % 700);
        if (d % 2 === 0) { lic++; await c.query(`INSERT INTO crew_licenses (lic_uuid, crew_uuid, certificate_document, expiry, is_deleted) VALUES ($1,$2,$3,$4,false)`, [id("4", lic), id("2", n), `VOL Licence ${d}`, exp]); }
        else { trn++; await c.query(`INSERT INTO crew_training_courses (train_uuid, crew_uuid, training_course, expiry, is_deleted) VALUES ($1,$2,$3,$4,false)`, [id("5", trn), id("2", n), `VOL Course ${d}`, d === 3 && n % 5 === 0 ? "" : exp]); }
      }
    }
    for (let v = 1; v <= 60; v++) for (let k = 0; k < 2; k++) { plan++; await c.query(`INSERT INTO vessel_planning_v2 (plan_uuid, vessel_uuid, rank_id, rank, crew_status, is_archived, is_deleted) VALUES ($1,$2,'R018','Fitter','primary',false,false)`, [id("3", plan), id("1", v)]); }
    for (let r = 1; r <= 1200; r++) {
      const n = ((r - 1) % 1440) + 1;
      const month = ["2026-08", "2026-09", "2026-10"][Math.floor((r - 1) / 400)];
      const days: Record<number, string[]> = {};
      if (r % 3 === 0) { days[3] = ["A"]; days[9] = ["G"]; }
      if (r % 7 === 0) days[15] = ["C"];
      if (r % 11 === 0) days[20] = ["H"];
      await c.query(`INSERT INTO rh_daily_records_v2 (rh_daily_uuid, crew_member_id, vessel_id, rank, name, month_year, daily_records, opa_mode, updated_at, is_deleted)
        VALUES ($1,$2,$3,'AB','VOL Crew',$4,$5,false,now(),false)`, [id("a", r), id("2", n), id("1", Math.ceil(n / 24)), month, dailyRecordsJson(month, days)]);
    }
    for (let p = 1; p <= 300; p++) {
      await c.query(`INSERT INTO rotation_drafts_v2 (draft_uuid, draft_id, plan_from_date, plan_to_date, plan_status, proposed_by_uuid, proposed_date, is_deleted) VALUES ($1,$2,'2026-11-01','2027-01-31',$3,$4,'2026-10-20',false)`,
        [id("6", p), `VOL-RP-${p}`, ["Proposed", "Partially Approved", "In Draft", "Archived"][p % 4], user]);
      await c.query(`INSERT INTO rotation_draft_vessels_v2 (rv_uuid, draft_uuid, vessel_uuid, is_deleted) VALUES ($1,$2,$3,false)`, [id("7", p), id("6", p), id("1", (p % 60) + 1)]);
      for (let e = 0; e < 5; e++) await c.query(`INSERT INTO rotation_entries_v2 (entry_uuid, draft_uuid, vessel_uuid, rank, proposal_status, is_deleted) VALUES ($1,$2,$3,'Master',$4,false)`,
        [id("8", p * 10 + e), id("6", p), id("1", (p % 60) + 1), ["Pending", "Deployed", "Rejected"][e % 3]]);
    }
    for (let a = 1; a <= 2000; a++) {
      const st = ["draft", "preliminary", "pending_review", "reviewed"][a % 4];
      await c.query(`INSERT INTO appraisal_results_v2 (appraisal_uuid, crew_member_id, appraisal_type, appraisal_date, status, overall_rating, submitted_by, form_version_id, form_version_uuid, is_deleted)
        VALUES ($1,$2,'Annual',$3,$4,'B',$5,$6,$7,false)`, [id("b", a), id("2", ((a - 1) % 4000) + 1), day("2026-01-01", a % 300), st, user, st === "draft" ? null : 1, st === "draft" ? null : id("d", 1)]);
    }
    await c.query("COMMIT");
    await c.query("ANALYZE");
    const k = await c.query(`SELECT (SELECT count(*) FROM crew_members_v2) crew, (SELECT count(*) FROM vessel_planning_v2) plans, (SELECT count(*) FROM crew_licenses)+(SELECT count(*) FROM crew_training_courses) docs,
      (SELECT count(*) FROM rh_daily_records_v2) rh, (SELECT count(*) FROM rotation_drafts_v2) rot, (SELECT count(*) FROM appraisal_results_v2) appr`);
    console.log(DB, JSON.stringify(k.rows[0]));
  });
}

async function run() {
  const t = targets().mt;
  const V = { tenantDomain: "trial-v.local", tuid: "crew_trial_v" };
  const next = (amount: number, unit = "days") => ({ direction: "next", amount, unit });
  const cases: [string, string, Record<string, unknown>][] = [
    ["assignments fleet count", "crewing_query_assignments", { mode: "count" }],
    ["assignments group by vessel", "crewing_query_assignments", { mode: "group", groupBy: ["vesselName"] }],
    ["assignments engineers list", "crewing_query_assignments", { mode: "list", rankGroups: ["engineers"] }],
    ["assignments + hasDocument 60d", "crewing_query_assignments", { mode: "count", hasDocument: { expiryWithin: next(60) } }],
    ["documents expiring 60d", "crewing_query_documents", { mode: "count", expiryWithin: next(60) }],
    ["documents list people 60d", "crewing_query_documents", { mode: "list", unit: "people", expiryWithin: next(60) }],
    ["documents group by vessel on board", "crewing_query_documents", { mode: "group", groupBy: ["vesselName"], crewOnBoard: true, expiryWithin: next(30) }],
    ["availability next 2 months", "crewing_query_availability", { mode: "list", availableWithin: next(2, "months") }],
    ["availability group by rank", "crewing_query_availability", { mode: "group", groupBy: ["rank"], availableBy: "2026-12-31" }],
    ["relief due 1 month", "crewing_query_relief_due", { mode: "list", dueWithin: next(1, "months") }],
    ["relief overdue by vessel", "crewing_query_relief_due", { mode: "group", groupBy: ["vesselName"], dueState: "overdue" }],
    ["rest hours Oct fleet", "crewing_query_rest_hours", { mode: "count", months: ["2026-10"] }],
    ["rest hours 3 months by vessel", "crewing_query_rest_hours", { mode: "group", groupBy: ["vesselName"], months: ["2026-08", "2026-09", "2026-10"] }],
    ["rotation waiting", "crewing_query_rotation_approvals", { mode: "list" }],
    ["manning summary", "crewing_query_manning", { mode: "group", groupBy: ["vesselName"] }],
    ["appraisals pending", "crewing_query_appraisals", { mode: "list" }],
    ["appraisals completed scores", "crewing_query_appraisals", { mode: "list", statusClass: "completed", includeScores: true }],
  ];
  const out: Record<string, unknown>[] = [];
  for (const [label, tool, args] of cases) {
    const times: number[] = [];
    let last: Record<string, unknown> = {};
    for (let i = 0; i < 3; i++) { const r = await call(t, tool, args, { who: V }); times.push(r.ms); last = r.body ?? {}; }
    times.sort((a, b) => a - b);
    const row = { label, tool, ok: last.ok, code: last.code, total: last.total, totals: last.totals, summary: last.summary, msMedian: times[1], msMax: times[2] };
    out.push(row);
    console.log(`${last.ok === true ? "OK  " : "FAIL"} ${label.padEnd(36)} total=${JSON.stringify(last.total ?? last.totals)} median ${times[1]}ms max ${times[2]}ms${last.code ? " code=" + last.code : ""}`);
  }
  writeFileSync(new URL("./results/volume-check.json", import.meta.url), JSON.stringify({ at: new Date().toISOString(), db: DB, cases: out }, null, 2));
  const slow = out.filter((r) => (r.msMax as number) > 5000 || r.ok !== true);
  console.log(`\n${out.length - slow.length}/${out.length} ok within 5 s`);
}

const mode = process.argv[2];
if (mode === "build") build().catch((e) => { console.error(e.message); process.exit(1); });
else if (mode === "run") run().catch((e) => { console.error(e.message); process.exit(1); });
else { console.error("usage: build | run"); process.exit(2); }
