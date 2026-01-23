import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { crewVesselTypesApplied } from "../../../../shared/v2/crew-pool/schema";
import type { InsertCrewVesselTypesApplied, CrewVesselTypesApplied } from "../../../../shared/v2/crew-pool/types";

export class CrewVesselTypesRepository {
  async findByCrewUuid(crewUuid: string): Promise<CrewVesselTypesApplied[]> {
    const db = getDb();
    return db
      .select()
      .from(crewVesselTypesApplied)
      .where(eq(crewVesselTypesApplied.crewUuid, crewUuid));
  }

  async sync(crewUuid: string, vesselTypeUuids: string[]): Promise<CrewVesselTypesApplied[]> {
    const db = getDb();
    
    // Delete all existing vessel types for this crew member
    await db
      .delete(crewVesselTypesApplied)
      .where(eq(crewVesselTypesApplied.crewUuid, crewUuid));

    if (vesselTypeUuids.length === 0) {
      return [];
    }

    // Insert new vessel types
    const results = await db
      .insert(crewVesselTypesApplied)
      .values(vesselTypeUuids.map(vesselTypeUuid => ({ crewUuid, vesselTypeUuid })))
      .returning();
    return results;
  }

  async add(crewUuid: string, vesselTypeUuid: string): Promise<CrewVesselTypesApplied> {
    const db = getDb();
    const results = await db
      .insert(crewVesselTypesApplied)
      .values({ crewUuid, vesselTypeUuid })
      .returning();
    return results[0];
  }

  async remove(crewUuid: string, vesselTypeUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewVesselTypesApplied)
      .where(
        eq(crewVesselTypesApplied.crewUuid, crewUuid)
      )
      .returning();
    return results.length > 0;
  }

  async deleteAll(crewUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .delete(crewVesselTypesApplied)
      .where(eq(crewVesselTypesApplied.crewUuid, crewUuid));
    return true;
  }
}

export const crewVesselTypesRepository = new CrewVesselTypesRepository();
