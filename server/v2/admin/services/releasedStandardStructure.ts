import { and, eq } from "drizzle-orm";
import { frmFormParts, frmSections } from "../../../../shared/v2/forms-engine/schema";
import { getDb } from "../../db";

// These standard forms render version-owned structure, not legacy JSON settings.
// Do not impose new required sections/questions: fixed-only or empty configurable
// parts are supported by the runtime. Missing parts cannot be displayed.
export async function releasedStandardStructureError(
  formUuid: string,
  versionUuid: string,
): Promise<string | null> {
  const db = getDb();
  const parts = await db.select({
    formPartUuid: frmFormParts.formPartUuid,
    formUuid: frmFormParts.formUuid,
  }).from(frmFormParts).where(and(
    eq(frmFormParts.formVersionUuid, versionUuid),
    eq(frmFormParts.isDeleted, false),
  ));
  if (!parts.length || parts.some((part: typeof parts[number]) => part.formUuid !== formUuid)) {
    return "The released form's version-owned structure is missing or belongs to another form. Ask an administrator to review the released version.";
  }
  const partIds = new Set(parts.map((part: typeof parts[number]) => part.formPartUuid));
  const sections = await db.select({
    formPartUuid: frmSections.formPartUuid,
  }).from(frmSections).where(and(
    eq(frmSections.formVersionUuid, versionUuid),
    eq(frmSections.isDeleted, false),
  ));
  if (sections.some((section: typeof sections[number]) => !partIds.has(section.formPartUuid))) {
    return "The released form's structure contains a section linked to a missing or incorrect version-owned part. Ask an administrator to review the released version.";
  }
  return null;
}
