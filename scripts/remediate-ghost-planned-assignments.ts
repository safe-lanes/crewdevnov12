/**
 * Close the seven historic Planned crew assignments identified by the
 * September 2026 crew-assignment integrity investigation.
 *
 * Run:
 *   npx tsx scripts/remediate-ghost-planned-assignments.ts
 *
 * The script is transactional and fail-closed. It will only proceed when all
 * seven rows are either still in the exact expected source state or are all
 * already in the exact target state from a previous successful run.
 */
import { Pool, type PoolClient } from "pg";

const VESSEL_NOT_IN_MASTER_REASON =
  "Historic remediation - vessel not in active master";
const NO_PLANNING_RECORD_REASON =
  "Historic remediation - no planning record";

const VESSEL_NOT_IN_MASTER_ASSIGNMENTS = [
  "d92219fa-686a-4877-91ba-cff8a249fb2d",
  "5bc158bd-00c4-494f-ad0d-eaca8967bc28",
  "d08f42d7-cc82-4447-8ae2-e745217748aa",
  "3109e449-ffd2-46b9-b8a3-2d4affc679db",
  "64028ca0-6da7-4b12-a5c5-cc7759ca1044",
  "5d09e503-5a52-4008-9c3c-feb4104c6154",
] as const;

const NO_PLANNING_RECORD_ASSIGNMENT =
  "cc173268-2d72-4434-8549-4daab7e29fb9";

const ALL_ASSIGNMENTS = [
  ...VESSEL_NOT_IN_MASTER_ASSIGNMENTS,
  NO_PLANNING_RECORD_ASSIGNMENT,
];

interface AssignmentRow {
  assign_uuid: string;
  crew_uuid: string;
  vessel_uuid: string;
  is_current: boolean;
  assignment_type: string;
  reason: string | null;
  is_deleted: boolean;
}

function expectedReason(assignUuid: string): string {
  return assignUuid === NO_PLANNING_RECORD_ASSIGNMENT
    ? NO_PLANNING_RECORD_REASON
    : VESSEL_NOT_IN_MASTER_REASON;
}

function isSourceState(row: AssignmentRow): boolean {
  return (
    row.assignment_type === "Planned" &&
    row.is_deleted === false
  );
}

function isTargetState(row: AssignmentRow): boolean {
  return (
    row.assignment_type === "Cancelled" &&
    row.is_current === false &&
    row.is_deleted === false &&
    row.reason === expectedReason(row.assign_uuid)
  );
}

