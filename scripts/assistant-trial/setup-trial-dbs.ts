/**
 * PILOT TRIAL ONLY — builds the isolated multi-tenant fixture for the assistant live-data trial.
 *
 *   crew_trial_master  tenants: trial-a.local → crew_trial_a, trial-b.local → crew_trial_b, trial-x.local (inactive)
 *                      (trial-c.local → crew_trial_c is added by setup-trial-local-copy.ts: the isolated copy of the local DB)
 *   crew_trial_a / _b  copies of the local schema (TEMPLATE), all business data wiped, then SYNTHETIC fixtures only.
 *                      Rank Administration (adm_* tables) and master users are KEPT from the template.
 *
 * Usage: DATABASE_URL=<local admin url to the template db> npx tsx scripts/assistant-trial/setup-trial-dbs.ts
 * Refuses to touch any database whose name does not start with crew_trial_. Never run against a shared server.
 * Expected answers are written BY HAND from this design with as-of date 2026-11-01 (direct-checks.ts) and re-derived with
 * separate SQL (expected-results.ts) — never computed from the tool.
 *
 * Fixture v2 (29-Oct-2026, Sahil's Part A answers) — see the A1/A4/A5/A6 notes inline.
 * Fixture v3 (30-Oct-2026, Part B): availability dates (B1), contract months / tolerance ranges (B2), rest-hour daily records
 * with known violation codes (B3), rotation plans and entries (B4), empty slots, a deployed-not-signed-on person and an
 * inactive vessel (B5), appraisals in every status incl. terminated / archived crew (B6).
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

type Crew = { n: number; first: string; family: string; rank: string; nat: keyof typeof NAT; archived?: boolean;
  status?: string; inactive?: boolean; terminationCategory?: string; availability?: string; nextAvailability?: string; notForHire?: boolean };
type Plan = { crew: number | null; vessel: number; rank: string; rankId: string; status?: string; signOn?: string | null; reliefDue?: string | null;
  archived?: boolean; deleted?: boolean; reliever?: number; relieverSignOn?: string; months?: number; rangeStart?: number; rangeEnd?: number };
type Doc = { crew: number; type: "licence" | "training"; name: string; expiry: string; archived?: boolean };
type Rotation = { n: number; planId: string; status: string; from: string; to: string; proposedOn?: string; vessels: number[];
  entries: { vessel: number; rank: string; crew?: number; status: "Pending" | "Deployed" | "Rejected" }[] };
/** one person-month of rest-hour daily records; `days` = day → violation codes (Rest codes A,C,E,F,G; OPA-only H,I; work B,D) */
type RestHours = { crew: number; vessel: number; month: string; days: Record<number, string[]>; applicableFrom?: string; updated: string };
type Appraisal = { n: number; crew: number; type: string; date: string; status: string; overall?: string; competence?: string; vessel?: string };
type Fixture = { vessels: [number, string, boolean?][]; crew: Crew[]; plans: Plan[]; docs: Doc[]; rotation?: Rotation[]; restHours?: RestHours[]; appraisals?: Appraisal[] };

