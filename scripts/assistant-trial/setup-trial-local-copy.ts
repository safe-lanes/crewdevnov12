/**
 * PILOT TRIAL ONLY — tenant C = an ISOLATED COPY of the local Crewing database plus LABELLED synthetic cases.
 *
 *   crew_trial_c   CREATE DATABASE … TEMPLATE <local db>  (the original is never written)
 *   trial-c.local  registered in crew_trial_master → crew_trial_c
 *
 * The copy keeps every real row of the local database (its Rank Administration included) and adds only rows whose
 * emp_no starts with SYN- and whose names start with "SYN" — the cases Sahil's rules need that the local data does not
 * cover (29-Oct-2026): a handover (primary + signed-on secondary), a planned reliever who has not signed on, terminated
 * and inactive crew holding documents, an on-board rank the Company tab does not classify, and expiry boundary dates
 * around the fixed as-of date 2026-11-01.
 *
 * Usage: DATABASE_URL=<local admin url> npx tsx scripts/assistant-trial/setup-trial-local-copy.ts
 * Refuses to touch any database whose name does not start with crew_trial_.
 */
import { Client } from "pg";

const TEMPLATE = process.env.TRIAL_TEMPLATE_DB || "crew_management_local";
const DB = "crew_trial_c";
const MASTER = "crew_trial_master";
const AS_OF = "2026-11-01";
const S = (n: number, kind: string) => `00000000-0000-4000-c${kind}00-${String(n).padStart(12, "0")}`;

