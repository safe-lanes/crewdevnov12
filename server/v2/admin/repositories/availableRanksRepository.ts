import { eq, and, asc } from "drizzle-orm";
import { getDb } from "../../db";
import { admAvailableRanksV2 } from "../../../../shared/v2/admin/schema";
import type { AdmAvailableRankV2, InsertAdmAvailableRankV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class AvailableRanksRepository {
  async findAll(): Promise<AdmAvailableRankV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admAvailableRanksV2)
      .where(eq(admAvailableRanksV2.isDeleted, false))
      .orderBy(asc(admAvailableRanksV2.sortOrder));
  }

  async findAllIncludingDeleted(): Promise<AdmAvailableRankV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admAvailableRanksV2)
      .orderBy(asc(admAvailableRanksV2.sortOrder));
  }

  async findById(id: number): Promise<AdmAvailableRankV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admAvailableRanksV2)
      .where(and(eq(admAvailableRanksV2.id, id), eq(admAvailableRanksV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(arUuid: string): Promise<AdmAvailableRankV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admAvailableRanksV2)
      .where(and(eq(admAvailableRanksV2.arUuid, arUuid), eq(admAvailableRanksV2.isDeleted, false)));
    return results[0];
  }

  async create(data: Omit<InsertAdmAvailableRankV2, "arUuid">): Promise<AdmAvailableRankV2> {
    const db = getDb();
    const results = await db
      .insert(admAvailableRanksV2)
      .values({ ...data, arUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmAvailableRankV2>): Promise<AdmAvailableRankV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admAvailableRanksV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admAvailableRanksV2.id, id), eq(admAvailableRanksV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async update(arUuid: string, data: Partial<InsertAdmAvailableRankV2>): Promise<AdmAvailableRankV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admAvailableRanksV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admAvailableRanksV2.arUuid, arUuid), eq(admAvailableRanksV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admAvailableRanksV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admAvailableRanksV2.id, id), eq(admAvailableRanksV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async softDelete(arUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admAvailableRanksV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admAvailableRanksV2.arUuid, arUuid), eq(admAvailableRanksV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async softDeleteAll(): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admAvailableRanksV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(admAvailableRanksV2.isDeleted, false))
      .returning();
    return results.length > 0;
  }

  async updateSortOrders(orders: { id: number; sortOrder: number }[]): Promise<boolean> {
    const db = getDb();
    for (const { id, sortOrder } of orders) {
      await db
        .update(admAvailableRanksV2)
        .set({ sortOrder, updatedAt: new Date() })
        .where(and(eq(admAvailableRanksV2.id, id), eq(admAvailableRanksV2.isDeleted, false)));
    }
    return true;
  }
}
