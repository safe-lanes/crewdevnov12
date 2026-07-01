import { AdvancesRepository } from "../repositories";
import type {
  AccAdvanceV2,
  InsertAccAdvanceV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const advancesRepository = new AdvancesRepository();

export const advancesService = {
  async getAll(filters?: {
    crewUuid?: string;
    status?: string;
  }): Promise<AccAdvanceV2[]> {
    return advancesRepository.findAll(filters);
  },

  async getByCrew(crewUuid: string): Promise<AccAdvanceV2[]> {
    return advancesRepository.findAll({ crewUuid });
  },

  async getByUuid(advanceUuid: string): Promise<AccAdvanceV2> {
    const record = await advancesRepository.findByUuid(advanceUuid);
    if (!record) {
      throw new Error(`Advance not found: ${advanceUuid}`);
    }
    return record;
  },

  async create(
    data: Omit<InsertAccAdvanceV2, "advanceUuid"> & {
      auditUserUuid?: string;
    },
  ): Promise<AccAdvanceV2> {
    if (!data.crewUuid) throw new Error("crewUuid is required");
    return advancesRepository.create(applyAuditUser(data, true));
  },

  async update(
    advanceUuid: string,
    data: Partial<InsertAccAdvanceV2> & { auditUserUuid?: string },
  ): Promise<AccAdvanceV2> {
    await this.getByUuid(advanceUuid);
    const updated = await advancesRepository.update(
      advanceUuid,
      applyAuditUser(data, false),
    );
    if (!updated) {
      throw new Error(`Failed to update advance: ${advanceUuid}`);
    }
    return updated;
  },

  async delete(advanceUuid: string): Promise<void> {
    await this.getByUuid(advanceUuid);
    const success = await advancesRepository.softDelete(advanceUuid);
    if (!success) {
      throw new Error(`Failed to delete advance: ${advanceUuid}`);
    }
  },
};
