/**
 * PILOT TRIAL — INDEPENDENT expected results (29-Oct-2026, Sahil's confirmed rules).
 *
 * Mode `derive`  : runs plain SQL written from the business rules (NOT the tool's query builders) against each trial
 *                  database and writes results/expected-<db>.json plus a data fingerprint (row counts + md5 of the
 *                  ordered key columns), so a comparison is repeatable against the same snapshot.
 * Mode `compare` : calls the live-data endpoint for the same questions (multi-tenant server, one tenant per database)
 *                  and reports PASS/FAIL per question → results/expected-compare-<label>.json.
 *
 * Rules encoded here (one SQL each, readable on its own):
 *   on board      primary or secondary, not archived/deleted, crew + vessel + sign-on date set (Vessel screen rule; A1)
 *   rank group    the Company tab of Rank Administration (adm_company_ranks_v2) by rank_id, else by normalised name (A5)
 *   documents     licences (not deleted, not archived) + training courses (not deleted) of crew not deleted/archived and
 *                 not terminated (status starting with 'Terminated'); inactive crew included (A2, A6)
 *   expiry        expired = before as-of; "expiring in N" = expired OR expiry ≤ window end (A4); upcoming = as-of ≤ expiry ≤ end
 *   as-of         2026-11-01 (fixture design); 30 days → 2026-12-01, 60 days → 2026-12-31, 2 months → 2027-01-01
 *
 * Usage: DATABASE_URL=<local admin url> npx tsx scripts/assistant-trial/expected-results.ts derive
 *        npx tsx scripts/assistant-trial/expected-results.ts compare <label>      (needs the MT trial server :6101)
 */
import { Client } from "pg";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { call, targets } from "./trialClient";

