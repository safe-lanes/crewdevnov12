import { TenantConfigRepository } from "../repositories";
import type {
  AccTenantConfigV2,
  InsertAccTenantConfigV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const tenantConfigRepository = new TenantConfigRepository();

export const tenantConfigService = {
  /** Return the single config row, creating it with defaults if absent. */
  async get(auditUserUuid?: string): Promise<AccTenantConfigV2> {
    const existing = await tenantConfigRepository.findSingle();
    if (existing) return existing;
    const dataWithAudit = applyAuditUser({ auditUserUuid }, true);
    return tenantConfigRepository.create(dataWithAudit);
  },

  async update(
    data: Partial<InsertAccTenantConfigV2> & { auditUserUuid?: string },
  ): Promise<AccTenantConfigV2> {
    const current = await this.get(data.auditUserUuid);
    const dataWithAudit = applyAuditUser(data, false);
    const updated = await tenantConfigRepository.update(
      current.configUuid,
      dataWithAudit,
    );
    if (!updated) {
      throw new Error("Failed to update tenant config");
    }
    return updated;
  },
};
