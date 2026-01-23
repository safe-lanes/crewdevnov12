import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import { crewPersonalDetails, crewAddresses } from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewPersonalDetails,
  CrewPersonalDetails,
  InsertCrewAddress,
  CrewAddress,
} from "../../../../shared/v2/crew-pool/types";

export class CrewPersonalRepository {
  // Personal Details (1:1 with crew_members_v2)
  async findPersonalDetails(crewUuid: string): Promise<CrewPersonalDetails | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewPersonalDetails)
      .where(eq(crewPersonalDetails.crewUuid, crewUuid));
    return results[0];
  }

  async upsertPersonalDetails(crewUuid: string, data: Omit<InsertCrewPersonalDetails, "crewUuid">): Promise<CrewPersonalDetails> {
    const db = getDb();
    const existing = await this.findPersonalDetails(crewUuid);

    if (existing) {
      const results = await db
        .update(crewPersonalDetails)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(crewPersonalDetails.crewUuid, crewUuid))
        .returning();
      return results[0];
    }

    const results = await db
      .insert(crewPersonalDetails)
      .values({ ...data, crewUuid })
      .returning();
    return results[0];
  }

  async deletePersonalDetails(crewUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewPersonalDetails)
      .where(eq(crewPersonalDetails.crewUuid, crewUuid))
      .returning();
    return results.length > 0;
  }

  // Address (1:1 with crew_members_v2)
  async findAddress(crewUuid: string): Promise<CrewAddress | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewAddresses)
      .where(eq(crewAddresses.crewUuid, crewUuid));
    return results[0];
  }

  async upsertAddress(crewUuid: string, data: Omit<InsertCrewAddress, "crewUuid">): Promise<CrewAddress> {
    const db = getDb();
    const existing = await this.findAddress(crewUuid);

    if (existing) {
      const results = await db
        .update(crewAddresses)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(crewAddresses.crewUuid, crewUuid))
        .returning();
      return results[0];
    }

    const results = await db
      .insert(crewAddresses)
      .values({ ...data, crewUuid })
      .returning();
    return results[0];
  }

  async deleteAddress(crewUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewAddresses)
      .where(eq(crewAddresses.crewUuid, crewUuid))
      .returning();
    return results.length > 0;
  }

  // Get all personal info for a crew member
  async findAllPersonalInfo(crewUuid: string): Promise<{
    personalDetails: CrewPersonalDetails | undefined;
    address: CrewAddress | undefined;
  }> {
    const [personalDetails, address] = await Promise.all([
      this.findPersonalDetails(crewUuid),
      this.findAddress(crewUuid),
    ]);
    return { personalDetails, address };
  }
}

export const crewPersonalRepository = new CrewPersonalRepository();