const AS_OF = "2026-11-01";
const DBS: Record<string, string> = { crew_trial_a: "trial-a.local", crew_trial_b: "trial-b.local", crew_trial_c: "trial-c.local" };
const OUT = new URL("./results/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

// ── plain SQL building blocks ───────────────────────────────────────────────────────────────────────────────────────
const NORM = (col: string) =>
  `regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(lower(btrim(${col})), '_[0-9]+$', ''), '\\m2nd\\M', 'second', 'g'), '\\m3rd\\M', 'third', 'g'), '\\m4th\\M', 'fourth', 'g'), '\\m1st\\M', 'first', 'g')`;
const DATE = (col: string) => `(CASE WHEN ${col} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND pg_input_is_valid(${col}, 'date') THEN ${col}::date END)`;
const ON_BOARD = `vp.crew_status IN ('primary','secondary') AND vp.is_archived = false AND vp.is_deleted = false
  AND vp.crew_uuid IS NOT NULL AND vp.vessel_uuid IS NOT NULL AND vp.sign_on_date IS NOT NULL`;
// one row per configured rank name/alias with its flags (company rank, role variant, Rank Master name of the same rank_id)
const CFG = `cfg AS (
  SELECT k, rank_id, bool_or(officer) officer, bool_or(rating) rating, bool_or(eng_officer) eng_officer, bool_or(deck_officer) deck_officer,
         bool_or(deck_rating) deck_rating, bool_or(engine_rating) engine_rating, bool_or(catering_rating) catering_rating,
         bool_or(officer OR rating OR senior_officer OR deck_officer OR eng_officer OR petty_officer OR deck_rating OR engine_rating OR general_rating OR catering_rating) classified
  FROM (
    SELECT ${NORM("cr.rank")} k, cr.rank_id, COALESCE(cr.officer,false) officer, COALESCE(cr.rating,false) rating, COALESCE(cr.senior_officer,false) senior_officer, COALESCE(cr.deck_officer,false) deck_officer, COALESCE(cr.eng_officer,false) eng_officer, COALESCE(cr.petty_officer,false) petty_officer, COALESCE(cr.deck_rating,false) deck_rating, COALESCE(cr.engine_rating,false) engine_rating, COALESCE(cr.general_rating,false) general_rating, COALESCE(cr.catering_rating,false) catering_rating FROM adm_company_ranks_v2 cr WHERE cr.is_deleted = false
    UNION ALL SELECT ${NORM("cr.role")} k, cr.rank_id, COALESCE(cr.officer,false) officer, COALESCE(cr.rating,false) rating, COALESCE(cr.senior_officer,false) senior_officer, COALESCE(cr.deck_officer,false) deck_officer, COALESCE(cr.eng_officer,false) eng_officer, COALESCE(cr.petty_officer,false) petty_officer, COALESCE(cr.deck_rating,false) deck_rating, COALESCE(cr.engine_rating,false) engine_rating, COALESCE(cr.general_rating,false) general_rating, COALESCE(cr.catering_rating,false) catering_rating FROM adm_company_ranks_v2 cr WHERE cr.is_deleted = false AND cr.role IS NOT NULL
    UNION ALL SELECT ${NORM("ar.name")} k, cr.rank_id, COALESCE(cr.officer,false) officer, COALESCE(cr.rating,false) rating, COALESCE(cr.senior_officer,false) senior_officer, COALESCE(cr.deck_officer,false) deck_officer, COALESCE(cr.eng_officer,false) eng_officer, COALESCE(cr.petty_officer,false) petty_officer, COALESCE(cr.deck_rating,false) deck_rating, COALESCE(cr.engine_rating,false) engine_rating, COALESCE(cr.general_rating,false) general_rating, COALESCE(cr.catering_rating,false) catering_rating FROM adm_company_ranks_v2 cr JOIN adm_available_ranks_v2 ar ON ar.rank_id = cr.rank_id AND ar.is_deleted = false
      WHERE cr.is_deleted = false
  ) x GROUP BY k, rank_id)`;
const OB = `ob AS (
  SELECT vp.id, vp.crew_uuid, vp.vessel_uuid, vp.crew_status, vp.rank, vp.rank_id, ${DATE("vp.sign_on_date")} sign_on,
         (SELECT mv.vessel FROM master_vessels mv WHERE mv.vessel_uuid = vp.vessel_uuid ORDER BY mv.id LIMIT 1) vessel,
         c.eng_officer, c.officer, c.rating, c.deck_rating, c.catering_rating, COALESCE(c.classified, false) classified
  FROM vessel_planning_v2 vp
  LEFT JOIN LATERAL (SELECT * FROM cfg WHERE cfg.rank_id = btrim(vp.rank_id) OR cfg.k = ${NORM("vp.rank")} ORDER BY (cfg.rank_id = btrim(vp.rank_id)) DESC LIMIT 1) c ON true
  WHERE ${ON_BOARD})`;
const DOCS = `docs AS (
  SELECT d.kind, d.crew_uuid, d.name, ${DATE("d.expiry")} expiry, d.expiry raw_expiry, cm.present_rank, cm.status, cm.is_active,
         EXISTS (SELECT 1 FROM vessel_planning_v2 vp WHERE vp.crew_uuid = d.crew_uuid AND ${ON_BOARD}) on_board,
         (SELECT (SELECT mv.vessel FROM master_vessels mv WHERE mv.vessel_uuid = vp.vessel_uuid ORDER BY mv.id LIMIT 1) FROM vessel_planning_v2 vp
            WHERE vp.crew_uuid = d.crew_uuid AND ${ON_BOARD} ORDER BY (vp.crew_status = 'primary') DESC, vp.id LIMIT 1) vessel,
         c.eng_officer, COALESCE(c.classified, false) classified
  FROM (
    SELECT 'licence' kind, l.crew_uuid, l.certificate_document name, l.expiry FROM crew_licenses l WHERE l.is_deleted = false AND l.archived_at IS NULL
    UNION ALL SELECT 'training', t.crew_uuid, t.training_course, t.expiry FROM crew_training_courses t WHERE t.is_deleted = false
  ) d
  JOIN crew_members_v2 cm ON cm.crew_uuid = d.crew_uuid AND cm.is_deleted = false AND cm.archived_at IS NULL AND (cm.status IS NULL OR cm.status NOT ILIKE 'Terminated%')
  LEFT JOIN LATERAL (SELECT * FROM cfg WHERE cfg.k = ${NORM("cm.present_rank")} LIMIT 1) c ON true)`;
const W = { d30: "2026-12-01", d60: "2026-12-31", m2: "2027-01-01" };

type Q = { id: string; text: string; sql: string; tool?: { name: string; args: Record<string, unknown>; pick: Record<string, string> } };
const next = (amount: number, unit = "days") => ({ direction: "next", amount, unit });

/** Each question: hand-written SQL producing one row of numbers; `tool` = the equivalent endpoint call and how to read it. */
const QUESTIONS: Q[] = [
  { id: "Q01", text: "Fleet on board: people and assignments", sql: `WITH ${CFG}, ${OB} SELECT count(DISTINCT crew_uuid)::int people, count(*)::int assignments FROM ob`,
    tool: { name: "crewing_query_assignments", args: { mode: "count" }, pick: { people: "totals.people", assignments: "totals.assignments" } } },
  { id: "Q02", text: "On board per vessel (people)", sql: `WITH ${CFG}, ${OB} SELECT jsonb_object_agg(vessel, n) per_vessel FROM (SELECT vessel, count(DISTINCT crew_uuid)::int n FROM ob GROUP BY vessel) v`,
    tool: { name: "crewing_query_assignments", args: { mode: "group", groupBy: ["vesselName"] }, pick: { per_vessel: "groups:vesselName=people" } } },
  { id: "Q03", text: "Secondary (signed-on relievers in handover) on board", sql: `WITH ${CFG}, ${OB} SELECT count(*)::int secondary FROM ob WHERE crew_status = 'secondary'`,
    tool: { name: "crewing_query_assignments", args: { mode: "count", crewStatus: ["secondary"] }, pick: { secondary: "totals.assignments" } } },
  { id: "Q04", text: "Engineers on board (Eng Officer flag) + unclassified ranks on board", sql: `WITH ${CFG}, ${OB} SELECT count(DISTINCT crew_uuid) FILTER (WHERE eng_officer)::int engineers,
      count(DISTINCT crew_uuid) FILTER (WHERE NOT classified)::int unclassified_people FROM ob`,
    tool: { name: "crewing_query_assignments", args: { mode: "count", rankGroups: ["engineers"] }, pick: { engineers: "totals.people", unclassified_people: "rankConfig.unclassifiedOnBoard.people" } } },
  { id: "Q05", text: "Officers / ratings / deck ratings / catering on board (people)", sql: `WITH ${CFG}, ${OB} SELECT count(DISTINCT crew_uuid) FILTER (WHERE officer)::int officers,
      count(DISTINCT crew_uuid) FILTER (WHERE rating)::int ratings, count(DISTINCT crew_uuid) FILTER (WHERE deck_rating)::int deck_ratings,
      count(DISTINCT crew_uuid) FILTER (WHERE catering_rating)::int catering FROM ob` },
  { id: "Q06", text: "Signed on in the last 30 days (people) + unreadable sign-on dates", sql: `WITH ${CFG}, ${OB} SELECT count(DISTINCT crew_uuid) FILTER (WHERE sign_on >= DATE '${AS_OF}' - 30 AND sign_on <= DATE '${AS_OF}')::int people,
      count(*) FILTER (WHERE sign_on IS NULL)::int unreadable FROM ob`,
    tool: { name: "crewing_query_assignments", args: { mode: "count", signOnWithin: { direction: "last", amount: 30, unit: "days" } }, pick: { people: "totals.people", unreadable: "excluded.unreadableSignOnDate" } } },
  { id: "Q07", text: "All documents (terminated/archived excluded): documents, people, inactive-crew documents, missing/unreadable dates",
    sql: `WITH ${CFG}, ${DOCS} SELECT count(*)::int documents, count(DISTINCT crew_uuid)::int people, count(*) FILTER (WHERE is_active = false)::int inactive_docs,
      count(*) FILTER (WHERE expiry IS NULL AND NULLIF(btrim(raw_expiry), '') IS NULL)::int missing, count(*) FILTER (WHERE expiry IS NULL AND NULLIF(btrim(raw_expiry), '') IS NOT NULL)::int unreadable FROM docs`,
    tool: { name: "crewing_query_documents", args: { mode: "count" }, pick: { documents: "totals.documents", people: "totals.people" } } },
  { id: "Q08", text: "Documents of terminated crew that must NOT be listed (sanity: count in raw tables)", sql: `SELECT count(*)::int terminated_docs FROM (
      SELECT l.crew_uuid FROM crew_licenses l WHERE l.is_deleted = false AND l.archived_at IS NULL UNION ALL SELECT t.crew_uuid FROM crew_training_courses t WHERE t.is_deleted = false) d
      JOIN crew_members_v2 cm ON cm.crew_uuid = d.crew_uuid WHERE cm.status ILIKE 'Terminated%'` },
  { id: "Q09", text: "Expired documents (any age)", sql: `WITH ${CFG}, ${DOCS} SELECT count(*)::int documents, count(DISTINCT crew_uuid)::int people FROM docs WHERE expiry < DATE '${AS_OF}'`,
    tool: { name: "crewing_query_documents", args: { mode: "count", expiryState: "expired" }, pick: { documents: "totals.documents", people: "totals.people" } } },
  { id: "Q10", text: "Expiring in 30 days = expired + upcoming by 2026-12-01 (documents, people, split)",
    sql: `WITH ${CFG}, ${DOCS} SELECT count(*)::int documents, count(DISTINCT crew_uuid)::int people, count(*) FILTER (WHERE expiry < DATE '${AS_OF}')::int expired_docs,
      count(*) FILTER (WHERE expiry >= DATE '${AS_OF}')::int upcoming_docs, count(DISTINCT crew_uuid) FILTER (WHERE expiry >= DATE '${AS_OF}')::int upcoming_people FROM docs WHERE expiry <= DATE '${W.d30}'`,
    tool: { name: "crewing_query_documents", args: { mode: "count", expiryWithin: next(30) }, pick: { documents: "totals.documents", people: "totals.people", expired_docs: "breakdown.expired.documents", upcoming_docs: "breakdown.upcoming.documents", upcoming_people: "breakdown.upcoming.people" } } },
  { id: "Q11", text: "Upcoming only, 30 days", sql: `WITH ${CFG}, ${DOCS} SELECT count(*)::int documents, count(DISTINCT crew_uuid)::int people FROM docs WHERE expiry >= DATE '${AS_OF}' AND expiry <= DATE '${W.d30}'`,
    tool: { name: "crewing_query_documents", args: { mode: "count", expiryState: "not_expired", expiryWithin: next(30) }, pick: { documents: "totals.documents", people: "totals.people" } } },
  { id: "Q12", text: "Expiring in 60 days (expired + upcoming by 2026-12-31)", sql: `WITH ${CFG}, ${DOCS} SELECT count(*)::int documents, count(DISTINCT crew_uuid)::int people,
      count(*) FILTER (WHERE expiry >= DATE '${AS_OF}')::int upcoming_docs FROM docs WHERE expiry <= DATE '${W.d60}'`,
    tool: { name: "crewing_query_documents", args: { mode: "count", expiryWithin: next(60) }, pick: { documents: "totals.documents", people: "totals.people", upcoming_docs: "breakdown.upcoming.documents" } } },
  { id: "Q13", text: "Expiring in 2 calendar months (by 2027-01-01) — differs from 60 days", sql: `WITH ${CFG}, ${DOCS} SELECT count(*)::int documents FROM docs WHERE expiry <= DATE '${W.m2}'`,
    tool: { name: "crewing_query_documents", args: { mode: "count", expiryWithin: next(2, "months") }, pick: { documents: "totals.documents" } } },
  { id: "Q14", text: "On-board crew: expiring in 60 days (expired + upcoming), documents and people, per vessel",
    sql: `WITH ${CFG}, ${DOCS} SELECT count(*)::int documents, count(DISTINCT crew_uuid)::int people, count(*) FILTER (WHERE expiry < DATE '${AS_OF}')::int expired_docs,
      (SELECT jsonb_object_agg(vessel, n) FROM (SELECT vessel, count(*)::int n FROM docs WHERE on_board AND expiry <= DATE '${W.d60}' GROUP BY vessel) v) per_vessel
      FROM docs WHERE on_board AND expiry <= DATE '${W.d60}'`,
    tool: { name: "crewing_query_documents", args: { mode: "group", groupBy: ["vesselName"], crewOnBoard: true, expiryWithin: next(60) }, pick: { documents: "totals.documents", people: "totals.people", expired_docs: "breakdown.expired.documents", per_vessel: "groups:vesselName=documents" } } },
  { id: "Q15", text: "Engineers' documents expiring in 60 days (expired + upcoming) + unclassified people in the population",
    sql: `WITH ${CFG}, ${DOCS} SELECT count(*) FILTER (WHERE eng_officer)::int documents, count(DISTINCT crew_uuid) FILTER (WHERE eng_officer)::int people,
      count(DISTINCT crew_uuid) FILTER (WHERE NOT classified)::int unclassified_people FROM docs WHERE expiry <= DATE '${W.d60}'`,
    tool: { name: "crewing_query_documents", args: { mode: "count", rankGroups: ["engineers"], expiryWithin: next(60) }, pick: { documents: "totals.documents", people: "totals.people", unclassified_people: "rankConfig.unclassifiedInResult.people" } } },
  { id: "Q16", text: "Boundary: documents expiring exactly on the as-of day count as upcoming", sql: `WITH ${CFG}, ${DOCS} SELECT count(*)::int on_as_of_day FROM docs WHERE expiry = DATE '${AS_OF}'`,
    tool: { name: "crewing_query_documents", args: { mode: "count", expiryState: "not_expired", expiryFrom: AS_OF, expiryTo: AS_OF }, pick: { on_as_of_day: "totals.documents" } } },
];

function get(o: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined), o);
}
function pickValue(body: Record<string, unknown>, spec: string): unknown {
  if (spec.startsWith("groups:")) {
    const [key, val] = spec.slice(7).split("=");
    const groups = (body.groups as Record<string, unknown>[] | undefined) ?? [];
    return Object.fromEntries(groups.map((g) => [String(g[key]), g[val]]));
  }
  const v = get(body, spec);
  return v === undefined ? 0 : v;
}
function sameJson(a: unknown, b: unknown): boolean {
  const norm = (x: unknown) => JSON.stringify(x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as object).sort()) : x);
  return norm(a) === norm(b);
}

