import { sql } from "drizzle-orm";

/**
 * Centralized audit-user stamp. On every call sets `updatedByUuid` and
 * `updatedAt` together so each write records who and when atomically. The
 * timestamp uses SQL `now()` (the transaction timestamp) rather than Node's
 * `new Date()`, so it depends only on the Postgres `TimeZone` setting and stays
 * consistent with `created_at` (`defaultNow()` = `now()`). On create it also
 * sets `createdByUuid`. The actor is read from a transient `auditUserUuid` field
 * on the payload, which is stripped from the returned object.
 */
export function applyAuditUser<T extends object>(data: T, isCreate = false): T & { createdByUuid?: string | null; updatedByUuid?: string | null } {
  const auditUserUuid = (data as any).auditUserUuid || null;
  const result = { ...data } as any;
  delete result.auditUserUuid;

  if (isCreate) {
    result.createdByUuid = auditUserUuid;
  }
  result.updatedByUuid = auditUserUuid;
  result.updatedAt = sql`now()`;

  return result;
}
