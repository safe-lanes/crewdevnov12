import { eq, desc, inArray, and } from "drizzle-orm";
import { getDb } from "../../db";
import { crewVisas, crewVisasAttachments } from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewVisa,
  CrewVisa,
  InsertCrewVisaAttachment,
  CrewVisaAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewVisaWithAttachments = CrewVisa & {
  attachments: CrewVisaAttachment[];
};

export class CrewVisasRepository {
  async findByCrewUuidWithAttachments(crewUuid: string): Promise<CrewVisaWithAttachments[]> {
    const db = getDb();
    
    const visas = await db
      .select()
      .from(crewVisas)
      .where(
        and(
          eq(crewVisas.crewUuid, crewUuid),
          eq(crewVisas.isDeleted, false)
        )
      )
      .orderBy(desc(crewVisas.createdAt));

    if (visas.length === 0) return [];

    const visaUuids = visas.map(v => v.visaUuid);
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
    attachments.forEach(att => {
      const existing = attMap.get(att.visaUuid) || [];
      existing.push(att);
      attMap.set(att.visaUuid, existing);
    });

    return visas.map(visa => ({
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
        and(
          eq(crewVisas.visaUuid, visaUuid),
          eq(crewVisas.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByUuidWithAttachments(visaUuid: string): Promise<CrewVisaWithAttachments | undefined> {
    const db = getDb();
    
    const results = await db
      .select()
      .from(crewVisas)
      .where(
        and(
          eq(crewVisas.visaUuid, visaUuid),
          eq(crewVisas.isDeleted, false)
        )
      );
    
    if (results.length === 0) return undefined;
    
    const visa = results[0];
    const attachments = await db
      .select()
      .from(crewVisasAttachments)
      .where(
        and(
          eq(crewVisasAttachments.visaUuid, visaUuid),
          eq(crewVisasAttachments.isDeleted, false)
        )
      );

    return { ...visa, attachments };
  }

  async create(data: Omit<InsertCrewVisa, "visaUuid">): Promise<CrewVisa> {
    const db = getDb();
    const results = await db
      .insert(crewVisas)
      .values({ ...data, visaUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(visaUuid: string, data: Partial<InsertCrewVisa>): Promise<CrewVisa | undefined> {
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

  async delete(visaUuid: string): Promise<boolean> {
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

  async addAttachment(visaUuid: string, data: Omit<InsertCrewVisaAttachment, "visaUuid" | "attUuid">): Promise<CrewVisaAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewVisasAttachments)
      .values({ ...data, visaUuid, attUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async findAttachment(attUuid: string): Promise<CrewVisaAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewVisasAttachments)
      .where(
        and(
          eq(crewVisasAttachments.attUuid, attUuid),
          eq(crewVisasAttachments.isDeleted, false)
        )
      );
    return results[0];
  }

  async removeAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewVisasAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewVisasAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}

export const crewVisasRepository = new CrewVisasRepository();