async function derive() {
  mkdirSync(OUT, { recursive: true });
  for (const db of Object.keys(DBS)) {
    const base = new URL(process.env.DATABASE_URL || "");
    base.pathname = `/${db}`;
    const c = new Client({ connectionString: base.toString() });
    await c.connect();
    try {
      const fp = (await c.query(`SELECT
        (SELECT count(*) FROM crew_members_v2) crew, (SELECT count(*) FROM vessel_planning_v2) plans, (SELECT count(*) FROM crew_licenses) licences,
        (SELECT count(*) FROM crew_training_courses) trainings, (SELECT count(*) FROM adm_company_ranks_v2) company_ranks,
        md5(string_agg(x::text, '|' ORDER BY x::text)) data_md5 FROM (
          SELECT crew_uuid || status || is_active::text || coalesce(archived_at::text,'') x FROM crew_members_v2
          UNION ALL SELECT plan_uuid || coalesce(crew_uuid,'') || crew_status || coalesce(sign_on_date,'') || is_archived::text || is_deleted::text FROM vessel_planning_v2
          UNION ALL SELECT lic_uuid || coalesce(expiry,'') || coalesce(archived_at::text,'') || is_deleted::text FROM crew_licenses
          UNION ALL SELECT train_uuid || coalesce(expiry,'') || is_deleted::text FROM crew_training_courses
          UNION ALL SELECT id || rank || coalesce(role,'') || officer::text || rating::text || eng_officer::text || deck_officer::text || deck_rating::text || engine_rating::text || catering_rating::text FROM adm_company_ranks_v2 WHERE is_deleted = false) f`)).rows[0];
      const answers: Record<string, unknown> = {};
      for (const qd of QUESTIONS) {
        const r = await c.query(qd.sql);
        answers[qd.id] = { text: qd.text, ...r.rows[0] };
      }
      const out = { db, asOf: AS_OF, derivedAt: new Date().toISOString(), fingerprint: fp, answers };
      writeFileSync(`${OUT}/expected-${db}.json`, JSON.stringify(out, null, 2));
      console.log(db, JSON.stringify(fp));
      for (const [id, a] of Object.entries(answers)) console.log(`  ${id} ${JSON.stringify(a)}`);
    } finally {
      await c.end();
    }
  }
}

