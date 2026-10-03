import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { appCrewErpCommands, appCrewPendingChanges } from "../../../../shared/v2/crew-app/schema";
import { assertTransition, type CommandStatus } from "./commandStateMachine";

export type ErpCommandRow = typeof appCrewErpCommands.$inferSelect;
export type PendingRow = typeof appCrewPendingChanges.$inferSelect;

function rowsOf(result: any): any[] { return result?.rows ?? result ?? []; }

export const erpCommandRepository = {
  async leaseNext(owner: string, leaseSeconds = 60): Promise<(ErpCommandRow & { recoveryMode: "execute" | "verify" }) | undefined> {
    const result = await getDb().execute(sql`
      WITH candidate AS (
        SELECT command_uuid, status AS previous_status
        FROM app_crew_erp_commands
        WHERE (
          (status IN ('queued','retryable') AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
          OR (status = 'leased' AND lease_expires_at < now())
          OR (status IN ('applying','verifying') AND lease_expires_at < now())
        )
        ORDER BY CASE WHEN status IN ('applying','verifying') THEN 0 ELSE 1 END, created_at
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE app_crew_erp_commands c SET
        status = CASE WHEN candidate.previous_status IN ('applying','verifying') THEN 'verifying' ELSE 'leased' END,
        lease_owner = ${owner}, lease_expires_at = now() + (${leaseSeconds} * interval '1 second'),
        last_attempt_at = now(),
        attempt_count = CASE WHEN candidate.previous_status IN ('applying','verifying') THEN c.attempt_count ELSE c.attempt_count + 1 END,
        updated_at = now()
      FROM candidate WHERE c.command_uuid = candidate.command_uuid
      RETURNING c.*, candidate.previous_status
    `);
    const row = rowsOf(result)[0];
    if (!row) return undefined;
    return {
      id: row.id, commandUuid: row.command_uuid, pendingUuid: row.pending_uuid,
      operationUuid: row.operation_uuid, domain: row.domain, crewUuid: row.crew_uuid,
      commandType: row.command_type, status: row.status, attemptCount: row.attempt_count,
      leaseOwner: row.lease_owner, leaseExpiresAt: row.lease_expires_at,
      lastAttemptAt: row.last_attempt_at, nextAttemptAt: row.next_attempt_at,
      resultJson: row.result_json, errorCode: row.error_code,
      lastErrorSummary: row.last_error_summary, authoritativeRecordUuid: row.authoritative_record_uuid,
      authoritativeResultHash: row.authoritative_result_hash, approvedPayloadHash: row.approved_payload_hash,
      appliedAt: row.applied_at, reconciledAt: row.reconciled_at,
      createdAt: row.created_at, updatedAt: row.updated_at,
      recoveryMode: ["applying", "verifying"].includes(row.previous_status) ? "verify" : "execute",
    } as any;
  },

  async loadPending(command: ErpCommandRow): Promise<PendingRow | undefined> {
    const [row] = await getDb().select().from(appCrewPendingChanges).where(and(
      eq(appCrewPendingChanges.pendingUuid, command.pendingUuid),
      eq(appCrewPendingChanges.domain, command.domain),
      eq(appCrewPendingChanges.crewUuid, command.crewUuid),
      eq(appCrewPendingChanges.status, "approved"),
      eq(appCrewPendingChanges.isDeleted, false),
    )).limit(1);
    return row;
  },

  async transition(command: ErpCommandRow, to: CommandStatus, values: Partial<ErpCommandRow> = {}): Promise<ErpCommandRow> {
    assertTransition(command.status as CommandStatus, to);
    const [updated] = await getDb().update(appCrewErpCommands).set({
      ...values, status: to, updatedAt: new Date(),
      ...(to === "applied" ? { appliedAt: new Date(), leaseOwner: null, leaseExpiresAt: null } : {}),
      ...(["blocked", "manual_reconciliation_required", "reconciliation_required", "dead_letter"].includes(to)
        ? { leaseOwner: null, leaseExpiresAt: null } : {}),
    }).where(and(
      eq(appCrewErpCommands.commandUuid, command.commandUuid),
      eq(appCrewErpCommands.status, command.status),
      command.leaseOwner ? eq(appCrewErpCommands.leaseOwner, command.leaseOwner) : sql`true`,
    )).returning();
    if (!updated) throw new Error("ERP command lease/state changed concurrently");
    return updated;
  },

  async queueStats() {
    const result = await getDb().execute(sql`SELECT
      count(*) FILTER (WHERE status = 'queued')::int AS queue_depth,
      count(*) FILTER (WHERE status = 'retryable')::int AS retryable_count,
      count(*) FILTER (WHERE status IN ('leased','applying','verifying'))::int AS active_leases,
      count(*) FILTER (WHERE status = 'reconciliation_required')::int AS reconciliation_required_count,
      count(*) FILTER (WHERE status = 'manual_reconciliation_required')::int AS manual_reconciliation_count,
      count(*) FILTER (WHERE status = 'dead_letter')::int AS dead_letter_count,
      COALESCE(EXTRACT(EPOCH FROM (now() - min(created_at) FILTER (WHERE status IN ('queued','retryable')))), 0)::int AS oldest_queued_age_seconds,
      count(*) FILTER (WHERE status IN ('queued','retryable') AND created_at < now() - interval '15 minutes')::int AS stale_queue_count,
      count(*) FILTER (WHERE status IN ('leased','applying','verifying') AND lease_expires_at < now())::int AS expired_lease_count
      FROM app_crew_erp_commands`);
    return rowsOf(result)[0] ?? {};
  },
};
