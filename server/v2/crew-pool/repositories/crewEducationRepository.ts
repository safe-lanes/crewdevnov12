import { eq, and, inArray, asc } from "drizzle-orm";
import { getDb } from "../../db";
import {
  crewEducation,
  crewEducationAttachments,
} from "../../../../shared/v2/crew-pool/schema";
import type {
  CrewEducation,
  InsertCrewEducation,
  CrewEducationAttachment,
  InsertCrewEducationAttachment,
} from "../../../../shared/v2/crew-pool/types";
import { v4 as uuidv4 } from "uuid";

export type CrewEducationWithAttachments = CrewEducation & {
  attachments: CrewEducationAttachment[];
};

export class CrewEducationRepository {
  async findByCrewUuid(crewUuid: string): Promise<CrewEducation[]> {
    const db = getDb();
    return db
      .select()
      .from(crewEducation)
      .where(
        and(
          eq(crewEducation.crewUuid, crewUuid),
          eq(crewEducation.isDeleted, false)
        )
      );
  }

  async findByCrewUuidWithAttachments(
    crewUuid: string
  ): Promise<CrewEducationWithAttachments[]> {
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
      .orderBy(asc(crewEducation.createdAt));

    if (eduRecords.length === 0) return [];

    const eduUuids = eduRecords.map((e: CrewEducation) => e.eduUuid);
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
    attachments.forEach((att: CrewEducationAttachment) => {
      const existing = attMap.get(att.eduUuid) || [];
      existing.push(att);
      attMap.set(att.eduUuid, existing);
    });

    return eduRecords.map((edu: CrewEducation) => ({
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

  async create(
    data: Omit<InsertCrewEducation, "eduUuid">
  ): Promise<CrewEducation> {
    const db = getDb();
    const results = await db
      .insert(crewEducation)
      .values({
        ...data,
        eduUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    eduUuid: string,
    data: Partial<InsertCrewEducation>
  ): Promise<CrewEducation | undefined> {
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

  async hardDelete(eduUuid: string): Promise<boolean> {
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

  // ============ Attachments ============
  async findAttachmentsByEduUuid(
    eduUuid: string
  ): Promise<CrewEducationAttachment[]> {
    const db = getDb();
    return db
      .select()
      .from(crewEducationAttachments)
      .where(
        and(
          eq(crewEducationAttachments.eduUuid, eduUuid),
          eq(crewEducationAttachments.isDeleted, false)
        )
      );
  }

  async addAttachment(
    data: Omit<InsertCrewEducationAttachment, "attUuid">
  ): Promise<CrewEducationAttachment> {
    const db = getDb();
    const results = await db
      .insert(crewEducationAttachments)
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
      .update(crewEducationAttachments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(crewEducationAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }

  async hardDeleteAttachment(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .delete(crewEducationAttachments)
      .where(eq(crewEducationAttachments.attUuid, attUuid))
      .returning();
    return results.length > 0;
  }
}
