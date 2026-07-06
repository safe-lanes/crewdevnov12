/**
 * Wage calculation engine — public surface.
 *
 * Only the engine service (which owns all ledger WRITES via the internal
 * LedgerRepository) and read-only ledger queries are exported. The
 * LedgerRepository itself is intentionally NOT exported: no route,
 * controller, or other service may write acc_wage_ledger_v2 rows.
 */
import { LedgerRepository } from "./ledgerRepository";

export { wageEngineService } from "./wageEngineService";
export type { CrewTotals, RunSummary } from "./wageEngineService";

const readOnlyRepo = new LedgerRepository();

/** Read-only ledger access for API endpoints. */
export const ledgerQueries = {
  findLinesByPortage: (portageUuid: string) =>
    readOnlyRepo.findLinesByPortage(portageUuid),
  findLinesByEngagementPeriod: (engagementUuid: string, period: string) =>
    readOnlyRepo.findLinesByEngagementPeriod(engagementUuid, period),
};
