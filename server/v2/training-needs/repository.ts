import { eq, and, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../db";
import { trainingNeedsOtherV2 } from "../../../shared/v2/training-needs/schema";
import type { TrainingNeedOther, InsertTrainingNeedOther } from "../../../shared/v2/training-needs/schema";
import { screeningB7TrainingItems } from "../../../shared/v2/recruitment/schema";
import { apprTrainingFollowupsV2 } from "../../../shared/v2/appraisals/schema";
import { promoTrainingNeedsV2 } from "../../../shared/v2/promotions/schema";

export type AggregatedTrainingNeed = {
  source: "Recruitment" | "Appraisal" | "Promotion" | string;
  sourceRefUuid: string;
  name: string | null;
  rank: string | null;
  training: string | null;
  correspondingInDb: string | null;
  identifiedBy: string | null;
  category: string | null;
  status: string | null;
  targetDate: string | null;
  comments: string | null;
  editable: "limited" | "full";
};

export class TrainingNeedsRepository {
  // ---- Aggregation ----
  async aggregateAll(): Promise<AggregatedTrainingNeed[]> {
    const db = getDb();

    const recruitmentRows = await db.execute(sql`
      SELECT
        b7i.train_item_uuid AS source_ref_uuid,
        b7i.training,
        b7i.identified_by_uuid AS identified_by,
        b7i.category,
        b7i.due_date AS target_date,
        b7i.comments,
        TRIM(CONCAT_WS(' ', rc.first_name, rc.family_name)) AS name,
        rc.present_rank AS rank
      FROM screening_b7_training_items b7i
      JOIN screening_b7_training b7 ON b7i.b7_uuid = b7.b7_uuid AND b7.is_deleted = FALSE
      JOIN recruitment_candidates_v2 rc ON b7.rec_can_uuid = rc.rec_can_uuid AND rc.is_deleted = FALSE
      WHERE b7i.is_deleted = FALSE
    `);

    const appraisalRows = await db.execute(sql`
      SELECT
        tf.training_followup_uuid AS source_ref_uuid,
        tf.training,
        tf.corresponding_in_db,
        tf.category,
        tf.status,
        tf.target_date,
        tf.comment AS comments,
        ar.seafarers_name AS name,
        ar.seafarers_rank AS rank
      FROM appr_training_followups_v2 tf
      JOIN appraisal_results_v2 ar ON tf.appraisal_uuid = ar.appraisal_uuid AND ar.is_deleted = FALSE
      WHERE tf.is_deleted = FALSE
    `);

    const promotionRows = await db.execute(sql`
      SELECT
        tn.tn_uuid AS source_ref_uuid,
        tn.training,
        tn.corresponding_in_db,
        tn.category,
        tn.status,
        tn.completion_date AS target_date,
        TRIM(CONCAT_WS(' ', cm.first_name, cm.family_name)) AS name,
        cm.present_rank AS rank
      FROM promo_training_needs_v2 tn
      JOIN promotion_reviews_v2 pr ON tn.review_uuid = pr.review_uuid AND pr.is_deleted = FALSE
      LEFT JOIN crew_members_v2 cm ON pr.crew_member_id = cm.emp_no AND cm.is_deleted = FALSE
      WHERE tn.is_deleted = FALSE
    `);

    const otherRows = await db
      .select()
      .from(trainingNeedsOtherV2)
      .where(eq(trainingNeedsOtherV2.isDeleted, false));

    const result: AggregatedTrainingNeed[] = [];

    for (const r of (recruitmentRows as any).rows ?? recruitmentRows ?? []) {
      result.push({
        source: "Recruitment",
        sourceRefUuid: r.source_ref_uuid,
        name: r.name || null,
        rank: r.rank || null,
        training: r.training || null,
        correspondingInDb: null,
        identifiedBy: r.identified_by || null,
        category: r.category || null,
        status: null,
        targetDate: r.target_date || null,
        comments: r.comments || null,
        editable: "limited",
      });
    }

    for (const r of (appraisalRows as any).rows ?? appraisalRows ?? []) {
      result.push({
        source: "Appraisal",
        sourceRefUuid: r.source_ref_uuid,
        name: r.name || null,
        rank: r.rank || null,
        training: r.training || null,
        correspondingInDb: r.corresponding_in_db || null,
        identifiedBy: null,
        category: r.category || null,
        status: r.status || null,
        targetDate: r.target_date || null,
        comments: r.comments || null,
        editable: "limited",
      });
    }

    for (const r of (promotionRows as any).rows ?? promotionRows ?? []) {
      result.push({
        source: "Promotion",
        sourceRefUuid: r.source_ref_uuid,
        name: r.name || null,
        rank: r.rank || null,
        training: r.training || null,
        correspondingInDb: r.corresponding_in_db || null,
        identifiedBy: null,
        category: r.category || null,
        status: r.status || null,
        targetDate: r.target_date || null,
        comments: null,
        editable: "limited",
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
        identifiedBy: r.identifiedBy,
        category: r.category,
        status: r.status,
        targetDate: r.targetDate,
        comments: r.comments,
        editable: "full",
      });
    }

    return result;
  }

  // ---- Source PATCHes (limited fields) ----
  async patchRecruitment(trainItemUuid: string, data: { targetDate?: string | null; comments?: string | null }): Promise<boolean> {
    const db = getDb();
    const sets: any = { updatedAt: new Date() };
    if (data.targetDate !== undefined) sets.dueDate = data.targetDate;
    if (data.comments !== undefined) sets.comments = data.comments;
    const r = await db
      .update(screeningB7TrainingItems)
      .set(sets)
      .where(and(eq(screeningB7TrainingItems.trainItemUuid, trainItemUuid), eq(screeningB7TrainingItems.isDeleted, false)))
      .returning();
    return r.length > 0;
  }

  async patchAppraisal(trainingFollowupUuid: string, data: { status?: string | null; targetDate?: string | null; comments?: string | null }): Promise<boolean> {
    const db = getDb();
    const sets: any = { updatedAt: new Date() };
    if (data.status !== undefined) sets.status = data.status;
    if (data.targetDate !== undefined) sets.targetDate = data.targetDate;
    if (data.comments !== undefined) sets.comment = data.comments;
    const r = await db
      .update(apprTrainingFollowupsV2)
      .set(sets)
      .where(and(eq(apprTrainingFollowupsV2.trainingFollowupUuid, trainingFollowupUuid), eq(apprTrainingFollowupsV2.isDeleted, false)))
      .returning();
    return r.length > 0;
  }

  async patchPromotion(tnUuid: string, data: { status?: string | null; targetDate?: string | null }): Promise<boolean> {
    const db = getDb();
    const sets: any = { updatedAt: new Date() };
    if (data.status !== undefined) sets.status = data.status;
    if (data.targetDate !== undefined) sets.completionDate = data.targetDate;
    const r = await db
      .update(promoTrainingNeedsV2)
      .set(sets)
      .where(and(eq(promoTrainingNeedsV2.tnUuid, tnUuid), eq(promoTrainingNeedsV2.isDeleted, false)))
      .returning();
    return r.length > 0;
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
