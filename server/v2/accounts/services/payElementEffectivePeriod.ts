import { PayElementsRepository } from "../repositories";
import {
  getEffectivePeriodReason,
  type EffectiveWindow,
} from "../../../../shared/v2/accounts/payElementEffectivePeriod";

const elements = new PayElementsRepository();

export async function assertEffectivePayElement(
  payElementUuid: string | null | undefined,
  window: EffectiveWindow,
  methods?: readonly string[],
): Promise<void> {
  if (
    !payElementUuid ||
    (!window.effectiveFrom && !window.effectiveTo)
  ) return;

  const element = await elements.findByUuid(payElementUuid);

  // Existing validators retain responsibility for missing references.
  if (!element) return;
  if (methods && !methods.includes(element.calcMethod)) return;

  const reason = getEffectivePeriodReason(element, window);
  if (reason) {
    throw Object.assign(new Error(reason), { code: "VALIDATION" });
  }
}
