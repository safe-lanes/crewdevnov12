import {
  PromotionReviewsRepository,
  CriteriaStatusRepository,
  CesTestsRepository,
  CriteriaCommentsRepository,
  TrainingCommentsRepository,
  TrainingNeedsRepository,
  ApprovalsRepository,
  ChecklistProgressRepository,
  CriteriaMasterRepository,
  SuitabilityRepository,
  ExecutionLedgerRepository,
} from "../repositories";
import { PromotionHierarchiesRepository } from "../../admin/repositories/promotionHierarchiesRepository";
import { formsService } from "../../admin/services";
import { applyAuditUser } from "../../admin/utils/auditUser";
import type { PromotionReviewV2, PromoSuitabilityV2 } from "../../../../shared/v2/promotions/types";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { promoExecutionLedgerV2, promotionReviewsV2 } from "../../../../shared/v2/promotions/schema";
import { eq, and, isNull, or, sql, inArray } from "drizzle-orm";
import { z } from "zod";

export const promotionReviewWritableSchema = z.object({
  crewMemberId: z.string().optional(),
  promotionToRank: z.string().optional(),
  selectedVesselTypeForA2_3b: z.string().nullable().optional(),
  selectedVesselTypeForA23b: z.string().nullable().optional(),
  criteriaVerifiedStatus: z.string().optional(),
  criteriaMeetsStatus: z.string().optional(),
  cesTestsData: z.string().optional(),
  criteriaComments: z.string().optional(),
  trainingNeeds: z.string().optional(),
  approvalData: z.string().optional(),
  selectedApproversForSubmission: z.string().optional(),
  checklistProgressData: z.string().optional(),
  promotionConfirmed: z.string().nullable().optional(),
  vesselAssigned: z.string().nullable().optional(),
  promotionDate: z.string().nullable().optional(),
  promotionTiming: z.string().nullable().optional(),
  partANotes: z.string().nullable().optional(),
  partBNotes: z.string().nullable().optional(),
  partCNotes: z.string().nullable().optional(),
  status: z.string().optional(),
  isLockForm: z.boolean().optional(),
  b2VesselTypes: z.array(z.string()).optional(),
  b2FleetGroups: z.array(z.string()).optional(),
}).passthrough();

export type PromotionReviewWritableInput = z.infer<typeof promotionReviewWritableSchema>;

const reviewsRepo = new PromotionReviewsRepository();
const criteriaStatusRepo = new CriteriaStatusRepository();
const cesTestsRepo = new CesTestsRepository();
const criteriaCommentsRepo = new CriteriaCommentsRepository();
const trainingCommentsRepo = new TrainingCommentsRepository();
const trainingNeedsRepo = new TrainingNeedsRepository();
const approvalsRepo = new ApprovalsRepository();
const checklistProgressRepo = new ChecklistProgressRepository();
const criteriaMasterRepo = new CriteriaMasterRepository();
const suitabilityRepo = new SuitabilityRepository();
const executionLedgerRepo = new ExecutionLedgerRepository();
const hierarchiesRepo = new PromotionHierarchiesRepository();

// Raised by the promotion workflow guards (future date, next-rank-only, one
// pending promotion per crew). The controller maps these to HTTP 400 so the
// user sees a clear validation message instead of a generic 500.
export class PromotionGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromotionGuardError";
  }
}

// Ordered workflow stages. Higher number = further along the workflow.
// draft / in progress are both editable starting points (rank 0).
const STATUS_RANK: Record<string, number> = {
  "draft": 0,
  "in progress": 0,
  "in_progress": 0,
  "submitted": 1,
  "for approval": 1,
  "approved": 2,
  "completed": 3,
};

function statusRank(status?: string | null): number {
  return STATUS_RANK[(status ?? "").trim().toLowerCase()] ?? 0;
}

function findNextPromotionRank(currentRank: string, hierarchies: any[]): string | null {
  for (const hierarchy of hierarchies) {
    let rankPath: string[];
    try {
      rankPath = typeof hierarchy.rankPath === 'string'
        ? JSON.parse(hierarchy.rankPath)
        : (Array.isArray(hierarchy.rankPath) ? hierarchy.rankPath : []);
    } catch (e) {
      rankPath = [];
    }
    if (!rankPath.includes(currentRank)) continue;
    // rankPath is stored junior→senior (index 0 = most junior, last index = most senior)
    const currentIndex = rankPath.indexOf(currentRank);
    if (currentIndex < rankPath.length - 1) return rankPath[currentIndex + 1];
    return null;
  }
  return null;
}

// True when the given rank appears anywhere in the promotion hierarchies. Used
// to tell apart "this rank is the most senior (no next rank)" from "this rank
// is not mapped in any hierarchy at all".
function isRankInHierarchies(rank: string, hierarchies: any[]): boolean {
  for (const hierarchy of hierarchies) {
    let rankPath: string[];
    try {
      rankPath = typeof hierarchy.rankPath === 'string'
        ? JSON.parse(hierarchy.rankPath)
        : (Array.isArray(hierarchy.rankPath) ? hierarchy.rankPath : []);
    } catch (e) {
      rankPath = [];
    }
    if (rankPath.includes(rank)) return true;
  }
  return false;
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    if (!result[k]) result[k] = [];
    result[k].push(item);
  }
  return result;
}

