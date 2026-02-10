import { eq, and, notInArray } from "drizzle-orm";
import { getDb } from "../../db";
import { daSignaturesV2 } from "../../../../shared/v2/drugs-alcohol/schema";
import type {
  DaSignatureV2,
  InsertDaSignatureV2,
} from "../../../../shared/v2/drugs-alcohol/schema";
import { v4 as uuidv4 } from "uuid";

export class SignaturesRepository {
  async findByTestRecordUuid(testRecordUuid: string): Promise<DaSignatureV2[]> {
    const db = getDb();
    return db
      .select()
      .from(daSignaturesV2)
      .where(
        and(
          eq(daSignaturesV2.testRecordUuid, testRecordUuid),
          eq(daSignaturesV2.isDeleted, false)
        )
      );
  }

  async findByUuid(sigUuid: string): Promise<DaSignatureV2 | null> {
    const db = getDb();
    const results = await db
      .select()
      .from(daSignaturesV2)
      .where(
        and(
          eq(daSignaturesV2.sigUuid, sigUuid),
          eq(daSignaturesV2.isDeleted, false)
        )
      );
    return results[0] || null;
  }

  async create(data: Omit<InsertDaSignatureV2, "sigUuid">): Promise<DaSignatureV2> {
    const db = getDb();
    const results = await db
      .insert(daSignaturesV2)
      .values({
        ...data,
        sigUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async updateByUuid(sigUuid: string, data: Partial<InsertDaSignatureV2>): Promise<DaSignatureV2> {
    const db = getDb();
    const results = await db
      .update(daSignaturesV2)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(daSignaturesV2.sigUuid, sigUuid),
          eq(daSignaturesV2.isDeleted, false)
        )
      )
      .returning();
    return results[0];
  }

  async softDeleteByTestRecordUuid(testRecordUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(daSignaturesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(daSignaturesV2.testRecordUuid, testRecordUuid),
          eq(daSignaturesV2.isDeleted, false)
        )
      )
      .returning();
    return results.length > 0;
  }

  async softDeleteExcluding(testRecordUuid: string, keepUuids: string[]): Promise<boolean> {
    const db = getDb();
    const conditions = [
      eq(daSignaturesV2.testRecordUuid, testRecordUuid),
      eq(daSignaturesV2.isDeleted, false),
    ];
    if (keepUuids.length > 0) {
      conditions.push(notInArray(daSignaturesV2.sigUuid, keepUuids));
    }
    const results = await db
      .update(daSignaturesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    return results.length > 0;
  }
}
