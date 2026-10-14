import { afterEach, describe, expect, it, vi } from "vitest";
import { formsService } from "@server/v2/admin/services/formsService";
import { AppraisalResultsService, FormVersionPinError } from "@server/v2/appraisals/services/appraisalResultsService";
import { PromotionReviewsService, PromotionGuardError } from "@server/v2/promotions/services/promotionReviewsService";

describe("unconfigured rank consumer errors", () => {
  afterEach(() => vi.restoreAllMocks());

  it("distinguishes an unconfigured appraisal rank from an unreleased version", async () => {
    vi.spyOn(formsService, "getFormForRank").mockResolvedValue(null);
    const service = new AppraisalResultsService();
    await expect((service as any).resolveRequiredAppraisalFormVersion("Wiper")).rejects.toMatchObject<Partial<FormVersionPinError>>({
      message: 'No appraisal form configured for rank "Wiper". Assign the rank to an active appraisal rank group before saving this appraisal.',
    });
  });

  it("distinguishes an unconfigured promotion rank from an unreleased version", async () => {
    vi.spyOn(formsService, "getFormForRank").mockResolvedValue(null);
    const service = new PromotionReviewsService();
    await expect((service as any).resolveRequiredPromotionFormVersion("Wiper")).rejects.toMatchObject<Partial<PromotionGuardError>>({
      message: 'No promotion form configured for rank "Wiper". Assign the rank to an active promotion rank group before submitting this review.',
    });
  });
});