async function assertVesselConditions(
  client: PoolClient,
  rows: AssignmentRow[],
): Promise<void> {
  const rowsByUuid = new Map(rows.map((row) => [row.assign_uuid, row]));
  const absentVesselUuids = Array.from(
    new Set(
      VESSEL_NOT_IN_MASTER_ASSIGNMENTS.map(
        (assignUuid) => rowsByUuid.get(assignUuid)!.vessel_uuid,
      ),
    ),
  );

  const unexpectedMasterRows = await client.query(
    `SELECT vessel_uuid
       FROM master_vessels
      WHERE vessel_uuid = ANY($1::text[])
        AND COALESCE(is_deleted, false) = false`,
    [absentVesselUuids],
  );
  if (unexpectedMasterRows.rowCount !== 0) {
    throw new Error(
      `Expected remediation vessels to be absent from the active master, but found: ${
        unexpectedMasterRows.rows
          .map((row: { vessel_uuid: string }) => row.vessel_uuid)
          .join(", ")
      }`,
    );
  }

  const noPlanningAssignment = rowsByUuid.get(NO_PLANNING_RECORD_ASSIGNMENT)!;
  const liveVessel = await client.query(
    `SELECT vessel_uuid
       FROM master_vessels
      WHERE vessel_uuid = $1
        AND COALESCE(is_deleted, false) = false`,
    [noPlanningAssignment.vessel_uuid],
  );
  if (liveVessel.rowCount !== 1) {
    throw new Error(
      `Expected ${noPlanningAssignment.vessel_uuid} to resolve to exactly one active master vessel`,
    );
  }

  const planningRows = await client.query(
    `SELECT plan_uuid
       FROM vessel_planning_v2
      WHERE vessel_uuid = $1
        AND COALESCE(is_deleted, false) = false
        AND (crew_uuid = $2 OR reliever_crew_uuid = $2)`,
    [noPlanningAssignment.vessel_uuid, noPlanningAssignment.crew_uuid],
  );
  if (planningRows.rowCount !== 0) {
    throw new Error(
      `Expected no planning record for assignment ${NO_PLANNING_RECORD_ASSIGNMENT}`,
    );
  }
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query<AssignmentRow>(
      `SELECT assign_uuid, crew_uuid, vessel_uuid, is_current,
              assignment_type, reason, is_deleted
         FROM crew_assignments
        WHERE assign_uuid = ANY($1::text[])
        ORDER BY assign_uuid
        FOR UPDATE`,
      [ALL_ASSIGNMENTS],
    );

    if (result.rowCount !== ALL_ASSIGNMENTS.length) {
      const found = new Set(result.rows.map((row) => row.assign_uuid));
      const missing = ALL_ASSIGNMENTS.filter((uuid) => !found.has(uuid));
      throw new Error(`Missing expected assignment rows: ${missing.join(", ")}`);
    }

    const sourceRows = result.rows.filter(isSourceState);
    const targetRows = result.rows.filter(isTargetState);

    if (targetRows.length === ALL_ASSIGNMENTS.length) {
      await client.query("ROLLBACK");
      console.log("All seven assignments are already in the target state.");
      return;
    }

    if (sourceRows.length !== ALL_ASSIGNMENTS.length) {
      const drifted = result.rows
        .filter((row) => !isSourceState(row))
        .map((row) => row.assign_uuid);
      throw new Error(
        `Assignment state changed before remediation: ${drifted.join(", ")}`,
      );
    }

    await assertVesselConditions(client, result.rows);

    const absentUpdate = await client.query(
      `UPDATE crew_assignments
          SET is_current = false,
              assignment_type = 'Cancelled',
              reason = $1
        WHERE assign_uuid = ANY($2::text[])
          AND assignment_type = 'Planned'
          AND is_deleted = false`,
      [VESSEL_NOT_IN_MASTER_REASON, VESSEL_NOT_IN_MASTER_ASSIGNMENTS],
    );
    if (absentUpdate.rowCount !== VESSEL_NOT_IN_MASTER_ASSIGNMENTS.length) {
      throw new Error(
        `Expected to update ${VESSEL_NOT_IN_MASTER_ASSIGNMENTS.length} absent-vessel rows, updated ${absentUpdate.rowCount}`,
      );
    }

    const noPlanningUpdate = await client.query(
      `UPDATE crew_assignments
          SET is_current = false,
              assignment_type = 'Cancelled',
              reason = $1
        WHERE assign_uuid = $2
          AND assignment_type = 'Planned'
          AND is_deleted = false`,
      [NO_PLANNING_RECORD_REASON, NO_PLANNING_RECORD_ASSIGNMENT],
    );
    if (noPlanningUpdate.rowCount !== 1) {
      throw new Error(
        `Expected to update one no-planning row, updated ${noPlanningUpdate.rowCount}`,
      );
    }

    const verification = await client.query<AssignmentRow>(
      `SELECT assign_uuid, crew_uuid, vessel_uuid, is_current,
              assignment_type, reason, is_deleted
         FROM crew_assignments
        WHERE assign_uuid = ANY($1::text[])
        ORDER BY assign_uuid`,
      [ALL_ASSIGNMENTS],
    );
    const invalid = verification.rows.filter((row) => !isTargetState(row));
    if (
      verification.rowCount !== ALL_ASSIGNMENTS.length ||
      invalid.length > 0
    ) {
      throw new Error(
        `Post-update verification failed for: ${
          invalid.map((row) => row.assign_uuid).join(", ") || "missing rows"
        }`,
      );
    }

    await client.query("COMMIT");
    console.log("Closed seven historic Planned crew assignments.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});