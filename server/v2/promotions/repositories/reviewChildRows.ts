import { and, eq, inArray } from "drizzle-orm";
import {
  promoCriteriaStatusV2,
  promoCesTestsV2,
  promoCriteriaCommentsV2,
  promoTrainingCommentsV2,
  promoTrainingNeedsV2,
  promoApprovalsV2,
  promoSuitabilityV2,
  promoExecutionLedgerV2,
  promoChecklistProgressV2,
  promoChecklistAttachmentsV2,
  promoChecklistVerificationsV2,
  promoChecklistCommentsV2,
} from "../../../../shared/v2/promotions/schema";
import { captureChange } from "../../sync/changeCapture";

// Every table that holds a promotion review's child rows (PRD-12), with the
// column that holds the row's own uuid. Each has `review_uuid`, except the
// attachments, which hang off the review's checklist rows
// (attachments, verifications and comments, PRD-14).
export const PROMOTION_REVIEW_CHILD_TABLES = [
  { table: promoCriteriaStatusV2, uuid: promoCriteriaStatusV2.csUuid },
  { table: promoCesTestsV2, uuid: promoCesTestsV2.ctUuid },
  { table: promoCriteriaCommentsV2, uuid: promoCriteriaCommentsV2.ccUuid },
  { table: promoTrainingCommentsV2, uuid: promoTrainingCommentsV2.tcUuid },
  { table: promoTrainingNeedsV2, uuid: promoTrainingNeedsV2.tnUuid },
  { table: promoApprovalsV2, uuid: promoApprovalsV2.apUuid },
  { table: promoSuitabilityV2, uuid: promoSuitabilityV2.psUuid },
  { table: promoExecutionLedgerV2, uuid: promoExecutionLedgerV2.ledgerUuid },
  { table: promoChecklistProgressV2, uuid: promoChecklistProgressV2.cpUuid },
] as const;

type Executor = any;

async function softDeleteLive(
  executor: Executor,
  table: any,
  uuidColumn: any,
  where: any,
  auditUserUuid: string | null,
): Promise<number> {
  const live: any[] = await executor.select().from(table).where(and(where, eq(table.isDeleted, false)));
  const now = new Date();
  // One row at a time, so each deletion is captured with its own row (PRD-07).
  for (const old of live) {
    const [row] = await executor
      .update(table)
      .set({ isDeleted: true, updatedAt: now, ...(auditUserUuid ? { updatedByUuid: auditUserUuid } : {}) })
      .where(eq(table.id, old.id))
      .returning();
    await captureChange(executor, {
      table,
      rowUuid: old[camel(uuidColumn.name)],
      oldRow: old,
      newRow: row,
      actorUuid: auditUserUuid,
    });
  }
  return live.length;
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// Soft-deletes the live child rows of a promotion review in every child table
// and the attachments of its checklist rows, so the sync never sends live rows
// of a deleted review. Rows deleted earlier are not written. Returns the
// number of rows deleted.
export async function softDeletePromotionReviewChildRows(
  executor: Executor,
  reviewUuid: string,
  auditUserUuid: string | null = null,
): Promise<number> {
  let deleted = 0;

  // The attachments first: they are found through the checklist rows.
  const progress: Array<{ cpUuid: string }> = await executor
    .select({ cpUuid: promoChecklistProgressV2.cpUuid })
    .from(promoChecklistProgressV2)
    .where(eq(promoChecklistProgressV2.reviewUuid, reviewUuid));
  if (progress.length > 0) {
    const cpUuids = progress.map((p) => p.cpUuid);
    deleted += await softDeleteLive(
      executor,
      promoChecklistAttachmentsV2,
      promoChecklistAttachmentsV2.attUuid,
      inArray(promoChecklistAttachmentsV2.checklistProgressUuid, cpUuids),
      auditUserUuid,
    );
    deleted += await softDeleteLive(
      executor,
      promoChecklistVerificationsV2,
      promoChecklistVerificationsV2.cvUuid,
      inArray(promoChecklistVerificationsV2.checklistProgressUuid, cpUuids),
      auditUserUuid,
    );
    deleted += await softDeleteLive(
      executor,
      promoChecklistCommentsV2,
      promoChecklistCommentsV2.cmUuid,
      inArray(promoChecklistCommentsV2.checklistProgressUuid, cpUuids),
      auditUserUuid,
    );
  }

  // Sequential: one transaction runs on one connection.
  for (const { table, uuid } of PROMOTION_REVIEW_CHILD_TABLES) {
    deleted += await softDeleteLive(
      executor,
      table,
      uuid,
      eq((table as any).reviewUuid, reviewUuid),
      auditUserUuid,
    );
  }
  return deleted;
}