async function compare(label: string) {
  const t = targets().mt;
  const report: Record<string, unknown>[] = [];
  let pass = 0, total = 0;
  for (const [db, domain] of Object.entries(DBS)) {
    const expected = JSON.parse(readFileSync(`${OUT}/expected-${db}.json`, "utf8")) as { answers: Record<string, Record<string, unknown>> };
    for (const qd of QUESTIONS) {
      if (!qd.tool) continue;
      const r = await call(t, qd.tool.name, qd.tool.args, { who: { tenantDomain: domain, tuid: db } });
      const exp = expected.answers[qd.id];
      const got: Record<string, unknown> = {};
      let ok = r.status === 200 && r.body?.ok === true;
      for (const [k, spec] of Object.entries(qd.tool.pick)) {
        got[k] = pickValue(r.body ?? {}, spec);
        if (!sameJson(got[k], exp[k])) ok = false;
      }
      total++;
      if (ok) pass++;
      report.push({ db, id: qd.id, text: qd.text, pass: ok, expected: Object.fromEntries(Object.keys(qd.tool.pick).map((k) => [k, exp[k]])), got, code: r.body?.code });
      console.log(`${ok ? "PASS" : "FAIL"}  ${db} ${qd.id} ${qd.text}${ok ? "" : "  expected=" + JSON.stringify(Object.fromEntries(Object.keys(qd.tool.pick).map((k) => [k, exp[k]]))) + " got=" + JSON.stringify(got) + (r.body?.code ? " code=" + r.body.code : "")}`);
    }
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/expected-compare-${label}.json`, JSON.stringify({ label, at: new Date().toISOString(), pass, total, report }, null, 2));
  console.log(`\n${pass}/${total} agree with the independent SQL`);
  process.exit(pass === total ? 0 : 1);
}

const mode = process.argv[2];
if (mode === "derive") derive().catch((e) => { console.error(e.message); process.exit(1); });
else if (mode === "compare") compare(process.argv[3] || "run").catch((e) => { console.error(e.message); process.exit(1); });
else { console.error("usage: derive | compare <label>"); process.exit(2); }
