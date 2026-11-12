import { eq, and, inArray, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { promoChecklistProgressV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoChecklistProgressV2 } from "../../../../shared/v2/promotions/types";
import { checklistPointUuid } from "../../../../shared/v2/promotions/promotionChanges";
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

  // The live row of one checklist point, or null. Read on `executor`, so a row
  // made earlier in the same save is seen.
  async findLiveByPoint(reviewUuid: string, sectionId: string, pointId: string, executor: any = getDb()): Promise<PromoChecklistProgressV2 | null> {
    const rows: PromoChecklistProgressV2[] = await executor
      .select()
      .from(promoChecklistProgressV2)
      .where(and(
        eq(promoChecklistProgressV2.reviewUuid, reviewUuid),
        eq(promoChecklistProgressV2.sectionId, sectionId),
        eq(promoChecklistProgressV2.assessmentPointId, pointId),
        eq(promoChecklistProgressV2.isDeleted, false),
      ))
      .orderBy(promoChecklistProgressV2.id)
      .limit(1);
    return rows[0] ?? null;
  }

  // The row of one checklist point (PRD-14), created when it is not there yet.
  // A new row's uuid is derived from review, section and point, so ship and
  // office make the same row. A point row is never deleted by a save; one
  // deleted with its review comes back only through a write to that point.
  // `executor` is a transaction (tx) or the default connection. Every written
  // row is reported to the sync change capture on the same executor (PRD-07).
  async findOrCreateByPoint(
    reviewUuid: string,
    point: { sectionId: string; pointId: string; sectionTitle?: string | null; text?: string | null },
    auditUserUuid: string | null = null,
    executor: any = getDb(),
  ): Promise<PromoChecklistProgressV2> {
    const db = executor;
    const rows: PromoChecklistProgressV2[] = await db
      .select()
      .from(promoChecklistProgressV2)
      .where(and(
        eq(promoChecklistProgressV2.reviewUuid, reviewUuid),
        eq(promoChecklistProgressV2.sectionId, point.sectionId),
        eq(promoChecklistProgressV2.assessmentPointId, point.pointId),
      ))
      .orderBy(promoChecklistProgressV2.id);
    // The oldest live row (an older save may have made two).
    const live = rows.find((r) => !r.isDeleted);
    if (live) return live;

    const uuid = checklistPointUuid(reviewUuid, point.sectionId, point.pointId);
    const sameUuid = rows.find((r) => r.cpUuid === uuid);
    if (sameUuid) {
      const [revived] = await db
        .update(promoChecklistProgressV2)
        .set({ isDeleted: false, updatedAt: new Date(), updatedByUuid: auditUserUuid })
        .where(eq(promoChecklistProgressV2.id, sameUuid.id))
        .returning();
      await captureChange(db, { table: promoChecklistProgressV2, rowUuid: uuid, oldRow: sameUuid, newRow: revived, actorUuid: auditUserUuid });
      return revived;
    }

    const [{ next }] = await db
      .select({ next: sql<number>`COALESCE(MAX(${promoChecklistProgressV2.sortOrder}), -1) + 1` })
      .from(promoChecklistProgressV2)
      .where(eq(promoChecklistProgressV2.reviewUuid, reviewUuid));
    const [inserted] = await db
      .insert(promoChecklistProgressV2)
      .values({
        cpUuid: uuid,
        reviewUuid,
        sectionId: point.sectionId,
        assessmentPointId: point.pointId,
        sectionTitle: point.sectionTitle || null,
        assessmentPointText: point.text || null,
        completed: false,
        sortOrder: Number(next),
        createdByUuid: auditUserUuid,
        updatedByUuid: auditUserUuid,
      })
      .returning();
    await captureChange(db, { table: promoChecklistProgressV2, rowUuid: uuid, oldRow: null, newRow: inserted, actorUuid: auditUserUuid });
    return inserted;
  }

  // Writes the given columns of a point's row, only the ones that differ from
  // what is stored. No write, and no change captured, when none does.
  async updateState(
    row: PromoChecklistProgressV2,
    patch: Partial<Pick<PromoChecklistProgressV2, "completed" | "verifierName" | "verifierRank" | "date" | "sectionTitle" | "assessmentPointText">>,
    auditUserUuid: string | null = null,
    executor: any = getDb(),
  ): Promise<PromoChecklistProgressV2> {
    const changed: Record<string, unknown> = {};
    for (const [column, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      if (((row as any)[column] ?? null) !== (value ?? null)) changed[column] = value;
    }
    if (Object.keys(changed).length === 0) return row;
    const [updated] = await executor
      .update(promoChecklistProgressV2)
      .set({ ...changed, updatedAt: new Date(), updatedByUuid: auditUserUuid })
      .where(eq(promoChecklistProgressV2.id, row.id))
      .returning();
    await captureChange(executor, { table: promoChecklistProgressV2, rowUuid: row.cpUuid, oldRow: row, newRow: updated, actorUuid: auditUserUuid });
    return updated;
  }
}
