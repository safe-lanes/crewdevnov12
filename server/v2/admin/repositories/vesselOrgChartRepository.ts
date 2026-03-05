import { eq, asc, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { admVesselOrgChartV2 } from "../../../../shared/v2/admin/schema";
import type { AdmVesselOrgChartV2, InsertAdmVesselOrgChartV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class VesselOrgChartRepository {
  async findAll(): Promise<AdmVesselOrgChartV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admVesselOrgChartV2)
      .where(eq(admVesselOrgChartV2.isDeleted, false))
      .orderBy(asc(admVesselOrgChartV2.sortOrder));
  }

  async saveAll(entries: InsertAdmVesselOrgChartV2[]): Promise<AdmVesselOrgChartV2[]> {
    const db = getDb();
    return db.transaction(async (tx: any) => {
      const allExisting = await tx
        .select()
        .from(admVesselOrgChartV2);

      const existingByRankId = new Map<string, AdmVesselOrgChartV2>();
      for (const row of allExisting) {
        const current = existingByRankId.get(row.rankId);
        if (!current || (!row.isDeleted && current.isDeleted)) {
          existingByRankId.set(row.rankId, row);
        }
      }

      const dedupedEntries = new Map<string, InsertAdmVesselOrgChartV2>();
      for (const entry of entries) {
        dedupedEntries.set(entry.rankId, entry);
      }
      const uniqueEntries = Array.from(dedupedEntries.values());

      const incomingRankIds = new Set(uniqueEntries.map(e => e.rankId));

      const activeToSoftDelete = allExisting
        .filter((row: AdmVesselOrgChartV2) => !row.isDeleted && !incomingRankIds.has(row.rankId));

      if (activeToSoftDelete.length > 0) {
        const idsToSoftDelete = activeToSoftDelete.map((row: AdmVesselOrgChartV2) => row.id);
        await tx
          .update(admVesselOrgChartV2)
          .set({ isDeleted: true, updatedAt: new Date() })
          .where(inArray(admVesselOrgChartV2.id, idsToSoftDelete));
      }

      const results: AdmVesselOrgChartV2[] = [];

      for (const entry of uniqueEntries) {
        const existingRow = existingByRankId.get(entry.rankId);
        if (existingRow) {
          const [updated] = await tx
            .update(admVesselOrgChartV2)
            .set({
              rank: entry.rank,
              parentRankId: entry.parentRankId,
              sortOrder: entry.sortOrder,
              isDeleted: false,
              updatedAt: new Date(),
              updatedByUuid: (entry as any).updatedByUuid || existingRow.updatedByUuid,
            })
            .where(eq(admVesselOrgChartV2.id, existingRow.id))
            .returning();
          results.push(updated);
        } else {
          const [inserted] = await tx
            .insert(admVesselOrgChartV2)
            .values({
              ...entry,
              ocUuid: entry.ocUuid || uuidv4(),
            })
            .returning();
          results.push(inserted);
        }
      }

      return results;
    });
  }
}
