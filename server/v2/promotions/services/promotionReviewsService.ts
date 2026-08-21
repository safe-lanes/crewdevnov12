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
import { vesselPlanningV2, type VesselPlanningV2 } from "../../../../shared/v2/vessel/schema";
import { promoExecutionLedgerV2, promotionReviewsV2, promoChecklistAttachmentsV2 } from "../../../../shared/v2/promotions/schema";
import { eq, and, isNull, or, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { fileStorageService } from "../../shared/fileStorageService.js";
import { decodeStoredFile } from "../../shared/serveAttachmentHelper.js";
import { v4 as uuidv4 } from "uuid";
import { getBaseRank } from "../../../../shared/crew-mapping";

export const promotionReviewWritableSchema = z.object({
  crewMemberId: z.string().optional(),
  promotionToRank: z.string().optional(),
  selectedPosition: z.string().nullable().optional(),
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

function statusRequiresPromotionVersionPin(status?: string | null): boolean {
  return statusRank(status) >= statusRank("submitted");
}

// Parse a promotion / approval date string (ISO 8601 or dd/mm/yyyy) into epoch
// milliseconds for chronological ordering and effective-date resolution.
// dd/mm/yyyy is tried first so it is not misread as US m/d/y. Overflow values
// (e.g. 30 Feb) are rejected. Returns null when unparseable.
function parseEffectiveDateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;

  const build = (y: number, m1: number, d: number): number | null => {
    if (isNaN(y) || isNaN(m1) || isNaN(d)) return null;
    const dt = new Date(Date.UTC(y, m1 - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m1 - 1 || dt.getUTCDate() !== d) {
      return null;
    }
    return dt.getTime();
  };

  const slash = s.split("/");
  if (slash.length === 3) {
    return build(parseInt(slash[2], 10), parseInt(slash[1], 10), parseInt(slash[0], 10));
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return build(parseInt(iso[1], 10), parseInt(iso[2], 10), parseInt(iso[3], 10));
  }
  return null;
}

// Canonical YYYY-MM-DD for a UTC-midnight epoch (used to feed the resolved
// effective date back into the rank engine / sea-service split as a string).
function toIsoDayFromMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// Aggregate outcome of a historical backfill / go-live catch-up run.
export interface BackfillResult {
  dryRun: boolean;
  totalReviews: number;
  eligible: number;
  ineligible: number;
  crewProcessed: number;
  applied: number; // newly applied this run (ledger did not yet exist)
  alreadyApplied: number; // skipped because the ledger row already existed
  rankWrites: number; // present_rank changed (from != to)
  historyOnly: number; // already at target rank; history-only record
  seaService: { created: number; alreadySplit: number; skippedInvalid: number };
  ineligibleReasons: Record<string, number>;
  errors: string[];
}

function findNextPromotionRank(currentRank: string, hierarchies: any[]): string | null {
  const currentBaseRank = getBaseRank(currentRank).trim().toLowerCase();
  for (const hierarchy of hierarchies) {
    let rankPath: string[];
    try {
      rankPath = typeof hierarchy.rankPath === 'string'
        ? JSON.parse(hierarchy.rankPath)
        : (Array.isArray(hierarchy.rankPath) ? hierarchy.rankPath : []);
    } catch (e) {
      rankPath = [];
    }
    const basePath = getBasePromotionPath(rankPath);
    const currentIndex = basePath.findIndex(
      (rank) => rank.trim().toLowerCase() === currentBaseRank,
    );
    if (currentIndex === -1) continue;
    // rankPath is stored junior→senior (index 0 = most junior, last index = most senior)
    if (currentIndex < basePath.length - 1) return basePath[currentIndex + 1];
    return null;
  }
  return null;
}

function getBasePromotionPath(rankPath: string[]): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const rank of rankPath) {
    const baseRank = getBaseRank(rank).trim();
    const key = baseRank.toLowerCase();
    if (!baseRank || seen.has(key)) continue;
    seen.add(key);
    output.push(baseRank);
  }
  return output;
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
  attachmentsList: any[] = [],
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
    identifiedByUuid: tn.identifiedByUuid || '',
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
    let legacyAttachments: any[] = [];
    try { verifications = (cp as any).verificationsData ? JSON.parse((cp as any).verificationsData) : []; } catch {}
    try { comments = (cp as any).commentsData ? JSON.parse((cp as any).commentsData) : []; } catch {}
    try { legacyAttachments = (cp as any).deprecatedAttachmentsData ? JSON.parse((cp as any).deprecatedAttachmentsData) : []; } catch {}
    if (!Array.isArray(legacyAttachments)) legacyAttachments = [];

    // Filesystem-backed attachments (canonical source of truth) for this assessment point.
    // Emit both fileName/fileSize (legacy/frontend shape) and name/size so every consumer renders correctly.
    const tableAttachments = attachmentsList
      .filter((att) => att.checklistProgressUuid === cp.cpUuid)
      .map((att) => {
        const size = att.fileSize ? parseInt(att.fileSize, 10) : 0;
        return {
          id: att.attUuid,
          attUuid: att.attUuid,
          fileName: att.fileName,
          fileSize: size,
          name: att.fileName,
          size,
          type: att.fileType || "",
          uploadedAt: att.createdAt?.toISOString() || "",
          filePath: att.filePath,
          viewUrl: `/api/v2/promotions/attachments/${att.attUuid}/raw`,
        };
      });

    // De-dupe: table rows win; only append legacy JSON entries not already represented in the table.
    const tableAttIds = new Set(tableAttachments.map((a) => a.id));
    const legacyOnly = legacyAttachments.filter((a: any) => {
      const lid = a?.attUuid || a?.id;
      return !lid || !tableAttIds.has(lid);
    });

    const attachments = [...tableAttachments, ...legacyOnly];

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
    selectedPosition: review.selectedPosition || null,
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
    formVersionId: (review as any).formVersionId ?? null,
    formVersionUuid: (review as any).formVersionUuid ?? null,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

// Shared predicate for an approved-but-not-executed prior-joining promotion.
// A completed promotion has status "completed" and is naturally excluded.
// Keep this single source of truth so every planning surface that surfaces
// "(PR)" stays in lockstep (mirrors vesselPlanningService.signOnReliever).
function isApprovedPriorJoining(r: {
  status?: string | null;
  promotionTiming?: string | null;
}): boolean {
  const status = (r.status ?? "").trim().toLowerCase();
  const timing = (r.promotionTiming ?? "").trim().toLowerCase();
  return status === "approved" && timing === "prior-joining";
}

type OnboardPromotionExecutionContext = {
  vesselUuid: string;
  currentPlanUuid: string;
  currentPosition: string;
  targetPosition: string;
  targetRankId: string;
  targetPlanUuid: string;
};

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
      if (!isApprovedPriorJoining(r)) continue;
      const crewUuid = empToCrew.get((r.crewMemberId ?? "").trim());
      const toRank = (r.promotionToRank ?? "").trim();
      if (crewUuid && toRank) result.set(crewUuid, { promotionToRank: toRank });
    }

    return result;
  }

  /**
   * Crew with an APPROVED prior-joining promotion whose TARGET rank equals
   * `targetRank` — i.e. they will become this rank on sign-on but their
   * present_rank is still lower. Rotation Planning uses this to surface them in
   * the target-rank crew pool tagged "(PR)". Same predicate as
   * getPendingPriorJoiningByCrewUuids; read-only and idempotent.
   */
  async getApprovedPriorJoiningPromoteesToRank(
    targetRank: string,
  ): Promise<Array<{ crewUuid: string; promotionToRank: string }>> {
    const wanted = (targetRank ?? "").trim().toLowerCase();
    if (!wanted) return [];

    const db = getDb();

    const reviews = await db
      .select()
      .from(promotionReviewsV2)
      .where(
        or(eq(promotionReviewsV2.isDeleted, false), isNull(promotionReviewsV2.isDeleted)),
      );

    const matched = reviews.filter(
      (r: any) =>
        isApprovedPriorJoining(r) &&
        (r.promotionToRank ?? "").trim().toLowerCase() === wanted,
    );
    if (matched.length === 0) return [];

    const empNos = Array.from(
      new Set(matched.map((r: any) => (r.crewMemberId ?? "").trim()).filter((e: any) => !!e)),
    ) as string[];
    if (empNos.length === 0) return [];

    const crews = await db
      .select({ crewUuid: crewMembersV2.crewUuid, empNo: crewMembersV2.empNo })
      .from(crewMembersV2)
      .where(inArray(crewMembersV2.empNo, empNos));

    const empToCrew = new Map<string, string>();
    for (const c of crews) {
      const empNo = (c.empNo ?? "").trim();
      if (empNo) empToCrew.set(empNo, c.crewUuid);
    }

    const out: Array<{ crewUuid: string; promotionToRank: string }> = [];
    const seen = new Set<string>();
    for (const r of matched) {
      const crewUuid = empToCrew.get((r.crewMemberId ?? "").trim());
      const toRank = (r.promotionToRank ?? "").trim();
      if (crewUuid && toRank && !seen.has(crewUuid)) {
        seen.add(crewUuid);
        out.push({ crewUuid, promotionToRank: toRank });
      }
    }
    return out;
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
          status: crewMembersV2.status,
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
        // Never auto-create promotion reviews for terminated crew.
        if ((crew.status || '').startsWith('Terminated')) continue;
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
          // Pin-at-submission rule: auto-created reviews start UNPINNED so they
          // live-follow the latest released version until Submit for Approval.
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

    const cpUuids = allChecklistProgress.map(item => item.cpUuid);
    let attachmentsList: any[] = [];
    if (cpUuids.length > 0) {
      const db = getDb();
      attachmentsList = await db
        .select()
        .from(promoChecklistAttachmentsV2)
        .where(
          and(
            inArray(promoChecklistAttachmentsV2.checklistProgressUuid, cpUuids),
            eq(promoChecklistAttachmentsV2.isDeleted, false)
          )
        );
    }

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
      attachmentsList,
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

    const cpUuids = cp.map(item => item.cpUuid);
    let attachmentsList: any[] = [];
    if (cpUuids.length > 0) {
      const db = getDb();
      attachmentsList = await db
        .select()
        .from(promoChecklistAttachmentsV2)
        .where(
          and(
            inArray(promoChecklistAttachmentsV2.checklistProgressUuid, cpUuids),
            eq(promoChecklistAttachmentsV2.isDeleted, false)
          )
        );
    }

    return assembleV1Response(review, cs, ct, cc, tc, tn, ap, cp, suit, attachmentsList);
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

    const cpUuids = cp.map(item => item.cpUuid);
    let attachmentsList: any[] = [];
    if (cpUuids.length > 0) {
      const db = getDb();
      attachmentsList = await db
        .select()
        .from(promoChecklistAttachmentsV2)
        .where(
          and(
            inArray(promoChecklistAttachmentsV2.checklistProgressUuid, cpUuids),
            eq(promoChecklistAttachmentsV2.isDeleted, false)
          )
        );
    }

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
      attachmentsList,
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

  private async resolveRequiredPromotionFormVersion(promotionToRank: string | null | undefined):
    Promise<{ formVersionId: number; formVersionUuid: string }> {
    const normalizedRank = (promotionToRank ?? "").trim();
    if (!normalizedRank) {
      throw new PromotionGuardError(
        "Cannot submit this promotion review without a promotion rank and a released promotion form version.",
      );
    }
    try {
      const formForRank = await formsService.getFormForRank(normalizedRank, "promotion");
      const formVersionId = formForRank?.formVersionId;
      const formVersionUuid = formForRank?.formVersionUuid;
      if (
        formForRank?.noReleasedVersion ||
        !Number.isInteger(formVersionId) ||
        !formVersionUuid
      ) {
        throw new PromotionGuardError(
          `No released promotion form version exists for rank "${normalizedRank}". Release a form version before submitting this review.`,
        );
      }
      return {
        formVersionId,
        formVersionUuid,
      };
    } catch (error) {
      if (error instanceof PromotionGuardError) throw error;
      throw new PromotionGuardError(
        `Unable to resolve a released promotion form version for rank "${normalizedRank}". This review was not saved.`,
      );
    }
  }

  private async resolvePromotionPinForSubmittedStatus(params: {
    status: string | null | undefined;
    promotionToRank: string | null | undefined;
    formVersionId: number | null | undefined;
    formVersionUuid: string | null | undefined;
  }): Promise<{ formVersionId: number; formVersionUuid: string } | null> {
    if (!statusRequiresPromotionVersionPin(params.status)) return null;

    const hasId = params.formVersionId != null;
    const hasUuid = !!params.formVersionUuid;
    if (hasId !== hasUuid) {
      throw new PromotionGuardError(
        "This promotion review has an incomplete form-version pin. Both form-version values are required before it can be submitted.",
      );
    }
    if (hasId && hasUuid) return null;

    return this.resolveRequiredPromotionFormVersion(params.promotionToRank);
  }

  private async getActivePlanningRows(vesselUuid: string): Promise<VesselPlanningV2[]> {
    const db = getDb();
    return db
      .select()
      .from(vesselPlanningV2)
      .where(
        and(
          eq(vesselPlanningV2.vesselUuid, vesselUuid),
          eq(vesselPlanningV2.isDeleted, false),
          eq(vesselPlanningV2.isArchived, false),
        ),
      );
  }

  private async resolveOnboardPromotionContext(params: {
    crewMemberId: string;
    promotionToRank: string;
    selectedPosition?: string | null;
  }): Promise<OnboardPromotionExecutionContext> {
    const {
      crewMemberId,
      promotionToRank,
      selectedPosition,
    } = params;
    const db = getDb();
    const [crew] = await db
      .select({
        crewUuid: crewMembersV2.crewUuid,
      })
      .from(crewMembersV2)
      .where(eq(crewMembersV2.empNo, crewMemberId));
    if (!crew?.crewUuid) {
      throw new PromotionGuardError(
        "Onboard promotion cannot be completed because the crew member could not be found.",
      );
    }

    const { crewAssignmentsService } = await import(
      "../../crew-pool/services/crewAssignmentsService"
    );
    const currentAssignment =
      await crewAssignmentsService.getCurrent(crew.crewUuid);
    const vesselUuid = currentAssignment?.vesselUuid;
    if (!vesselUuid) {
      throw new PromotionGuardError(
        "Onboard promotion cannot be completed because the crew member is not assigned to a current vessel.",
      );
    }

    const planningRows =
      await this.getActivePlanningRows(vesselUuid);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const signedOnRows = planningRows.filter((row) => {
      if (!row.signOnDate) return false;
      const date = new Date(row.signOnDate);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getTime() <= endOfToday.getTime()
      );
    });
    const promoteeRows = signedOnRows.filter(
      (row) => row.crewUuid === crew.crewUuid,
    );
    if (promoteeRows.length !== 1) {
      throw new PromotionGuardError(
        "Onboard promotion cannot be completed because the crew member's current onboard position could not be determined.",
      );
    }

    const currentRow = promoteeRows[0];
    const currentPosition = currentRow.rank;
    const { vesselRevisionsService } = await import(
      "../../admin/services/vesselRevisionsService"
    );
    const vesselRanks =
      await vesselRevisionsService.getRanksByVesselId(vesselUuid);
    const targetBaseRank = getBaseRank(promotionToRank)
      .trim()
      .toLowerCase();
    const configuredTargetPositions = Array.from(new Set(
      vesselRanks
        .map((rank: any) => rank.displayRole || "")
        .filter((position: string) => {
          return (
            !!position &&
            getBaseRank(position).trim().toLowerCase() ===
              targetBaseRank
          );
        }),
    ));
    if (configuredTargetPositions.length === 0) {
      throw new PromotionGuardError(
        `Onboard promotion cannot be completed because the target rank "${promotionToRank}" is not configured for the crew member's current vessel.`,
      );
    }

    let targetPosition: string;
    if (configuredTargetPositions.length === 1) {
      targetPosition = configuredTargetPositions[0];
    } else {
      targetPosition = String(selectedPosition || "").trim();
      if (!targetPosition) {
        throw new PromotionGuardError(
          "Please select a position before completing the promotion.",
        );
      }
      if (!configuredTargetPositions.includes(targetPosition)) {
        throw new PromotionGuardError(
          `The selected position "${targetPosition}" is not configured for the target rank on the crew member's current vessel.`,
        );
      }
    }

    const targetRows = planningRows.filter(
      (row) => row.rank === targetPosition,
    );
    const targetPrimaryRow = targetRows.find(
      (row) =>
        String(row.crewStatus).toLowerCase() === "primary",
    );
    if (!targetPrimaryRow?.planUuid || !targetPrimaryRow.rankId) {
      throw new PromotionGuardError(
        `Onboard promotion cannot be completed because the selected position ${targetPosition.replace(/_/g, " ")} has no active Primary row and rank id in Vessel Planning for the current vessel.`,
      );
    }
    const targetRankId = targetPrimaryRow.rankId;

    const hasSignedOnPrimary = signedOnRows.some(
      (row) =>
        row.rank === targetPosition &&
        String(row.crewStatus).toLowerCase() === "primary" &&
        !!row.crewUuid,
    );
    const hasSignedOnSecondary = signedOnRows.some(
      (row) =>
        row.rank === targetPosition &&
        String(row.crewStatus).toLowerCase() === "secondary" &&
        !!row.crewUuid,
    );
    if (hasSignedOnPrimary && hasSignedOnSecondary) {
      throw new PromotionGuardError(
        `Onboard promotion cannot be completed. Neither a Primary nor Secondary position is available at ${targetPosition.replace(/_/g, " ")} to promote the crew onboard.`,
      );
    }

    const hasExactPositionSecondary = signedOnRows.some(
      (row) =>
        row.crewUuid !== crew.crewUuid &&
        row.rank === currentPosition &&
        String(row.crewStatus).toLowerCase() === "secondary" &&
        !!row.crewUuid,
    );
    const currentBaseRank = getBaseRank(currentPosition)
      .trim()
      .toLowerCase();
    const hasSameFamilyCoverage = signedOnRows.some(
      (row) =>
        row.crewUuid !== crew.crewUuid &&
        row.rank !== currentPosition &&
        !!row.crewUuid &&
        ["primary", "secondary"].includes(
          String(row.crewStatus).toLowerCase(),
        ) &&
        getBaseRank(row.rank).trim().toLowerCase() ===
          currentBaseRank,
    );
    if (
      !hasExactPositionSecondary &&
      !hasSameFamilyCoverage
    ) {
      throw new PromotionGuardError(
        "Onboard promotion cannot be completed. A reliever must be assigned and signed onboard for the crew member's current rank before promotion can be executed.",
      );
    }

    return {
      vesselUuid,
      currentPlanUuid: currentRow.planUuid,
      currentPosition,
      targetPosition,
      targetRankId,
      targetPlanUuid: targetPrimaryRow.planUuid,
    };
  }

  private async withOnboardPositionLock<T>(
    context: OnboardPromotionExecutionContext,
    task: () => Promise<T>,
  ): Promise<T> {
    const db = getDb();
    return db.transaction(async (tx: typeof db) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${context.vesselUuid}), hashtext(${context.targetPosition}))`,
      );
      return task();
    });
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
    selectedPosition?: string | null;
    promotionDate?: string | null;
    promotionTiming?: string | null;
    incomingStatus?: string | null;
    existingStatus?: string | null;
    reviewUuid?: string | null;
  }): Promise<OnboardPromotionExecutionContext | null> {
    const { crewMemberId, promotionToRank, selectedPosition, promotionDate, promotionTiming, incomingStatus, existingStatus, reviewUuid } = params;

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

    const timing = (promotionTiming ?? "").trim().toLowerCase();
    if (
      timing === "on-board" &&
      incomingStatus &&
      incomingRank === statusRank("completed") &&
      existingRank < statusRank("completed") &&
      crewMemberId &&
      promotionToRank
    ) {
      return this.resolveOnboardPromotionContext({
        crewMemberId,
        promotionToRank,
        selectedPosition,
      });
    }
    return null;
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
          createdByUuid: actorUuid,
          updatedByUuid: actorUuid,
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

      // Phase 3b — split Rest Hours the same way: close the promotion month's
      // existing record at split-date−1 and open a new new-rank record for the
      // remainder, so RH compliance is attributed per rank. Same non-fatal,
      // ledger-gated, idempotent policy as the sea-service split above — the rank
      // flip is the committed core and must not be rolled back by an RH hiccup.
      try {
        const { rhPromotionService } = await import(
          "../../rest-hours/services/rhPromotionService"
        );
        const rhSplit = await rhPromotionService.splitForPromotion({
          crewUuid: crew.crewUuid ?? "",
          empNo: empNo ?? "",
          newRank: toRank ?? "",
          oldRank: fromRank ?? "",
          splitDate: effectiveDate ?? "",
          auditUserUuid: actorUuid,
        });
        if (rhSplit.status === "skipped-invalid-input") {
          console.warn(
            `[promotion-engine] Rest-hours split SKIPPED for review ${reviewUuid} ` +
            `(crew ${crew.crewUuid}): missing/invalid split date "${effectiveDate ?? ""}". ` +
            `Rank was flipped; RH records will be created under the new rank on next save.`,
          );
        }
      } catch (err) {
        console.error(
          `[promotion-engine] Rest-hours split FAILED for review ${reviewUuid} ` +
          `(crew ${crew.crewUuid}, non-fatal): rank is flipped but the RH month is un-split.`,
          err,
        );
      }
    }
  }

  // On-board promotion only: place the promotee into the target rank position on
  // their current vessel. If an active Primary already holds the target rank, the
  // promotee is placed as Secondary so the existing takeover flow can complete the
  // swap on the old Primary's sign-off. If the target position is vacant (no active
  // Primary), the promotee is placed directly as Primary — mirroring the reliever
  // sign-on vacant-position handling — so the slot is never left with a Secondary
  // and no Primary. Best-effort — a planning hiccup must not block the promotion
  // itself, mirroring the non-fatal sea-service sync pattern.
  private async placePromoteeOnTargetRank(
    review: PromotionReviewV2,
    actorUuid?: string | null,
    signOnDate?: string | null,
    onboardContext?: OnboardPromotionExecutionContext | null,
  ): Promise<void> {
    try {
      const empNo = (review.crewMemberId ?? "").trim();
      if (!empNo || !onboardContext) return;

      const { crewMembersService } = await import("../../crew-pool/services/crewMembersService");
      const crew = await crewMembersService.getByEmpNo(empNo);
      if (!crew) return;

      const slots = (
        await this.getActivePlanningRows(onboardContext.vesselUuid)
      ).filter((row) => row.rank === onboardContext.targetPosition);

      // Idempotency: already placed (as primary or secondary) on this vessel/rank.
      const alreadyPlaced = slots.find((s: any) => s.crewUuid === crew.crewUuid);
      if (alreadyPlaced) {
        // Heal a previously-created placement that is missing its sign-on date
        // (e.g. one created before the promotion execution recorded a sign-on
        // date, or by an earlier mis-execution). A normal idempotent re-run
        // finds the date already set and is a no-op.
        const desiredSignOn = (signOnDate ?? "").trim();
        const existingSignOn = (alreadyPlaced.signOnDate ?? "").trim();
        if (desiredSignOn && !existingSignOn) {
          const { vesselPlanningService } = await import("../../vessel/services/vesselPlanningService");
          await vesselPlanningService.update(alreadyPlaced.planUuid, {
            signOnDate: desiredSignOn,
            auditUserUuid: actorUuid ?? undefined,
          });
        }
        return;
      }

      // Decide Primary vs Secondary. Only an OCCUPIED Primary counts (crewUuid set):
      // a vacant manning slot defaults crewStatus to "primary" with no crew, which
      // must NOT be treated as an existing Primary. When no occupied Primary holds
      // the rank the position is vacant → promotee becomes Primary; otherwise
      // Secondary so the existing takeover swap completes.
      const hasActivePrimary = slots.some(
        (s: any) => !!s.crewUuid && (s.crewStatus ?? "").toLowerCase() === "primary",
      );
      const targetStatus: "primary" | "secondary" = hasActivePrimary ? "secondary" : "primary";

      const { vesselPlanningService } = await import("../../vessel/services/vesselPlanningService");
      if (targetStatus === "primary") {
        await vesselPlanningService.update(onboardContext.targetPlanUuid, {
          crewUuid: crew.crewUuid,
          crewStatus: "primary",
          signOnDate: (signOnDate ?? "").trim() || undefined,
          auditUserUuid: actorUuid ?? undefined,
        });
      } else {
        await vesselPlanningService.create({
          vesselUuid: onboardContext.vesselUuid,
          crewUuid: crew.crewUuid,
          rankId: onboardContext.targetRankId,
          rank: onboardContext.targetPosition,
          crewStatus: targetStatus,
          signOnDate: (signOnDate ?? "").trim() || undefined,
          auditUserUuid: actorUuid ?? undefined,
        } as any);
      }
    } catch (err) {
      console.error(
        `[promotion-engine] On-board target-rank placement failed for review ` +
        `${review.reviewUuid} (non-fatal):`,
        err,
      );
    }
  }

  // Fired after a review is persisted. When the review has reached "completed"
  // the rank propagation engine executes the promotion (idempotently). For
  // on-board promotions the promotee is additionally placed as a Secondary on
  // their current vessel to drive the takeover flow.
  private async runCompletionHook(
    review: PromotionReviewV2 | null,
    actorUuid?: string | null,
    onboardContext?: OnboardPromotionExecutionContext | null,
  ) {
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
      // On execution the promotee's rank position changes on the manning matrix:
      // they sign ON at the new rank (as Secondary when an existing Primary holds
      // the rank, or directly as Primary when the position is vacant) and their
      // OLD rank position is signed OFF (handing it to the reliever who was signed
      // on for that rank). The effective date for both events is the Date of
      // Promotion. The previous rank is read from the execution ledger written by
      // applyPromotedRank (reliable + idempotent).
      const ledger = await executionLedgerRepo.findByReviewUuid(review.reviewUuid);
      const fromRank = (ledger?.fromRank ?? "").trim();
      const toRank = (review.promotionToRank ?? "").trim();

      await this.placePromoteeOnTargetRank(
        review,
        actorUuid,
        effectiveDate,
        onboardContext,
      );

      if (fromRank && fromRank !== toRank && onboardContext) {
        await this.signOffPromoteeOldRank(
          review,
          onboardContext,
          effectiveDate,
          actorUuid,
        );
      }
    }
  }

  // On-board promotion only: sign off the promotee's planning row at their
  // PREVIOUS rank on their current vessel, vacating the position so the reliever
  // (the Secondary signed on for that rank) takes it over. The crew member stays
  // onboard at the new rank, so this is a planning-only sign-off — it does not
  // touch their crew_assignments or sea service. Best-effort + idempotent.
  private async signOffPromoteeOldRank(
    review: PromotionReviewV2,
    onboardContext: OnboardPromotionExecutionContext,
    effectiveDate?: string | null,
    actorUuid?: string | null,
  ): Promise<void> {
    try {
      const signOffDate = (effectiveDate ?? "").trim();
      if (!signOffDate) return;

      const { vesselPlanningService } = await import("../../vessel/services/vesselPlanningService");
      await vesselPlanningService.signOffForRankChange(onboardContext.currentPlanUuid, {
        signOffDate,
        auditUserUuid: actorUuid ?? undefined,
      });
    } catch (err) {
      console.error(
        `[promotion-engine] On-board old-rank sign-off failed for review ` +
        `${review.reviewUuid} (non-fatal):`,
        err,
      );
    }
  }

  /**
   * Phase 5 — Historical backfill & go-live catch-up.
   *
   * Applies the rank-propagation engine to every historical promotion that was
   * approved/completed before the engine existed, so present_rank, the ledger
   * and the Company sea-service history all reflect promotions that happened
   * before go-live.
   *
   * Eligibility: a review is processed only when it is fully approved
   * (status approved or completed) AND has a resolvable effective date:
   *   • on-board (and any non prior-joining timing) → Part C Date of Promotion
   *     (`promotionDate`).
   *   • prior-joining → the Sign-On date (stored in `promotionDate` once signed
   *     on); legacy records with no sign-on fall back to their latest Approval
   *     Date.
   *
   * Eligible reviews are grouped per crew and applied oldest-first so the
   * cumulative present_rank and sea-service boundaries land in the right order.
   * Everything routes through the Phase 2 engine (`applyPromotedRank`), which is
   * ledger-gated (exactly-once), flips present_rank only when it differs, and
   * performs the Phase 3 line-level sea-service split — so re-running is safe.
   *
   * Defaults to `dryRun` so the caller can review the summary before any write.
   *
   * NOTE: in dry-run the present_rank is never mutated, so the rank-write /
   * history-only / sea-service counts are best-effort estimates against the
   * current snapshot when multiple un-applied promotions stack for one crew.
   * The applied vs already-applied counts (driven by the ledger) are exact.
   */
  async applyHistoricalBackfill(
    opts: { dryRun?: boolean; actorUuid?: string | null } = {},
  ): Promise<BackfillResult> {
    const dryRun = opts.dryRun !== false; // default to a safe dry-run
    const actorUuid = opts.actorUuid ?? null;

    const result: BackfillResult = {
      dryRun,
      totalReviews: 0,
      eligible: 0,
      ineligible: 0,
      crewProcessed: 0,
      applied: 0,
      alreadyApplied: 0,
      rankWrites: 0,
      historyOnly: 0,
      seaService: { created: 0, alreadySplit: 0, skippedInvalid: 0 },
      ineligibleReasons: {},
      errors: [],
    };

    const markIneligible = (reason: string) => {
      result.ineligible++;
      result.ineligibleReasons[reason] = (result.ineligibleReasons[reason] ?? 0) + 1;
    };

    const allReviews = await reviewsRepo.findAll();
    result.totalReviews = allReviews.length;

    // Latest parseable Approval Date per review — the fallback effective date for
    // legacy prior-joining records that never captured a sign-on date.
    const approvals = await approvalsRepo.findByReviewUuids(
      allReviews.map((r) => r.reviewUuid),
    );
    const approvalMsByReview = new Map<string, number>();
    for (const a of approvals) {
      const ms = parseEffectiveDateMs(a.date);
      if (ms == null) continue;
      const prev = approvalMsByReview.get(a.reviewUuid);
      if (prev == null || ms > prev) approvalMsByReview.set(a.reviewUuid, ms);
    }

    interface EligibleReview {
      review: PromotionReviewV2;
      effectiveDate: string;
      effectiveMs: number;
    }
    const eligible: EligibleReview[] = [];

    for (const review of allReviews) {
      if (statusRank(review.status) < statusRank("approved")) {
        markIneligible("not-approved");
        continue;
      }

      const timing = (review.promotionTiming ?? "").trim().toLowerCase();
      const promotionMs = parseEffectiveDateMs(review.promotionDate);

      let effectiveMs: number | null = null;
      let effectiveDate: string | null = null;

      if (timing === "prior-joining") {
        if (promotionMs != null) {
          effectiveMs = promotionMs;
          effectiveDate = (review.promotionDate ?? "").trim();
        } else {
          const apprMs = approvalMsByReview.get(review.reviewUuid) ?? null;
          if (apprMs != null) {
            effectiveMs = apprMs;
            effectiveDate = toIsoDayFromMs(apprMs);
          }
        }
      } else if (promotionMs != null) {
        effectiveMs = promotionMs;
        effectiveDate = (review.promotionDate ?? "").trim();
      }

      if (effectiveMs == null || !effectiveDate) {
        markIneligible(
          timing === "prior-joining"
            ? "no-sign-on-or-approval-date"
            : "no-promotion-date",
        );
        continue;
      }

      if (!(review.crewMemberId ?? "").trim()) {
        markIneligible("no-crew-member");
        continue;
      }

      // A target rank is required: the engine no-ops without one, so a review
      // missing it cannot be applied and must not be counted as processed.
      if (!(review.promotionToRank ?? "").trim()) {
        markIneligible("no-promotion-rank");
        continue;
      }

      eligible.push({ review, effectiveDate, effectiveMs });
    }

    result.eligible = eligible.length;

    // Group per crew and apply oldest-first so cumulative rank / sea-service
    // boundaries are chronologically correct.
    const byCrew = new Map<string, EligibleReview[]>();
    for (const e of eligible) {
      const key = (e.review.crewMemberId ?? "").trim();
      const list = byCrew.get(key) ?? [];
      list.push(e);
      byCrew.set(key, list);
    }
    for (const list of byCrew.values()) {
      list.sort(
        (a, b) =>
          a.effectiveMs - b.effectiveMs ||
          (a.review.createdAt?.getTime?.() ?? 0) - (b.review.createdAt?.getTime?.() ?? 0) ||
          a.review.id - b.review.id,
      );
    }
    result.crewProcessed = byCrew.size;

    const { crewMembersService } = await import("../../crew-pool/services/crewMembersService");
    const { crewSeaServiceService } = await import("../../crew-pool/services/crewSeaServiceService");

    for (const [empNo, list] of byCrew) {
      for (const { review, effectiveDate } of list) {
        try {
          // Ledger gate — already executed promotions are a no-op.
          const existingLedger = await executionLedgerRepo.findByReviewUuid(review.reviewUuid);
          if (existingLedger) {
            result.alreadyApplied++;
            continue;
          }

          let crew;
          try {
            crew = await crewMembersService.getByEmpNo(empNo);
          } catch {
            crew = null;
          }
          if (!crew) {
            result.errors.push(
              `Crew not found for employee ${empNo} (review ${review.reviewUuid})`,
            );
            continue;
          }

          const fromRank = (crew.presentRank ?? "").trim();
          const toRank = (review.promotionToRank ?? "").trim();

          // Preview the sea-service split against the CURRENT (pre-apply) state so
          // the summary reflects what this run does, for both dry-run and live.
          const splitPreview = await crewSeaServiceService.previewSplitForPromotion({
            crewUuid: crew.crewUuid,
            newRank: toRank,
            oldRank: fromRank || null,
            splitDate: effectiveDate,
          });

          if (!dryRun) {
            await this.applyPromotedRank(review, { effectiveDate, actorUuid });
            // Confirm the engine actually recorded the promotion before counting
            // it as applied, so the summary cannot overstate what happened.
            const recorded = await executionLedgerRepo.findByReviewUuid(review.reviewUuid);
            if (!recorded) {
              result.errors.push(
                `Apply recorded no ledger row for review ${review.reviewUuid} (crew ${empNo})`,
              );
              continue;
            }
          }

          result.applied++;
          if (fromRank === toRank) result.historyOnly++;
          else result.rankWrites++;
          if (splitPreview === "would-create") result.seaService.created++;
          else if (splitPreview === "already-split") result.seaService.alreadySplit++;
          else result.seaService.skippedInvalid++;
        } catch (err) {
          result.errors.push(
            `Failed review ${review.reviewUuid} (crew ${empNo}): ` +
              (err instanceof Error ? err.message : String(err)),
          );
        }
      }
    }

    console.log(
      `[promotion-backfill] ${dryRun ? "DRY-RUN" : "LIVE"} — ` +
        `${result.applied}/${result.eligible} ${dryRun ? "would be" : ""} applied, ` +
        `${result.alreadyApplied} already applied, ${result.ineligible} ineligible, ` +
        `${result.errors.length} error(s).`,
    );

    return result;
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

    const effectivePromotionTiming = coreFields.promotionTiming;
    coreFields.selectedPosition =
      String(effectivePromotionTiming || "").trim().toLowerCase() === "on-board"
        ? (coreFields.selectedPosition?.trim() || null)
        : null;

    const onboardContext = await this.assertPromotionGuards({
      crewMemberId: coreFields.crewMemberId,
      promotionToRank: coreFields.promotionToRank,
      selectedPosition: coreFields.selectedPosition,
      promotionDate: coreFields.promotionDate,
      promotionTiming: coreFields.promotionTiming,
      incomingStatus: coreFields.status,
      existingStatus: null,
      reviewUuid: null,
    });

    const persistReview = async (
      executionContext: OnboardPromotionExecutionContext | null,
    ) => {
      // First submission can happen directly via POST (new review submitted for
      // approval). Snapshot the lock flag so later admin toggles don't change it.
      if (coreFields.status === "submitted") {
        coreFields.isLockForm = await this.resolvePromotionLockFlag();
      }

      // Pins are server-resolved only. Draft and In Progress reviews remain
      // unpinned; every submitted-or-later review must get a complete pair.
      delete coreFields.formVersionId;
      delete coreFields.formVersionUuid;
      const pin = await this.resolvePromotionPinForSubmittedStatus({
        status: coreFields.status,
        promotionToRank: coreFields.promotionToRank,
        formVersionId: null,
        formVersionUuid: null,
      });
      if (pin) {
        coreFields.formVersionId = pin.formVersionId;
        coreFields.formVersionUuid = pin.formVersionUuid;
      }

      const review = await reviewsRepo.create(coreFields);

      await this.saveChildData(review.reviewUuid, {
        criteriaVerifiedStatus, criteriaMeetsStatus, cesTestsData, criteriaComments,
        trainingNeeds, approvalData, selectedApproversForSubmission, checklistProgressData,
        b2VesselTypes, b2FleetGroups,
      }, coreFields.updatedByUuid ?? null);

      await this.runCompletionHook(
        review,
        coreFields.updatedByUuid ?? null,
        executionContext,
      );

      return this.getReviewByUuid(review.reviewUuid);
    };

    if (onboardContext) {
      return this.withOnboardPositionLock(onboardContext, async () => {
        const lockedContext = await this.resolveOnboardPromotionContext({
          crewMemberId: coreFields.crewMemberId,
          promotionToRank: coreFields.promotionToRank,
          selectedPosition: coreFields.selectedPosition,
        });
        return persistReview(lockedContext);
      });
    }

    return persistReview(null);
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
    const selectedPositionWasProvided =
      Object.prototype.hasOwnProperty.call(coreFields, "selectedPosition");
    const effectivePromotionTiming =
      coreFields.promotionTiming ?? existing?.promotionTiming ?? null;
    if (
      String(effectivePromotionTiming || "").trim().toLowerCase() !==
      "on-board"
    ) {
      coreFields.selectedPosition = null;
    } else if (selectedPositionWasProvided) {
      coreFields.selectedPosition =
        coreFields.selectedPosition?.trim() || null;
    } else {
      delete coreFields.selectedPosition;
    }

    const isAlreadyCompleted =
      statusRank(existing?.status) >= statusRank("completed");
    if (isAlreadyCompleted) {
      const immutableFieldChanged =
        (
          data.promotionToRank !== undefined &&
          data.promotionToRank !== existing?.promotionToRank
        ) ||
        (
          data.promotionTiming !== undefined &&
          data.promotionTiming !== existing?.promotionTiming
        ) ||
        (
          data.promotionDate !== undefined &&
          data.promotionDate !== existing?.promotionDate
        ) ||
        (
          data.selectedPosition !== undefined &&
          data.selectedPosition !== existing?.selectedPosition
        );
      if (immutableFieldChanged) {
        throw new PromotionGuardError(
          "Completed promotion execution details cannot be changed.",
        );
      }
    }

    if (
      statusRank(existing?.status) >= statusRank("approved") &&
      data.promotionTiming !== undefined &&
      data.promotionTiming !== existing?.promotionTiming
    ) {
      throw new PromotionGuardError(
        "Promotion Type cannot be changed after Part B has been submitted.",
      );
    }

    // Idempotency / no regression: never move a review backwards through the
    // workflow. Re-saving a review that is already at (or past) the requested
    // status simply drops the status change so the transition has no effect.
    if (coreFields.status !== undefined && statusRank(coreFields.status) < statusRank(existingStatusRaw)) {
      delete coreFields.status;
    }

    const effectiveSelectedPosition = selectedPositionWasProvided
      ? coreFields.selectedPosition
      : existing?.selectedPosition ?? null;
    const onboardContext = await this.assertPromotionGuards({
      crewMemberId: coreFields.crewMemberId ?? existing?.crewMemberId ?? null,
      promotionToRank: coreFields.promotionToRank ?? existing?.promotionToRank ?? null,
      selectedPosition: effectiveSelectedPosition,
      promotionDate: coreFields.promotionDate,
      promotionTiming: coreFields.promotionTiming ?? existing?.promotionTiming ?? null,
      incomingStatus: coreFields.status,
      existingStatus: existingStatusRaw,
      reviewUuid,
    });

    const persistReview = async (
      executionContext: OnboardPromotionExecutionContext | null,
    ) => {
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

      // Pins are taken at the first submitted-or-later write and are never
      // trusted from the client. A legacy final-state review with no pin is
      // resolved now or rejected before the update can persist.
      delete coreFields.formVersionId;
      delete coreFields.formVersionUuid;
      const effectiveStatus = coreFields.status ?? existingStatusRaw;
      const pin = await this.resolvePromotionPinForSubmittedStatus({
        status: effectiveStatus,
        promotionToRank: coreFields.promotionToRank ?? existing?.promotionToRank ?? null,
        formVersionId: existing?.formVersionId,
        formVersionUuid: existing?.formVersionUuid,
      });
      if (pin) {
        coreFields.formVersionId = pin.formVersionId;
        coreFields.formVersionUuid = pin.formVersionUuid;
      }

      const review = await reviewsRepo.update(reviewUuid, coreFields);
      if (!review) return null;

      await this.saveChildData(reviewUuid, {
        criteriaVerifiedStatus, criteriaMeetsStatus, cesTestsData, criteriaComments,
        trainingNeeds, approvalData, selectedApproversForSubmission, checklistProgressData,
        b2VesselTypes, b2FleetGroups,
      }, coreFields.updatedByUuid ?? null);

      await this.runCompletionHook(
        review,
        coreFields.updatedByUuid ?? null,
        executionContext,
      );

      return this.getReviewByUuid(reviewUuid);
    };

    if (onboardContext) {
      return this.withOnboardPositionLock(onboardContext, async () => {
        const lockedContext = await this.resolveOnboardPromotionContext({
          crewMemberId: coreFields.crewMemberId ?? existing?.crewMemberId ?? "",
          promotionToRank: coreFields.promotionToRank ?? existing?.promotionToRank ?? "",
          selectedPosition: effectiveSelectedPosition,
        });
        return persistReview(lockedContext);
      });
    }

    return persistReview(null);
  }

  async deleteReview(reviewUuid: string): Promise<boolean> {
    return reviewsRepo.softDelete(reviewUuid);
  }

  private async saveChildData(reviewUuid: string, data: any, auditUserUuid: string | null = null) {
    const tasks: Promise<any>[] = [];

    if (data.criteriaVerifiedStatus !== undefined || data.criteriaMeetsStatus !== undefined) {
      const verified = this.parseJson(data.criteriaVerifiedStatus, {});
      const meets = this.parseJson(data.criteriaMeetsStatus, {});
      const allCodes = new Set([...Object.keys(verified), ...Object.keys(meets)]);
      for (const code of allCodes) {
        tasks.push(criteriaStatusRepo.upsert(reviewUuid, code, {
          verifiedStatus: verified[code] ?? null,
          meetsStatus: meets[code] ?? null,
        }, auditUserUuid));
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
      })), auditUserUuid));
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
      tasks.push(criteriaCommentsRepo.replaceForReview(reviewUuid, criteriaCommentRows, auditUserUuid));
      tasks.push(trainingCommentsRepo.replaceForReview(reviewUuid, trainingCommentRows, auditUserUuid));
    }

    if (data.trainingNeeds !== undefined) {
      const needs = this.parseJson(data.trainingNeeds, []);
      tasks.push(trainingNeedsRepo.replaceForReview(reviewUuid, needs.map((n: any) => ({
        trainingRowId: n.id || null,
        training: n.training || null,
        correspondingInDb: n.correspondingInDB || n.correspondingInDb || null,
        identifiedByUuid: n.identifiedByUuid || null,
        category: n.category || null,
        status: n.status || null,
        completionDate: n.completionDate || n.completion_date || null,
      })), auditUserUuid));
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
      tasks.push(approvalsRepo.replaceForReview(reviewUuid, approvalRows, auditUserUuid));
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
              deprecatedAttachmentsData: null, // attachments persist in promo_checklist_attachments_v2; never re-serialize into the deprecated JSON column
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

      const saveChecklistProgressAndAttachments = async () => {
        const savedProgress = await checklistProgressRepo.replaceForReview(reviewUuid, items, auditUserUuid);
        
        if (progressObj.sections && Array.isArray(progressObj.sections)) {
          const db = getDb();

          // Resolve the crew folder (employee number) once for this review so new
          // attachment files are grouped under promotion/{empNo}/. crew_member_id
          // on the review IS the employee number; fall back to the review UUID.
          const reviewRows = await db
            .select({ crewMemberId: promotionReviewsV2.crewMemberId })
            .from(promotionReviewsV2)
            .where(eq(promotionReviewsV2.reviewUuid, reviewUuid))
            .limit(1);
          const promotionCrewFolder =
            (reviewRows[0]?.crewMemberId || "").toString().trim() || reviewUuid;

          for (const section of progressObj.sections) {
            if (!section.assessmentPoints || !Array.isArray(section.assessmentPoints)) continue;
            for (const point of section.assessmentPoints) {
              const matchedProgress = savedProgress.find(
                (p) => p.sectionId === section.id && p.assessmentPointId === point.id
              );
              if (!matchedProgress) continue;
              
              const cpUuid = matchedProgress.cpUuid;
              const attachments = point.attachments || [];
              
              // Get existing files in DB
              const dbAttachments = await db
                .select()
                .from(promoChecklistAttachmentsV2)
                .where(
                  and(
                    eq(promoChecklistAttachmentsV2.checklistProgressUuid, cpUuid),
                    eq(promoChecklistAttachmentsV2.isDeleted, false)
                  )
                );
              
              const existingByUuid = new Map<string, any>(
                dbAttachments.map((da: any) => [da.attUuid, da])
              );
              const keepUuids: string[] = [];
              
              for (const att of attachments) {
                if (att.isDeleted) continue;
                
                const candidateUuid = att.attUuid || att.id;
                
                // Already persisted (matched by id/attUuid, or carrying a server file path) -> keep, never re-insert
                if ((candidateUuid && existingByUuid.has(candidateUuid)) || att.filePath) {
                  if (candidateUuid) keepUuids.push(candidateUuid);
                  continue;
                }
                
                // Genuinely new attachment with base64 data -> persist to disk + table (conflict-safe)
                if (att.data) {
                  const decoded = decodeStoredFile(att.data, att.type);
                  if (decoded) {
                    const { buffer, mime } = decoded;
                    const cleanName = att.fileName || att.name || "attachment";
                    
                    const filePath = await fileStorageService.writeAttachment(
                      `promotions/${promotionCrewFolder}`,
                      cleanName,
                      buffer
                    );
                    
                    const attUuid = candidateUuid || uuidv4();
                    
                    await db.insert(promoChecklistAttachmentsV2).values({
                      attUuid,
                      checklistProgressUuid: cpUuid,
                      fileName: cleanName,
                      filePath,
                      fileSize: att.fileSize?.toString() || att.size?.toString() || buffer.length.toString(),
                      fileType: att.fileType || att.type || mime,
                      createdByUuid: auditUserUuid,
                      updatedByUuid: auditUserUuid,
                    }).onConflictDoNothing();
                    
                    keepUuids.push(attUuid);
                  }
                }
              }
              
              // Soft delete removed attachments
              const toDelete = dbAttachments.filter((da: any) => !keepUuids.includes(da.attUuid));
              if (toDelete.length > 0) {
                await db
                  .update(promoChecklistAttachmentsV2)
                  .set({ isDeleted: true, updatedAt: new Date(), updatedByUuid: auditUserUuid })
                  .where(
                    inArray(
                      promoChecklistAttachmentsV2.attUuid,
                      toDelete.map((da: any) => da.attUuid)
                    )
                  );
              }
            }
          }
        }
      };

      tasks.push(saveChecklistProgressAndAttachments());
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
      tasks.push(suitabilityRepo.upsertForReview(reviewUuid, { vesselTypes, fleetGroups }, auditUserUuid));
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
