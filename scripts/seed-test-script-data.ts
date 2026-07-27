/**
 * Seed data for the Accounts manual test script (docs/accounts-manual-test-script.md), Phase E.
 *
 * Creates, idempotently:
 *   - vessel  MV CHECKMATE                (vessel_type NULL so the fleet-wide MTS SCALE 2026 matches)
 *   - 5 crew  with the exact names, rank codes and sign-on dates from the dataset table
 *   - their vessel assignments on MV CHECKMATE
 *
 * Rank codes are stored as adm_company_ranks_v2.rank_id values (R001 / R002 / R015), NOT rank names,
 * because the engagement sync resolves a valid rank code directly; storing a display name that does
 * not match a rank silently breaks every wage-scale lookup.
 *
 * Run:
 *   npx tsx scripts/seed-test-script-data.ts
 *
 * Verify (should print 5 crew rows with rank codes R001/R002/R015 and the assignment dates):
 *   npx tsx scripts/seed-test-script-data.ts --verify
 *
 * The script is safe to run repeatedly: it matches existing rows by stable business keys
 * (vessel name, crew emp_no, assignment triple) and revives any soft-deleted matches instead of
 * inserting duplicates that would collide with unique constraints.
 */
import { Pool } from "pg";
import { randomUUID } from "crypto";

const VESSEL_NAME = "MV CHECKMATE";

// Stable UUIDs so repeated runs and cross-references stay identical.
const VESSEL_UUID = "c4ec0000-0000-4000-8000-000000000001";

interface CrewSeed {
  code: string; // dataset code (C1..C5), used for logging only
  empNo: string; // stable business key
  crewUuid: string;
  firstName: string;
  familyName: string;
  rankCode: string; // adm_company_ranks_v2.rank_id
  rankLabel: string; // for logging
  signOn: string; // YYYY-MM-DD
  signOff: string | null;
  assignUuid: string;
}

const CREW: CrewSeed[] = [
  { code: "C1", empNo: "CHKMT-C1", crewUuid: "c4ec0000-0000-4000-8000-0000000000c1", firstName: "JOHN", familyName: "MASTERSON", rankCode: "R001", rankLabel: "Master", signOn: "2026-03-01", signOff: null, assignUuid: "c4ec0000-0000-4000-8000-0000000000a1" },
  { code: "C2", empNo: "CHKMT-C2", crewUuid: "c4ec0000-0000-4000-8000-0000000000c2", firstName: "CARLOS", familyName: "OFICIAL", rankCode: "R002", rankLabel: "Chief Officer", signOn: "2026-03-01", signOff: null, assignUuid: "c4ec0000-0000-4000-8000-0000000000a2" },
  { code: "C3", empNo: "CHKMT-C3", crewUuid: "c4ec0000-0000-4000-8000-0000000000c3", firstName: "ANDRES", familyName: "BODEGA", rankCode: "R015", rankLabel: "Able Seaman", signOn: "2026-03-01", signOff: null, assignUuid: "c4ec0000-0000-4000-8000-0000000000a3" },
  { code: "C4", empNo: "CHKMT-C4", crewUuid: "c4ec0000-0000-4000-8000-0000000000c4", firstName: "BEN", familyName: "DECKER", rankCode: "R015", rankLabel: "Able Seaman", signOn: "2026-03-01", signOff: null, assignUuid: "c4ec0000-0000-4000-8000-0000000000a4" },
  { code: "C5", empNo: "CHKMT-C5", crewUuid: "c4ec0000-0000-4000-8000-0000000000c5", firstName: "SAMUEL", familyName: "PARTIDA", rankCode: "R015", rankLabel: "Able Seaman", signOn: "2026-03-15", signOff: "2026-04-20", assignUuid: "c4ec0000-0000-4000-8000-0000000000a5" },
];

async function assertRankCodesExist(pool: Pool): Promise<void> {
  const codes = Array.from(new Set(CREW.map((c) => c.rankCode)));
  const res = await pool.query(
    `SELECT DISTINCT rank_id FROM adm_company_ranks_v2
       WHERE rank_id = ANY($1) AND COALESCE(is_deleted, false) = false`,
    [codes],
  );
  const found = new Set(res.rows.map((r: any) => r.rank_id));
  const missing = codes.filter((c) => !found.has(c));
  if (missing.length > 0) {
    throw new Error(
      `Required rank code(s) missing from adm_company_ranks_v2: ${missing.join(", ")}. ` +
        `Seed the company ranks master before running this script.`,
    );
  }
}

async function upsertVessel(pool: Pool): Promise<string> {
  const existing = await pool.query(
    `SELECT vessel_uuid FROM master_vessels WHERE vessel = $1 LIMIT 1`,
    [VESSEL_NAME],
  );
  if (existing.rows.length > 0) {
    const uuid = existing.rows[0].vessel_uuid as string;
    // Ensure vessel_type stays NULL so the fleet-wide scale matches.
    await pool.query(
      `UPDATE master_vessels SET vessel_type = NULL WHERE vessel_uuid = $1`,
      [uuid],
    );
    console.log(`  vessel "${VESSEL_NAME}" already exists (${uuid}) — left in place`);
    return uuid;
  }
  await pool.query(
    `INSERT INTO master_vessels (vessel_uuid, vessel, vessel_type, flag)
       VALUES ($1, $2, NULL, $3)`,
    [VESSEL_UUID, VESSEL_NAME, "N/A"],
  );
  console.log(`  vessel "${VESSEL_NAME}" created (${VESSEL_UUID})`);
  return VESSEL_UUID;
}

