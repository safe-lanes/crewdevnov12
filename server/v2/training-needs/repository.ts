import { eq, and, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db";
import { trainingNeedsOtherV2, trainingNeedsSourceOverlayV2 } from "../../../shared/v2/training-needs/schema";
import type { TrainingNeedOther, InsertTrainingNeedOther } from "../../../shared/v2/training-needs/schema";
import { screeningB7TrainingItems } from "../../../shared/v2/recruitment/schema";
import { apprTrainingFollowupsV2 } from "../../../shared/v2/appraisals/schema";
import { promoTrainingNeedsV2 } from "../../../shared/v2/promotions/schema";
import { masterUsers } from "../../../shared/schema";

type SourceType = "recruitment" | "appraisal" | "promotion";

export type AggregatedTrainingNeed = {
  source: string;
  sourceRefUuid: string;
  name: string | null;
  rank: string | null;
  training: string | null;
  correspondingInDb: string | null;
  identifiedBy: string | null;
  identifiedByUuid: string | null;
  category: string | null;
  status: string | null;
  targetDate: string | null;
  comments: string | null;
  editable: "limited" | "full";
  // Linkage fields — populated for Others rows so edit dialog can preserve them
  crewMemberId: string | null;
  rankId: string | null;
};

type RawRecruitmentRow = {
  source_ref_uuid: string;
  training: string | null;
  identified_by: string | null;
  category: string | null;
  status: string | null;
  target_date: string | null;
  comments: string | null;
  name: string | null;
  rank: string | null;
  overlay_status: string | null;
  overlay_comments: string | null;
};

type RawAppraisalRow = {
  source_ref_uuid: string;
  training: string | null;
  corresponding_in_db: string | null;
  identified_by: string | null;
  category: string | null;
  status: string | null;
  target_date: string | null;
  comments: string | null;
  name: string | null;
  rank: string | null;
};

type RawPromotionRow = {
  source_ref_uuid: string;
  training: string | null;
  corresponding_in_db: string | null;
  identified_by: string | null;
  category: string | null;
  status: string | null;
  target_date: string | null;
  name: string | null;
  rank: string | null;
  overlay_status: string | null;
  overlay_comments: string | null;
};

export type SourcePatchInput = {
  status?: string | null;
  targetDate?: string | null;
  comments?: string | null;
  correspondingInDb?: string | null;
};

export class TrainingNeedsRepository {
  // ---- Aggregation ----
  async aggregateAll(): Promise<AggregatedTrainingNeed[]> {
    const db = getDb();

    const recruitmentResult = await db.execute(sql`
      SELECT
        b7i.train_item_uuid AS source_ref_uuid,
        b7i.training,
        COALESCE(mu.fullname, mu.display_name, b7i.identified_by_uuid) AS identified_by,
        b7i.category,
        b7i.status,
        b7i.due_date AS target_date,
        b7i.comments,
        TRIM(CONCAT_WS(' ', rc.first_name, rc.family_name)) AS name,
        rc.present_rank AS rank,
        ov.status AS overlay_status,
        ov.comments AS overlay_comments,
        ov.corresponding_in_db AS overlay_corresponding_in_db
      FROM screening_b7_training_items b7i
      JOIN screening_b7_training b7 ON b7i.b7_uuid = b7.b7_uuid AND b7.is_deleted = FALSE
      JOIN recruitment_candidates_v2 rc ON b7.rec_can_uuid = rc.rec_can_uuid AND rc.is_deleted = FALSE
      LEFT JOIN master_users mu ON mu.user_uuid = b7i.identified_by_uuid
      LEFT JOIN training_needs_source_overlay_v2 ov
        ON ov.source_type = 'recruitment'
       AND ov.source_ref_uuid = b7i.train_item_uuid
       AND ov.is_deleted = FALSE
      WHERE b7i.is_deleted = FALSE
        AND rc.status = 'Recruited'
    `);
    const recruitmentRows = recruitmentResult.rows as (RawRecruitmentRow & {
      overlay_corresponding_in_db: string | null;
    })[];

    const appraisalResult = await db.execute(sql`
      SELECT
        tf.training_followup_uuid AS source_ref_uuid,
        tf.training,
        tf.corresponding_in_db,
        COALESCE(mu.fullname, mu.display_name, tf.identified_by_uuid) AS identified_by,
        tf.category,
        tf.status,
        tf.target_date,
        tf.comment AS comments,
        ar.seafarers_name AS name,
        ar.seafarers_rank AS rank
      FROM appr_training_followups_v2 tf
      JOIN appraisal_results_v2 ar ON tf.appraisal_uuid = ar.appraisal_uuid AND ar.is_deleted = FALSE
      LEFT JOIN master_users mu ON mu.user_uuid = tf.identified_by_uuid
      WHERE tf.is_deleted = FALSE
    `);
    const appraisalRows = appraisalResult.rows as RawAppraisalRow[];

    const promotionResult = await db.execute(sql`
      SELECT
        tn.tn_uuid AS source_ref_uuid,
        tn.training,
        tn.corresponding_in_db,
        COALESCE(mu.fullname, mu.display_name, tn.identified_by_uuid) AS identified_by,
        tn.category,
        tn.status,
        tn.completion_date AS target_date,
        TRIM(CONCAT_WS(' ', cm.first_name, cm.family_name)) AS name,
        cm.present_rank AS rank,
        ov.status AS overlay_status,
        ov.comments AS overlay_comments
      FROM promo_training_needs_v2 tn
      JOIN promotion_reviews_v2 pr ON tn.review_uuid = pr.review_uuid AND pr.is_deleted = FALSE
      LEFT JOIN crew_members_v2 cm ON pr.crew_member_id = cm.emp_no AND cm.is_deleted = FALSE
      LEFT JOIN master_users mu ON mu.user_uuid = tn.identified_by_uuid
      LEFT JOIN training_needs_source_overlay_v2 ov
        ON ov.source_type = 'promotion'
       AND ov.source_ref_uuid = tn.tn_uuid
       AND ov.is_deleted = FALSE
      WHERE tn.is_deleted = FALSE
    `);
    const promotionRows = promotionResult.rows as RawPromotionRow[];

    const otherRowsRaw = await db
      .select({
        row: trainingNeedsOtherV2,
        resolvedIdentifiedBy: sql<string | null>`COALESCE(${masterUsers.fullname}, ${masterUsers.displayName}, ${trainingNeedsOtherV2.identifiedBy})`,
      })
      .from(trainingNeedsOtherV2)
      .leftJoin(masterUsers, eq(masterUsers.userUuid, trainingNeedsOtherV2.identifiedByUuid))
      .where(eq(trainingNeedsOtherV2.isDeleted, false));
    const otherRows = otherRowsRaw.map((r: { row: TrainingNeedOther; resolvedIdentifiedBy: string | null }) => ({ ...r.row, resolvedIdentifiedBy: r.resolvedIdentifiedBy }));

    const result: AggregatedTrainingNeed[] = [];

    for (const r of recruitmentRows) {
      result.push({
        source: "Recruitment",
        sourceRefUuid: r.source_ref_uuid,
        name: r.name || null,
        rank: r.rank || null,
        training: r.training,
        correspondingInDb: r.overlay_corresponding_in_db,
        identifiedBy: r.identified_by,
        identifiedByUuid: null,
        category: r.category,
        // status from source; overlay is fallback if source is null
        status: r.status ?? r.overlay_status,
        targetDate: r.target_date,
        // comments come from source (b7i.comments) — overlay is fallback
        comments: r.comments ?? r.overlay_comments,
        editable: "limited",
        crewMemberId: null,
        rankId: null,
      });
    }

    for (const r of appraisalRows) {
      result.push({
        source: "Appraisal",
        sourceRefUuid: r.source_ref_uuid,
        name: r.name || null,
        rank: r.rank || null,
        training: r.training,
        correspondingInDb: r.corresponding_in_db,
        identifiedBy: r.identified_by,
        identifiedByUuid: null,
        category: r.category,
        status: r.status,
        targetDate: r.target_date,
        comments: r.comments,
        editable: "limited",
        crewMemberId: null,
        rankId: null,
      });
    }

    for (const r of promotionRows) {
      result.push({
        source: "Promotion",
        sourceRefUuid: r.source_ref_uuid,
        name: r.name || null,
        rank: r.rank || null,
        training: r.training,
        correspondingInDb: r.corresponding_in_db,
        identifiedBy: r.identified_by,
        identifiedByUuid: null,
        category: r.category,
        // status from source; overlay is fallback if source is null
        status: r.status ?? r.overlay_status,
        targetDate: r.target_date,
        // comments come from overlay (source table has no comments column)
        comments: r.overlay_comments,
        editable: "limited",
        crewMemberId: null,
        rankId: null,
      });
    }

    for (const r of otherRows) {
      result.push({
        source: r.sourceLabel || "Others",
        sourceRefUuid: r.tnoUuid,
        name: r.name,
        rank: r.rank,
        training: r.training,
        correspondingInDb: r.correspondingInDb,
        identifiedBy: r.resolvedIdentifiedBy,
        identifiedByUuid: r.identifiedByUuid,
        category: r.category,
        status: r.status,
        targetDate: r.targetDate,
        comments: r.comments,
        editable: "full",
        crewMemberId: r.crewMemberId,
        rankId: r.rankId,
      });
    }

    return result;
  }

  // ---- Source PATCHes (limited fields: status / targetDate / comments) ----
  // Where the source table cannot persist a field, we upsert it into
  // training_needs_source_overlay_v2 instead — no source-module schema changes.

  private async upsertOverlay(
    sourceType: SourceType,
    sourceRefUuid: string,
    fields: { status?: string | null; comments?: string | null; correspondingInDb?: string | null },
    auditUserUuid?: string | null,
  ): Promise<void> {
    if (Object.keys(fields).length === 0) return;
    const db = getDb();
    const existing = await db
      .select()
      .from(trainingNeedsSourceOverlayV2)
      .where(
        and(
          eq(trainingNeedsSourceOverlayV2.sourceType, sourceType),
          eq(trainingNeedsSourceOverlayV2.sourceRefUuid, sourceRefUuid),
          eq(trainingNeedsSourceOverlayV2.isDeleted, false),
        ),
      );
    if (existing.length > 0) {
      await db
        .update(trainingNeedsSourceOverlayV2)
        .set({ ...fields, updatedAt: new Date(), updatedByUuid: auditUserUuid || null })
        .where(eq(trainingNeedsSourceOverlayV2.soUuid, existing[0].soUuid));
    } else {
      await db.insert(trainingNeedsSourceOverlayV2).values({
        soUuid: uuidv4(),
        sourceType,
        sourceRefUuid,
        status: fields.status ?? null,
        comments: fields.comments ?? null,
        correspondingInDb: fields.correspondingInDb ?? null,
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      });
    }
  }

  async patchRecruitment(
    trainItemUuid: string,
    data: SourcePatchInput,
    auditUserUuid?: string | null,
  ): Promise<boolean> {
    const db = getDb();
    const sets: Partial<typeof screeningB7TrainingItems.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    // Status now has its own column on the source table (added for Task #713);
    // write it there directly so the Recruitment B7 form (which reads the
    // source column) stays in sync with edits made from Training & Retention.
    if (data.status !== undefined) sets.status = data.status;
    if (data.targetDate !== undefined) sets.dueDate = data.targetDate;
    if (data.comments !== undefined) sets.comments = data.comments;
    const r = await db
      .update(screeningB7TrainingItems)
      .set(sets)
      .where(and(eq(screeningB7TrainingItems.trainItemUuid, trainItemUuid), eq(screeningB7TrainingItems.isDeleted, false)))
      .returning();
    if (r.length === 0) return false;
    // The source table has no corresponding_in_db column — overlay it.
    if (data.correspondingInDb !== undefined) {
      await this.upsertOverlay("recruitment", trainItemUuid, { correspondingInDb: data.correspondingInDb }, auditUserUuid);
    }
    return true;
  }

  async patchAppraisal(
    trainingFollowupUuid: string,
    data: SourcePatchInput,
    _auditUserUuid?: string | null,
  ): Promise<boolean> {
    const db = getDb();
    const sets: Partial<typeof apprTrainingFollowupsV2.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (data.status !== undefined) sets.status = data.status;
    if (data.targetDate !== undefined) sets.targetDate = data.targetDate;
    if (data.comments !== undefined) sets.comment = data.comments;
    if (data.correspondingInDb !== undefined) sets.correspondingInDb = data.correspondingInDb;
    const r = await db
      .update(apprTrainingFollowupsV2)
      .set(sets)
      .where(and(eq(apprTrainingFollowupsV2.trainingFollowupUuid, trainingFollowupUuid), eq(apprTrainingFollowupsV2.isDeleted, false)))
      .returning();
    return r.length > 0;
  }

  async patchPromotion(
    tnUuid: string,
    data: SourcePatchInput,
    auditUserUuid?: string | null,
  ): Promise<boolean> {
    const db = getDb();
    const sets: Partial<typeof promoTrainingNeedsV2.$inferInsert> & { updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (data.status !== undefined) sets.status = data.status;
    if (data.targetDate !== undefined) sets.completionDate = data.targetDate;
    if (data.correspondingInDb !== undefined) sets.correspondingInDb = data.correspondingInDb;
    const r = await db
      .update(promoTrainingNeedsV2)
      .set(sets)
      .where(and(eq(promoTrainingNeedsV2.tnUuid, tnUuid), eq(promoTrainingNeedsV2.isDeleted, false)))
      .returning();
    if (r.length === 0) return false;
    // Comments has no column on the source — overlay it.
    if (data.comments !== undefined) {
      await this.upsertOverlay("promotion", tnUuid, { comments: data.comments }, auditUserUuid);
    }
    return true;
  }

  // ---- Others CRUD ----
  async createOther(data: InsertTrainingNeedOther, auditUserUuid?: string | null): Promise<TrainingNeedOther> {
    const db = getDb();
    const r = await db
      .insert(trainingNeedsOtherV2)
      .values({
        ...data,
        tnoUuid: uuidv4(),
        sourceLabel: data.sourceLabel || "Others",
        createdByUuid: auditUserUuid || null,
        updatedByUuid: auditUserUuid || null,
      })
      .returning();
    return r[0];
  }

  async updateOther(tnoUuid: string, data: Partial<InsertTrainingNeedOther>, auditUserUuid?: string | null): Promise<TrainingNeedOther | undefined> {
    const db = getDb();
    const r = await db
      .update(trainingNeedsOtherV2)
      .set({ ...data, updatedAt: new Date(), updatedByUuid: auditUserUuid || null })
      .where(and(eq(trainingNeedsOtherV2.tnoUuid, tnoUuid), eq(trainingNeedsOtherV2.isDeleted, false)))
      .returning();
    return r[0];
  }

  async deleteOther(tnoUuid: string): Promise<boolean> {
    const db = getDb();
    const r = await db
      .update(trainingNeedsOtherV2)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(and(eq(trainingNeedsOtherV2.tnoUuid, tnoUuid), eq(trainingNeedsOtherV2.isDeleted, false)))
      .returning();
    return r.length > 0;
  }
}
