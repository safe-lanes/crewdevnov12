import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { promoApprovalsV2 } from "../../../../shared/v2/promotions/schema";
import type { PromoApprovalV2, InsertPromoApprovalV2 } from "../../../../shared/v2/promotions/types";
import { v4 as uuidv4 } from "uuid";
import { keyField, syncChildRows, textField, type ChildFieldConfig, type ChildTableConfig } from "../../appraisals/repositories/childRowSync";
import { promoRowUuid, type PromoSectionChanges } from "../../../../shared/v2/promotions/promotionChanges";

const APPROVAL_FIELDS: ChildFieldConfig[] = [
  textField("date"),
  textField("approver"),
  textField("status"),
  textField("approval"),
  textField("comments"),
];

const APPROVAL_TABLE = {
  table: promoApprovalsV2,
  uuidKey: "apUuid",
  parentKey: "reviewUuid",
  parentLabel: "promotion review",
};

// promo_approvals_v2 holds three lists (PRD-02). Each is saved on its own and
// sees only its own rows, split the way the GET response splits them.
// - B1 approvers added by hand: uuid made by the browser.
export const MANUAL_APPROVER_ROWS: ChildTableConfig = {
  ...APPROVAL_TABLE,
  fields: APPROVAL_FIELDS,
  scope: (row) => !row.isSelectedForSubmission && !row.isFromPartA,
  fixed: { isFromPartA: false, isSelectedForSubmission: false },
};

// - B1 approvers from Part A: one row per approver user (approverId).
export const PART_A_APPROVER_ROWS: ChildTableConfig = {
  ...APPROVAL_TABLE,
  fields: [keyField("approverId"), ...APPROVAL_FIELDS],
  scope: (row) => !row.isSelectedForSubmission && !!row.isFromPartA,
  fixed: { isFromPartA: true, isSelectedForSubmission: false },
  matchKey: ["approverId"],
  uuidFor: (row, reviewUuid) => promoRowUuid(reviewUuid, "partAApprovers", String(row.approverId)),
  revive: true,
};

// - Approvers picked when Part A is submitted for approval: one row per user.
export const SELECTED_APPROVER_ROWS: ChildTableConfig = {
  ...APPROVAL_TABLE,
  fields: [keyField("approverId"), textField("approver")],
  scope: (row) => !!row.isSelectedForSubmission,
  fixed: { isSelectedForSubmission: true },
  matchKey: ["approverId"],
  uuidFor: (row, reviewUuid) => promoRowUuid(reviewUuid, "selectedApprovers", String(row.approverId)),
  revive: true,
};

const APPROVAL_LISTS = {
  approvers: MANUAL_APPROVER_ROWS,
  partAApprovers: PART_A_APPROVER_ROWS,
  selectedApprovers: SELECTED_APPROVER_ROWS,
} as const;

export class ApprovalsRepository {
  async findByReviewUuid(reviewUuid: string): Promise<PromoApprovalV2[]> {
    const db = getDb();
    return db
      .select()
      .from(promoApprovalsV2)
      .where(and(eq(promoApprovalsV2.reviewUuid, reviewUuid), eq(promoApprovalsV2.isDeleted, false)))
      .orderBy(promoApprovalsV2.sortOrder);
  }

  async findByReviewUuids(reviewUuids: string[]): Promise<PromoApprovalV2[]> {
    if (reviewUuids.length === 0) return [];
    const db = getDb();
    return db
      .select()
      .from(promoApprovalsV2)
      .where(and(inArray(promoApprovalsV2.reviewUuid, reviewUuids), eq(promoApprovalsV2.isDeleted, false)))
      .orderBy(promoApprovalsV2.sortOrder);
  }

  async create(data: Omit<InsertPromoApprovalV2, "apUuid">): Promise<PromoApprovalV2> {
    const db = getDb();
    const results = await db
      .insert(promoApprovalsV2)
      .values({ ...data, apUuid: uuidv4() })
      .returning();
    return results[0];
  }

  // Saves one approver list of a change set: rows matched by uuid (or user),
  // only the sent fields written, only the listed rows deleted.
  async applyChanges(
    reviewUuid: string,
    list: keyof typeof APPROVAL_LISTS,
    changes: PromoSectionChanges,
    auditUserUuid: string | null = null,
    executor: any = getDb(),
  ): Promise<number> {
    return syncChildRows(executor, APPROVAL_LISTS[list], reviewUuid, changes, "patch", auditUserUuid);
  }
}
