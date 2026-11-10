import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoChecklistProgressV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoChecklistProgressV2, InsertPromoChecklistProgressV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";
import { captureChange } from "../../sync/changeCapture";

export class ChecklistProgressRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoChecklistProgressV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoChecklistProgressV2)
      .where(and(eq(promoChecklistProgressV2.reviewUuid, reviewUuid), eq(promoChecklistProgressV2.isDeleted, false)))
      .orderBy(promoChecklistProgressV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoChecklistProgressV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoChecklistProgressV2)
      .where(and(inArray(promoChecklistProgressV2.reviewUuid, reviewUuids), eq(promoChecklistProgressV2.isDeleted, false)))
      .orderBy(promoChecklistProgressV2.sortOrder);
  }

  // `executor` is a transaction (tx) or the default connection. Every written
  // row is reported to the sync change capture on the same executor (PRD-07).
  async replaceForReview(reviewUuid: string, items: Omit<InsertPromoChecklistProgressV2, "cpUuid" | "reviewUuid">[], auditUserUuid: string | null = null, executor: any = getDb()): Promise<PromoChecklistProgressV2[]> {
    const db = executor;
    const existing: PromoChecklistProgressV2[] = await db
      .select()
      .from(promoChecklistProgressV2)
      .where(and(eq(promoChecklistProgressV2.reviewUuid, reviewUuid), eq(promoChecklistProgressV2.isDeleted, false)));

    if (items.length === 0) {
      await this.softDeleteRows(existing, auditUserUuid, db);
      return [];
    }

    const results: PromoChecklistProgressV2[] = [];
    const usedExistingIds: number[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const match = existing.find(e =>
        e.sectionId === item.sectionId &&
        e.assessmentPointId === item.assessmentPointId &&
        !usedExistingIds.includes(e.id)
      );

      if (match) {
        usedExistingIds.push(match.id);
        const updated = await db
          .update(promoChecklistProgressV2)
          .set({
            completed: item.completed ?? false,
            sectionTitle: item.sectionTitle ?? null,
            assessmentPointText: item.assessmentPointText ?? null,
            verifierName: item.verifierName,
            verifierRank: item.verifierRank ?? null,
            date: item.date,
            verificationsData: item.verificationsData ?? null,
            commentsData: item.commentsData ?? null,
            deprecatedAttachmentsData: item.deprecatedAttachmentsData ?? null,
            sortOrder: i,
            updatedAt: new Date(),
            updatedByUuid: auditUserUuid,
          })
          .where(eq(promoChecklistProgressV2.id, match.id))
          .returning();
        await captureChange(db, { table: promoChecklistProgressV2, rowUuid: match.cpUuid, oldRow: match, newRow: updated[0], actorUuid: auditUserUuid });
        results.push(updated[0]);
      } else {
        const inserted = await db
          .insert(promoChecklistProgressV2)
          .values({ ...item, cpUuid: uuidv4(), reviewUuid, sortOrder: i, createdByUuid: auditUserUuid, updatedByUuid: auditUserUuid })
          .returning();
        await captureChange(db, { table: promoChecklistProgressV2, rowUuid: inserted[0]?.cpUuid, oldRow: null, newRow: inserted[0], actorUuid: auditUserUuid });
        results.push(inserted[0]);
      }
    }

    await this.softDeleteRows(existing.filter(e => !usedExistingIds.includes(e.id)), auditUserUuid, db);

    return results;
  }

  // Soft-deletes the given live rows one by one, so each deletion is captured
  // with its own row.
  private async softDeleteRows(rows: PromoChecklistProgressV2[], auditUserUuid: string | null, executor: any): Promise<void> {
    const now = new Date();
    for (const old of rows) {
      const deleted = await executor
        .update(promoChecklistProgressV2)
        .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid })
        .where(eq(promoChecklistProgressV2.id, old.id))
        .returning();
      await captureChange(executor, { table: promoChecklistProgressV2, rowUuid: old.cpUuid, oldRow: old, newRow: deleted[0], actorUuid: auditUserUuid });
    }
  }
}
