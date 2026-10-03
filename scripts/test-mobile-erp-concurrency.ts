/**
 * Live PostgreSQL harness for the 20-request approval invariant.
 * It deliberately refuses to mock the database. Run only against an isolated,
 * migrated test database: DATABASE_URL=... npx tsx scripts/test-mobile-erp-concurrency.ts
 */
import pg from "pg";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("NOT VERIFIED — LIVE POSTGRESQL REQUIRED (DATABASE_URL is not configured)");
  process.exit(2);
}
if (process.env.ALLOW_ERP_CONCURRENCY_TEST !== "true") {
  console.error("Refusing to alter a database without ALLOW_ERP_CONCURRENCY_TEST=true");
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url, max: 24 });
const pendingUuid = randomUUID();
const operationUuid = randomUUID();
const domain = `erp-worker-test-${randomUUID()}.invalid`;
const crewUuid = randomUUID();

async function approve(index: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `UPDATE app_crew_pending_changes SET status='approved', reviewed_by_uuid=$2, reviewed_at=now(), updated_at=now()
       WHERE pending_uuid=$1 AND status='pending' RETURNING *`, [pendingUuid, `reviewer-${index}`],
    );
    if (!claimed.rowCount) { await client.query("ROLLBACK"); return false; }
    await client.query(
      `INSERT INTO app_crew_pending_reviews(review_uuid,pending_uuid,decision,reviewer_uuid)
       VALUES($1,$2,'approved',$3)`, [randomUUID(), pendingUuid, `reviewer-${index}`],
    );
    await client.query(
      `INSERT INTO app_crew_erp_commands(command_uuid,pending_uuid,operation_uuid,domain,crew_uuid,command_type,status,approved_payload_hash)
       VALUES($1,$2,$3,$4,$5,'UPDATE_CREW_PARTICULARS','queued',$6)`,
      [randomUUID(), pendingUuid, operationUuid, domain, crewUuid, "live-harness-placeholder-hash"],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

try {
  await pool.query(
    `INSERT INTO app_crew_pending_changes
      (pending_uuid,operation_uuid,domain,crew_uuid,section,action,target_uuid,payload,staged_attachments,status,is_deleted,is_sync)
     VALUES($1,$2,$3,$4,'particulars','update',NULL,$5,'[]','pending',false,false)`,
    [pendingUuid, operationUuid, domain, crewUuid, '{"firstName":"Concurrency Test"}'],
  );
  const outcomes = await Promise.all(Array.from({ length: 20 }, (_, index) => approve(index)));
  const counts = await pool.query(
    `SELECT
      (SELECT count(*)::int FROM app_crew_pending_changes WHERE pending_uuid=$1 AND status='approved') AS pending_transition,
      (SELECT count(*)::int FROM app_crew_pending_reviews WHERE pending_uuid=$1) AS reviews,
      (SELECT count(*)::int FROM app_crew_erp_commands WHERE pending_uuid=$1) AS commands`, [pendingUuid],
  );
  console.log(JSON.stringify({ approvalWinners: outcomes.filter(Boolean).length, ...counts.rows[0], authoritativeMutation: "NOT VERIFIED — worker requires a seeded authoritative crew record" }, null, 2));
} finally {
  await pool.query("DELETE FROM app_crew_erp_commands WHERE pending_uuid=$1", [pendingUuid]);
  await pool.query("DELETE FROM app_crew_pending_reviews WHERE pending_uuid=$1", [pendingUuid]);
  await pool.query("DELETE FROM app_crew_pending_changes WHERE pending_uuid=$1", [pendingUuid]);
  await pool.end();
}
