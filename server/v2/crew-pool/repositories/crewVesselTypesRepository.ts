import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { crewVesselTypesApplied } from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewVesselTypesApplied,
  InsertCrewVesselTypesApplied,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export class CrewVesselTypesRepository {
  async findByCrewUuid(crewUuid: string): Promise<(CrewVesselTypesApplied & { resolvedVesselTypeName?: string })[]> {
    const db = getDb();
    // JOIN with master_vessel_types to resolve UUID to name
    const results = await db.execute(sql`
      SELECT 
        cvta.*,
        mvt."vesselType" as "resolvedVesselTypeName"
      FROM crew_vessel_types_applied cvta
      LEFT JOIN master_vessel_types mvt ON cvta.vessel_type_uuid = mvt.vtuid
      WHERE cvta.crew_uuid = ${crewUuid}
        AND cvta.is_deleted = false
      ORDER BY cvta.sort_order ASC
    `);
    return results.rows as (CrewVesselTypesApplied & { resolvedVesselTypeName?: string })[];
  }

  async create(
    data: Omit<InsertCrewVesselTypesApplied, "cvtaUuid">
  ): Promise<CrewVesselTypesApplied> {
    const db = getDb();
    const results = await db
      .insert(crewVesselTypesApplied)
      .values({
        ...data,
        cvtaUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async softDelete(cvtaUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewVesselTypesApplied)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewVesselTypesApplied.cvtaUuid, cvtaUuid))
      .returning();
    return results.length > 0;
  }

  async sync(
    crewUuid: string,
    vesselTypeUuids: string[]
  ): Promise<CrewVesselTypesApplied[]> {
    const db = getDb();

    // Soft delete existing vessel types for this crew
    await db
      .update(crewVesselTypesApplied)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewVesselTypesApplied.crewUuid, crewUuid));

    // Insert new vessel types
    if (vesselTypeUuids.length === 0) return [];

    const results = await db
      .insert(crewVesselTypesApplied)
      .values(
        vesselTypeUuids.map((vesselTypeUuid, index) => ({
          crewUuid,
          vesselTypeUuid,
          cvtaUuid: uuidv4(),
          sortOrder: index,
        }))
      )
      .returning();
    return results;
  }

  async hardDeleteByCrewUuid(crewUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewVesselTypesApplied)
      .where(eq(crewVesselTypesApplied.crewUuid, crewUuid))
      .returning();
    return results.length > 0;
  }
}
