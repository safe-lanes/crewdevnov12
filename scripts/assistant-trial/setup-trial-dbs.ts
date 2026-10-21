/**
 * PILOT TRIAL ONLY — builds the isolated multi-tenant fixture for the assistant live-data trial.
 *
 *   crew_trial_master  tenants: trial-a.local → crew_trial_a, trial-b.local → crew_trial_b, trial-x.local (inactive)
 *   crew_trial_a / _b  copies of the local schema (TEMPLATE), all business data wiped, then SYNTHETIC fixtures only
 *
 * Usage: DATABASE_URL=<local admin url to the template db> npx tsx scripts/assistant-trial/setup-trial-dbs.ts
 * Refuses to touch any database whose name does not start with crew_trial_. Never run against a shared server.
 * The expected answers of the trial test set (tests/assistant-trial/test-set.json) are written by hand against
 * this fixture with as-of date 2026-11-01 — they are NOT computed from it.
 */
import { Client } from "pg";

const TEMPLATE = process.env.TRIAL_TEMPLATE_DB || "crew_management_local";
const DBS = ["crew_trial_a", "crew_trial_b"];
const MASTER = "crew_trial_master";

const KEEP = (t: string) =>
  (t.startsWith("adm_") || (t.startsWith("master_") && !t.startsWith("master_vessels"))) ||
  ["schema_migrations", "data_masters", "id_counters", "company_ranks", "oil_major_rules", "promo_criteria_master_v2", "alert_policies_v2"].includes(t);

const NAT = { IN: "ba9cddf2-60b0-11ec-a42e-507b9da1cbd6", PH: "bb1b521a-60b0-11ec-a42e-507b9da1cbd6", UA: "bb792548-60b0-11ec-a42e-507b9da1cbd6", HR: "ba9063eb-60b0-11ec-a42e-507b9da1cbd6", GB: "ba68798b-60b0-11ec-a42e-507b9da1cbd6" };
const u = (tenant: string, kind: string, n: number) =>
  `00000000-0000-4000-${tenant === "a" ? "a" : "b"}${kind}00-${String(n).padStart(12, "0")}`;

type Crew = { n: number; first: string; family: string; rank: string; nat: keyof typeof NAT; archived?: boolean };
type Plan = { crew: number | null; vessel: number; rank: string; status?: string; signOn?: string | null; reliefDue?: string | null; archived?: boolean; deleted?: boolean };
type Doc = { crew: number; type: "licence" | "training"; name: string; expiry: string; archived?: boolean };
type Fixture = { vessels: [number, string][]; crew: Crew[]; plans: Plan[]; docs: Doc[] };

