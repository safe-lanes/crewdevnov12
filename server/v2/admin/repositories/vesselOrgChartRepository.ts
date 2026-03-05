import { eq, asc } from "drizzle-orm";
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
      await tx.delete(admVesselOrgChartV2);
      if (entries.length === 0) return [];
      const entriesWithUuids = entries.map(entry => ({
        ...entry,
        ocUuid: entry.ocUuid || uuidv4(),
      }));
      const results = await tx
        .insert(admVesselOrgChartV2)
        .values(entriesWithUuids)
        .returning();
      return results;
    });
  }
}
