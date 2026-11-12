import { eq, and, inArray, desc } from "drizzle-orm";
import { getDb } from "../../db";
import { promotionReviewsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromotionReviewV2, InsertPromotionReviewV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";
import { captureChange } from "../../sync/changeCapture";

export class PromotionReviewsRepository {
  async findAll(): Promise<PromotionReviewV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promotionReviewsV2)
      .where(eq(promotionReviewsV2.isDeleted, false))
      .orderBy(desc(promotionReviewsV2.createdAt));
  }

  async findByUuid(reviewUuid: string): Promise<PromotionReviewV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(promotionReviewsV2)
      .where(and(eq(promotionReviewsV2.reviewUuid, reviewUuid), eq(promotionReviewsV2.isDeleted, false)));
    return results[0];
  }

  async findById(id: number): Promise<PromotionReviewV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(promotionReviewsV2)
      .where(and(eq(promotionReviewsV2.id, id), eq(promotionReviewsV2.isDeleted, false)));
    return results[0];
  }

  async findByCrewMemberId(crewMemberId: string): Promise<PromotionReviewV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promotionReviewsV2)
      .where(and(eq(promotionReviewsV2.crewMemberId, crewMemberId), eq(promotionReviewsV2.isDeleted, false)))
      .orderBy(desc(promotionReviewsV2.createdAt));
  }

  async findByCrewAndRank(crewMemberId: string, promotionToRank: string): Promise<PromotionReviewV2 | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(promotionReviewsV2)
      .where(and(
        eq(promotionReviewsV2.crewMemberId, crewMemberId),
        eq(promotionReviewsV2.promotionToRank, promotionToRank),
        eq(promotionReviewsV2.isDeleted, false)
      ));
    return results[0];
  }

  async findByUuids(reviewUuids: string[]): Promise<PromotionReviewV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promotionReviewsV2)
      .where(and(inArray(promotionReviewsV2.reviewUuid, reviewUuids), eq(promotionReviewsV2.isDeleted, false)));
  }

  // Writes. `executor` is a transaction (tx) or the default connection. Each
  // written row is reported to the sync change capture on the same executor
  // (PRD-07); the actor is the row's created_by / updated_by.
  async create(data: Omit<InsertPromotionReviewV2, "reviewUuid">, executor: any = getDb()): Promise<PromotionReviewV2> {
    const results = await executor
      .insert(promotionReviewsV2)
      .values({ ...data, reviewUuid: uuidv4() })
      .returning();
    const row = results[0];
    await captureChange(executor, {
      table: promotionReviewsV2, rowUuid: row?.reviewUuid, oldRow: null, newRow: row,
      actorUuid: (data as any).createdByUuid ?? null,
    });
    return row;
  }

  async update(reviewUuid: string, data: Partial<InsertPromotionReviewV2>, executor: any = getDb()): Promise<PromotionReviewV2 | undefined> {
    const old = await this.findLive(reviewUuid, executor);
    if (!old) return undefined;
    const results = await executor
      .update(promotionReviewsV2)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(promotionReviewsV2.id, old.id))
      .returning();
    await captureChange(executor, {
      table: promotionReviewsV2, rowUuid: reviewUuid, oldRow: old, newRow: results[0],
      actorUuid: (data as any).updatedByUuid ?? null,
    });
    return results[0];
  }

  // Crew and target rank of every deleted review. Auto-create skips these
  // pairs, so a deleted review is not made again with a new uuid (PRD-12).
  async findDeletedKeys(executor: any = getDb()): Promise<Array<{ crewMemberId: string; promotionToRank: string }>> {
    return executor
      .select({ crewMemberId: promotionReviewsV2.crewMemberId, promotionToRank: promotionReviewsV2.promotionToRank })
      .from(promotionReviewsV2)
      .where(eq(promotionReviewsV2.isDeleted, true));
  }

  // The review row only; the service deletes the child rows in the same
  // transaction (PRD-12).
  async softDelete(reviewUuid: string, auditUserUuid: string | null = null, executor: any = getDb()): Promise<boolean> {
    const old = await this.findLive(reviewUuid, executor);
    if (!old) return false;
    const results = await executor
      .update(promotionReviewsV2)
      .set({ isDeleted: true, updatedAt: new Date(), ...(auditUserUuid ? { updatedByUuid: auditUserUuid } : {}) })
      .where(eq(promotionReviewsV2.id, old.id))
      .returning();
    await captureChange(executor, {
      table: promotionReviewsV2, rowUuid: reviewUuid, oldRow: old, newRow: results[0], actorUuid: auditUserUuid,
    });
    return results.length > 0;
  }

  // The live review as stored, read on the executor of the write that follows.
  private async findLive(reviewUuid: string, executor: any): Promise<PromotionReviewV2 | undefined> {
    const rows = await executor
      .select()
      .from(promotionReviewsV2)
      .where(and(eq(promotionReviewsV2.reviewUuid, reviewUuid), eq(promotionReviewsV2.isDeleted, false)));
    return rows[0];
  }
}