export const A: Fixture = {
  vessels: [[1, "MV Alpha Star"], [2, "MV Beta Ocean"], [3, "MV Gamma Bay"], [4, "MV Alpha Trader"], [5, "MV Epsilon Reef", false]], // 5 = INACTIVE (B5)
  crew: [
    { n: 1, first: "Aldric", family: "Vexmoor", rank: "Master", nat: "IN" },
    { n: 2, first: "Benedek", family: "Quorrlyn", rank: "Chief Officer", nat: "IN" },
    { n: 3, first: "Corvina", family: "Tallowind", rank: "Second Officer", nat: "PH" },
    { n: 4, first: "Dagny", family: "Brisketh", rank: "Chief Engineer", nat: "UA" },
    { n: 5, first: "Elsbet", family: "Orvanne", rank: "2nd Engineer", nat: "IN" },
    { n: 6, first: "Faustin", family: "Kelderwick", rank: "Third Engineer", nat: "PH" },
    { n: 7, first: "Gisla", family: "Marrowfen", rank: "Bosun", nat: "PH" },
    { n: 8, first: "Hadrian", family: "Pellisande", rank: "Chief Cook", nat: "PH" },
    { n: 9, first: "Ilvar", family: "Strandquist", rank: "Third Officer", nat: "HR", availability: "2026-11-15" },        // B1: on leave (deployed, not signed on)
    { n: 10, first: "Jorund", family: "Talmace", rank: "Chief Officer", nat: "HR", nextAvailability: "2026-12-10" },      // B1: on leave (signed off)
    { n: 11, first: "Kestrel", family: "Duvanne", rank: "Second Officer", nat: "IN", nextAvailability: "2026-11-05" },    // B1: planned reliever, on leave
    { n: 12, first: "Lusine", family: "Ferrowby", rank: "Fourth Engineer", nat: "UA" },                                    // B1: on leave, NO availability date
    { n: 13, first: "Marek", family: "Oldenvaal", rank: "Master", nat: "HR" },
    { n: 14, first: "Nadira", family: "Sklemmon", rank: "Chief Officer", nat: "IN", nextAvailability: "2026-12-05" },     // B1: ON BOARD with Next Availability (Sahil's case)
    { n: 15, first: "Orrin", family: "Haverlock", rank: "Chief Engineer", nat: "UA" },
    { n: 16, first: "Petra", family: "Wintermarsh", rank: "Second Engineer", nat: "UA" },
    { n: 17, first: "Quillon", family: "Rasterby", rank: "Electrical Officer", nat: "IN" },
    { n: 18, first: "Rasmine", family: "Thornquay", rank: "Oiler", nat: "PH" },
    { n: 19, first: "Sefton", family: "Grallowmere", rank: "Master", nat: "GB" },
    { n: 20, first: "Tamsin", family: "Ebberline", rank: "Chief Engineer", nat: "GB" },
    { n: 21, first: "Ulric", family: "Penhallow", rank: "Chief Officer", nat: "IN", availability: "2026-10-20" },          // B1: on leave, already available
    { n: 22, first: "Vesna", family: "Ardcaster", rank: "Chief Officer", nat: "HR", archived: true },
    { n: 23, first: "Oswin", family: "Larkspur", rank: "Chief Officer", nat: "PH" },
    { n: 24, first: "Pelham", family: "Ashgrove", rank: "Third Officer", nat: "IN", status: "Terminated", inactive: true, terminationCategory: "UT", nextAvailability: "2026-11-02" }, // never available
    { n: 25, first: "Quenby", family: "Thistlewood", rank: "Oiler", nat: "PH", status: "Terminated - NFR", inactive: true, terminationCategory: "general" },
    { n: 26, first: "Rowena", family: "Castlewick", rank: "Chief Cook", nat: "IN", status: "inactive", inactive: true, availability: "2026-11-10" }, // inactive → not available
    { n: 27, first: "Sorrel", family: "Wainfleet", rank: "Gas Engineer", nat: "GB" },
    { n: 28, first: "Tobiah", family: "Rendlesham", rank: "Deck Cadet", nat: "PH" },
    { n: 29, first: "Una", family: "Marchbanks", rank: "AB", nat: "PH" },
    { n: 30, first: "Verity", family: "Ashcombe", rank: "Second Officer", nat: "GB", availability: "2026-11-01", notForHire: true }, // B1: not for rehire
  ],
  plans: [
    // MV Alpha Star — 8 on board (B2: contract months → contract end; Aldric's recorded relief-due differs; Elsbet has a tolerance range)
    { crew: 1, vessel: 1, rank: "Master", rankId: "R001", signOn: "2026-06-01", reliefDue: "2026-10-20", months: 4 },              // contract end 2026-10-01 → OVERDUE; relief-due differs
    { crew: 2, vessel: 1, rank: "Chief Officer", rankId: "R002", signOn: "2026-07-15", reliefDue: "2027-01-15", months: 6 },
    { crew: 3, vessel: 1, rank: "2nd Officer", rankId: "R003", signOn: "2026-08-01", reliefDue: "2027-02-01", months: 6, reliever: 11, relieverSignOn: "2026-11-05" },
    { crew: 4, vessel: 1, rank: "Chief Engineer", rankId: "R005", signOn: "2026-05-10", reliefDue: "2026-11-10", months: 6 },       // due within 1 month
    { crew: 5, vessel: 1, rank: "2nd Engineer", rankId: "R006", signOn: "2026-09-01", reliefDue: "2027-03-01", months: 6, rangeStart: 5, rangeEnd: 7 }, // contract end 2027-02-01 (range start) ≠ relief-due
    { crew: 6, vessel: 1, rank: "3rd Engineer", rankId: "R007", signOn: "2026-10-05", reliefDue: "2027-04-05", months: 6 },
    { crew: 7, vessel: 1, rank: "Bosun", rankId: "R014", signOn: "15/06/2026", reliefDue: "2026-12-15", months: 6 },                // unreadable sign-on → contract end = recorded relief-due
    { crew: 8, vessel: 1, rank: "Chief Cook", rankId: "R022", signOn: "2026-10-20", reliefDue: null },                               // no months, no relief-due → no due date
    // MV Alpha Star — NOT on board (B5: a deployed person not signed on = vacancy; an empty slot = vacancy)
    { crew: 9, vessel: 1, rank: "3rd Officer", rankId: "R004", signOn: null },
    { crew: 10, vessel: 1, rank: "Chief Officer", rankId: "R002", signOn: "2026-01-10", archived: true },
    { crew: null, vessel: 1, rank: "4th Engineer", rankId: "R008", signOn: null },
    { crew: 12, vessel: 1, rank: "4th Engineer", rankId: "R008", signOn: "2026-09-15", deleted: true },
    // MV Beta Ocean — 6 primary + Oswin secondary (handover with Nadira) = 7 people, 7 assignments; 6 positions
    { crew: 13, vessel: 2, rank: "Master", rankId: "R001", signOn: "2026-04-01", reliefDue: "2026-10-01", months: 6 },              // OVERDUE
    { crew: 14, vessel: 2, rank: "Chief Officer", rankId: "R002", signOn: "2026-08-20", reliefDue: "2026-11-20", months: 3 },       // due within 1 month
    { crew: 23, vessel: 2, rank: "Chief Officer", rankId: "R002", status: "secondary", signOn: "2026-10-25", reliefDue: "2027-04-25", months: 6 },
    { crew: 15, vessel: 2, rank: "Chief Engineer", rankId: "R005", signOn: "2026-07-01", reliefDue: "2027-01-01", months: 6 },
    { crew: 16, vessel: 2, rank: "2nd Engineer", rankId: "R006", signOn: "2026-10-15", reliefDue: "2027-04-15", months: 6 },
    { crew: 17, vessel: 2, rank: "Electrical Officer", rankId: "R010", signOn: "2026-09-10", reliefDue: "2027-03-10", months: 6 },
    { crew: 18, vessel: 2, rank: "Oiler_1", rankId: "R021", signOn: "2026-06-20", reliefDue: "2026-12-20", months: 6 },
    // MV Alpha Trader — 5 on board; MV Gamma Bay — one empty Master slot; MV Epsilon Reef (inactive) — two empty slots (never counted)
    { crew: 19, vessel: 4, rank: "Master", rankId: "R001", signOn: "2026-09-01", reliefDue: "2027-03-01", months: 6 },
    { crew: 20, vessel: 4, rank: "Chief Engineer", rankId: "R005", signOn: "2026-09-01", reliefDue: "2027-03-01", months: 6 },
    { crew: 27, vessel: 4, rank: "Gas Engineer", rankId: "R011", signOn: "2026-09-15", reliefDue: "2027-03-15", months: 6 },
    { crew: 28, vessel: 4, rank: "Deck Cadet", rankId: "R012", signOn: "2026-10-01", reliefDue: "2027-04-01", months: 6 },
    { crew: 29, vessel: 4, rank: "AB_1", rankId: "RO15", signOn: "2026-08-10", reliefDue: "2027-02-10", months: 6 },
    { crew: null, vessel: 3, rank: "Master", rankId: "R001", signOn: null },
    { crew: null, vessel: 5, rank: "Master", rankId: "R001", signOn: null },
    { crew: null, vessel: 5, rank: "Chief Engineer", rankId: "R005", signOn: null },
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
    { crew: 21, type: "training", name: "Basic Safety Training", expiry: "2024-03-01" },
    { crew: 3, type: "training", name: "Crowd Management", expiry: "2026-11-01" },
    { crew: 23, type: "licence", name: "CoC Chief Mate", expiry: "2026-12-15" },
    { crew: 24, type: "licence", name: "CoC Third Officer", expiry: "2026-11-20" },
    { crew: 25, type: "training", name: "Basic Safety Training", expiry: "2026-11-22" },
    { crew: 26, type: "training", name: "Medical First Aid", expiry: "2026-11-25" },
    { crew: 27, type: "licence", name: "CoC Gas Engineer", expiry: "2026-12-05" },
    { crew: 28, type: "training", name: "Basic Safety Training", expiry: "2026-11-30" },
  ],
  // B4 — plans: two waiting (Proposed, Partially Approved), one draft, one archived
  rotation: [
    { n: 1, planId: "RP-2026-01", status: "Proposed", from: "2026-11-01", to: "2027-01-31", proposedOn: "2026-10-25", vessels: [1, 2],
      entries: [{ vessel: 1, rank: "Chief Officer", crew: 21, status: "Pending" }, { vessel: 2, rank: "Master", crew: 10, status: "Pending" }, { vessel: 1, rank: "Chief Engineer", crew: 12, status: "Deployed" }] },
    { n: 2, planId: "RP-2026-02", status: "Partially Approved", from: "2026-12-01", to: "2027-02-28", proposedOn: "2026-10-28", vessels: [4],
      entries: [{ vessel: 4, rank: "Master", crew: 9, status: "Deployed" }, { vessel: 4, rank: "Chief Engineer", crew: 11, status: "Rejected" }, { vessel: 4, rank: "AB", crew: 29, status: "Pending" }] },
    { n: 3, planId: "RP-2026-03", status: "In Draft", from: "2027-01-01", to: "2027-03-31", vessels: [3], entries: [{ vessel: 3, rank: "Master", crew: 13, status: "Pending" }] },
    { n: 4, planId: "RP-2025-09", status: "Archived", from: "2025-09-01", to: "2025-11-30", proposedOn: "2025-08-20", vessels: [1], entries: [{ vessel: 1, rank: "Master", crew: 1, status: "Deployed" }] },
  ],
  // B3 — October 2026 records on MV Beta Ocean (+ one on Alpha Star); codes per day. Rest mode counts A,C,E,F,G; H/I only with OPA.
  restHours: [
    { crew: 13, vessel: 2, month: "2026-10", days: { 3: ["A"], 10: ["A", "G"], 17: ["E"] }, updated: "2026-10-31" },          // 3 violation days → 1 NC
    { crew: 15, vessel: 2, month: "2026-10", days: { 5: ["C"] }, updated: "2026-10-28" },                                    // code C → 1 NC (1 violation day)
    { crew: 16, vessel: 2, month: "2026-10", days: { 20: ["H"] }, updated: "2026-10-30", applicableFrom: "2026-10-15" },     // OPA-only → 0 in rest mode, 1 with OPA
    { crew: 17, vessel: 2, month: "2026-10", days: {}, updated: "2026-10-29" },                                              // no violations
    { crew: 18, vessel: 2, month: "2026-10", days: { 2: ["A"], 12: ["B"] }, updated: "2026-10-26" },                         // 1 rest day (B is work mode)
    { crew: 4, vessel: 1, month: "2026-10", days: { 8: ["A"], 9: ["A"] }, updated: "2026-10-27" },                           // Alpha Star: 2 days
    { crew: 13, vessel: 2, month: "2026-09", days: { 1: ["A"] }, updated: "2026-09-30" },                                    // previous month
  ],
  // B6 — statuses: draft / preliminary / pending_review (pending) / reviewed (completed); terminated and archived crew excluded
  appraisals: [
    { n: 1, crew: 1, type: "Annual", date: "2026-09-15", status: "reviewed", overall: "B", competence: "A", vessel: "MV Alpha Star" },
    { n: 2, crew: 15, type: "Annual", date: "2026-08-01", status: "reviewed", overall: "A", competence: "A", vessel: "MV Beta Ocean" },
    { n: 3, crew: 2, type: "Annual", date: "2026-10-10", status: "pending_review", overall: "C", vessel: "MV Alpha Star" },   // score hidden: not completed
    { n: 4, crew: 21, type: "Sign-off", date: "2026-07-01", status: "submitted", vessel: "MV Alpha Star" },
    { n: 5, crew: 3, type: "Annual", date: "2026-10-20", status: "draft", overall: "B", vessel: "MV Alpha Star" },            // draft
    { n: 6, crew: 24, type: "Annual", date: "2026-09-01", status: "reviewed", overall: "A" },                                   // terminated → excluded
    { n: 7, crew: 22, type: "Annual", date: "2026-06-01", status: "draft" },                                                   // archived → excluded
    { n: 8, crew: 14, type: "Annual", date: "2026-10-05", status: "preliminary", vessel: "MV Beta Ocean" },                   // pending
    // 31-Oct-2026: the appraisal's OWN vessel (historical), matched by name only when exactly one vessel matches
    { n: 9, crew: 20, type: "Sign-off", date: "2026-05-01", status: "reviewed", overall: "A", vessel: "MV Alpha Star" },     // Tamsin: appraised on Alpha Star, now on Alpha Trader
    { n: 10, crew: 6, type: "Annual", date: "2026-10-01", status: "submitted", vessel: "  mv   ALPHA star " },              // case / spacing variant → matched
    { n: 11, crew: 5, type: "Annual", date: "2026-09-10", status: "draft", vessel: "Alpha Star (old name)" },                 // unmatched
    { n: 12, crew: 16, type: "Annual", date: "2026-09-20", status: "preliminary" },                                           // no vessel recorded → missing
  ],
};

