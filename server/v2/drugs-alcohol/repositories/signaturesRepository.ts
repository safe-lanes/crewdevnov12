import { eq, and } from "drizzle-orm";
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
}
