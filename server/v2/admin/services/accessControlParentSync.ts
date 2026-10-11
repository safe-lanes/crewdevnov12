import type { Request } from "express";
import { sql } from "drizzle-orm";
import { getDb } from "../../db";
import { AccessControlError, appendAudit, lockAccessControl, managementSnapshot, normalizeRole, trustedRecoveryRoleIds,
  type AuditActor } from "./accessControlManagement";

export async function parentSyncActor(req: Request, host: string): Promise<AuditActor> {
  if (!req.user) throw new AccessControlError("Authenticated sync source required.");
  const user = (await getDb().execute(sql`SELECT id,user_type FROM master_users WHERE id=${req.user.id}`)).rows[0];
  if (!user || !user.user_type || normalizeRole(user.user_type) !== normalizeRole(req.user.userType))
    throw new AccessControlError("Sync actor identity mismatch.");
  return { masterUserId: user.id, userType: user.user_type, source: `trusted_parent_sync:${host}` };
}
export class UnrecoverableSnapshotError extends Error {
  constructor(public details: unknown) {
    super("PARENT SYNC REJECTED: snapshot would leave no eligible manager and no valid trusted recovery principal.");
  }
}
export async function roleSyncTransition<T>(db: any, source: AuditActor | undefined, replace: (tx: any) => Promise<T>): Promise<T> {
  if (!source?.source.startsWith("trusted_parent_sync:") || !Number.isSafeInteger(source.masterUserId))
    throw new AccessControlError("Trusted parent synchronization source required.");
  try {
    return await db.transaction(async (tx: any) => {
      await lockAccessControl(tx);
      const before = await managementSnapshot(tx);
      const result = await replace(tx);
      // Category-readiness switch: only a completed authoritative snapshot, never an Access Control/browser setting.
      const suppliedCategory = (await tx.execute(sql`SELECT ruid FROM adm_rolemaster_ac
        WHERE parent_owned=true AND COALESCE(is_deleted,false)=false AND lower(btrim(roletype))='sail admin'`)).rows;
      if (!before.categoryReady && suppliedCategory.length) {
        await tx.execute(sql`UPDATE adm_access_control_state SET category_ready=true,
          category_established_at=clock_timestamp(),category_evidence=${JSON.stringify({
            source, roleIds: suppliedCategory.map((r: any) => r.ruid), evidence: "completed_parent_role_snapshot",
          })}::jsonb WHERE singleton=true AND category_ready=false`);
      }
      const after = await managementSnapshot(tx);
      const recovery = trustedRecoveryRoleIds(after);
      const outcome = { eligibleHolderCountBefore: before.eligibleManagerCount,
        eligibleHolderCountAfter: after.eligibleManagerCount, categoryReadyBefore: before.categoryReady,
        categoryReadyAfter: after.categoryReady, recoveryRoute: after.categoryReady ? "parent_sail_admin" : "interim_names",
        recoveryRoleIds: recovery, recoveryActive: after.eligibleManagerCount === 0 };
      if (after.eligibleManagerCount === 0 && !recovery.length) throw new UnrecoverableSnapshotError(outcome);
      const affected = new Set([...before.roles, ...after.roles].filter(r => r.decision === true).map(r => r.ruid));
      for (const roleId of affected) {
        const was = before.eligible.some(r => r.ruid === roleId), now = after.eligible.some(r => r.ruid === roleId);
        if (was === now) continue; // An unchanged refresh never reports lost authority.
        const stored = after.roles.find(r => r.ruid === roleId)?.decision ??
          before.roles.find(r => r.ruid === roleId)?.decision ?? null;
        await appendAudit(tx, source, "parent_sync_management_eligibility", roleId, "access_control", "management_eligibility",
          { eligible: was, storedManagementDecision: stored }, { eligible: now, storedManagementDecision: stored },
          { ...outcome, affectedRoleIds: [...affected].filter(id =>
            before.eligible.some(r => r.ruid === id) !== after.eligible.some(r => r.ruid === id)) });
      }
      if (before.categoryReady !== after.categoryReady)
        await appendAudit(tx, source, "parent_sync_category_readiness", null, "access_control", "category_readiness",
          before.categoryReady, after.categoryReady, outcome);
      return result;
    });
  } catch (error: any) {
    // The replacement transaction is rolled back first. This is a rejection event, not a successful change.
    await db.transaction(async (tx: any) => {
      await lockAccessControl(tx);
      await appendAudit(tx, source, "parent_sync_rejected", null, "access_control", "snapshot_rejected",
        null, null, { reason: error.message, proposedOutcome: error.details ?? null, existingStatePreserved: true });
    });
    throw error;
  }
}
