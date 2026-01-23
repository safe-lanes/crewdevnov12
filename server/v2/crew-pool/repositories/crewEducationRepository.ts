import { eq, desc, inArray, and } from "drizzle-orm";
import { getDb } from "../../db";
import { crewEducation, crewEducationAttachments } from "../../../../shared/v2/crew-pool/schema";
import type {
  InsertCrewEducation,
  CrewEducation,
  InsertCrewEducationAttachment,
  CrewEducationAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewEducationWithAttachments = CrewEducation & {
  attachments: CrewEducationAttachment[];
};

export class CrewEducationRepository {
  async findByCrewUuidWithAttachments(crewUuid: string): Promise<CrewEducationWithAttachments[]> {
    const db = getDb();
    
    const eduRecords = await db
      .select()
      .from(crewEducation)
      .where(
        and(
          eq(crewEducation.crewUuid, crewUuid),
          eq(crewEducation.isDeleted, false)
        )
      )
      .orderBy(desc(crewEducation.createdAt));

    if (eduRecords.length === 0) return [];

    const eduUuids = eduRecords.map(e => e.eduUuid);
    const attachments = await db
      .select()
      .from(crewEducationAttachments)
      .where(
        and(
          inArray(crewEducationAttachments.eduUuid, eduUuids),
          eq(crewEducationAttachments.isDeleted, false)
        )
      );

    const attMap = new Map<string, CrewEducationAttachment[]>();
    attachments.forEach(att => {
      const existing = attMap.get(att.eduUuid) || [];
      existing.push(att);
      attMap.set(att.eduUuid, existing);
    });

    return eduRecords.map(edu => ({
      ...edu,
      attachments: attMap.get(edu.eduUuid) || [],
    }));
  }

  async findByUuid(eduUuid: string): Promise<CrewEducation | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewEducation)
      .where(
        and(
          eq(crewEducation.eduUuid, eduUuid),
          eq(crewEducation.isDeleted, false)
        )
      );
    return results[0];
  }

  async findByUuidWithAttachments(eduUuid: string): Promise<CrewEducationWithAttachments | undefined> {
    const db = getDb();
    
    const results = await db
      .select()
      .from(crewEducation)
      .where(
        and(
          eq(crewEducation.eduUuid, eduUuid),
          eq(crewEducation.isDeleted, false)
        )
      );
    
    if (results.length === 0) return undefined;
    
    const edu = results[0];
    const attachments = await db
      .select()
      .from(crewEducationAttachments)
      .where(
        and(
          eq(crewEducationAttachments.eduUuid, eduUuid),
          eq(crewEducationAttachments.isDeleted, false)
        )
      );

    return { ...edu, attachments };
  }

  async create(data: Omit<InsertCrewEducation, "eduUuid">): Promise<CrewEducation> {
    const db = getDb();
    const results = await db
      .insert(crewEducation)
      .values({ ...data, eduUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(eduUuid: string, data: Partial<InsertCrewEducation>): Promise<CrewEducation | undefined> {
    const db = getDb();
    const results = await db
      .update(crewEducation)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crewEducation.eduUuid, eduUuid))
      .returning();
    return results[0];
  }

  async softDelete(eduUuid: string): Promise<boolean> {
    const db = getDb();
    
    await db
      .update(crewEducationAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewEducationAttachments.eduUuid, eduUuid));

    const results = await db
      .update(crewEducation)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewEducation.eduUuid, eduUuid))
      .returning();
    return results.length > 0;
  }

  async delete(eduUuid: string): Promise<boolean> {
    const db = getDb();
    
    await db
      .delete(crewEducationAttachments)
      .where(eq(crewEducationAttachments.eduUuid, eduUuid));

    const results = await db
      .delete(crewEducation)
      .where(eq(crewEducation.eduUuid, eduUuid))
      .returning();
    return results.length > 0;
  }

  async addAttachment(eduUuid: string, data: Omit<InsertCrewEducationAttachment, "eduUuid" | "attUuid">): Promise<CrewEducationAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewEducationAttachments)
      .values({ ...data, eduUuid, attUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async findAttachment(attUuid: string): Promise<CrewEducationAttachment | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(crewEducationAttachments)
      .where(
        and(
          eq(crewEducationAttachments.attUuid, attUuid),
          eq(crewEducationAttachments.isDeleted, false)
        )
      );
    return results[0];
  }

  async removeAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(crewEducationAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewEducationAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}

export const crewEducationRepository = new CrewEducationRepository();
