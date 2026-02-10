import { eq, and, notInArray, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { daAttachmentsV2 } from "../../../../shared/v2/drugs-alcohol/schema";
import type {
  DaAttachmentV2,
  InsertDaAttachmentV2,
} from "../../../../shared/v2/drugs-alcohol/schema";
import { v4 as uuidv4 } from "uuid";

export class AttachmentsRepository {
  async findByTestRecordUuid(testRecordUuid: string): Promise<DaAttachmentV2[]> {
    const db = getDb();
    return db
      .select()
      .from(daAttachmentsV2)
      .where(
        and(
          eq(daAttachmentsV2.testRecordUuid, testRecordUuid),
          eq(daAttachmentsV2.isDeleted, false)
        )
      )
      .orderBy(asc(daAttachmentsV2.sortOrder));
  }

  async create(data: Omit<InsertDaAttachmentV2, "attUuid">): Promise<DaAttachmentV2> {
    const db = getDb();
    const results = await db
      .insert(daAttachmentsV2)
      .values({
        ...data,
        attUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async findByUuid(attUuid: string): Promise<DaAttachmentV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(daAttachmentsV2)
      .where(
        and(
          eq(daAttachmentsV2.attUuid, attUuid),
          eq(daAttachmentsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async updateByUuid(attUuid: string, data: Partial<InsertDaAttachmentV2>): Promise<DaAttachmentV2> {
    const db = getDb();
    const results = await db
      .update(daAttachmentsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(daAttachmentsV2.attUuid, attUuid),
          eq(daAttachmentsV2.isDeleted, false)
        )
      )
      .returning();
    return results[0];
  }

  async softDeleteByUuid(attUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(daAttachmentsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(daAttachmentsV2.attUuid, attUuid),
          eq(daAttachmentsV2.isDeleted, false)
        )
      )
      .returning();
    return results.length > 0;
  }

  async softDeleteByTestRecordUuid(testRecordUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(daAttachmentsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(daAttachmentsV2.testRecordUuid, testRecordUuid),
          eq(daAttachmentsV2.isDeleted, false)
        )
      )
      .returning();
    return results.length > 0;
  }

  async softDeleteExcluding(testRecordUuid: string, keepUuids: string[]): Promise<boolean> {
    const db = getDb();
    const conditions = [
      eq(daAttachmentsV2.testRecordUuid, testRecordUuid),
      eq(daAttachmentsV2.isDeleted, false),
    ];
    if (keepUuids.length > 0) {
      conditions.push(notInArray(daAttachmentsV2.attUuid, keepUuids));
    }
    const results = await db
      .update(daAttachmentsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return results.length > 0;
  }
}
