import { eq, and, inArray, notInArray } from "drizzle-orm";
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
    const existing = await db
      .select()
      .from(promoCesTestsV2)
      .where(and(eq(promoCesTestsV2.reviewUuid, reviewUuid), eq(promoCesTestsV2.isDeleted, false)));

    if (tests.length === 0) {
      if (existing.length > 0) {
        await db
          .update(promoCesTestsV2)
          .set({ isDeleted: true, updatedAt: new Date() })
          .where(and(eq(promoCesTestsV2.reviewUuid, reviewUuid), eq(promoCesTestsV2.isDeleted, false)));
      }
      return [];
    }

    const results: PromoCesTestV2[] = [];
    const usedExistingIds: number[] = [];

    for (let i = 0; i < tests.length; i++) {
      const t = tests[i];
      const match = t.testId
        ? existing.find(e => e.testId === t.testId && !usedExistingIds.includes(e.id))
        : existing[i] && !usedExistingIds.includes(existing[i].id) ? existing[i] : undefined;

      if (match) {
        usedExistingIds.push(match.id);
        const updated = await db
          .update(promoCesTestsV2)
          .set({ ...t, sortOrder: i, updatedAt: new Date() })
          .where(eq(promoCesTestsV2.id, match.id))
          .returning();
        results.push(updated[0]);
      } else {
        const inserted = await db
          .insert(promoCesTestsV2)
          .values({ ...t, ctUuid: uuidv4(), reviewUuid, sortOrder: i })
          .returning();
        results.push(inserted[0]);
      }
    }

    const unusedIds = existing.filter(e => !usedExistingIds.includes(e.id)).map(e => e.id);
    if (unusedIds.length > 0) {
      await db
        .update(promoCesTestsV2)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(inArray(promoCesTestsV2.id, unusedIds));
    }

    return results;
  }
}
