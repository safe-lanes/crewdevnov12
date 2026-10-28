import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprReviewersV2 } from "../../../../shared/v2/appraisals/schema";
import { syncChildRows, textField, type ChildTableConfig } from "./childRowSync";

// A transaction (tx) or the default connection.
type Executor = any;

const ROWS: ChildTableConfig = {
  table: apprReviewersV2,
  uuidKey: "reviewerUuid",
  fields: [
    textField("userUuid"),
    textField("reviewerName"),
    textField("designation"),
  ],
};

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

  // Stage 2: the whole reviewer list. The form sends reviewers without a row
  // uuid, so each one is matched to a live row here: same user, or a row with
  // no user and the same name (the rule addAssignedReviewers uses). Unchanged
  // rows are not written, reviewers left out are soft-deleted and new ones are
  // inserted. Before APD-37 every submit deleted and re-inserted all rows.
  async syncForAppraisal(
    appraisalUuid: string,
    reviewers: { userUuid?: string; reviewerName?: string; designation?: string }[],
    auditUserUuid?: string | null,
    executor: Executor = getDb(),
  ): Promise<number> {
    const live: any[] = await executor
      .select()
      .from(apprReviewersV2)
      .where(
        and(
          eq(apprReviewersV2.appraisalUuid, appraisalUuid),
          eq(apprReviewersV2.isDeleted, false),
        ),
      );

    // Each live row is matched once, so a reviewer listed twice keeps two rows.
    const unmatched = [...live];
    const take = (match: (row: any) => boolean) => {
      const i = unmatched.findIndex(match);
      return i === -1 ? undefined : unmatched.splice(i, 1)[0];
    };

    const rows = reviewers.map((reviewer) => {
      const userUuid = reviewer.userUuid?.trim();
      const name = reviewer.reviewerName?.trim();
      const existing = (userUuid ? take((r) => (r.userUuid ?? "").trim() === userUuid) : undefined)
        ?? (name ? take((r) => !r.userUuid && (r.reviewerName ?? "").trim() === name) : undefined);
      return {
        uuid: existing?.reviewerUuid,
        userUuid: reviewer.userUuid,
        reviewerName: reviewer.reviewerName,
        designation: reviewer.designation,
      };
    });

    return syncChildRows(executor, ROWS, appraisalUuid, { rows }, "replace", auditUserUuid);
  }
}
