import { PayElementsRepository } from "../repositories";
import type {
  AccPayElementV2,
  InsertAccPayElementV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const payElementsRepository = new PayElementsRepository();

export const payElementsService = {
  async getAll(filters?: {
    status?: string;
    type?: string;
  }): Promise<AccPayElementV2[]> {
    return payElementsRepository.findAll(filters);
  },

  async getByUuid(payElementUuid: string): Promise<AccPayElementV2> {
    const record = await payElementsRepository.findByUuid(payElementUuid);
    if (!record) {
      throw new Error(`Pay element not found: ${payElementUuid}`);
    }
    return record;
  },

  async create(
    data: Omit<InsertAccPayElementV2, "payElementUuid"> & {
      auditUserUuid?: string;
    },
  ): Promise<AccPayElementV2> {
    if (!data.code) throw new Error("Pay element code is required");
    if (!data.name) throw new Error("Pay element name is required");
    if (!data.type) throw new Error("Pay element type is required");
    const dataWithAudit = applyAuditUser(data, true);
    return payElementsRepository.create(dataWithAudit);
  },

  async update(
    payElementUuid: string,
    data: Partial<InsertAccPayElementV2> & { auditUserUuid?: string },
  ): Promise<AccPayElementV2> {
    await this.getByUuid(payElementUuid);
    const dataWithAudit = applyAuditUser(data, false);
    const updated = await payElementsRepository.update(
      payElementUuid,
      dataWithAudit,
    );
    if (!updated) {
      throw new Error(`Failed to update pay element: ${payElementUuid}`);
    }
    return updated;
  },

  async delete(payElementUuid: string): Promise<void> {
    await this.getByUuid(payElementUuid);
    const success = await payElementsRepository.softDelete(payElementUuid);
    if (!success) {
      throw new Error(`Failed to delete pay element: ${payElementUuid}`);
    }
  },
};
