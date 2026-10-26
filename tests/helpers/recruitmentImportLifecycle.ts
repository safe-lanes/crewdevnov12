import { eq, getTableName, inArray } from "drizzle-orm";
import * as tables from "../../shared/v2/recruitment/schema";

export const importTables = [
  tables.candAdditionalInfo, tables.candSeaService, tables.candTrainingCourses,
  tables.candLicenses, tables.candEducation, tables.candVisas, tables.candDocuments,
  tables.candNextOfKin, tables.candChildren, tables.candFamilyInfo, tables.candAddresses,
  tables.candPersonalDetails, tables.candVesselTypesApplied, tables.recruitmentCandidatesV2,
];

export async function importSnapshot(db: any, uuid: string) {
  const snapshot: Record<string, any[]> = {};
  for (const table of importTables) {
    snapshot[getTableName(table)] = await db.select().from(table).where(eq(table.recCanUuid, uuid));
  }
  return snapshot;
}

export async function cleanupSyntheticImports(db: any, uuids: string[]) {
  if (process.env.NODE_ENV !== "development") throw new Error("Cleanup is development-only.");
  if (!uuids.length) return;
  if (!uuids.every(uuid => /^[a-f0-9-]{36}$/.test(uuid))) throw new Error("Invalid synthetic UUID.");
  await db.transaction(async (tx: any) => {
    const roots = await tx.select().from(tables.recruitmentCandidatesV2)
      .where(inArray(tables.recruitmentCandidatesV2.recCanUuid, uuids));
    for (const candidate of roots) {
      if (!candidate.firstName?.startsWith("ExcelImport") || candidate.familyName !== "Test") {
        throw new Error("Refusing to clean a non-synthetic candidate.");
      }
    }
    // Only roots verified above may authorize detail cleanup.
    const verified = roots.map((root: any) => root.recCanUuid);
    if (!verified.length) return;
    for (const table of [tables.recCandidateScreening, tables.screeningB1Initial, ...importTables]) {
      await tx.delete(table).where(inArray(table.recCanUuid, verified));
    }
  });
}
