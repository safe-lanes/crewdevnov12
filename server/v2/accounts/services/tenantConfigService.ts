import { TenantConfigRepository, PayElementsRepository } from "../repositories";
import type {
  AccTenantConfigV2,
  InsertAccTenantConfigV2,
} from "../../../../shared/v2/accounts/types";
import { applyAuditUser } from "./auditUtils";

const tenantConfigRepository = new TenantConfigRepository();
const payElementsRepository = new PayElementsRepository();

function validationError(message: string): Error {
  const err = new Error(message) as Error & { code: string };
  err.code = "VALIDATION";
  return err;
}

/** Calc methods a configurable vessel-entry tab may bind to. */
const EXTRA_TAB_CALC_METHODS = new Set(["manual_entry", "rate_times_qty"]);

/**
 * 0179 rule: an enabled extra vessel-entry tab slot requires both a label
 * and a linked pay element (manual_entry / rate_times_qty only).
 */
async function assertExtraTabSlotsValid(
  next: Partial<InsertAccTenantConfigV2>,
  current: AccTenantConfigV2,
): Promise<void> {
  for (const slot of [1, 2] as const) {
    const enabled =
      (next as any)[`extraTab${slot}Enabled`] ??
      (current as any)[`extraTab${slot}Enabled`];
    if (!enabled) continue;
    const label = (
      ((next as any)[`extraTab${slot}Label`] ??
        (current as any)[`extraTab${slot}Label`]) ||
      ""
    ).trim();
    const elementUuid =
      (next as any)[`extraTab${slot}PayElementUuid`] ??
      (current as any)[`extraTab${slot}PayElementUuid`];
    if (!label || !elementUuid) {
      throw validationError(
        `Extra vessel entry tab ${slot} is enabled but requires both a label and a linked pay element`,
      );
    }
    const element = await payElementsRepository.findByUuid(elementUuid);
    if (!element) {
      throw validationError(
        `Extra vessel entry tab ${slot}: pay element not found (${elementUuid})`,
      );
    }
    if (!EXTRA_TAB_CALC_METHODS.has(element.calcMethod)) {
      throw validationError(
        `Extra vessel entry tab ${slot}: pay element ${element.code} must be a manual_entry or rate_times_qty element`,
      );
    }
  }
}

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
    await assertExtraTabSlotsValid(data, current);
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