function assembleV1Response(
  review: PromotionReviewV2,
  criteriaStatuses: any[],
  cesTests: any[],
  criteriaComments: any[],
  trainingComments: any[],
  trainingNeeds: any[],
  approvals: any[],
  checklistProgress: any[],
  suitability: PromoSuitabilityV2 | null = null,
) {
  const criteriaVerifiedStatus: Record<string, string> = {};
  const criteriaMeetsStatus: Record<string, string> = {};
  for (const cs of criteriaStatuses) {
    if (cs.verifiedStatus !== null && cs.verifiedStatus !== undefined) criteriaVerifiedStatus[cs.criteriaCode] = cs.verifiedStatus;
    if (cs.meetsStatus !== null && cs.meetsStatus !== undefined) criteriaMeetsStatus[cs.criteriaCode] = cs.meetsStatus;
  }

  const cesTestsData = cesTests.map(t => ({
    id: t.testId || t.ctUuid || '',
    testId: t.testId || '',
    description: t.description || '',
    date: t.date || '',
    minScore: t.minScore || '',
    score: t.score || '',
    result: t.result || '',
  }));

  const criteriaCommentsObj: Record<string, any> = {};
  for (const cc of criteriaComments) {
    if (!criteriaCommentsObj[cc.criteriaCode]) criteriaCommentsObj[cc.criteriaCode] = [];
    criteriaCommentsObj[cc.criteriaCode].push({
      id: cc.commentId || cc.ccUuid,
      user: cc.commentUser || '',
      text: cc.commentText || '',
    });
  }
  const a3Comments: Record<string, any[]> = {};
  for (const tc of trainingComments) {
    const key = tc.trainingRowId;
    if (!a3Comments[key]) a3Comments[key] = [];
    a3Comments[key].push({
      id: tc.commentId || tc.tcUuid,
      user: tc.commentUser || '',
      text: tc.commentText || '',
    });
  }
  if (Object.keys(a3Comments).length > 0) {
    criteriaCommentsObj['a3'] = a3Comments;
  }

  const trainingNeedsData = trainingNeeds.map(tn => ({
    id: tn.trainingRowId || tn.tnUuid,
    training: tn.training || '',
    correspondingInDB: tn.correspondingInDb || '',
    category: tn.category || '',
    status: tn.status || '',
    completionDate: tn.completionDate || '',
  }));

  const approvalData = approvals.filter(a => !a.isSelectedForSubmission).map(a => ({
    id: a.approverId || a.apUuid,
    date: a.date || '',
    approver: a.approver || '',
    status: a.status || '',
    approval: a.approval || '',
    comments: a.comments || '',
    isFromPartA: a.isFromPartA || false,
  }));
  const selectedApproversForSubmission = approvals
    .filter(a => a.isSelectedForSubmission)
    .map(a => ({
      userUuid: a.approverId || '',
      displayName: a.approver || '',
    }));

  const sectionsMap = new Map<string, { id: string; title: string; assessmentPoints: any[] }>();
  for (const cp of checklistProgress) {
    if (!sectionsMap.has(cp.sectionId)) {
      sectionsMap.set(cp.sectionId, {
        id: cp.sectionId,
        title: (cp as any).sectionTitle || '',
        assessmentPoints: [],
      });
    }
    const section = sectionsMap.get(cp.sectionId)!;
    let verifications: any[] = [];
    let comments: any[] = [];
    let attachments: any[] = [];
    try { verifications = (cp as any).verificationsData ? JSON.parse((cp as any).verificationsData) : []; } catch {}
    try { comments = (cp as any).commentsData ? JSON.parse((cp as any).commentsData) : []; } catch {}
    try { attachments = (cp as any).attachmentsData ? JSON.parse((cp as any).attachmentsData) : []; } catch {}
    section.assessmentPoints.push({
      id: cp.assessmentPointId,
      text: (cp as any).assessmentPointText || '',
      completed: (cp as any).completed ?? false,
      verifications,
      comments,
      attachments,
    });
  }
  const reconstructedSections = Array.from(sectionsMap.values());

  let completedVerifications = 0;
  let totalPoints = 0;
  for (const section of reconstructedSections) {
    for (const point of section.assessmentPoints) {
      totalPoints++;
      completedVerifications += Math.min(point.verifications?.length ?? 0, 1);
    }
  }
  const totalRequired = totalPoints;
  const percentage = totalRequired > 0 ? Math.round((completedVerifications / totalRequired) * 100) : 0;

  const checklistProgressDataObj = {
    sections: reconstructedSections,
    progress: {
      percentage,
      meetsThreshold: percentage >= 100,
      completedVerifications,
      totalRequired,
      thresholdPercent: 100,
      requiredPerPoint: 1,
    }
  };

  return {
    id: review.id,
    reviewUuid: review.reviewUuid,
    crewMemberId: review.crewMemberId,
    promotionToRank: review.promotionToRank,
    selectedVesselTypeForA2_3b: review.selectedVesselTypeForA23b || null,
    criteriaVerifiedStatus: JSON.stringify(criteriaVerifiedStatus),
    criteriaMeetsStatus: JSON.stringify(criteriaMeetsStatus),
    cesTestsData: JSON.stringify(cesTestsData),
    criteriaComments: JSON.stringify(criteriaCommentsObj),
    trainingNeeds: JSON.stringify(trainingNeedsData),
    approvalData: JSON.stringify(approvalData),
    selectedApproversForSubmission: JSON.stringify(selectedApproversForSubmission),
    promotionConfirmed: review.promotionConfirmed || null,
    vesselAssigned: review.vesselAssigned || null,
    promotionDate: review.promotionDate || null,
    promotionTiming: review.promotionTiming || null,
    partANotes: review.partANotes || null,
    partBNotes: review.partBNotes || null,
    partCNotes: review.partCNotes || null,
    checklistProgressData: JSON.stringify(checklistProgressDataObj),
    b2VesselTypes: Array.isArray(suitability?.vesselTypes) ? suitability!.vesselTypes : [],
    b2FleetGroups: Array.isArray(suitability?.fleetGroups) ? suitability!.fleetGroups : [],
    status: review.status,
    isLockForm: (review as any).isLockForm ?? false,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

export class PromotionReviewsService {
  async getCriteriaMaster() {
    return criteriaMasterRepo.findAll();
  }

  /**
   * For a set of crew (by crewUuid), return which of them have an APPROVED
   * prior-joining promotion that has not yet been executed — i.e. the promotee
   * has not signed on, so the rank flip has not happened. These are the
   * "planned" promotions surfaced as Target Rank "(PR)" in Rotation Planning
   * and Vessel Planning. Read-only and idempotent.
   *
   * Detection mirrors vesselPlanningService.signOnReliever (status "approved" +
   * timing "prior-joining"); a completed promotion has status "completed" and is
   * therefore naturally excluded. Keyed by crewUuid — crew without a pending
   * prior-joining promotion are absent from the map.
   */
  async getPendingPriorJoiningByCrewUuids(
    crewUuids: Array<string | null | undefined>,
  ): Promise<Map<string, { promotionToRank: string }>> {
    const result = new Map<string, { promotionToRank: string }>();
    const unique = Array.from(new Set(crewUuids.filter((u): u is string => !!u)));
    if (unique.length === 0) return result;

    const db = getDb();

    // Promotion reviews are keyed by employee number, so map crewUuid -> empNo.
    const crews = await db
      .select({ crewUuid: crewMembersV2.crewUuid, empNo: crewMembersV2.empNo })
      .from(crewMembersV2)
      .where(inArray(crewMembersV2.crewUuid, unique));

    const empToCrew = new Map<string, string>();
    for (const c of crews) {
      const empNo = (c.empNo ?? "").trim();
      if (empNo) empToCrew.set(empNo, c.crewUuid);
    }
    if (empToCrew.size === 0) return result;

    const reviews = await db
      .select()
      .from(promotionReviewsV2)
      .where(
        and(
          inArray(promotionReviewsV2.crewMemberId, Array.from(empToCrew.keys())),
          or(eq(promotionReviewsV2.isDeleted, false), isNull(promotionReviewsV2.isDeleted)),
        ),
      );

    for (const r of reviews) {
      const status = (r.status ?? "").trim().toLowerCase();
      const timing = (r.promotionTiming ?? "").trim().toLowerCase();
      if (status !== "approved" || timing !== "prior-joining") continue;
      const crewUuid = empToCrew.get((r.crewMemberId ?? "").trim());
      const toRank = (r.promotionToRank ?? "").trim();
      if (crewUuid && toRank) result.set(crewUuid, { promotionToRank: toRank });
    }

    return result;
  }

  async ensurePromotionReviewsForEligibleCrew(): Promise<{ created: number; existing: number }> {
    let created = 0;
    let existing = 0;

    try {
      const db = getDb();
      const [v2CrewMembers, hierarchies, existingReviews] = await Promise.all([
        db.select({
          empNo: crewMembersV2.empNo,
          presentRank: crewMembersV2.presentRank,
        })
        .from(crewMembersV2)
        .where(
          and(
            or(eq(crewMembersV2.isDeleted, false), isNull(crewMembersV2.isDeleted))
          )
        ),
        hierarchiesRepo.findAll(),
        reviewsRepo.findAll(),
      ]);

      const existingKeys = new Set(
        existingReviews.map(r => `${r.crewMemberId}__${r.promotionToRank}`)
      );

      const ranksInHierarchies = new Set<string>();
      for (const h of hierarchies) {
        const rankPath: string[] = typeof h.rankPath === 'string'
          ? JSON.parse(h.rankPath)
          : h.rankPath || [];
        rankPath.forEach(r => ranksInHierarchies.add(r));
      }

      const reviewsToCreate: { crewMemberId: string; promotionToRank: string }[] = [];

      for (const crew of v2CrewMembers) {
        const currentRank = crew.presentRank || '';
        if (!currentRank || !ranksInHierarchies.has(currentRank)) continue;
        const nextRank = findNextPromotionRank(currentRank, hierarchies);
        if (!nextRank) continue;
        const key = `${crew.empNo}__${nextRank}`;
        if (existingKeys.has(key)) {
          existing++;
          continue;
        }
        reviewsToCreate.push({ crewMemberId: crew.empNo, promotionToRank: nextRank });
      }

      for (const reviewData of reviewsToCreate) {
        try {
          await reviewsRepo.create({
            crewMemberId: reviewData.crewMemberId,
            promotionToRank: reviewData.promotionToRank,
            status: 'In Progress',
          });
          created++;
        } catch (error: any) {
          if (error?.code === '23505') {
            existing++;
          } else {
            console.error(`Failed to create V2 promotion review for ${reviewData.crewMemberId}:`, error);
          }
        }
      }

      if (created > 0) {
        console.log(`[Promotions V2 Sync] Created ${created} new reviews, ${existing} already existed`);
      }
    } catch (error) {
      console.error('[Promotions V2 Sync] Error:', error);
    }

    return { created, existing };
  }

  async getAllReviews() {
    await this.ensurePromotionReviewsForEligibleCrew();

    const reviews = await reviewsRepo.findAll();
    if (reviews.length === 0) return [];

    const reviewUuids = reviews.map(r => r.reviewUuid);

    const [
      allCriteriaStatuses,
      allCesTests,
      allCriteriaComments,
      allTrainingComments,
      allTrainingNeeds,
      allApprovals,
      allChecklistProgress,
      allSuitability,
    ] = await Promise.all([
      criteriaStatusRepo.findByReviewUuids(reviewUuids),
      cesTestsRepo.findByReviewUuids(reviewUuids),
      criteriaCommentsRepo.findByReviewUuids(reviewUuids),
      trainingCommentsRepo.findByReviewUuids(reviewUuids),
      trainingNeedsRepo.findByReviewUuids(reviewUuids),
      approvalsRepo.findByReviewUuids(reviewUuids),
      checklistProgressRepo.findByReviewUuids(reviewUuids),
      suitabilityRepo.findByReviewUuids(reviewUuids),
    ]);

    const csMap = groupBy(allCriteriaStatuses, i => i.reviewUuid);
    const ctMap = groupBy(allCesTests, i => i.reviewUuid);
    const ccMap = groupBy(allCriteriaComments, i => i.reviewUuid);
    const tcMap = groupBy(allTrainingComments, i => i.reviewUuid);
    const tnMap = groupBy(allTrainingNeeds, i => i.reviewUuid);
    const apMap = groupBy(allApprovals, i => i.reviewUuid);
    const cpMap = groupBy(allChecklistProgress, i => i.reviewUuid);
    const suitByReview = new Map(allSuitability.map(s => [s.reviewUuid, s]));

    return reviews.map(review => assembleV1Response(
      review,
      csMap[review.reviewUuid] || [],
      ctMap[review.reviewUuid] || [],
      ccMap[review.reviewUuid] || [],
      tcMap[review.reviewUuid] || [],
      tnMap[review.reviewUuid] || [],
      apMap[review.reviewUuid] || [],
      cpMap[review.reviewUuid] || [],
      suitByReview.get(review.reviewUuid) ?? null,
    ));
  }

  async getReviewByUuid(reviewUuid: string) {
    const review = await reviewsRepo.findByUuid(reviewUuid);
    if (!review) return null;

    const [cs, ct, cc, tc, tn, ap, cp, suit] = await Promise.all([
      criteriaStatusRepo.findByReviewUuid(reviewUuid),
      cesTestsRepo.findByReviewUuid(reviewUuid),
      criteriaCommentsRepo.findByReviewUuid(reviewUuid),
      trainingCommentsRepo.findByReviewUuid(reviewUuid),
      trainingNeedsRepo.findByReviewUuid(reviewUuid),
      approvalsRepo.findByReviewUuid(reviewUuid),
      checklistProgressRepo.findByReviewUuid(reviewUuid),
      suitabilityRepo.findByReviewUuid(reviewUuid),
    ]);

    return assembleV1Response(review, cs, ct, cc, tc, tn, ap, cp, suit);
  }

  async getReviewById(id: number) {
    const review = await reviewsRepo.findById(id);
    if (!review) return null;
    return this.getReviewByUuid(review.reviewUuid);
  }

  async getReviewsByCrewMember(crewMemberId: string) {
    const reviews = await reviewsRepo.findByCrewMemberId(crewMemberId);
    if (reviews.length === 0) return [];

    const reviewUuids = reviews.map(r => r.reviewUuid);
    const [cs, ct, cc, tc, tn, ap, cp, suit] = await Promise.all([
      criteriaStatusRepo.findByReviewUuids(reviewUuids),
      cesTestsRepo.findByReviewUuids(reviewUuids),
      criteriaCommentsRepo.findByReviewUuids(reviewUuids),
      trainingCommentsRepo.findByReviewUuids(reviewUuids),
      trainingNeedsRepo.findByReviewUuids(reviewUuids),
      approvalsRepo.findByReviewUuids(reviewUuids),
      checklistProgressRepo.findByReviewUuids(reviewUuids),
      suitabilityRepo.findByReviewUuids(reviewUuids),
    ]);

    const csMap = groupBy(cs, i => i.reviewUuid);
    const ctMap = groupBy(ct, i => i.reviewUuid);
    const ccMap = groupBy(cc, i => i.reviewUuid);
    const tcMap = groupBy(tc, i => i.reviewUuid);
    const tnMap = groupBy(tn, i => i.reviewUuid);
    const apMap = groupBy(ap, i => i.reviewUuid);
    const cpMap = groupBy(cp, i => i.reviewUuid);
    const suitByReview = new Map(suit.map(s => [s.reviewUuid, s]));

    return reviews.map(review => assembleV1Response(
      review,
      csMap[review.reviewUuid] || [],
      ctMap[review.reviewUuid] || [],
      ccMap[review.reviewUuid] || [],
      tcMap[review.reviewUuid] || [],
      tnMap[review.reviewUuid] || [],
      apMap[review.reviewUuid] || [],
      cpMap[review.reviewUuid] || [],
      suitByReview.get(review.reviewUuid) ?? null,
    ));
  }

  async getReviewByCrewAndRank(crewMemberId: string, promotionToRank: string) {
    const review = await reviewsRepo.findByCrewAndRank(crewMemberId, promotionToRank);
    if (!review) return null;
    return this.getReviewByUuid(review.reviewUuid);
  }

  // Task #569: resolve the admin "Lock Form" flag for the Promotion Review form.
  // Match the frontend which looks up by name ("Promotion Review Form"); fall back
  // to the promotion category so behaviour is stable if the form is renamed.
  private async resolvePromotionLockFlag(): Promise<boolean> {
    try {
      const allForms = await formsService.getAll();
      const promotionForm =
        allForms.find((f: any) => f.name === "Promotion Review Form") ??
        allForms.find((f: any) => f.category === "promotion");
      return !!(promotionForm as any)?.isLockForm;
    } catch (e) {
      console.warn("[Promotions V2] Failed to resolve promotion lock flag:", e);
      return false;
    }
  }

  // Enforce the promotion workflow rules before a write is persisted:
  //  1. A Date of Promotion may not be in the future.
  //  2. Only the next rank in the crew member's hierarchy may be promoted
  //     (checked when the workflow moves forward into submitted/approved/completed).
  //  3. A crew member may have at most one "pending" promotion — a review that
  //     has been approved but not yet completed.
  private async assertPromotionGuards(params: {
    crewMemberId?: string | null;
    promotionToRank?: string | null;
    promotionDate?: string | null;
    incomingStatus?: string | null;
    existingStatus?: string | null;
    reviewUuid?: string | null;
  }) {
    const { crewMemberId, promotionToRank, promotionDate, incomingStatus, existingStatus, reviewUuid } = params;

    // 1. No future-dated promotion.
    if (promotionDate && String(promotionDate).trim()) {
      const d = new Date(String(promotionDate));
      if (!isNaN(d.getTime())) {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        if (d.getTime() > endOfToday.getTime()) {
          throw new PromotionGuardError("The Date of Promotion cannot be in the future.");
        }
      }
    }

    const incomingRank = statusRank(incomingStatus);
    const existingRank = statusRank(existingStatus);
    const isForwardTransition = !!incomingStatus && incomingRank > existingRank;

    // 2. Next-rank-only — validated when the review actually advances into
    //    submitted/approved/completed (not on idempotent re-saves or drafts).
    if (isForwardTransition && incomingRank >= statusRank("submitted") && crewMemberId && promotionToRank) {
      const db = getDb();
      const [crew] = await db
        .select({ presentRank: crewMembersV2.presentRank })
        .from(crewMembersV2)
        .where(eq(crewMembersV2.empNo, crewMemberId));
      const presentRank = crew?.presentRank?.trim();
      if (presentRank) {
        const hierarchies = await hierarchiesRepo.findAll();
        const expectedNext = findNextPromotionRank(presentRank, hierarchies);
        if (!expectedNext) {
          // No next rank resolvable — either the crew is already at the most
          // senior rank, or the current rank is not mapped in any hierarchy.
          // Either way the next-rank-only rule cannot be satisfied, so reject.
          if (isRankInHierarchies(presentRank, hierarchies)) {
            throw new PromotionGuardError(
              `"${presentRank}" is already the most senior rank in the hierarchy and cannot be promoted further.`
            );
          }
          throw new PromotionGuardError(
            `The next rank for "${presentRank}" could not be determined. Check the promotion hierarchy configuration before promoting.`
          );
        }
        if (promotionToRank.trim() !== expectedNext.trim()) {
          throw new PromotionGuardError(
            `Only the next rank in the hierarchy can be promoted. Expected "${expectedNext}" for the current rank "${presentRank}".`
          );
        }
      }
    }

    // 3. One pending promotion per crew — checked only when this review is
    //    newly entering the approved (pending) stage.
    if (incomingStatus && incomingRank === statusRank("approved") && existingRank < statusRank("approved") && crewMemberId) {
      const existingReviews = await reviewsRepo.findByCrewMemberId(crewMemberId);
      const otherPending = existingReviews.find(
        (r) => r.reviewUuid !== reviewUuid && statusRank(r.status) === statusRank("approved")
      );
      if (otherPending) {
        throw new PromotionGuardError(
          "This crew member already has a pending promotion awaiting completion. Complete or clear it before approving another."
        );
      }
    }
  }

  // ── Rank Propagation Engine (Phase 2) ────────────────────────────────────
  // A promotion is "executed" exactly once. The execution ledger
  // (promo_execution_ledger_v2, keyed by review_uuid) is the durable guard:
  // if a ledger row already exists for the review the engine is a no-op, so
  // re-saving / replaying a completed review never re-applies the rank change.

  // Flip the crew member's present_rank to the promoted rank and record the
  // ledger row. Idempotent: a no-op when the promotion was already executed.
  // Errors propagate to the caller — the rank flip is the core deliverable and
  // a failure must surface rather than silently leave the rank unchanged.
  async applyPromotedRank(
    review: PromotionReviewV2,
    opts: { effectiveDate?: string | null; actorUuid?: string | null } = {},
  ): Promise<void> {
    const reviewUuid = review.reviewUuid;
    const empNo = (review.crewMemberId ?? "").trim();
    const toRank = (review.promotionToRank ?? "").trim();

    if (!empNo || !toRank) {
      console.warn(
        `[promotion-engine] Skipping rank propagation for review ${reviewUuid}: ` +
        `missing ${!empNo ? "crew member" : "promotion rank"}.`,
      );
      return;
    }

    // Idempotency guard #1 — fast no-op path when already executed.
    const existingLedger = await executionLedgerRepo.findByReviewUuid(reviewUuid);
    if (existingLedger) return;

    const { crewMembersService } = await import("../../crew-pool/services/crewMembersService");
    const crew = await crewMembersService.getByEmpNo(empNo);
    if (!crew) {
      console.warn(
        `[promotion-engine] Skipping rank propagation for review ${reviewUuid}: ` +
        `no crew member found for employee number "${empNo}".`,
      );
      return;
    }

    const fromRank = (crew.presentRank ?? "").trim() || null;
    const effectiveDate = (opts.effectiveDate ?? review.promotionDate ?? null) || null;
    const actorUuid = opts.actorUuid ?? (review as any).updatedByUuid ?? null;
    const { v4: uuidv4 } = await import("uuid");

    // Exactly-once: the ledger insert and the rank flip commit together in one
    // transaction. ON CONFLICT DO NOTHING on the unique review_uuid means a
    // concurrent (or replayed) execution inserts nothing and returns no row, so
    // we skip the rank flip. A crash mid-transaction rolls back BOTH, so a retry
    // re-applies cleanly — the ledger never persists without the rank update.
    const db = getDb();
    let applied = false;
    await db.transaction(async (tx: typeof db) => {
      const inserted = await tx
        .insert(promoExecutionLedgerV2)
        .values({
          ledgerUuid: uuidv4(),
          reviewUuid,
          crewMemberId: empNo,
          crewUuid: crew.crewUuid,
          fromRank,
          toRank,
          effectiveDate,
          promotionTiming: review.promotionTiming ?? null,
          appliedByUuid: actorUuid,
        })
        .onConflictDoNothing({ target: promoExecutionLedgerV2.reviewUuid })
        .returning({ id: promoExecutionLedgerV2.id });

      // Another execution already owns this promotion — leave the rank to it.
      if (inserted.length === 0) return;
      applied = true;

      // Flip the rank only when it actually differs (the present_rank column is
      // the single source of truth read by Crew Pool, Reports, Promotions, etc.).
      if (fromRank !== toRank) {
        await tx
          .update(crewMembersV2)
          .set({
            presentRank: toRank,
            updatedAt: sql`NOW()`,
            updatedByUuid: actorUuid,
          })
          .where(eq(crewMembersV2.crewUuid, crew.crewUuid));
      }
    });

    // Phase 3 — split Company sea service so experience is attributed to the old
    // and new rank (closes the previous-rank line at split-date−1, opens a new
    // new-rank line on the split date). `splitDate` is the per-timing effective
    // date resolved by runCompletionHook (Part C date on-board / sign-on date
    // prior-joining). Runs only on first application (ledger-gated) and is itself
    // idempotent, so a re-run is a safe no-op.
    //
    // Deliberately non-fatal: the ledger row + rank flip already committed and
    // are the atomic core deliverable; they must NOT be rolled back by a
    // sea-service hiccup (this mirrors the established best-effort policy for
    // promotion side-effects). Recovery is deterministic rather than silent — a
    // ledger row that has no matching new-rank Company line is exactly what the
    // Phase 5 backfill detects and repairs, reusing this same `splitForPromotion`
    // path. We log every non-success at error/warn level so the gap is visible
    // until then.
    if (applied) {
      try {
        const { crewSeaServiceService } = await import(
          "../../crew-pool/services/crewSeaServiceService"
        );
        const split = await crewSeaServiceService.splitForPromotion({
          crewUuid: crew.crewUuid,
          newRank: toRank,
          oldRank: fromRank,
          splitDate: effectiveDate ?? "",
          auditUserUuid: actorUuid,
        });
        // A missing/invalid Date of Promotion leaves the rank flipped but the
        // history un-split — flag it loudly for the deterministic backfill.
        if (split.status === "skipped-invalid-input") {
          console.warn(
            `[promotion-engine] Sea-service split SKIPPED for review ${reviewUuid} ` +
            `(crew ${crew.crewUuid}): missing/invalid split date "${effectiveDate ?? ""}". ` +
            `Rank was flipped; Phase 5 backfill will repair once a valid Date of Promotion is set.`,
          );
        }
      } catch (err) {
        console.error(
          `[promotion-engine] Sea-service split FAILED for review ${reviewUuid} ` +
          `(crew ${crew.crewUuid}, non-fatal): rank is flipped but history is un-split; ` +
          `Phase 5 backfill will reconcile this ledger row.`,
          err,
        );
      }
    }
  }

  // On-board promotion only: place the promotee into the target rank position
  // on their current vessel as a Secondary so the existing takeover flow can
  // complete the swap. Best-effort — a planning hiccup must not block the
  // promotion itself, mirroring the non-fatal sea-service sync pattern.
  private async placePromoteeAsSecondary(
    review: PromotionReviewV2,
    actorUuid?: string | null,
  ): Promise<void> {
    try {
      const empNo = (review.crewMemberId ?? "").trim();
      const toRank = (review.promotionToRank ?? "").trim();
      if (!empNo || !toRank) return;

      const { crewMembersService } = await import("../../crew-pool/services/crewMembersService");
      const crew = await crewMembersService.getByEmpNo(empNo);
      if (!crew) return;

      const { crewAssignmentsService } = await import("../../crew-pool/services/crewAssignmentsService");
      const current = await crewAssignmentsService.getCurrent(crew.crewUuid);
      const vesselUuid = current?.vesselUuid;
      if (!vesselUuid) {
        console.warn(
          `[promotion-engine] On-board promotion ${review.reviewUuid}: crew ${empNo} ` +
          `has no current vessel assignment; skipping Secondary placement.`,
        );
        return;
      }

      const { vesselPlanningRepository } = await import("../../vessel/repositories");

      // Reuse the rankId convention already on the vessel: find an existing
      // planning row for the target rank (by name) and copy its rankId. This
      // avoids guessing how rankId is encoded across the manning matrix.
      const slots = await vesselPlanningRepository.findByVesselAndRankName(vesselUuid, toRank);

      // Idempotency: already placed (as primary or secondary) on this vessel/rank.
      const alreadyPlaced = slots.find((s: any) => s.crewUuid === crew.crewUuid);
      if (alreadyPlaced) return;

      let rankId: string | null = null;
      if (slots.length > 0) {
        rankId = slots[0].rankId ?? null;
        // A Secondary already occupies the slot — don't create a duplicate.
        const existingSecondary = slots.find(
          (s: any) => (s.crewStatus ?? "").toLowerCase() === "secondary",
        );
        if (existingSecondary) {
          console.warn(
            `[promotion-engine] On-board promotion ${review.reviewUuid}: a Secondary ` +
            `already occupies "${toRank}" on the vessel; skipping placement.`,
          );
          return;
        }
      } else {
        // No slot for the target rank yet — resolve the rankId from masters.
        const db = getDb();
        const { admAvailableRanksV2 } = await import("../../../../shared/v2/admin/schema");
        const [rankRow] = await db
          .select({ rankId: admAvailableRanksV2.rankId })
          .from(admAvailableRanksV2)
          .where(and(
            eq(admAvailableRanksV2.name, toRank),
            eq(admAvailableRanksV2.isDeleted, false),
          ))
          .limit(1);
        rankId = rankRow?.rankId ?? null;
      }

      if (!rankId) {
        console.warn(
          `[promotion-engine] On-board promotion ${review.reviewUuid}: could not resolve ` +
          `a rank id for "${toRank}"; skipping Secondary placement.`,
        );
        return;
      }

      const { vesselPlanningService } = await import("../../vessel/services/vesselPlanningService");
      await vesselPlanningService.create({
        vesselUuid,
        crewUuid: crew.crewUuid,
        rankId,
        rank: toRank,
        crewStatus: "secondary",
        auditUserUuid: actorUuid ?? undefined,
      } as any);
    } catch (err) {
      console.error(
        `[promotion-engine] On-board Secondary placement failed for review ` +
        `${review.reviewUuid} (non-fatal):`,
        err,
      );
    }
  }

  // Fired after a review is persisted. When the review has reached "completed"
  // the rank propagation engine executes the promotion (idempotently). For
  // on-board promotions the promotee is additionally placed as a Secondary on
  // their current vessel to drive the takeover flow.
  private async runCompletionHook(review: PromotionReviewV2 | null, actorUuid?: string | null) {
    if (!review) return;
    if (statusRank(review.status) < statusRank("completed")) return;

    // Split/effective date by promotion timing (Phase 3 requirement):
    //   • on-board      → the Part C Date of Promotion.
    //   • prior-joining → the Sign-On date. A prior-joining promotion is only
    //     completed by `vesselPlanningService.signOnReliever`, which writes the
    //     sign-on date into `promotionDate` on the same `updateReview` call that
    //     sets status=completed.
    // Both timings therefore carry the correct split date in `review.promotionDate`
    // by the time we get here, so we pass it explicitly as the effective date.
    const effectiveDate = (review.promotionDate ?? null) || null;
    await this.applyPromotedRank(review, { actorUuid, effectiveDate });

    const timing = (review.promotionTiming ?? "").trim().toLowerCase();
    if (timing === "on-board") {
      await this.placePromoteeAsSecondary(review, actorUuid);
    }
  }

  async createReview(data: any) {
    const auditedData = applyAuditUser(data, true);
    const { criteriaVerifiedStatus, criteriaMeetsStatus, cesTestsData, criteriaComments,
      trainingNeeds, approvalData, selectedApproversForSubmission, checklistProgressData,
      selectedVesselTypeForA2_3b: _svt,
      b2VesselTypes, b2FleetGroups,
      ...coreFields } = auditedData;

    if (_svt !== undefined && coreFields.selectedVesselTypeForA23b === undefined) {
      coreFields.selectedVesselTypeForA23b = _svt;
    }

    await this.assertPromotionGuards({
      crewMemberId: coreFields.crewMemberId,
      promotionToRank: coreFields.promotionToRank,
      promotionDate: coreFields.promotionDate,
      incomingStatus: coreFields.status,
      existingStatus: null,
      reviewUuid: null,
    });

    // First submission can happen directly via POST (new review submitted for
    // approval). Snapshot the lock flag so later admin toggles don't change it.
    if (coreFields.status === "submitted") {
      coreFields.isLockForm = await this.resolvePromotionLockFlag();
    }

    const review = await reviewsRepo.create(coreFields);

    await this.saveChildData(review.reviewUuid, {
      criteriaVerifiedStatus, criteriaMeetsStatus, cesTestsData, criteriaComments,
      trainingNeeds, approvalData, selectedApproversForSubmission, checklistProgressData,
      b2VesselTypes, b2FleetGroups,
    });

    await this.runCompletionHook(review, coreFields.updatedByUuid ?? null);

    return this.getReviewByUuid(review.reviewUuid);
  }

  async updateReview(reviewUuid: string, data: any) {
    const auditedData = applyAuditUser(data);
    const { criteriaVerifiedStatus, criteriaMeetsStatus, cesTestsData, criteriaComments,
      trainingNeeds, approvalData, selectedApproversForSubmission, checklistProgressData,
      id: _id, reviewUuid: _ruuid, createdAt: _ca, updatedAt: _ua, isDeleted: _del,
      selectedVesselTypeForA2_3b: _svt2,
      b2VesselTypes, b2FleetGroups,
      ...coreFields } = auditedData;

    if (_svt2 !== undefined && coreFields.selectedVesselTypeForA23b === undefined) {
      coreFields.selectedVesselTypeForA23b = _svt2;
    }

    const existing = await reviewsRepo.findByUuid(reviewUuid);
    const existingStatusRaw = existing?.status ?? null;

    // Idempotency / no regression: never move a review backwards through the
    // workflow. Re-saving a review that is already at (or past) the requested
    // status simply drops the status change so the transition has no effect.
    if (coreFields.status !== undefined && statusRank(coreFields.status) < statusRank(existingStatusRaw)) {
      delete coreFields.status;
    }

    await this.assertPromotionGuards({
      crewMemberId: coreFields.crewMemberId ?? existing?.crewMemberId ?? null,
      promotionToRank: coreFields.promotionToRank ?? existing?.promotionToRank ?? null,
      promotionDate: coreFields.promotionDate,
      incomingStatus: coreFields.status,
      existingStatus: existingStatusRaw,
      reviewUuid,
    });

    // Task #569: snapshot the promotion form's admin lock-form flag onto this
    // review at the first submission (Submit for Approval → status "submitted")
    // so later admin lock/unlock toggles do not retroactively change the lock
    // state of already-submitted reviews. Mirror the appraisal stage-2 snapshot.
    if (coreFields.status === "submitted") {
      const existingStatus = (existingStatusRaw || "").trim().toLowerCase();
      const alreadyLocked = ["submitted", "approved", "completed"].includes(existingStatus);
      if (!alreadyLocked) {
        coreFields.isLockForm = await this.resolvePromotionLockFlag();
      }
    }

    const review = await reviewsRepo.update(reviewUuid, coreFields);
    if (!review) return null;

    await this.saveChildData(reviewUuid, {
      criteriaVerifiedStatus, criteriaMeetsStatus, cesTestsData, criteriaComments,
      trainingNeeds, approvalData, selectedApproversForSubmission, checklistProgressData,
      b2VesselTypes, b2FleetGroups,
    });

    await this.runCompletionHook(review, coreFields.updatedByUuid ?? null);

    return this.getReviewByUuid(reviewUuid);
  }

  async deleteReview(reviewUuid: string): Promise<boolean> {
    return reviewsRepo.softDelete(reviewUuid);
  }

  private async saveChildData(reviewUuid: string, data: any) {
    const tasks: Promise<any>[] = [];

    if (data.criteriaVerifiedStatus !== undefined || data.criteriaMeetsStatus !== undefined) {
      const verified = this.parseJson(data.criteriaVerifiedStatus, {});
      const meets = this.parseJson(data.criteriaMeetsStatus, {});
      const allCodes = new Set([...Object.keys(verified), ...Object.keys(meets)]);
      for (const code of allCodes) {
        tasks.push(criteriaStatusRepo.upsert(reviewUuid, code, {
          verifiedStatus: verified[code] ?? null,
          meetsStatus: meets[code] ?? null,
        }));
      }
    }

    if (data.cesTestsData !== undefined) {
      const tests = this.parseJson(data.cesTestsData, []);
      tasks.push(cesTestsRepo.replaceForReview(reviewUuid, tests.map((t: any) => ({
        testId: t.testId || t.test_id || t.id || null,
        description: t.description || null,
        date: t.date || null,
        minScore: t.minScore || t.min_score || null,
        score: t.score || null,
        result: t.result || null,
      }))));
    }

    if (data.criteriaComments !== undefined) {
      const commentsObj = this.parseJson(data.criteriaComments, {});
      const criteriaCommentRows: any[] = [];
      const trainingCommentRows: any[] = [];

      const flatComments: Record<string, any[]> = {};
      for (const [key, value] of Object.entries(commentsObj)) {
        if (key === 'a3' && value && typeof value === 'object' && !Array.isArray(value)) {
          for (const [subKey, subValue] of Object.entries(value as Record<string, any>)) {
            if (Array.isArray(subValue)) {
              const normalizedKey = subKey.startsWith('a3_') ? subKey : `a3_${subKey}`;
              flatComments[normalizedKey] = subValue;
            }
          }
        } else if (Array.isArray(value)) {
          flatComments[key] = value;
        }
      }

      for (const [key, comments] of Object.entries(flatComments)) {
        if (key.startsWith('a3_')) {
          const trainingRowId = key.replace('a3_', '');
          for (const c of comments) {
            trainingCommentRows.push({
              trainingRowId,
              commentId: c.id || null,
              commentUser: c.user || null,
              commentText: c.text || null,
            });
          }
        } else {
          for (const c of comments) {
            criteriaCommentRows.push({
              criteriaCode: key,
              commentId: c.id || null,
              commentUser: c.user || null,
              commentText: c.text || null,
            });
          }
        }
      }
      tasks.push(criteriaCommentsRepo.replaceForReview(reviewUuid, criteriaCommentRows));
      tasks.push(trainingCommentsRepo.replaceForReview(reviewUuid, trainingCommentRows));
    }

    if (data.trainingNeeds !== undefined) {
      const needs = this.parseJson(data.trainingNeeds, []);
      tasks.push(trainingNeedsRepo.replaceForReview(reviewUuid, needs.map((n: any) => ({
        trainingRowId: n.id || null,
        training: n.training || null,
        correspondingInDb: n.correspondingInDB || n.correspondingInDb || null,
        category: n.category || null,
        status: n.status || null,
        completionDate: n.completionDate || n.completion_date || null,
      }))));
    }

    if (data.approvalData !== undefined || data.selectedApproversForSubmission !== undefined) {
      const approvalRows: any[] = [];
      const approvals = this.parseJson(data.approvalData, []);
      for (const a of approvals) {
        approvalRows.push({
          approverId: a.id || null,
          date: a.date || null,
          approver: a.approver || null,
          status: a.status || null,
          approval: a.approval || null,
          comments: a.comments || null,
          isFromPartA: a.isFromPartA || false,
          isSelectedForSubmission: false,
        });
      }
      const selectedApprovers = this.parseJson(data.selectedApproversForSubmission, []);
      for (const item of selectedApprovers) {
        if (typeof item === 'string') {
          approvalRows.push({
            approver: item,
            isSelectedForSubmission: true,
          });
        } else {
          approvalRows.push({
            approverId: item.userUuid || null,
            approver: item.displayName || item.approver || '',
            isSelectedForSubmission: true,
          });
        }
      }
      tasks.push(approvalsRepo.replaceForReview(reviewUuid, approvalRows));
    }

    if (data.checklistProgressData !== undefined) {
      const progressObj = this.parseJson(data.checklistProgressData, {});
      const items: any[] = [];

      if (progressObj.sections && Array.isArray(progressObj.sections)) {
        let sortIdx = 0;
        for (const section of progressObj.sections) {
          if (!section.assessmentPoints || !Array.isArray(section.assessmentPoints)) continue;
          for (const point of section.assessmentPoints) {
            const latestVerification = point.verifications?.length > 0
              ? point.verifications[point.verifications.length - 1]
              : null;
            items.push({
              sectionId: section.id,
              assessmentPointId: point.id,
              completed: point.completed ?? false,
              sectionTitle: section.title || null,
              assessmentPointText: point.text || null,
              verifierName: latestVerification?.verifierName || null,
              verifierRank: latestVerification?.rank || null,
              date: latestVerification?.date || null,
              verificationsData: point.verifications?.length > 0 ? JSON.stringify(point.verifications) : null,
              commentsData: point.comments?.length > 0 ? JSON.stringify(point.comments) : null,
              attachmentsData: point.attachments?.length > 0 ? JSON.stringify(point.attachments) : null,
              sortOrder: sortIdx++,
            });
          }
        }
      } else {
        for (const [sectionId, assessments] of Object.entries(progressObj)) {
          if (typeof assessments !== 'object' || assessments === null) continue;
          for (const [apId, val] of Object.entries(assessments as Record<string, any>)) {
            items.push({
              sectionId,
              assessmentPointId: apId,
              verifierName: val?.verifierName || null,
              date: val?.date || null,
            });
          }
        }
      }
      tasks.push(checklistProgressRepo.replaceForReview(reviewUuid, items));
    }

    if (data.b2VesselTypes !== undefined || data.b2FleetGroups !== undefined) {
      const toNames = (raw: any, keys: string[]): string[] | undefined => {
        if (raw === undefined) return undefined;
        const list = Array.isArray(raw) ? raw : this.parseJson(raw, []);
        if (!Array.isArray(list)) return [];
        return list
          .map((v: any) => {
            if (typeof v === 'string') return v;
            for (const k of keys) {
              if (v && typeof v[k] === 'string') return v[k];
            }
            return '';
          })
          .filter((n: string) => !!n);
      };

      const existing = await suitabilityRepo.findByReviewUuid(reviewUuid);
      const vesselTypes = toNames(data.b2VesselTypes, ['name', 'vesselType'])
        ?? (existing?.vesselTypes ?? []);
      const fleetGroups = toNames(data.b2FleetGroups, ['name', 'fleetGroup'])
        ?? (existing?.fleetGroups ?? []);
      tasks.push(suitabilityRepo.upsertForReview(reviewUuid, { vesselTypes, fleetGroups }));
    }

    if (tasks.length > 0) await Promise.all(tasks);
  }

  private parseJson(value: any, fallback: any): any {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return fallback; }
    }
    return value;
  }
}
