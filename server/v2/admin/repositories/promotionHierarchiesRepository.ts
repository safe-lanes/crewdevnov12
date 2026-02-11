import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { admPromotionHierarchiesV2 } from "../../../../shared/v2/admin/schema";
import type { AdmPromotionHierarchyV2, InsertAdmPromotionHierarchyV2 } from "../../../../shared/v2/admin/types";
import { v4 as uuidv4 } from "uuid";

export class PromotionHierarchiesRepository {
  async findAll(): Promise<AdmPromotionHierarchyV2[]> {
    const db = getDb();
    return db
      .select()
      .from(admPromotionHierarchiesV2)
      .where(eq(admPromotionHierarchiesV2.isDeleted, false))
      .orderBy(desc(admPromotionHierarchiesV2.createdAt));
  }

  async findById(id: number): Promise<AdmPromotionHierarchyV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admPromotionHierarchiesV2)
      .where(and(eq(admPromotionHierarchiesV2.id, id), eq(admPromotionHierarchiesV2.isDeleted, false)));
    return results[0];
  }

  async findByUuid(phUuid: string): Promise<AdmPromotionHierarchyV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(admPromotionHierarchiesV2)
      .where(and(eq(admPromotionHierarchiesV2.phUuid, phUuid), eq(admPromotionHierarchiesV2.isDeleted, false)));
    return results[0];
  }

  async create(data: Omit<InsertAdmPromotionHierarchyV2, "phUuid">): Promise<AdmPromotionHierarchyV2> {
    const db = getDb();
    const results = await db
      .insert(admPromotionHierarchiesV2)
      .values({ ...data, phUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async updateById(id: number, data: Partial<InsertAdmPromotionHierarchyV2>): Promise<AdmPromotionHierarchyV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admPromotionHierarchiesV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admPromotionHierarchiesV2.id, id), eq(admPromotionHierarchiesV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async update(phUuid: string, data: Partial<InsertAdmPromotionHierarchyV2>): Promise<AdmPromotionHierarchyV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(admPromotionHierarchiesV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(admPromotionHierarchiesV2.phUuid, phUuid), eq(admPromotionHierarchiesV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDeleteById(id: number): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admPromotionHierarchiesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admPromotionHierarchiesV2.id, id), eq(admPromotionHierarchiesV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async softDelete(phUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(admPromotionHierarchiesV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(admPromotionHierarchiesV2.phUuid, phUuid), eq(admPromotionHierarchiesV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }
}