const A: Fixture = {
  vessels: [[1, "MV Alpha Star"], [2, "MV Beta Ocean"], [3, "MV Gamma Bay"], [4, "MV Alpha Trader"]],
  crew: [
    { n: 1, first: "Aldric", family: "Vexmoor", rank: "Master", nat: "IN" },
    { n: 2, first: "Benedek", family: "Quorrlyn", rank: "Chief Officer", nat: "IN" },
    { n: 3, first: "Corvina", family: "Tallowind", rank: "Second Officer", nat: "PH" },
    { n: 4, first: "Dagny", family: "Brisketh", rank: "Chief Engineer", nat: "UA" },
    { n: 5, first: "Elsbet", family: "Orvanne", rank: "2nd Engineer", nat: "IN" },
    { n: 6, first: "Faustin", family: "Kelderwick", rank: "Third Engineer", nat: "PH" },
    { n: 7, first: "Gisla", family: "Marrowfen", rank: "Bosun", nat: "PH" },
    { n: 8, first: "Hadrian", family: "Pellisande", rank: "Chief Cook", nat: "PH" },
    { n: 9, first: "Ilvar", family: "Strandquist", rank: "Third Officer", nat: "HR" },
    { n: 10, first: "Jorund", family: "Talmace", rank: "Chief Officer", nat: "HR" },
    { n: 11, first: "Kestrel", family: "Duvanne", rank: "Second Officer", nat: "IN" },
    { n: 12, first: "Lusine", family: "Ferrowby", rank: "Fourth Engineer", nat: "UA" },
    { n: 13, first: "Marek", family: "Oldenvaal", rank: "Master", nat: "HR" },
    { n: 14, first: "Nadira", family: "Sklemmon", rank: "Chief Officer", nat: "IN" },
    { n: 15, first: "Orrin", family: "Haverlock", rank: "Chief Engineer", nat: "UA" },
    { n: 16, first: "Petra", family: "Wintermarsh", rank: "Second Engineer", nat: "UA" },
    { n: 17, first: "Quillon", family: "Rasterby", rank: "Electrical Officer", nat: "IN" },
    { n: 18, first: "Rasmine", family: "Thornquay", rank: "Oiler", nat: "PH" },
    { n: 19, first: "Sefton", family: "Grallowmere", rank: "Master", nat: "GB" },
    { n: 20, first: "Tamsin", family: "Ebberline", rank: "Chief Engineer", nat: "GB" },
    { n: 21, first: "Ulric", family: "Penhallow", rank: "Chief Officer", nat: "IN" },
    { n: 22, first: "Vesna", family: "Ardcaster", rank: "Chief Officer", nat: "HR", archived: true },
  ],
  plans: [
    // MV Alpha Star — 8 on board
    { crew: 1, vessel: 1, rank: "Master", signOn: "2026-06-01", reliefDue: "2026-10-20" },
    { crew: 2, vessel: 1, rank: "Chief Officer", signOn: "2026-07-15", reliefDue: "2027-01-15" },
    { crew: 3, vessel: 1, rank: "Second Officer", signOn: "2026-08-01", reliefDue: "2027-02-01" },
    { crew: 4, vessel: 1, rank: "Chief Engineer", signOn: "2026-05-10", reliefDue: "2026-11-10" },
    { crew: 5, vessel: 1, rank: "2nd Engineer", signOn: "2026-09-01", reliefDue: "2027-03-01" },
    { crew: 6, vessel: 1, rank: "Third Engineer", signOn: "2026-10-05", reliefDue: "2027-04-05" },
    { crew: 7, vessel: 1, rank: "Bosun", signOn: "15/06/2026", reliefDue: "2026-12-15" },
    { crew: 8, vessel: 1, rank: "Chief Cook", signOn: "2026-10-20", reliefDue: null },
    // MV Alpha Star — NOT on board
    { crew: 9, vessel: 1, rank: "Third Officer", signOn: null },                         // deployed, not signed on
    { crew: 10, vessel: 1, rank: "Chief Officer", signOn: "2026-01-10", archived: true }, // signed off (archived)
    { crew: 11, vessel: 1, rank: "Second Officer", status: "relief", signOn: "2026-10-01" }, // relief-only row
    { crew: null, vessel: 1, rank: "Fourth Engineer", signOn: null },                    // empty slot
    { crew: 12, vessel: 1, rank: "Fourth Engineer", signOn: "2026-09-15", deleted: true }, // deleted row
    // MV Beta Ocean — 6 primary + Faustin secondary
    { crew: 13, vessel: 2, rank: "Master", signOn: "2026-04-01", reliefDue: "2026-10-01" },
    { crew: 14, vessel: 2, rank: "Chief Officer", signOn: "2026-08-20", reliefDue: "2026-11-20" },
    { crew: 15, vessel: 2, rank: "Chief Engineer", signOn: "2026-07-01", reliefDue: "2027-01-01" },
    { crew: 16, vessel: 2, rank: "Second Engineer", signOn: "2026-10-15", reliefDue: "2027-04-15" },
    { crew: 17, vessel: 2, rank: "Electrical Officer", signOn: "2026-09-10", reliefDue: "2027-03-10" },
    { crew: 18, vessel: 2, rank: "Oiler", signOn: "2026-06-20", reliefDue: "2026-12-20" },
    { crew: 6, vessel: 2, rank: "Third Engineer", status: "secondary", signOn: "2026-10-25", reliefDue: null },
    // MV Alpha Trader — 2 on board; MV Gamma Bay — none
    { crew: 19, vessel: 4, rank: "Master", signOn: "2026-09-01", reliefDue: "2027-03-01" },
    { crew: 20, vessel: 4, rank: "Chief Engineer", signOn: "2026-09-01", reliefDue: "2027-03-01" },
  ],
  docs: [
    { crew: 1, type: "licence", name: "CoC Master", expiry: "2026-11-10" },
    { crew: 2, type: "training", name: "Ship Security Officer", expiry: "2026-11-05" },
    { crew: 2, type: "licence", name: "CoC Chief Mate (old)", expiry: "2026-11-08", archived: true },
    { crew: 4, type: "licence", name: "CoC Chief Engineer", expiry: "2026-09-30" },
    { crew: 3, type: "licence", name: "GMDSS GOC", expiry: "2027-06-01" },
    { crew: 15, type: "licence", name: "CoC Chief Engineer", expiry: "2026-11-15" },
    { crew: 15, type: "training", name: "Advanced Fire Fighting", expiry: "2026-12-10" },
    { crew: 15, type: "training", name: "Medical First Aid", expiry: "2026-12-20" },
    { crew: 16, type: "licence", name: "CoC Second Engineer", expiry: "2026-11-25" },
    { crew: 16, type: "training", name: "Basic Safety Training", expiry: "2026-12-31" },
    { crew: 16, type: "training", name: "Tanker Familiarisation", expiry: "2027-01-01" },
    { crew: 13, type: "licence", name: "CoC Master", expiry: "2026-10-15" },
    { crew: 14, type: "licence", name: "CoC Chief Mate", expiry: "2027-03-01" },
    { crew: 17, type: "licence", name: "ETO Certificate", expiry: "31/12/2026" },
    { crew: 18, type: "training", name: "Basic Safety Training", expiry: "" },
    { crew: 6, type: "licence", name: "CoC Third Engineer", expiry: "2027-02-15" },
    { crew: 20, type: "training", name: "Advanced Fire Fighting", expiry: "2026-11-20" },
    { crew: 21, type: "licence", name: "CoC Chief Mate", expiry: "2026-11-12" },
    { crew: 22, type: "licence", name: "CoC Chief Mate", expiry: "2026-11-14" },
    { crew: 9, type: "training", name: "Basic Safety Training", expiry: "2026-11-18" },
  ],
};

