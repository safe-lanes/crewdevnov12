import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { daPersonnelTestedV2 } from "../../../../shared/v2/drugs-alcohol/schema";
import type {
  DaPersonnelTestedV2,
  InsertDaPersonnelTestedV2,
} from "../../../../shared/v2/drugs-alcohol/schema";
import { v4 as uuidv4 } from "uuid";

export class PersonnelTestedRepository {
  async findByTestRecordUuid(testRecordUuid: string): Promise<DaPersonnelTestedV2[]> {
    const db = getDb();
    return db
      .select()
      .from(daPersonnelTestedV2)
      .where(
        and(
          eq(daPersonnelTestedV2.testRecordUuid, testRecordUuid),
          eq(daPersonnelTestedV2.isDeleted, false)
        )
      );
  }

  async create(data: Omit<InsertDaPersonnelTestedV2, "ptUuid">): Promise<DaPersonnelTestedV2> {
    const db = getDb();
    const results = await db
      .insert(daPersonnelTestedV2)
      .values({
        ...data,
        ptUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async softDeleteByTestRecordUuid(testRecordUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(daPersonnelTestedV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(daPersonnelTestedV2.testRecordUuid, testRecordUuid),
          eq(daPersonnelTestedV2.isDeleted, false)
        )
      )
      .returning();
    return results.length > 0;
  }
}
