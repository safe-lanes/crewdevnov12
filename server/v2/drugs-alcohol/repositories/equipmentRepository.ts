import { eq, and } from "drizzle-orm";
import { getDb } from "../../db";
import { daTestingEquipmentV2 } from "../../../../shared/v2/drugs-alcohol/schema";
import type {
  DaTestingEquipmentV2,
  InsertDaTestingEquipmentV2,
} from "../../../../shared/v2/drugs-alcohol/schema";
import { v4 as uuidv4 } from "uuid";

export class EquipmentRepository {
  async findByTestRecordUuid(testRecordUuid: string): Promise<DaTestingEquipmentV2[]> {
    const db = getDb();
    return db
      .select()
      .from(daTestingEquipmentV2)
      .where(
        and(
          eq(daTestingEquipmentV2.testRecordUuid, testRecordUuid),
          eq(daTestingEquipmentV2.isDeleted, false)
        )
      );
  }

  async create(data: Omit<InsertDaTestingEquipmentV2, "eqUuid">): Promise<DaTestingEquipmentV2> {
    const db = getDb();
    const results = await db
      .insert(daTestingEquipmentV2)
      .values({
        ...data,
        eqUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async softDeleteByTestRecordUuid(testRecordUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(daTestingEquipmentV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(
        and(
          eq(daTestingEquipmentV2.testRecordUuid, testRecordUuid),
          eq(daTestingEquipmentV2.isDeleted, false)
        )
      )
      .returning();
    return results.length > 0;
  }
}