const B: Fixture = {
  vessels: [[1, "MV Alpha Star"], [2, "MV Delta Sky"]],
  crew: [
    { n: 1, first: "Wendel", family: "Crossfeather", rank: "Master", nat: "GB" },
    { n: 2, first: "Xanthe", family: "Moorgrave", rank: "Chief Officer", nat: "GB" },
    { n: 3, first: "Yorick", family: "Fellhammer", rank: "Chief Engineer", nat: "HR" },
    { n: 4, first: "Zelia", family: "Brantwood", rank: "Second Engineer", nat: "HR" },
    { n: 5, first: "Abelard", family: "Nettlecombe", rank: "Master", nat: "IN" },
    { n: 6, first: "Brisa", family: "Halvorcrest", rank: "Chief Officer", nat: "IN" },
    { n: 7, first: "Cormac", family: "Tidewellyn", rank: "Chief Engineer", nat: "PH" },
  ],
  plans: [
    { crew: 1, vessel: 1, rank: "Master", signOn: "2026-08-01" },
    { crew: 2, vessel: 1, rank: "Chief Officer", signOn: "2026-08-01" },
    { crew: 3, vessel: 1, rank: "Chief Engineer", signOn: "2026-08-01" },
    { crew: 4, vessel: 1, rank: "Second Engineer", signOn: "2026-08-01" },
    { crew: 5, vessel: 2, rank: "Master", signOn: "2026-09-01" },
    { crew: 6, vessel: 2, rank: "Chief Officer", signOn: "2026-09-01" },
    { crew: 7, vessel: 2, rank: "Chief Engineer", signOn: "2026-09-01" },
  ],
  docs: [
    { crew: 3, type: "licence", name: "CoC Chief Engineer", expiry: "2026-11-09" },
    { crew: 7, type: "training", name: "Advanced Fire Fighting", expiry: "2026-12-05" },
  ],
};

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

