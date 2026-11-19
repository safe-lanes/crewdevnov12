import { eq } from "drizzle-orm";
import { frmFormParts, frmSections, frmOptionSets } from "../../../../shared/v2/forms-engine/schema";
import { isLegacyStandardCategory, isSupportedLegacyConfiguration } from "../../../../shared/v2/forms-engine/legacyStandardConfiguration";
import type { AdmFormV2, AdmFormVersionV2 } from "../../../../shared/v2/admin/types";

// Called only inside the draft-creation transaction, with the form locked.
// False means use the strict copier, NOT swallow a copier error.
export async function isLegacyJsonDraftSource(
  form: AdmFormV2, source: AdmFormVersionV2, target: AdmFormVersionV2, tx: any,
): Promise<boolean> {
  if (!isLegacyStandardCategory(form.category)) return false;
  if (source.formId !== form.id || target.formId !== form.id ||
      source.rankGroupId !== target.rankGroupId || source.rankGroupId == null ||
      source.status !== "released" || target.status !== "draft" ||
      source.isDeleted || target.isDeleted || source.fvUuid === target.fvUuid) {
    throw Object.assign(new Error("The source version does not belong to this draft context. Refresh the form versions."), { statusCode: 409 });
  }
  const parts = await tx.select({ id: frmFormParts.id }).from(frmFormParts)
    .where(eq(frmFormParts.formVersionUuid, source.fvUuid)).limit(1);
  // Include deleted rows: deleted parts are evidence of structured history,
  // not permission to reinterpret damaged structure as legacy JSON.
  if (parts.length) return false;
  const sections = await tx.select({ id: frmSections.id }).from(frmSections)
    .where(eq(frmSections.formVersionUuid, source.fvUuid)).limit(1);
  const sets = await tx.select({ id: frmOptionSets.id }).from(frmOptionSets)
    .where(eq(frmOptionSets.formVersionUuid, source.fvUuid)).limit(1);
  if (sections.length || sets.length) return false;
  if (source.sharedConfig != null) {
    try {
      const shared = JSON.parse(source.sharedConfig);
      if (!shared || typeof shared !== "object" || Array.isArray(shared)) return false;
    } catch { return false; }
  }
  return isSupportedLegacyConfiguration(form.category, source.configuration);
}
