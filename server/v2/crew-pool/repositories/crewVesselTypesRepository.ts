import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { crewVesselTypesApplied } from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewVesselTypesApplied,
  InsertCrewVesselTypesApplied,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export class CrewVesselTypesRepository {
  async findByCrewUuid(crewUuid: string): Promise<CrewVesselTypesApplied[]> {
    const db = getDb();
    return db
      .select()
      .from(crewVesselTypesApplied)
      .where(
        and(
          eq(crewVesselTypesApplied.crewUuid, crewUuid),
          eq(crewVesselTypesApplied.isDeleted, false)
        )
      );
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
