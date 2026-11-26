import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { rhDatelineAdjustmentsV2 } from "../../../../shared/v2/rest-hours/schema";
import type {
  RhDatelineAdjustmentV2,
  InsertRhDatelineAdjustmentV2,
} from "../../../../shared/v2/rest-hours/types";
import { v4 as uuidv4 } from "uuid";
import { capturedInsert, capturedUpdate } from "../../sync/capturedWrite";

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
    data: Omit<InsertRhDatelineAdjustmentV2, "adjustmentUuid">, tx?: any
  ): Promise<RhDatelineAdjustmentV2> {
    return capturedInsert<RhDatelineAdjustmentV2>(tx, rhDatelineAdjustmentsV2, "adjustmentUuid", {
      ...data,
      adjustmentUuid: uuidv4(),
    });
  }

  async update(
    adjustmentUuid: string,
    data: Partial<InsertRhDatelineAdjustmentV2>, tx?: any
  ): Promise<RhDatelineAdjustmentV2 | undefined> {
    return capturedUpdate<RhDatelineAdjustmentV2>(
      tx, rhDatelineAdjustmentsV2, "adjustmentUuid", adjustmentUuid, { ...data, updatedAt: new Date() });
  }

  async softDelete(adjustmentUuid: string, tx?: any): Promise<boolean> {
    const row = await capturedUpdate(
      tx, rhDatelineAdjustmentsV2, "adjustmentUuid", adjustmentUuid, { isDeleted: true, updatedAt: new Date() });
    return !!row;
  }
}
