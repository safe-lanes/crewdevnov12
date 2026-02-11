import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admTrainingMasterV2 } from "../../../../shared/v2/admin/schema";
import type { AdmTrainingMasterV2, InsertAdmTrainingMasterV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class TrainingMasterRepository {
  async findAll(): Promise<AdmTrainingMasterV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admTrainingMasterV2)
      .where(eq(admTrainingMasterV2.isDeleted, false))
      .orderBy(desc(admTrainingMasterV2.createdAt));
  }

  async findById(id: number): Promise<AdmTrainingMasterV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admTrainingMasterV2)
      .where(and(eq(admTrainingMasterV2.id, id), eq(admTrainingMasterV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(tmUuid: string): Promise<AdmTrainingMasterV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admTrainingMasterV2)
      .where(and(eq(admTrainingMasterV2.tmUuid, tmUuid), eq(admTrainingMasterV2.isDeleted, false)));
    return results[0];
  }

  async findByTrainingId(trainingId: string): Promise<AdmTrainingMasterV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admTrainingMasterV2)
      .where(and(eq(admTrainingMasterV2.trainingId, trainingId), eq(admTrainingMasterV2.isDeleted, false)));
    return results[0];
  }

  async create(data: Omit<InsertAdmTrainingMasterV2, "tmUuid">): Promise<AdmTrainingMasterV2> {
    const db = getDb();
    const results = await db
      .insert(admTrainingMasterV2)
      .values({ ...data, tmUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmTrainingMasterV2>): Promise<AdmTrainingMasterV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admTrainingMasterV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admTrainingMasterV2.id, id), eq(admTrainingMasterV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admTrainingMasterV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admTrainingMasterV2.id, id), eq(admTrainingMasterV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async batchUpdate(updates: Array<{ id: number; data: Partial<InsertAdmTrainingMasterV2> }>): Promise<AdmTrainingMasterV2[]> {
    const db = getDb();
    const results: AdmTrainingMasterV2[] = [];
    for (const update of updates) {
      const updated = await db
        .update(admTrainingMasterV2)
        .set({ ...update.data, updatedAt: new Date() })
        .where(and(eq(admTrainingMasterV2.id, update.id), eq(admTrainingMasterV2.isDeleted, false)))
        .returning();
      if (updated[0]) results.push(updated[0]);
    }
    return results;
  }

  async reorder(orders: Array<{ id: number; sortOrder: number }>): Promise<void> {
    const db = getDb();
    for (const order of orders) {
      await db
        .update(admTrainingMasterV2)
        .set({ sortOrder: order.sortOrder, updatedAt: new Date() })
        .where(eq(admTrainingMasterV2.id, order.id));
    }
  }
}
