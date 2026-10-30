/**
 * PILOT TRIAL — proves the runner itself is read-only and time-bounded (independent of the tools' SQL):
 *   1. a write issued inside runReadOnly is rejected by Postgres (read-only transaction, SQLSTATE 25006)
 *   2. a statement longer than ASSISTANT_DATA_STATEMENT_TIMEOUT_MS ends as DataTimeoutError (never a result)
 * Usage: MASTER_DATABASE_URL=<…/crew_trial_master> DATABASE_URL=<…/crew_trial_a> ASSISTANT_DATA_STATEMENT_TIMEOUT_MS=300 \
 *        npx tsx scripts/assistant-trial/readonly-timeout-check.ts
 */
import { sql } from "drizzle-orm";
import { tenantConnectionManager } from "../../server/utils/tenantConnectionManager";
import { DataTimeoutError, runReadOnly } from "../../server/v2/assistant/repositories/assistantDataRepository";

(async () => {
  await tenantConnectionManager.init();
  const out: string[] = [];
  await tenantConnectionManager.runInTenantContext("crew_trial_a", async () => {
    const before = await runReadOnly((q) => q(sql`SELECT count(*)::int AS n FROM master_vessels`));
    try {
      await runReadOnly((q) => q(sql`INSERT INTO master_vessels (vessel_uuid, vessel) VALUES ('ro-test', 'RO TEST')`));
      out.push("FAIL write was accepted");
    } catch (e: unknown) {
      const code = (e as { code?: string; cause?: { code?: string } }).code ?? (e as { cause?: { code?: string } }).cause?.code;
      out.push(code === "25006" ? "PASS write rejected: read-only transaction (25006)" : `FAIL unexpected error ${code} ${(e as Error).message}`);
    }
    const after = await runReadOnly((q) => q(sql`SELECT count(*)::int AS n FROM master_vessels`));
    out.push(before[0].n === after[0].n ? `PASS vessel count unchanged (${after[0].n})` : "FAIL count changed");
    try {
      await runReadOnly((q) => q(sql`SELECT pg_sleep(2)`));
      out.push("FAIL slow statement returned");
    } catch (e: unknown) {
      out.push(e instanceof DataTimeoutError ? "PASS slow statement stopped as DataTimeoutError" : `FAIL ${(e as Error).message}`);
    }
  });
  console.log(out.join("\n"));
  await tenantConnectionManager.closeAll();
  process.exit(out.some((l) => l.startsWith("FAIL")) ? 1 : 0);
})();
