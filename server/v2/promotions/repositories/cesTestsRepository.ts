import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoCesTestsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoCesTestV2, InsertPromoCesTestV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";

export class CesTestsRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoCesTestV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoCesTestsV2)
      .where(and(eq(promoCesTestsV2.reviewUuid, reviewUuid), eq(promoCesTestsV2.isDeleted, false)))
      .orderBy(promoCesTestsV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoCesTestV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoCesTestsV2)
      .where(and(inArray(promoCesTestsV2.reviewUuid, reviewUuids), eq(promoCesTestsV2.isDeleted, false)))
      .orderBy(promoCesTestsV2.sortOrder);
  }

  async create(data: Omit<InsertPromoCesTestV2, "ctUuid">): Promise<PromoCesTestV2> {
    const db = getDb();
    const results = await db
      .insert(promoCesTestsV2)
      .values({ ...data, ctUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async update(ctUuid: string, data: Partial<InsertPromoCesTestV2>): Promise<PromoCesTestV2 | undefined> {
    const db = getDb();
    const results = await db
      .update(promoCesTestsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(promoCesTestsV2.ctUuid, ctUuid), eq(promoCesTestsV2.isDeleted, false)))
      .returning();
    return results[0];
  }

  async softDelete(ctUuid: string): Promise<boolean> {
    const db = getDb();
    const results = await db
      .update(promoCesTestsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(promoCesTestsV2.ctUuid, ctUuid), eq(promoCesTestsV2.isDeleted, false)))
      .returning();
    return results.length > 0;
  }

  async replaceForReview(reviewUuid: string, tests: Omit<InsertPromoCesTestV2, "ctUuid" | "reviewUuid">[]): Promise<PromoCesTestV2[]> {
    const db = getDb();
    await db
      .update(promoCesTestsV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(promoCesTestsV2.reviewUuid, reviewUuid), eq(promoCesTestsV2.isDeleted, false)));
    if (tests.length === 0) return [];
    const results = await db
      .insert(promoCesTestsV2)
      .values(tests.map((t, i) => ({ ...t, ctUuid: uuidv4(), reviewUuid, sortOrder: i })))
      .returning();
    return results;
  }
}
