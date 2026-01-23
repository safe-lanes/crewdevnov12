import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewPersonalDetails,
  crewAddresses,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewPersonalDetails,
  InsertCrewPersonalDetails,
  CrewAddress,
  InsertCrewAddress,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export class CrewPersonalRepository {
  // ============ Personal Details ============
  async findPersonalDetailsByCrewUuid(
    crewUuid: string
  ): Promise<CrewPersonalDetails | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewPersonalDetails)
      .where(
        and(
          eq(crewPersonalDetails.crewUuid, crewUuid),
          eq(crewPersonalDetails.isDeleted, false)
        )
      );
    return results[0];
  }

  async createPersonalDetails(
    data: Omit<InsertCrewPersonalDetails, "cpdUuid">
  ): Promise<CrewPersonalDetails> {
    const db = getDb();
    const results = await db
      .insert(crewPersonalDetails)
      .values({
        ...data,
        cpdUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async updatePersonalDetails(
    crewUuid: string,
    data: Partial<InsertCrewPersonalDetails>
  ): Promise<CrewPersonalDetails | undefined> {
    const db = getDb();
    const results = await db
      .update(crewPersonalDetails)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewPersonalDetails.crewUuid, crewUuid))
      .returning();
    return results[0];
  }

  async upsertPersonalDetails(
    crewUuid: string,
    data: Omit<InsertCrewPersonalDetails, "cpdUuid" | "crewUuid">
  ): Promise<CrewPersonalDetails> {
    const existing = await this.findPersonalDetailsByCrewUuid(crewUuid);
    if (existing) {
      const updated = await this.updatePersonalDetails(crewUuid, data);
      return updated!;
    }
    return this.createPersonalDetails({ ...data, crewUuid });
  }

  // ============ Addresses ============
  async findAddressByCrewUuid(
    crewUuid: string
  ): Promise<CrewAddress | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewAddresses)
      .where(
        and(
          eq(crewAddresses.crewUuid, crewUuid),
          eq(crewAddresses.isDeleted, false)
        )
      );
    return results[0];
  }

  async createAddress(
    data: Omit<InsertCrewAddress, "addrUuid">
  ): Promise<CrewAddress> {
    const db = getDb();
    const results = await db
      .insert(crewAddresses)
      .values({
        ...data,
        addrUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async updateAddress(
    crewUuid: string,
    data: Partial<InsertCrewAddress>
  ): Promise<CrewAddress | undefined> {
    const db = getDb();
    const results = await db
      .update(crewAddresses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewAddresses.crewUuid, crewUuid))
      .returning();
    return results[0];
  }

  async upsertAddress(
    crewUuid: string,
    data: Omit<InsertCrewAddress, "addrUuid" | "crewUuid">
  ): Promise<CrewAddress> {
    const existing = await this.findAddressByCrewUuid(crewUuid);
    if (existing) {
      const updated = await this.updateAddress(crewUuid, data);
      return updated!;
    }
    return this.createAddress({ ...data, crewUuid });
  }

  // ============ Combined Profile ============
  async findFullProfileByCrewUuid(crewUuid: string) {
    const [personalDetails, address] = await Promise.all([
      this.findPersonalDetailsByCrewUuid(crewUuid),
      this.findAddressByCrewUuid(crewUuid),
    ]);
    return { personalDetails, address };
  }
}
