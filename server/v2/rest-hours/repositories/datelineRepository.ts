import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhDatelineAdjustmentsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhDatelineAdjustmentV2,
  InsertRhDatelineAdjustmentV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";

export class DatelineRepository {
  async findAll(filters?: {
    vesselId?: string;
    monthValue?: string;
  }): Promise<RhDatelineAdjustmentV2[]> {
    const db = getDb();
    let conditions = [eq(rhDatelineAdjustmentsV2.isDeleted, false)];

    if (filters?.vesselId) {
      conditions.push(eq(rhDatelineAdjustmentsV2.vesselId, filters.vesselId));
    }
    if (filters?.monthValue) {
      conditions.push(eq(rhDatelineAdjustmentsV2.monthValue, filters.monthValue));
    }

    const results = await db
      .select()
      .from(rhDatelineAdjustmentsV2)
      .where(and(...conditions))
      .orderBy(desc(rhDatelineAdjustmentsV2.createdAt));

    return results;
  }

  async findByUuid(adjustmentUuid: string): Promise<RhDatelineAdjustmentV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(rhDatelineAdjustmentsV2)
      .where(
        and(
          eq(rhDatelineAdjustmentsV2.adjustmentUuid, adjustmentUuid),
          eq(rhDatelineAdjustmentsV2.isDeleted, false)
        )
      );
    return results[0];
  }

  async create(
    data: Omit<InsertRhDatelineAdjustmentV2, "adjustmentUuid">
  ): Promise<RhDatelineAdjustmentV2> {
    const db = getDb();
    const results = await db
      .insert(rhDatelineAdjustmentsV2)
      .values({
        ...data,
        adjustmentUuid: uuidv4(),
      })
      .returning();
    return results[0];
  }

  async update(
    adjustmentUuid: string,
    data: Partial<InsertRhDatelineAdjustmentV2>
  ): Promise<RhDatelineAdjustmentV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(rhDatelineAdjustmentsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rhDatelineAdjustmentsV2.adjustmentUuid, adjustmentUuid))
      .returning();
    return results[0];
  }

  async softDelete(adjustmentUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(rhDatelineAdjustmentsV2)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(rhDatelineAdjustmentsV2.adjustmentUuid, adjustmentUuid))
      .returning();
    return results.length > 0;
  }
}
