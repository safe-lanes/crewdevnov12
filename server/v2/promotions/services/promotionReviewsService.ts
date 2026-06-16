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
} from "../repositories";
import { PromotionHierarchiesRepository } from "../../admin/repositories/promotionHierarchiesRepository";
import { formsService } from "../../admin/services";
import { applyAuditUser } from "../../admin/utils/auditUser";
import type { PromotionReviewV2, PromoSuitabilityV2 } from "../../../../shared/v2/promotions/types";
import { getDb } from "../../db";
import { crewMembersV2 } from "../../../../shared/v2/crew-pool/schema";
import { eq, and, isNull, or } from "drizzle-orm";
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