async function fill(db: string, t: "a" | "b", f: Fixture) {
  await withClient(db, async (c) => {
    const { rows } = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
    const wipe = rows.map((r) => r.table_name as string).filter((n) => !KEEP(n));
    await c.query(`TRUNCATE ${wipe.map((n) => `"${n}"`).join(", ")} RESTART IDENTITY CASCADE`);
    for (const [n, name] of f.vessels) {
      await c.query(`INSERT INTO master_vessels (vessel_uuid, vessel, imo_number, is_active, is_deleted) VALUES ($1,$2,$3,true,false)`,
        [u(t, "1", n), name, `${t === "a" ? 91 : 92}0000${n}`]);
    }
    for (const m of f.crew) {
      await c.query(
        `INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, present_rank, nationality_uuid, status, is_active, archived_at, is_deleted)
         VALUES ($1,$2,$3,$4,$5,$6,'Active',true,$7,false)`,
        [u(t, "2", m.n), `TRIAL-${t.toUpperCase()}-${String(m.n).padStart(3, "0")}`, m.first, m.family, m.rank, NAT[m.nat], m.archived ? new Date("2026-10-01T00:00:00Z") : null]);
    }
    let i = 0;
    for (const p of f.plans) {
      i++;
      await c.query(
        `INSERT INTO vessel_planning_v2 (plan_uuid, vessel_uuid, rank_id, rank, crew_uuid, crew_status, sign_on_date, relief_due, is_archived, is_deleted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [u(t, "3", i), u(t, "1", p.vessel), `rank-${i}`, p.rank, p.crew === null ? null : u(t, "2", p.crew), p.status ?? "primary",
          p.signOn ?? null, p.reliefDue ?? null, !!p.archived, !!p.deleted]);
    }
    let j = 0;
    for (const d of f.docs) {
      j++;
      if (d.type === "licence") {
        await c.query(`INSERT INTO crew_licenses (lic_uuid, crew_uuid, certificate_document, expiry, archived_at, is_deleted) VALUES ($1,$2,$3,$4,$5,false)`,
          [u(t, "4", j), u(t, "2", d.crew), d.name, d.expiry, d.archived ? new Date("2026-10-01T00:00:00Z") : null]);
      } else {
        await c.query(`INSERT INTO crew_training_courses (train_uuid, crew_uuid, training_course, expiry, is_deleted) VALUES ($1,$2,$3,$4,false)`,
          [u(t, "5", j), u(t, "2", d.crew), d.name, d.expiry]);
      }
    }
    const counts = await c.query(`SELECT (SELECT count(*) FROM crew_members_v2) crew, (SELECT count(*) FROM vessel_planning_v2) plans,
      (SELECT count(*) FROM crew_licenses) lic, (SELECT count(*) FROM crew_training_courses) trn, (SELECT count(*) FROM master_vessels) vessels`);
    console.log(db, JSON.stringify(counts.rows[0]), `wiped ${wipe.length} tables`);
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  for (const n of [...DBS, MASTER]) if (!n.startsWith("crew_trial_")) throw new Error(`refusing ${n}`);
  await withClient("postgres", async (c) => {
    for (const n of [...DBS, MASTER]) {
      await c.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [n]);
      await c.query(`DROP DATABASE IF EXISTS "${n}"`);
    }
    for (const n of DBS) await c.query(`CREATE DATABASE "${n}" TEMPLATE "${TEMPLATE}"`);
    await c.query(`CREATE DATABASE "${MASTER}"`);
  });
  await withClient(MASTER, async (c) => {
    await c.query(`CREATE TABLE tenants (id serial PRIMARY KEY, tuid text NOT NULL UNIQUE, domain text NOT NULL UNIQUE, company_name text,
      is_active boolean NOT NULL DEFAULT true, is_deleted boolean NOT NULL DEFAULT false, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now())`);
    await c.query(`INSERT INTO tenants (tuid, domain, company_name, is_active) VALUES
      ('crew_trial_a','trial-a.local','Trial Company A',true), ('crew_trial_b','trial-b.local','Trial Company B',true),
      ('crew_trial_x','trial-x.local','Trial Company X (inactive)',false)`);
  });
  await fill("crew_trial_a", "a", A);
  await fill("crew_trial_b", "b", B);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