export const B: Fixture = {
  vessels: [[1, "MV Alpha Star"], [2, "MV Delta Sky"], [3, "mv delta sky"]], // 3 = same normalised name → appraisal vessel AMBIGUOUS
  crew: [
    { n: 1, first: "Wendel", family: "Crossfeather", rank: "Master", nat: "GB" },
    { n: 2, first: "Xanthe", family: "Moorgrave", rank: "Chief Officer", nat: "GB" },
    { n: 3, first: "Yorick", family: "Fellhammer", rank: "Chief Engineer", nat: "HR" },
    { n: 4, first: "Zelia", family: "Brantwood", rank: "Second Engineer", nat: "HR" },
    { n: 5, first: "Abelard", family: "Nettlecombe", rank: "Master", nat: "IN" },
    { n: 6, first: "Brisa", family: "Halvorcrest", rank: "Chief Officer", nat: "IN" },
    { n: 7, first: "Cormac", family: "Tidewellyn", rank: "Chief Engineer", nat: "PH" },
    { n: 8, first: "Delphine", family: "Marrow", rank: "Second Officer", nat: "GB" },
    { n: 9, first: "Edric", family: "Sallowford", rank: "Chief Officer", nat: "IN", nextAvailability: "2026-11-20" }, // B1 isolation: available in B only
  ],
  plans: [
    { crew: 1, vessel: 1, rank: "Master", rankId: "R001", signOn: "2026-08-01", reliefDue: "2027-02-01", months: 6 },
    { crew: 2, vessel: 1, rank: "Chief Officer", rankId: "R002", signOn: "2026-08-01", reliefDue: "2026-11-15", months: 3 }, // due within 1 month
    { crew: 3, vessel: 1, rank: "Chief Engineer", rankId: "R005", signOn: "2026-08-01", reliefDue: "2027-02-01", months: 6 },
    { crew: 4, vessel: 1, rank: "2nd Engineer", rankId: "R006", signOn: "2026-08-01", reliefDue: "2027-02-01", months: 6 },
    { crew: 5, vessel: 2, rank: "Master", rankId: "R001", signOn: "2026-09-01", reliefDue: "2027-03-01", months: 6 },
    { crew: 6, vessel: 2, rank: "Chief Officer", rankId: "R002", signOn: "2026-09-01", reliefDue: "2027-03-01", months: 6 },
    { crew: 7, vessel: 2, rank: "Chief Engineer", rankId: "R005", signOn: "2026-09-01", reliefDue: "2027-03-01", months: 6 },
    // INVALID DATA (cannot arise through the UI — checkSignOnConflict refuses a second active sign-on): kept to show the tool's behaviour
    { crew: 8, vessel: 1, rank: "2nd Officer", rankId: "R003", signOn: "2026-08-15", reliefDue: "2027-02-15", months: 6 },
    { crew: 8, vessel: 2, rank: "2nd Officer", rankId: "R003", status: "secondary", signOn: "2026-10-20", reliefDue: "2027-04-20", months: 6 },
    { crew: null, vessel: 2, rank: "Oiler", rankId: "R021", signOn: null }, // B5: one vacancy in B
  ],
  docs: [
    { crew: 3, type: "licence", name: "CoC Chief Engineer", expiry: "2026-11-09" },
    { crew: 7, type: "training", name: "Advanced Fire Fighting", expiry: "2026-12-05" },
  ],
  rotation: [{ n: 1, planId: "RP-B-2026-01", status: "Proposed", from: "2026-11-01", to: "2027-01-31", proposedOn: "2026-10-20", vessels: [2], entries: [{ vessel: 2, rank: "Master", crew: 9, status: "Pending" }] }],
  restHours: [{ crew: 1, vessel: 1, month: "2026-10", days: { 4: ["A"] }, updated: "2026-10-25" }],
  appraisals: [{ n: 1, crew: 1, type: "Annual", date: "2026-09-01", status: "reviewed", overall: "B", vessel: "MV Alpha Star" }, { n: 2, crew: 2, type: "Annual", date: "2026-10-01", status: "submitted" },
    { n: 3, crew: 5, type: "Annual", date: "2026-10-03", status: "submitted", vessel: "MV Delta Sky" }],
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

/** A month of daily records in the RH module's stored shape: one entry per day; violations are the stored per-day codes. */
export function dailyRecordsJson(month: string, days: Record<number, string[]>): string {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out = [];
  for (let d = 1; d <= n; d++) {
    const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    out.push({ entryId: `day-${d}-primary`, day: d, dayOfWeek: dow, occurrence: "primary", hours: Array(48).fill(""), violations: days[d] ?? [], isPlan: false });
  }
  return JSON.stringify(out);
}

async function fill(db: string, t: "a" | "b", f: Fixture) {
  await withClient(db, async (c) => {
    const { rows } = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
    const wipe = rows.map((r) => r.table_name as string).filter((n) => !KEEP(n));
    await c.query(`TRUNCATE ${wipe.map((n) => `"${n}"`).join(", ")} RESTART IDENTITY CASCADE`);
    const userUuid = String((await c.query(`SELECT user_uuid FROM master_users ORDER BY id LIMIT 1`)).rows[0]?.user_uuid ?? u(t, "9", 1));
    for (const [n, name, active] of f.vessels) {
      await c.query(`INSERT INTO master_vessels (vessel_uuid, vessel, imo_number, is_active, is_deleted) VALUES ($1,$2,$3,$4,false)`,
        [u(t, "1", n), name, `${t === "a" ? 91 : 92}0000${n}`, active !== false]);
    }
    for (const m of f.crew) {
      await c.query(
        `INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, present_rank, nationality_uuid, status, is_active, archived_at, is_deleted,
           last_termination_category, last_termination_date, availability, next_availability, not_for_hire)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,$10,$11,$12,$13,$14)`,
        [u(t, "2", m.n), `TRIAL-${t.toUpperCase()}-${String(m.n).padStart(3, "0")}`, m.first, m.family, m.rank, NAT[m.nat],
          m.status ?? "Active", !m.inactive, m.archived ? new Date("2026-10-01T00:00:00Z") : null,
          m.terminationCategory ?? null, m.terminationCategory ? "2026-10-10" : null, m.availability ?? null, m.nextAvailability ?? null, !!m.notForHire]);
    }
    let i = 0;
    for (const p of f.plans) {
      i++;
      await c.query(
        `INSERT INTO vessel_planning_v2 (plan_uuid, vessel_uuid, rank_id, rank, crew_uuid, crew_status, sign_on_date, relief_due, is_archived, is_deleted,
           reliever_crew_uuid, reliever_sign_on_date, joining_status, contract_period_months, contract_end_range_start_months, contract_end_range_end_months)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [u(t, "3", i), u(t, "1", p.vessel), p.rankId, p.rank, p.crew === null ? null : u(t, "2", p.crew), p.status ?? "primary",
          p.signOn ?? null, p.reliefDue ?? null, !!p.archived, !!p.deleted,
          p.reliever ? u(t, "2", p.reliever) : null, p.relieverSignOn ?? null, p.reliever ? "Planned" : null,
          p.months ?? null, p.rangeStart ?? null, p.rangeEnd ?? null]);
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
    for (const r of f.rotation ?? []) {
      await c.query(`INSERT INTO rotation_drafts_v2 (draft_uuid, draft_id, plan_from_date, plan_to_date, plan_status, proposed_by_uuid, proposed_date, created_by_uuid, is_deleted)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$6,false)`, [u(t, "6", r.n), r.planId, r.from, r.to, r.status, userUuid, r.proposedOn ?? null]);
      let k = 0;
      for (const v of r.vessels) {
        k++;
        await c.query(`INSERT INTO rotation_draft_vessels_v2 (rv_uuid, draft_uuid, vessel_uuid, is_deleted) VALUES ($1,$2,$3,false)`, [u(t, "7", r.n * 100 + k), u(t, "6", r.n), u(t, "1", v)]);
      }
      for (const e of r.entries) {
        k++;
        await c.query(`INSERT INTO rotation_entries_v2 (entry_uuid, draft_uuid, vessel_uuid, rank, crew_uuid, proposal_status, sign_on_date, is_deleted)
          VALUES ($1,$2,$3,$4,$5,$6,$7,false)`, [u(t, "8", r.n * 100 + k), u(t, "6", r.n), u(t, "1", e.vessel), e.rank, e.crew ? u(t, "2", e.crew) : null, e.status, r.from]);
      }
    }
    let h = 0;
    for (const r of f.restHours ?? []) {
      h++;
      const crew = f.crew.find((x) => x.n === r.crew)!;
      await c.query(`INSERT INTO rh_daily_records_v2 (rh_daily_uuid, crew_member_id, vessel_id, rank, name, month_year, daily_records, opa_mode, applicable_from, updated_at, is_deleted)
        VALUES ($1,$2,$3,$4,$5,$6,$7,false,$8,$9,false)`,
        [u(t, "a", h), u(t, "2", r.crew), u(t, "1", r.vessel), crew.rank, `${crew.first} ${crew.family}`, r.month, dailyRecordsJson(r.month, r.days), r.applicableFrom ?? null, `${r.updated}T10:00:00Z`]);
    }
    for (const ap of f.appraisals ?? []) {
      // submitted statuses must carry a form-version pin (check constraint appraisal_results_v2_submitted_form_version_pin_check)
      const pinned = ap.status !== "draft";
      await c.query(`INSERT INTO appraisal_results_v2 (appraisal_uuid, crew_member_id, appraisal_type, appraisal_date, status, overall_rating, competence_rating, vessel, submitted_by,
          form_version_id, form_version_uuid, is_deleted)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false)`, [u(t, "b", ap.n), u(t, "2", ap.crew), ap.type, ap.date, ap.status, ap.overall ?? null, ap.competence ?? null, ap.vessel ?? null, userUuid,
          pinned ? 1 : null, pinned ? u(t, "d", 1) : null]);
      await c.query(`INSERT INTO appr_appraiser_comments_v2 (appraiser_comment_uuid, appraisal_uuid, comment, is_deleted) VALUES ($1,$2,$3,false)`,
        [u(t, "c", ap.n), u(t, "b", ap.n), "CONFIDENTIAL remark — must never be returned by the assistant"]);
    }
    const counts = await c.query(`SELECT (SELECT count(*) FROM crew_members_v2) crew, (SELECT count(*) FROM vessel_planning_v2) plans,
      (SELECT count(*) FROM crew_licenses) lic, (SELECT count(*) FROM crew_training_courses) trn, (SELECT count(*) FROM master_vessels) vessels,
      (SELECT count(*) FROM rotation_drafts_v2) rotation, (SELECT count(*) FROM rh_daily_records_v2) rh, (SELECT count(*) FROM appraisal_results_v2) appraisals`);
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
    await c.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [TEMPLATE]);
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

if (process.argv[1] && /setup-trial-dbs\.ts$/.test(process.argv[1].replace(/\\/g, "/"))) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
