import { BondItemsRepository } from "../repositories";
import type {
  AccBondItemV2,
  InsertAccBondItemV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const bondItemsRepository = new BondItemsRepository();

export const bondItemsService = {
  async getAll(filters?: {
    crewUuid?: string;
    status?: string;
  }): Promise<AccBondItemV2[]> {
    return bondItemsRepository.findAll(filters);
  },

  async getByCrew(crewUuid: string): Promise<AccBondItemV2[]> {
    return bondItemsRepository.findAll({ crewUuid });
  },

  async getByUuid(bondItemUuid: string): Promise<AccBondItemV2> {
    const record = await bondItemsRepository.findByUuid(bondItemUuid);
    if (!record) {
      throw new Error(`Bond item not found: ${bondItemUuid}`);
    }
    return record;
  },

  async create(
    data: Omit<InsertAccBondItemV2, "bondItemUuid"> & {
      auditUserUuid?: string;
    },
  ): Promise<AccBondItemV2> {
    if (!data.crewUuid) throw new Error("crewUuid is required");
    if (!data.itemName) throw new Error("itemName is required");
    return bondItemsRepository.create(applyAuditUser(data, true));
  },

  async update(
    bondItemUuid: string,
    data: Partial<InsertAccBondItemV2> & { auditUserUuid?: string },
  ): Promise<AccBondItemV2> {
    await this.getByUuid(bondItemUuid);
    const updated = await bondItemsRepository.update(
      bondItemUuid,
      applyAuditUser(data, false),
    );
    if (!updated) {
      throw new Error(`Failed to update bond item: ${bondItemUuid}`);
    }
    return updated;
  },

  async delete(bondItemUuid: string): Promise<void> {
    await this.getByUuid(bondItemUuid);
    const success = await bondItemsRepository.softDelete(bondItemUuid);
    if (!success) {
      throw new Error(`Failed to delete bond item: ${bondItemUuid}`);
    }
  },
};