async function upsertCrew(pool: Pool, c: CrewSeed): Promise<string> {
  const existing = await pool.query(
    `SELECT crew_uuid FROM crew_members_v2 WHERE emp_no = $1 LIMIT 1`,
    [c.empNo],
  );
  if (existing.rows.length > 0) {
    const uuid = existing.rows[0].crew_uuid as string;
    await pool.query(
      `UPDATE crew_members_v2
          SET first_name = $2, family_name = $3, present_rank = $4,
              status = 'active', is_active = true, is_deleted = false, updated_at = now()
        WHERE crew_uuid = $1`,
      [uuid, c.firstName, c.familyName, c.rankCode],
    );
    console.log(`  crew ${c.code} ${c.firstName} ${c.familyName} exists (${uuid}) — refreshed`);
    return uuid;
  }
  await pool.query(
    `INSERT INTO crew_members_v2
        (crew_uuid, emp_no, first_name, family_name, present_rank, status, is_active, is_deleted, is_sync, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'active', true, false, false, now(), now())`,
    [c.crewUuid, c.empNo, c.firstName, c.familyName, c.rankCode],
  );
  console.log(`  crew ${c.code} ${c.firstName} ${c.familyName} created (${c.crewUuid}, rank ${c.rankCode})`);
  return c.crewUuid;
}

async function upsertAssignment(pool: Pool, c: CrewSeed, crewUuid: string, vesselUuid: string): Promise<void> {
  const existing = await pool.query(
    `SELECT assign_uuid FROM crew_assignments
       WHERE crew_uuid = $1 AND vessel_uuid = $2 AND sign_on_date = $3 LIMIT 1`,
    [crewUuid, vesselUuid, c.signOn],
  );
  const isCurrent = c.signOff === null;
  if (existing.rows.length > 0) {
    const uuid = existing.rows[0].assign_uuid as string;
    await pool.query(
      `UPDATE crew_assignments
          SET sign_off_date = $2, is_current = $3, assignment_type = 'OnBoard',
              is_deleted = false, updated_at = now()
        WHERE assign_uuid = $1`,
      [uuid, c.signOff, isCurrent],
    );
    console.log(`  assignment ${c.code} exists (${uuid}) — refreshed`);
    return;
  }
  await pool.query(
    `INSERT INTO crew_assignments
        (assign_uuid, crew_uuid, vessel_uuid, is_current, sign_on_date, sign_off_date, assignment_type, is_deleted, is_sync, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'OnBoard', false, false, now(), now())`,
    [c.assignUuid, crewUuid, vesselUuid, isCurrent, c.signOn, c.signOff],
  );
  console.log(`  assignment ${c.code} created (${c.assignUuid}) sign-on ${c.signOn}${c.signOff ? ` sign-off ${c.signOff}` : ""}`);
}

async function verify(pool: Pool): Promise<void> {
  const res = await pool.query(
    `SELECT cm.emp_no, cm.first_name, cm.family_name, cm.present_rank,
            a.sign_on_date, a.sign_off_date, mv.vessel
       FROM crew_members_v2 cm
       JOIN crew_assignments a ON a.crew_uuid = cm.crew_uuid AND COALESCE(a.is_deleted,false)=false
       JOIN master_vessels mv ON mv.vessel_uuid = a.vessel_uuid
      WHERE cm.emp_no = ANY($1) AND mv.vessel = $2
      ORDER BY cm.emp_no`,
    [CREW.map((c) => c.empNo), VESSEL_NAME],
  );
  console.log("\nVerification — expected 5 rows on MV CHECKMATE:");
  console.table(
    res.rows.map((r: any) => ({
      emp_no: r.emp_no,
      name: `${r.first_name} ${r.family_name}`,
      rank_code: r.present_rank,
      sign_on: r.sign_on_date,
      sign_off: r.sign_off_date ?? "—",
    })),
  );
  const expectedRanks: Record<string, string> = { "CHKMT-C1": "R001", "CHKMT-C2": "R002", "CHKMT-C3": "R015", "CHKMT-C4": "R015", "CHKMT-C5": "R015" };
  const problems: string[] = [];
  if (res.rows.length !== 5) problems.push(`expected 5 rows, found ${res.rows.length}`);
  for (const r of res.rows) {
    if (expectedRanks[r.emp_no] !== r.present_rank) {
      problems.push(`${r.emp_no}: rank code ${r.present_rank} (expected ${expectedRanks[r.emp_no]})`);
    }
  }
  if (problems.length > 0) {
    console.error("\n✗ Verification FAILED:\n  " + problems.join("\n  "));
    process.exitCode = 1;
  } else {
    console.log("\n✓ Verification passed: 5 crew on MV CHECKMATE with rank codes R001/R002/R015×3.");
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set.");
  const pool = new Pool({ connectionString });
  try {
    if (process.argv.includes("--verify")) {
      await verify(pool);
      return;
    }
    console.log(`Seeding Accounts manual-test data (vessel "${VESSEL_NAME}", 5 crew)...`);
    await assertRankCodesExist(pool);
    const vesselUuid = await upsertVessel(pool);
    for (const c of CREW) {
      const crewUuid = await upsertCrew(pool, c);
      await upsertAssignment(pool, c, crewUuid, vesselUuid);
    }
    await verify(pool);
    console.log("\nDone. Next: in Accounts run the engagement sync for MV CHECKMATE, then set C2's seniority anchor.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