function urlFor(db: string): string {
  const base = new URL(process.env.DATABASE_URL || "");
  base.pathname = `/${db}`;
  return base.toString();
}
async function withClient<T>(db: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const c = new Client({ connectionString: urlFor(db) });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** The synthetic cases, in the order they are inserted (the doc lists them by these labels). */
export const SYNTHETIC = {
  crew: [
    { n: 1, first: "SYN", family: "Reliever-SignedOn ChiefOfficer", rank: "Chief Officer", label: "C1 handover: signed-on reliever (secondary) of the real Chief Officer on board" },
    { n: 2, first: "SYN", family: "Planned-Reliever Master", rank: "Master", label: "C2 planned reliever of the real Master (on the Master's row, NOT signed on → not on board)" },
    { n: 3, first: "SYN", family: "Terminated ThirdOfficer", rank: "3rd Officer", label: "C3 terminated crew with a licence expiring 2026-11-15 → never listed", status: "Terminated", inactive: true, cat: "UT" },
    { n: 4, first: "SYN", family: "Inactive Cook", rank: "Chief Cook", label: "C4 inactive crew with a training certificate expiring 2026-11-18 and a licence expired 2019-01-01 → listed", status: "inactive", inactive: true },
    { n: 5, first: "SYN", family: "GasEngineer OnBoard", rank: "Gas Engineer", label: "C5 on board with a rank the Company tab does not classify (Gas Engineer) → unclassified, reported" },
  ],
  docs: [
    { crew: 1, type: "licence", name: "SYN CoC Chief Mate (expires on as-of day)", expiry: AS_OF },
    { crew: 1, type: "training", name: "SYN Basic Safety (60-day end)", expiry: "2026-12-31" },
    { crew: 1, type: "licence", name: "SYN GMDSS (2-month end)", expiry: "2027-01-01" },
    { crew: 1, type: "training", name: "SYN Advanced Fire Fighting (expired yesterday)", expiry: "2026-10-31" },
    { crew: 3, type: "licence", name: "SYN CoC Third Officer", expiry: "2026-11-15" },
    { crew: 4, type: "training", name: "SYN Medical First Aid", expiry: "2026-11-18" },
    { crew: 4, type: "licence", name: "SYN Ship Cook Certificate (expired 2019)", expiry: "2019-01-01" },
    { crew: 5, type: "licence", name: "SYN CoC Gas Engineer", expiry: "2026-12-10" },
  ],
} as const;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  for (const n of [DB, MASTER]) if (!n.startsWith("crew_trial_")) throw new Error(`refusing ${n}`);
  await withClient("postgres", async (c) => {
    await c.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [DB]);
    await c.query(`DROP DATABASE IF EXISTS "${DB}"`);
    await c.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [TEMPLATE]);
    await c.query(`CREATE DATABASE "${DB}" TEMPLATE "${TEMPLATE}"`);
  });
  await withClient(MASTER, async (c) => {
    await c.query(`INSERT INTO tenants (tuid, domain, company_name, is_active) VALUES ('crew_trial_c','trial-c.local','Trial Company C (local copy)',true)
      ON CONFLICT (tuid) DO NOTHING`);
  });
  await withClient(DB, async (c) => {
    const vessel = (await c.query(`SELECT vessel_uuid, vessel FROM master_vessels WHERE is_deleted IS NOT TRUE ORDER BY id LIMIT 1`)).rows[0];
    if (!vessel) throw new Error("the local copy has no vessel");
    const onBoard = (rank: string) => c.query(
      `SELECT plan_uuid, rank_id, rank, crew_uuid FROM vessel_planning_v2 WHERE vessel_uuid = $1 AND crew_status = 'primary' AND is_archived = false
         AND is_deleted = false AND crew_uuid IS NOT NULL AND sign_on_date IS NOT NULL AND lower(btrim(rank)) = lower($2) ORDER BY id LIMIT 1`,
      [vessel.vessel_uuid, rank]).then((r) => r.rows[0]);
    const chiefOfficer = await onBoard("Chief Officer");
    const master = await onBoard("Master");
    if (!chiefOfficer || !master) throw new Error("the local copy has no primary Chief Officer / Master on board");
    const natUuid = (await c.query(`SELECT nat_uuid FROM master_nationalities WHERE is_deleted IS NOT TRUE ORDER BY id LIMIT 1`)).rows[0]?.nat_uuid ?? null;

    for (const m of SYNTHETIC.crew) {
      await c.query(
        `INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, present_rank, nationality_uuid, status, is_active, is_deleted,
           last_termination_category, last_termination_date)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9,$10)`,
        [S(m.n, "2"), `SYN-${String(m.n).padStart(3, "0")}`, m.first, m.family, m.rank, natUuid, (m as { status?: string }).status ?? "active",
          !(m as { inactive?: boolean }).inactive, (m as { cat?: string }).cat ?? null, (m as { cat?: string }).cat ? "2026-10-10" : null]);
    }
    // C1 handover: a secondary row next to the real Chief Officer (same vessel, rank_id, rank), signed on 2026-10-28
    await c.query(
      `INSERT INTO vessel_planning_v2 (plan_uuid, vessel_uuid, rank_id, rank, crew_uuid, crew_status, sign_on_date, relief_due, is_archived, is_deleted)
       VALUES ($1,$2,$3,$4,$5,'secondary','2026-10-28','2027-04-28',false,false)`,
      [S(1, "3"), vessel.vessel_uuid, chiefOfficer.rank_id, chiefOfficer.rank, S(1, "2")]);
    // C2 planned reliever on the real Master's row (not signed on)
    await c.query(`UPDATE vessel_planning_v2 SET reliever_crew_uuid = $1, reliever_sign_on_date = '2026-11-10', joining_status = 'Planned' WHERE plan_uuid = $2`,
      [S(2, "2"), master.plan_uuid]);
    // C5 unclassified rank on board
    await c.query(
      `INSERT INTO vessel_planning_v2 (plan_uuid, vessel_uuid, rank_id, rank, crew_uuid, crew_status, sign_on_date, relief_due, is_archived, is_deleted)
       VALUES ($1,$2,'R011','Gas Engineer',$3,'primary','2026-09-01','2027-03-01',false,false)`,
      [S(5, "3"), vessel.vessel_uuid, S(5, "2")]);
    let j = 0;
    for (const d of SYNTHETIC.docs) {
      j++;
      if (d.type === "licence") {
        await c.query(`INSERT INTO crew_licenses (lic_uuid, crew_uuid, certificate_document, expiry, is_deleted) VALUES ($1,$2,$3,$4,false)`,
          [S(j, "4"), S(d.crew, "2"), d.name, d.expiry]);
      } else {
        await c.query(`INSERT INTO crew_training_courses (train_uuid, crew_uuid, training_course, expiry, is_deleted) VALUES ($1,$2,$3,$4,false)`,
          [S(j, "5"), S(d.crew, "2"), d.name, d.expiry]);
      }
    }
    const counts = await c.query(`SELECT (SELECT count(*) FROM crew_members_v2) crew, (SELECT count(*) FROM crew_members_v2 WHERE emp_no LIKE 'SYN-%') syn_crew,
      (SELECT count(*) FROM vessel_planning_v2) plans, (SELECT count(*) FROM crew_licenses) lic, (SELECT count(*) FROM crew_training_courses) trn`);
    console.log(DB, "vessel:", vessel.vessel, JSON.stringify(counts.rows[0]));
  });
}

if (process.argv[1] && /setup-trial-local-copy\.ts$/.test(process.argv[1].replace(/\\/g, "/"))) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
