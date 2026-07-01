import { AllotmentsRepository } from "../repositories";
import type {
  AccAllotmentV2,
  InsertAccAllotmentV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const allotmentsRepository = new AllotmentsRepository();

export const allotmentsService = {
  async getAll(filters?: {
    crewUuid?: string;
    status?: string;
  }): Promise<AccAllotmentV2[]> {
    return allotmentsRepository.findAll(filters);
  },

  async getByCrew(crewUuid: string): Promise<AccAllotmentV2[]> {
    return allotmentsRepository.findAll({ crewUuid });
  },

  async getByUuid(allotmentUuid: string): Promise<AccAllotmentV2> {
    const record = await allotmentsRepository.findByUuid(allotmentUuid);
    if (!record) {
      throw new Error(`Allotment not found: ${allotmentUuid}`);
    }
    return record;
  },

  async create(
    data: Omit<InsertAccAllotmentV2, "allotmentUuid"> & {
      auditUserUuid?: string;
    },
  ): Promise<AccAllotmentV2> {
    if (!data.crewUuid) throw new Error("crewUuid is required");
    if (!data.beneficiaryName) throw new Error("beneficiaryName is required");
    if (!data.allotmentType) throw new Error("allotmentType is required");
    return allotmentsRepository.create(applyAuditUser(data, true));
  },

  async update(
    allotmentUuid: string,
    data: Partial<InsertAccAllotmentV2> & { auditUserUuid?: string },
  ): Promise<AccAllotmentV2> {
    await this.getByUuid(allotmentUuid);
    const updated = await allotmentsRepository.update(
      allotmentUuid,
      applyAuditUser(data, false),
    );
    if (!updated) {
      throw new Error(`Failed to update allotment: ${allotmentUuid}`);
    }
    return updated;
  },

  async delete(allotmentUuid: string): Promise<void> {
    await this.getByUuid(allotmentUuid);
    const success = await allotmentsRepository.softDelete(allotmentUuid);
    if (!success) {
      throw new Error(`Failed to delete allotment: ${allotmentUuid}`);
    }
  },
};
