import { eq, and, inArray, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewVisas,
  crewVisasAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewVisa,
  InsertCrewVisa,
  CrewVisaAttachment,
  InsertCrewVisaAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewVisaWithAttachments = CrewVisa & {
  attachments: CrewVisaAttachment[];
};

export class CrewVisasRepository {
  async findByCrewUuid(crewUuid: string): Promise<CrewVisa[]> {
    const db = getDb();
    return db
      .select()
      .from(crewVisas)
      .where(
        and(eq(crewVisas.crewUuid, crewUuid), eq(crewVisas.isDeleted, false))
      );
  }

  async findByCrewUuidWithAttachments(
    crewUuid: string
  ): Promise<CrewVisaWithAttachments[]> {
    const db = getDb();
    
    const visas = await db
      .select()
      .from(crewVisas)
      .where(
        and(eq(crewVisas.crewUuid, crewUuid), eq(crewVisas.isDeleted, false))
      )
      .orderBy(asc(crewVisas.sortOrder), asc(crewVisas.createdAt));

    if (visas.length === 0) return [];

    const visaUuids = visas.map((v: CrewVisa) => v.visaUuid);
    const attachments = await db
      .select()
      .from(crewVisasAttachments)
      .where(
        and(
          inArray(crewVisasAttachments.visaUuid, visaUuids),
          eq(crewVisasAttachments.isDeleted, false)
        )
      );

    const attMap = new Map<string, CrewVisaAttachment[]>();
    attachments.forEach((att: CrewVisaAttachment) => {
      const existing = attMap.get(att.visaUuid) || [];
      existing.push(att);
      attMap.set(att.visaUuid, existing);
    });

    return visas.map((visa: CrewVisa) => ({
      ...visa,
      attachments: attMap.get(visa.visaUuid) || [],
    }));
  }

  async findByUuid(visaUuid: string): Promise<CrewVisa | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewVisas)
      .where(
        and(eq(crewVisas.visaUuid, visaUuid), eq(crewVisas.isDeleted, false))
      );
    return results[0];
  }

  async create(data: Omit<InsertCrewVisa, "visaUuid">): Promise<CrewVisa> {
    const db = getDb();
    const results = await db
      .insert(crewVisas)
      .values({
        ...data,
        visaUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    visaUuid: string,
    data: Partial<InsertCrewVisa>
  ): Promise<CrewVisa | undefined> {
    const db = getDb();
    const results = await db
      .update(crewVisas)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewVisas.visaUuid, visaUuid))
      .returning();
    return results[0];
  }

  async softDelete(visaUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .update(crewVisasAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewVisasAttachments.visaUuid, visaUuid));

    const results = await db
      .update(crewVisas)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewVisas.visaUuid, visaUuid))
      .returning();
    return results.length > 0;
  }

  async hardDelete(visaUuid: string): Promise<boolean> {
    const db = getDb();
    await db
      .delete(crewVisasAttachments)
      .where(eq(crewVisasAttachments.visaUuid, visaUuid));

    const results = await db
      .delete(crewVisas)
      .where(eq(crewVisas.visaUuid, visaUuid))
      .returning();
    return results.length > 0;
  }

  // ============ Attachments ============
  async findAttachmentsByVisaUuid(
    visaUuid: string
  ): Promise<CrewVisaAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewVisasAttachments)
      .where(
        and(
          eq(crewVisasAttachments.visaUuid, visaUuid),
          eq(crewVisasAttachments.isDeleted, false)
        )
      );
  }

  async addAttachment(
    data: Omit<InsertCrewVisaAttachment, "attUuid">
  ): Promise<CrewVisaAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewVisasAttachments)
      .values({
        ...data,
        attUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async softDeleteAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewVisasAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewVisasAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  async hardDeleteAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewVisasAttachments)
      .where(eq(crewVisasAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}
