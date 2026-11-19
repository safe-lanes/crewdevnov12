import { z } from "zod";
import { promotionA2ConfigSchema } from "../../schema";

export const isLegacyStandardCategory = (category: string) =>
  category === "appraisal" || category === "promotion";

const row = z.object({ id: z.union([z.string(), z.number()]) }).passthrough();
const assessment = row.extend({ assessmentCriteria: z.string(), weight: z.number() });
const appraisalConfiguration = z.object({
  trainings: z.array(row.extend({ training: z.string() })).optional(),
  targets: z.array(row.extend({ targetSetting: z.string() })).optional(),
  competenceAssessments: z.array(assessment).optional(),
  behaviouralAssessments: z.array(assessment).optional(),
  trainingNeeds: z.array(row.extend({ training: z.string() })).optional(),
  recommendations: z.array(row).optional(),
  trainingFollowups: z.array(row).optional(),
  hiddenFields: z.array(z.string()).optional(),
  hiddenSections: z.array(z.string()).optional(),
  effectivenessOptions: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
}).passthrough();

// Recognition only: never parse-and-reserialize a saved source, which would
// discard unknown historical settings or materialize schema defaults.
export function isSupportedLegacyConfiguration(category: string, serialized: string | null): boolean {
  if (!serialized || !isLegacyStandardCategory(category)) return false;
  try {
    const value = JSON.parse(serialized);
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    if (category === "promotion") {
      // This is also the discriminator used by the existing Promotion editor.
      return Array.isArray(value.higherLicenseIds) && promotionA2ConfigSchema.safeParse(value).success;
    }
    return Object.keys(appraisalConfiguration.shape).some(key => Object.prototype.hasOwnProperty.call(value, key))
      && appraisalConfiguration.safeParse(value).success;
  } catch {
    return false;
  }
}
