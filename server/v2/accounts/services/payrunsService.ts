import {
  PayrunsRepository,
  PayrunEntriesRepository,
} from "../repositories";
import type {
  AccPayrunV2,
  InsertAccPayrunV2,
  AccPayrunEntryV2,
  InsertAccPayrunEntryV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const payrunsRepository = new PayrunsRepository();
const payrunEntriesRepository = new PayrunEntriesRepository();

export const payrunsService = {
  async getAll(filters?: {
    vesselUuid?: string;
    status?: string;
  }): Promise<AccPayrunV2[]> {
    return payrunsRepository.findAll(filters);
  },

  async getByUuid(payrunUuid: string): Promise<AccPayrunV2> {
    const record = await payrunsRepository.findByUuid(payrunUuid);
    if (!record) {
      throw new Error(`Payrun not found: ${payrunUuid}`);
    }
    return record;
  },

  async create(
    data: Omit<InsertAccPayrunV2, "payrunUuid"> & { auditUserUuid?: string },
  ): Promise<AccPayrunV2> {
    if (!data.vessel) throw new Error("vessel is required");
    if (!data.period) throw new Error("period is required");
    return payrunsRepository.create(applyAuditUser(data, true));
  },

  async update(
    payrunUuid: string,
    data: Partial<InsertAccPayrunV2> & { auditUserUuid?: string },
  ): Promise<AccPayrunV2> {
    await this.getByUuid(payrunUuid);
    const updated = await payrunsRepository.update(
      payrunUuid,
      applyAuditUser(data, false),
    );
    if (!updated) {
      throw new Error(`Failed to update payrun: ${payrunUuid}`);
    }
    return updated;
  },

  async delete(payrunUuid: string): Promise<void> {
    await this.getByUuid(payrunUuid);
    await payrunEntriesRepository.softDeleteByPayrun(payrunUuid);
    const success = await payrunsRepository.softDelete(payrunUuid);
    if (!success) {
      throw new Error(`Failed to delete payrun: ${payrunUuid}`);
    }
  },

  // ----- Entries -----
  async getEntries(payrunUuid: string): Promise<AccPayrunEntryV2[]> {
    await this.getByUuid(payrunUuid);
    return payrunEntriesRepository.findByPayrun(payrunUuid);
  },

  /**
   * Replace the full set of entries for a payrun (soft-delete existing, insert new),
   * then recompute payrun totals (crew count + net total) from the saved entries.
   */
  async saveEntries(
    payrunUuid: string,
    entries: Array<
      Omit<InsertAccPayrunEntryV2, "payrunEntryUuid" | "payrunUuid">
    >,
    auditUserUuid?: string,
  ): Promise<AccPayrunEntryV2[]> {
    await this.getByUuid(payrunUuid);
    await payrunEntriesRepository.softDeleteByPayrun(payrunUuid);

    const saved: AccPayrunEntryV2[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.crewUuid) throw new Error("crewUuid is required for each entry");
      const created = await payrunEntriesRepository.create(
        applyAuditUser(
          { ...entry, payrunUuid, sortOrder: entry.sortOrder ?? i, auditUserUuid },
          true,
        ),
      );
      saved.push(created);
    }

    const netTotal = saved.reduce((sum, e) => sum + (e.netPay ?? 0), 0);
    await payrunsRepository.update(
      payrunUuid,
      applyAuditUser(
        { crewCount: saved.length, netTotal, auditUserUuid },
        false,
      ),
    );

    return saved;
  },
};
