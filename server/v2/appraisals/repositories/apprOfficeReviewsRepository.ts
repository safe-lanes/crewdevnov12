import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "../../db";
import { apprOfficeReviewsV2 } from "../../../../shared/v2/appraisals/schema";
import type { ApprOfficeReviewV2 } from "../../../../shared/v2/appraisals/types";
import type { AppraisalSectionChanges } from "../../../../shared/v2/appraisals/appraisalChanges";
import { syncChildRows, textField, type ChildTableConfig } from "./childRowSync";

// A transaction (tx) or the default connection.
type Executor = any;

const ROWS: ChildTableConfig = {
  table: apprOfficeReviewsV2,
  uuidKey: "officeReviewUuid",
  fields: [
    textField("name"),
    textField("position"),
    textField("feedback"),
    textField("userUuid"),
    { column: "isAssigned", from: ["isAssigned"], normalize: (r) => r.isAssigned ?? false },
  ],
};

export class ApprOfficeReviewsRepository {
  async findByAppraisalUuids(appraisalUuids: string[]): Promise<Map<string, ApprOfficeReviewV2[]>> {
    if (appraisalUuids.length === 0) return new Map();
    const db = getDb();
    const rows = await db
      .select()
      .from(apprOfficeReviewsV2)
      .where(and(
        inArray(apprOfficeReviewsV2.appraisalUuid, appraisalUuids),
        eq(apprOfficeReviewsV2.isDeleted, false)
      ))
      .orderBy(apprOfficeReviewsV2.sortOrder);
    const map = new Map<string, ApprOfficeReviewV2[]>();
    for (const row of rows) {
      if (!map.has(row.appraisalUuid)) map.set(row.appraisalUuid, []);
      map.get(row.appraisalUuid)!.push(row);
    }
    return map;
  }

  // The whole section (create, stage submits): rows matched by uuid, live rows
  // missing from `rows` are soft-deleted, unchanged rows are not written.
  async syncForAppraisal(appraisalUuid: string, rows: any[], auditUserUuid?: string, executor: Executor = getDb()): Promise<number> {
    return syncChildRows(executor, ROWS, appraisalUuid, { rows }, "replace", auditUserUuid);
  }

  // A save-draft change set: only the given rows and deletions are written.
  async applyChanges(appraisalUuid: string, changes: AppraisalSectionChanges, auditUserUuid?: string, executor: Executor = getDb()): Promise<number> {
    return syncChildRows(executor, ROWS, appraisalUuid, changes, "patch", auditUserUuid);
  }

  // Stage 2: gives each assigned reviewer one G1 row. The server does this, not
  // the form, so two sessions can't each add the row under their own uuid
  // (APD-20). A reviewer who already has a live row (same user, or a row from
  // before migration 0180 with no user and the same name) gets no new row; if
  // that row was added by hand it is marked assigned. Running it again writes
  // nothing. Reviewers without a user are skipped.
  async addAssignedReviewers(
    appraisalUuid: string,
    reviewers: { userUuid?: string; reviewerName?: string; designation?: string }[],
    auditUserUuid?: string | null,
    executor: Executor = getDb(),
  ): Promise<number> {
    const live: any[] = await executor
      .select()
      .from(apprOfficeReviewsV2)
      .where(and(
        eq(apprOfficeReviewsV2.appraisalUuid, appraisalUuid),
        eq(apprOfficeReviewsV2.isDeleted, false),
      ));

    const rows: Record<string, unknown>[] = [];
    const seen = new Set<string>();
    for (const reviewer of reviewers) {
      const userUuid = reviewer.userUuid?.trim();
      if (!userUuid || seen.has(userUuid)) continue;
      seen.add(userUuid);
      const name = reviewer.reviewerName?.trim() || "";

      const existing = live.find((r) => r.userUuid === userUuid)
        ?? (name ? live.find((r) => !r.userUuid && (r.name ?? "").trim() === name) : undefined);
      if (!existing) {
        rows.push({ name, position: reviewer.designation || "", feedback: "", userUuid, isAssigned: true });
      } else if (!existing.isAssigned) {
        rows.push({ uuid: existing.officeReviewUuid, isAssigned: true });
      }
    }

    if (rows.length === 0) return 0;
    return syncChildRows(executor, ROWS, appraisalUuid, { rows }, "patch", auditUserUuid);
  }
}
