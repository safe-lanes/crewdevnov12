import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { admFormVersionsV2, admRankGroupsV2 } from "../../../../shared/v2/admin/schema";
import { frmFormParts } from "../../../../shared/v2/forms-engine/schema";
import type { AdmFormV2, AdmFormVersionV2, AdmRankGroupV2 } from "../../../../shared/v2/admin/types";

type Version = Pick<AdmFormVersionV2, "id" | "formId" | "rankGroupId" | "versionNo" | "versionDate" | "status">;
type Part = {
  formPartUuid: string; formUuid: string; formVersionUuid: string | null;
  partCode: string; partTitle: string; partType: string; isOfficeOnly: boolean;
};
type Rows = {
  versions: PromiseSettledResult<Version[]>;
  rankGroups: PromiseSettledResult<AdmRankGroupV2[]>;
  parts: PromiseSettledResult<Part[]>;
};

function groupBy<T>(rows: T[], key: (row: T) => number | string) {
  const groups = new Map<number | string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id) ?? [];
    group.push(row);
    groups.set(id, group);
  }
  return groups;
}

export function attachFormListSummaries(forms: AdmFormV2[], rows: Rows) {
  const versions = groupBy(rows.versions.status === "fulfilled" ? rows.versions.value : [], v => v.formId);
  const groups = groupBy(rows.rankGroups.status === "fulfilled" ? rows.rankGroups.value : [], g => g.formId);
  const parts = groupBy(rows.parts.status === "fulfilled" ? rows.parts.value : [], p => p.formUuid);
  return forms.map(form => {
    const items = versions.get(form.id) ?? [];
    const validVersions = items.every(v => Number.isInteger(v.id) && v.formId === form.id
      && typeof v.versionNo === "string" && typeof v.versionDate === "string" && typeof v.status === "string");
    const loaded = rows.versions.status === "fulfilled" && validVersions && rows.parts.status === "fulfilled"
      && (form.category === "dynamic" || rows.rankGroups.status === "fulfilled");
    return {
      ...form,
      versionSummary: loaded
        ? { state: "loaded" as const, versions: items } : { state: "error" as const },
      rankGroups: groups.get(form.id) ?? [],
      parts: parts.get(form.formUuid) ?? [],
      partsLoadState: rows.parts.status === "fulfilled" ? "loaded" as const : "error" as const,
    };
  });
}

// A fixed three bulk reads, independent of form count. Failure of a metadata
// read never rejects the form inventory or manufactures version information.
export async function loadFormListSummaries(forms: AdmFormV2[]) {
  if (!forms.length) return [];
  const db = getDb();
  const ids = forms.map(form => form.id);
  const uuids = forms.map(form => form.formUuid);
  const [versions, rankGroups, parts] = await Promise.allSettled([
    db.select({
      id: admFormVersionsV2.id, formId: admFormVersionsV2.formId,
      rankGroupId: admFormVersionsV2.rankGroupId, versionNo: admFormVersionsV2.versionNo,
      versionDate: admFormVersionsV2.versionDate, status: admFormVersionsV2.status,
    }).from(admFormVersionsV2).where(and(inArray(admFormVersionsV2.formId, ids),
      eq(admFormVersionsV2.isDeleted, false))),
    db.select().from(admRankGroupsV2).where(and(inArray(admRankGroupsV2.formId, ids),
      eq(admRankGroupsV2.isDeleted, false))),
    db.select({
      formPartUuid: frmFormParts.formPartUuid, formUuid: frmFormParts.formUuid,
      formVersionUuid: frmFormParts.formVersionUuid, partCode: frmFormParts.partCode,
      partTitle: frmFormParts.partTitle, partType: frmFormParts.partType,
      isOfficeOnly: frmFormParts.isOfficeOnly,
    }).from(frmFormParts).where(and(inArray(frmFormParts.formUuid, uuids),
      isNull(frmFormParts.formVersionUuid), eq(frmFormParts.isDeleted, false)))
      .orderBy(asc(frmFormParts.sortOrder), asc(frmFormParts.id)),
  ]);
  // Server logs retain diagnostics; the response contains no exception text.
  for (const result of [versions, rankGroups, parts])
    if (result.status === "rejected") console.error("Forms list metadata read failed:", result.reason);
  return attachFormListSummaries(forms, { versions, rankGroups, parts });
}
