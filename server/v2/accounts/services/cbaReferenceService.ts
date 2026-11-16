import { CbaReferenceRepository } from "../repositories";
import type {
  AccCbaReferenceV2,
  InsertAccCbaReferenceV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";
import { selectionChanged } from "../../../../shared/v2/accounts/payElementEffectivePeriod";
import { assertEffectivePayElement } from "./payElementEffectivePeriod";

const cbaReferenceRepository = new CbaReferenceRepository();

export const cbaReferenceService = {
  async getAll(): Promise<AccCbaReferenceV2[]> {
    return cbaReferenceRepository.findAll();
  },

  async getByUuid(cbaRefUuid: string): Promise<AccCbaReferenceV2> {
    const record = await cbaReferenceRepository.findByUuid(cbaRefUuid);
    if (!record) {
      throw new Error(`CBA reference not found: ${cbaRefUuid}`);
    }
    return record;
  },

  async create(
    data: Omit<InsertAccCbaReferenceV2, "cbaRefUuid"> & {
      auditUserUuid?: string;
    },
  ): Promise<AccCbaReferenceV2> {
    if (!data.cbaName) throw new Error("CBA name is required");
    await assertEffectivePayElement(data.payElementUuid, data);
    const dataWithAudit = applyAuditUser(data, true);
    return cbaReferenceRepository.create(dataWithAudit);
  },

  async update(
    cbaRefUuid: string,
    data: Partial<InsertAccCbaReferenceV2> & { auditUserUuid?: string },
  ): Promise<AccCbaReferenceV2> {
    const existing = await this.getByUuid(cbaRefUuid);
    const merged = { ...existing, ...data };

    if (selectionChanged(existing, merged)) {
      await assertEffectivePayElement(merged.payElementUuid, merged);
    }
    const dataWithAudit = applyAuditUser(data, false);
    const updated = await cbaReferenceRepository.update(
      cbaRefUuid,
      dataWithAudit,
    );
    if (!updated) {
      throw new Error(`Failed to update CBA reference: ${cbaRefUuid}`);
    }
    return updated;
  },

  async delete(cbaRefUuid: string): Promise<void> {
    await this.getByUuid(cbaRefUuid);
    const success = await cbaReferenceRepository.softDelete(cbaRefUuid);
    if (!success) {
      throw new Error(`Failed to delete CBA reference: ${cbaRefUuid}`);
    }
  },
};
