import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprReviewersV2 } from "../../../../shared/v2/appraisals/schema";
import { v4 as uuidv4 } from "uuid";

export class ApprReviewersRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, any[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprReviewersV2)
      .where(
        and(
          inArray(apprReviewersV2.appraisalUuid, appraisalUuids),
          eq(apprReviewersV2.isDeleted, false),
        ),
      )
      .orderBy(apprReviewersV2.sortOrder);

    const map = new Map<string, any[]>();
    for (const row of rows) {
      if (!map.has(row.appraisalUuid)) map.set(row.appraisalUuid, []);
      map.get(row.appraisalUuid)!.push(row);
    }
    return map;
  }

  async syncForAppraisal(
    appraisalUuid: string,
    reviewers: { userUuid?: string; reviewerName?: string; designation?: string }[],
    auditUserUuid?: string | null,
  ): Promise<void> {
    const db = getDb();
    const now = new Date();

    // Soft-delete all existing non-deleted rows for this appraisal
    await db
      .update(apprReviewersV2)
      .set({ isDeleted: true, updatedAt: now, updatedByUuid: auditUserUuid || null })
      .where(
        and(
          eq(apprReviewersV2.appraisalUuid, appraisalUuid),
          eq(apprReviewersV2.isDeleted, false),
        ),
      );

    if (reviewers.length === 0) return;

    // Insert fresh rows
    await db.insert(apprReviewersV2).values(
      reviewers.map((r, i) => ({
        reviewerUuid: uuidv4(),
        appraisalUuid,
        userUuid: r.userUuid || null,
        reviewerName: r.reviewerName || null,
        designation: r.designation || null,
        sortOrder: i,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      })),
    );
  }
}
