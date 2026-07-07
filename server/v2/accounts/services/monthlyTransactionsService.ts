import { MonthlyTransactionsRepository } from "../repositories";
import type {
  AccMonthlyTransactionV2,
  InsertAccMonthlyTransactionV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const repo = new MonthlyTransactionsRepository();

function conflict(message: string): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = "CONFLICT";
  return err;
}

/**
 * Refuse any mutation touching a vessel-month whose portage bill is locked
 * (spec: after lock the monthly-transactions grid is read-only).
 */
async function assertUnlocked(
  vesselUuid: string | null | undefined,
  period: string,
): Promise<void> {
  if (!vesselUuid) return;
  const portage = await repo.findPortage(vesselUuid, period);
  if (portage && (portage.isLocked || portage.status === "locked")) {
    throw conflict(
      `Portage bill for vessel ${vesselUuid} period ${period} is locked; monthly transactions are read-only`,
    );
  }
}

export const monthlyTransactionsService = {
  async getAll(filters?: {
    vesselUuid?: string;
    period?: string;
    crewUuid?: string;
    engagementUuid?: string;
    status?: string;
  }): Promise<AccMonthlyTransactionV2[]> {
    return repo.findAll(filters);
  },

  async getByUuid(txnUuid: string): Promise<AccMonthlyTransactionV2> {
    const record = await repo.findByUuid(txnUuid);
    if (!record) {
      throw new Error(`Monthly transaction not found: ${txnUuid}`);
    }
    return record;
  },

  async create(
    data: Omit<InsertAccMonthlyTransactionV2, "txnUuid"> & {
      auditUserUuid?: string;
    },
  ): Promise<AccMonthlyTransactionV2> {
    await assertUnlocked(data.vesselUuid, data.period);
    return repo.create(applyAuditUser(data, true));
  },

  async update(
    txnUuid: string,
    data: Partial<InsertAccMonthlyTransactionV2> & { auditUserUuid?: string },
  ): Promise<AccMonthlyTransactionV2> {
    const existing = await this.getByUuid(txnUuid);
    await assertUnlocked(existing.vesselUuid, existing.period);
    // Guard the destination vessel-month too when it changes.
    const nextVessel = data.vesselUuid ?? existing.vesselUuid;
    const nextPeriod = data.period ?? existing.period;
    if (nextVessel !== existing.vesselUuid || nextPeriod !== existing.period) {
      await assertUnlocked(nextVessel, nextPeriod);
    }
    const updated = await repo.update(txnUuid, applyAuditUser(data, false));
    if (!updated) {
      throw new Error(`Failed to update monthly transaction: ${txnUuid}`);
    }
    return updated;
  },

  async delete(txnUuid: string): Promise<void> {
    const existing = await this.getByUuid(txnUuid);
    await assertUnlocked(existing.vesselUuid, existing.period);
    const success = await repo.softDelete(txnUuid);
    if (!success) {
      throw new Error(`Failed to delete monthly transaction: ${txnUuid}`);
    }
  },
};
