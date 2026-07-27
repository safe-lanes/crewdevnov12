import {
  AppraisalResultsRepository,
  ApprTrainingsRepository,
  ApprTargetsRepository,
  ApprCompetenceAssessmentsRepository,
  ApprBehaviouralAssessmentsRepository,
  ApprTrainingNeedsRepository,
  ApprRecommendationsRepository,
  ApprAppraiserCommentsRepository,
  ApprSeafarerCommentsRepository,
  ApprOfficeReviewsRepository,
  ApprTrainingFollowupsRepository,
  ApprReviewersRepository,
} from "../repositories";
import { CrewMembersRepository } from "../../crew-pool/repositories";
import { assembleV1Response } from "../utils/responseAssembler";
import { applyAuditUser } from "../../admin/utils/auditUser";
import { formsService } from "../../admin/services";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../db";
import { masterUsers } from "../../../../shared/schema";
import { eq } from "drizzle-orm";
import { sendEmail, logEmailEvent } from "../../shared/emailService";
import { buildAppraisalReviewEmail } from "../templates/appraisalReviewNotificationTemplate";

const appraisalResultsRepo = new AppraisalResultsRepository();
const trainingsRepo = new ApprTrainingsRepository();
const targetsRepo = new ApprTargetsRepository();
const competenceAssessmentsRepo = new ApprCompetenceAssessmentsRepository();
const behaviouralAssessmentsRepo = new ApprBehaviouralAssessmentsRepository();
const trainingNeedsRepo = new ApprTrainingNeedsRepository();
const recommendationsRepo = new ApprRecommendationsRepository();
const appraiserCommentsRepo = new ApprAppraiserCommentsRepository();
const seafarerCommentsRepo = new ApprSeafarerCommentsRepository();
const officeReviewsRepo = new ApprOfficeReviewsRepository();
const trainingFollowupsRepo = new ApprTrainingFollowupsRepository();
const reviewersRepo = new ApprReviewersRepository();
const crewMembersRepo = new CrewMembersRepository();

async function fetchChildDataForUuids(appraisalUuids: string[]) {
  if (appraisalUuids.length === 0) {
    return {
      trainings: new Map(), targets: new Map(),
      competenceAssessments: new Map(), behaviouralAssessments: new Map(),
      trainingNeeds: new Map(), recommendations: new Map(),
      appraiserComments: new Map(), seafarerComments: new Map(),
      officeReviews: new Map(), trainingFollowups: new Map(),
      reviewers: new Map(),
    };
  }
  const [trainings, targets, competenceAssessments, behaviouralAssessments,
         trainingNeeds, recommendations, appraiserComments, seafarerComments,
         officeReviews, trainingFollowups, reviewers] = await Promise.all([
    trainingsRepo.findByAppraisalUuids(appraisalUuids),
    targetsRepo.findByAppraisalUuids(appraisalUuids),
    competenceAssessmentsRepo.findByAppraisalUuids(appraisalUuids),
    behaviouralAssessmentsRepo.findByAppraisalUuids(appraisalUuids),
    trainingNeedsRepo.findByAppraisalUuids(appraisalUuids),
    recommendationsRepo.findByAppraisalUuids(appraisalUuids),
    appraiserCommentsRepo.findByAppraisalUuids(appraisalUuids),
    seafarerCommentsRepo.findByAppraisalUuids(appraisalUuids),
    officeReviewsRepo.findByAppraisalUuids(appraisalUuids),
    trainingFollowupsRepo.findByAppraisalUuids(appraisalUuids),
    reviewersRepo.findByAppraisalUuids(appraisalUuids),
  ]);
  return { trainings, targets, competenceAssessments, behaviouralAssessments,
           trainingNeeds, recommendations, appraiserComments, seafarerComments,
           officeReviews, trainingFollowups, reviewers };
}

function assembleOne(appraisal: any, childData: any) {
  const uuid = appraisal.appraisalUuid;
  return assembleV1Response(
    appraisal,
    childData.trainings.get(uuid) || [],
    childData.targets.get(uuid) || [],
    childData.competenceAssessments.get(uuid) || [],
    childData.behaviouralAssessments.get(uuid) || [],
    childData.trainingNeeds.get(uuid) || [],
    childData.recommendations.get(uuid) || [],
    childData.appraiserComments.get(uuid) || [],
    childData.seafarerComments.get(uuid) || [],
    childData.officeReviews.get(uuid) || [],
    childData.trainingFollowups.get(uuid) || [],
    childData.reviewers.get(uuid) || [],
  );
}

/**
 * Fire-and-forget helper: looks up each reviewer's email from masterUsers
 * and sends them an appraisal review assignment notification.
 */
async function triggerAppraisalReviewNotification(
  reviewers: { userUuid?: string; reviewerName?: string; designation?: string }[],
  seafarerName: string,
  rank: string,
  appraisalUuid: string,
): Promise<void> {
  const origin = process.env.VITE_API_CREWING_URL;
  if (!origin) {
    logEmailEvent('WARN', '[Appraisals V2] VITE_API_CREWING_URL not set — appraisal link will be omitted from email body.');
  }
  const appraisalLink = origin ? `${origin}/crewing?appraisal=${appraisalUuid}` : '';
  const db = getDb();

  for (const reviewer of reviewers) {
    if (!reviewer.userUuid) continue;
    try {
      const userRows = await db
        .select({ email: masterUsers.email, fullname: masterUsers.fullname })
        .from(masterUsers)
        .where(eq(masterUsers.userUuid, reviewer.userUuid))
        .limit(1);
      const user = userRows[0];
      if (!user?.email) {
        logEmailEvent('WARN', `[Appraisals V2] No email for reviewer UUID ${reviewer.userUuid}`);
        continue;
      }
      const emailData = buildAppraisalReviewEmail({
        reviewerName: reviewer.reviewerName || user.fullname || 'Reviewer',
        seafarerName,
        rank,
        appraisalLink,
      });
      logEmailEvent('INFO', `[Appraisals V2] Sending review assignment email to ${user.email}`);
      sendEmail([user.email], emailData.subject, emailData.html);
    } catch (err: any) {
      logEmailEvent('ERROR', `[Appraisals V2] Failed to send email to reviewer ${reviewer.userUuid}:`, err?.message || err);
    }
  }
}

export class AppraisalResultsService {
  async getAll() {
    const appraisals = await appraisalResultsRepo.findAll();
    if (appraisals.length === 0) return [];
    const uuids = appraisals.map(a => a.appraisalUuid);
    const childData = await fetchChildDataForUuids(uuids);
    return appraisals.map(a => assembleOne(a, childData));
  }

  async getById(id: number) {
    const appraisal = await appraisalResultsRepo.findById(id);
    if (!appraisal) return null;
    const childData = await fetchChildDataForUuids([appraisal.appraisalUuid]);
    return assembleOne(appraisal, childData);
  }

  async getByCrewMember(crewMemberId: string) {
    const appraisals = await appraisalResultsRepo.findByCrewMemberId(crewMemberId);
    if (appraisals.length === 0) return [];
    const uuids = appraisals.map(a => a.appraisalUuid);
    const childData = await fetchChildDataForUuids(uuids);
    return appraisals.map(a => assembleOne(a, childData));
  }

  async getPromotionRecommendations(crewMemberId: string, rank: string) {
    // Promotion and Appraisal modules historically disagree on what
    // crew_member_id means: Promotion stores the crew's emp_no (e.g. "A100084"),
    // while Appraisal stores the crew_uuid in most cases (and sometimes the
    // emp_no in older rows). Resolve the incoming identifier to the full set
    // of values an appraisal row might use for this crew, then look up
    // appraisals matching any of them.
    const candidateIds = new Set<string>();
    if (crewMemberId) candidateIds.add(crewMemberId);

    // Try to resolve the crew member. The incoming value is usually an emp_no
    // (from the Promotion form) but could also be a crew_uuid or numeric id.
    // Repo errors are intentionally allowed to propagate so real DB issues
    // surface as 5xx rather than silently undercounting.
    let crew = await crewMembersRepo.findByEmpNo(crewMemberId);
    if (!crew) {
      crew = await crewMembersRepo.findByUuid(crewMemberId);
    }
    if (!crew) {
      const numericId = Number(crewMemberId);
      if (Number.isFinite(numericId) && numericId > 0) {
        crew = await crewMembersRepo.findById(numericId);
      }
    }
    if (crew) {
      if (crew.empNo) candidateIds.add(crew.empNo);
      if (crew.crewUuid) candidateIds.add(crew.crewUuid);
      if (crew.id != null) candidateIds.add(String(crew.id));
    }

    const appraisals = await appraisalResultsRepo.findByCrewMemberIds(
      Array.from(candidateIds),
    );

    // Per spec, count is by crewId across all the crew's appraisal forms.
    // Rank is no longer used to filter — it is accepted only for backward
    // compatibility and echoed back in the response.
    // Only count appraisals whose work is at least preliminary — draft
    // appraisals are explicitly excluded (confirmed business rule).
    // `pending_review` (stage 2 submitted, awaiting office review) counts as eligible.
    const ELIGIBLE_STATUSES = new Set(["preliminary", "submitted", "pending_review", "stage2_submitted", "reviewed", "stage3_submitted"]);

    const eligibleUuids: string[] = [];
    const seen = new Set<string>();
    for (const appraisal of appraisals) {
      const statusLower = (appraisal.status || "").toLowerCase();
      if (!ELIGIBLE_STATUSES.has(statusLower)) continue;
      const uuid = appraisal.appraisalUuid;
      if (!uuid || seen.has(uuid)) continue;
      seen.add(uuid);
      eligibleUuids.push(uuid);
    }

    if (eligibleUuids.length === 0) {
      return { count: 0, rank, crewMemberId };
    }

    // Batched fetch — one query for all eligible appraisals rather than N.
    const recsByUuid = await recommendationsRepo.findByAppraisalUuids(eligibleUuids);

    let count = 0;
    for (const uuid of eligibleUuids) {
      const recs = recsByUuid.get(uuid) || [];
      const promotionRec = recs.find(
        (r: any) => r.question?.toLowerCase().includes("recommended for promotion")
      );
      if (promotionRec && (promotionRec.answer || "").toLowerCase() === "yes") {
        count++;
      }
    }

    return { count, rank, crewMemberId };
  }

  async create(body: any) {
    const auditData = applyAuditUser(body, true);
    const appraisalData = typeof auditData.appraisalData === "object"
      ? auditData.appraisalData
      : JSON.parse(auditData.appraisalData || "{}");

    const appraisalUuid = uuidv4();

    // Pin the appraisal to the latest released form version for the seafarer's
    // rank at creation time so later releases don't re-skin saved appraisals.
    let formVersionId: number | null = null;
    let formVersionUuid: string | null = null;
    const seafarersRank: string | undefined = appraisalData?.seafarersRank;
    if (seafarersRank) {
      try {
        const formForRank = await formsService.getFormForRank(seafarersRank, "appraisal");
        if (formForRank && !formForRank.noReleasedVersion) {
          formVersionId = formForRank.formVersionId ?? null;
          formVersionUuid = formForRank.formVersionUuid ?? null;
        }
      } catch (e) {
        console.warn(`[Appraisals V2] Failed to resolve form version for rank "${seafarersRank}":`, e);
      }
    }

    const created = await appraisalResultsRepo.createWithUuid({
      appraisalUuid,
      crewMemberId: auditData.crewMemberId,
      formUuid: auditData.formId?.toString() || null,
      formIdLegacy: typeof auditData.formId === "number" ? auditData.formId : (parseInt(auditData.formId) || null),
      formVersionId,
      formVersionUuid,
      appraisalType: auditData.appraisalType || "",
      appraisalDate: auditData.appraisalDate || new Date().toISOString(),
      seafarersName: appraisalData.seafarersName || null,
      seafarersRank: appraisalData.seafarersRank || null,
      nationality: appraisalData.nationality || null,
      vessel: appraisalData.vessel || null,
      signOn: appraisalData.signOn || null,
      appraisalPeriodFrom: appraisalData.appraisalPeriodFrom || null,
      appraisalPeriodTo: appraisalData.appraisalPeriodTo || null,
      personalityIndexCategory: appraisalData.personalityIndexCategory || null,
      primaryAppraiser: appraisalData.primaryAppraiser || null,
      competenceRating: auditData.competenceRating || null,
      behavioralRating: auditData.behavioralRating || null,
      overallRating: auditData.overallRating || null,
      submittedBy: auditData.submittedBy || "Unknown",
      status: auditData.status || "draft",
      createdByUuid: auditData.createdByUuid || null,
      updatedByUuid: auditData.updatedByUuid || null,
    });

    const auditUserUuid = auditData.createdByUuid || null;
    await Promise.all([
      trainingsRepo.syncForAppraisal(appraisalUuid, appraisalData.trainings || [], auditUserUuid),
      targetsRepo.syncForAppraisal(appraisalUuid, appraisalData.targets || [], auditUserUuid),
      competenceAssessmentsRepo.syncForAppraisal(appraisalUuid, appraisalData.competenceAssessments || [], auditUserUuid),
      behaviouralAssessmentsRepo.syncForAppraisal(appraisalUuid, appraisalData.competenceAssessments ? appraisalData.behaviouralAssessments || [] : [], auditUserUuid),
      trainingNeedsRepo.syncForAppraisal(appraisalUuid, appraisalData.trainingNeeds || [], auditUserUuid),
      recommendationsRepo.syncForAppraisal(appraisalUuid, appraisalData.recommendations || [], auditUserUuid),
      appraiserCommentsRepo.syncForAppraisal(appraisalUuid, appraisalData.appraiserComments || [], auditUserUuid),
      seafarerCommentsRepo.syncForAppraisal(appraisalUuid, appraisalData.seafarerComments || [], auditUserUuid),
      officeReviewsRepo.syncForAppraisal(appraisalUuid, appraisalData.officeReviews || [], auditUserUuid),
      trainingFollowupsRepo.syncForAppraisal(appraisalUuid, appraisalData.trainingFollowups || [], auditUserUuid),
    ]);

    return this.getById(created.id);
  }

  async update(id: number, body: any) {
    const existing = await appraisalResultsRepo.findById(id);
    if (!existing) return null;

    const auditData = applyAuditUser(body);
    const appraisalData = auditData.appraisalData
      ? (typeof auditData.appraisalData === "object"
        ? auditData.appraisalData
        : JSON.parse(auditData.appraisalData || "{}"))
      : null;

    if (appraisalData?.competenceAssessments) {
      console.log('[DEBUG] competence comments in PUT payload:', appraisalData.competenceAssessments.map((c: any) => ({ id: c.id, comment: c.comment })));
    }
    if (appraisalData?.behaviouralAssessments) {
      console.log('[DEBUG] behavioural comments in PUT payload:', appraisalData.behaviouralAssessments.map((b: any) => ({ id: b.id, comment: b.comment })));
    }

    const updateFields: any = {};
    if (auditData.crewMemberId !== undefined) updateFields.crewMemberId = auditData.crewMemberId;
    if (auditData.formId !== undefined) {
      updateFields.formUuid = auditData.formId?.toString() || null;
      updateFields.formIdLegacy = typeof auditData.formId === "number" ? auditData.formId : (parseInt(auditData.formId) || null);
    }
    if (auditData.appraisalType !== undefined) updateFields.appraisalType = auditData.appraisalType;
    if (auditData.appraisalDate !== undefined) updateFields.appraisalDate = auditData.appraisalDate;
    if (auditData.competenceRating !== undefined) updateFields.competenceRating = auditData.competenceRating;
    if (auditData.behavioralRating !== undefined) updateFields.behavioralRating = auditData.behavioralRating;
    if (auditData.overallRating !== undefined) updateFields.overallRating = auditData.overallRating;
    if (auditData.submittedBy !== undefined) updateFields.submittedBy = auditData.submittedBy;
    if (auditData.status !== undefined) updateFields.status = auditData.status;
    if (auditData.updatedByUuid) updateFields.updatedByUuid = auditData.updatedByUuid;

    if (appraisalData) {
      updateFields.seafarersName = appraisalData.seafarersName || null;
      updateFields.seafarersRank = appraisalData.seafarersRank || null;
      updateFields.nationality = appraisalData.nationality || null;
      updateFields.vessel = appraisalData.vessel || null;
      updateFields.signOn = appraisalData.signOn || null;
      updateFields.appraisalPeriodFrom = appraisalData.appraisalPeriodFrom || null;
      updateFields.appraisalPeriodTo = appraisalData.appraisalPeriodTo || null;
      updateFields.personalityIndexCategory = appraisalData.personalityIndexCategory || null;
      updateFields.primaryAppraiser = appraisalData.primaryAppraiser || null;
    }

    await appraisalResultsRepo.updateById(id, updateFields);

    if (appraisalData) {
      const auditUserUuid = auditData.updatedByUuid || null;
      await Promise.all([
        trainingsRepo.syncForAppraisal(existing.appraisalUuid, appraisalData.trainings || [], auditUserUuid),
        targetsRepo.syncForAppraisal(existing.appraisalUuid, appraisalData.targets || [], auditUserUuid),
        competenceAssessmentsRepo.syncForAppraisal(existing.appraisalUuid, appraisalData.competenceAssessments || [], auditUserUuid),
        behaviouralAssessmentsRepo.syncForAppraisal(existing.appraisalUuid, appraisalData.behaviouralAssessments || [], auditUserUuid),
        trainingNeedsRepo.syncForAppraisal(existing.appraisalUuid, appraisalData.trainingNeeds || [], auditUserUuid),
        recommendationsRepo.syncForAppraisal(existing.appraisalUuid, appraisalData.recommendations || [], auditUserUuid),
        appraiserCommentsRepo.syncForAppraisal(existing.appraisalUuid, appraisalData.appraiserComments || [], auditUserUuid),
        seafarerCommentsRepo.syncForAppraisal(existing.appraisalUuid, appraisalData.seafarerComments || [], auditUserUuid),
        officeReviewsRepo.syncForAppraisal(existing.appraisalUuid, appraisalData.officeReviews || [], auditUserUuid),
        trainingFollowupsRepo.syncForAppraisal(existing.appraisalUuid, appraisalData.trainingFollowups || [], auditUserUuid),
      ]);
    }

    return this.getById(id);
  }

  async delete(id: number) {
    return appraisalResultsRepo.softDeleteById(id);
  }

  async submitStage(
    id: number,
    stage: "stage1" | "stage2" | "stage3",
    data: any,
    submittedBy: string,
    extra?: { competenceRating?: string | null; behavioralRating?: string | null; overallRating?: string | null },
  ) {
    const auditUserUuid = (data as any)?.auditUserUuid ?? null;

    const appraisal = await appraisalResultsRepo.findById(id);
    if (!appraisal) return null;

    if (stage === "stage2" && !appraisal.stage1Status) {
      throw new Error("Stage 1 must be submitted before Stage 2");
    }
    if (stage === "stage3" && !appraisal.stage2Status) {
      throw new Error("Stage 2 must be submitted before Stage 3");
    }
    // Task #500: Stage 3 requires every B1 training row to carry a non-empty
    // Evaluation. We enforce this server-side as defense-in-depth. We prefer
    // validating the incoming payload (which carries any post-Stage-2 B1
    // Evaluation edits) and fall back to the persisted rows if the client
    // omits `trainings` (legacy callers).
    if (stage === "stage3") {
      const incoming = Array.isArray((data as any)?.trainings) ? (data as any).trainings as any[] : null;
      const source = incoming
        ?? ((await trainingsRepo.findByAppraisalUuids([appraisal.appraisalUuid])).get(appraisal.appraisalUuid) || []);
      const missing = source.findIndex((t: any) => !((t?.evaluation ?? "").toString().trim()));
      if (missing !== -1) {
        throw new Error(
          `B1 Evaluation required for every training row before Stage 3 submission (row ${missing + 1} is missing).`,
        );
      }
    }

    // Forward-only status progression: draft < preliminary < submitted < reviewed.
    // A stage submission may advance the status to its nominal value but must
    // never regress an appraisal that is already further along (e.g. resubmitting
    // Stage 1 on a Submitted/Reviewed appraisal must not revert it to Preliminary).
    // Task #500: accept new status synonyms `stage2_submitted` and
    // `stage3_submitted` as equivalents of `submitted`/`reviewed` so existing
    // consumers (UI status checks, role-based filtering) keep working without
    // a coordinated rewrite. Server still emits the canonical short names.
    const STATUS_ORDER: Record<string, number> = {
      draft: 0,
      preliminary: 1,
      submitted: 2,
      stage2_submitted: 2,
      pending_review: 2,
      reviewed: 3,
      stage3_submitted: 3,
    };
    const normalize = (s: string | null | undefined) =>
      (s ?? "").trim().toLowerCase();
    const rank = (s: string | null | undefined) => {
      const key = normalize(s);
      return key in STATUS_ORDER ? STATUS_ORDER[key] : -1;
    };
    // Stage 2 now advances to `pending_review` (awaiting office review)
    // rather than `submitted`, so the form locks and reviewers get notified.
    const nominalForStage =
      stage === "stage1" ? "preliminary"
      : stage === "stage2" ? "pending_review"
      : "reviewed";
    const currentNormalized = normalize(appraisal.status);
    const newStatus = rank(nominalForStage) >= rank(currentNormalized)
      ? nominalForStage
      : (currentNormalized in STATUS_ORDER ? currentNormalized : nominalForStage);

    const stageUpdate: any = {
      status: newStatus,
      submittedBy,
      submittedAt: new Date(),
      updatedByUuid: auditUserUuid,
    };

    if (stage === "stage1") {
      stageUpdate.stage1Status = "completed";
      stageUpdate.stage1SubmittedAt = new Date().toISOString();
      stageUpdate.stage1SubmittedBy = submittedBy;
      stageUpdate.seafarersName = data.seafarersName;
      stageUpdate.seafarersRank = data.seafarersRank;
      stageUpdate.nationality = data.nationality;
      stageUpdate.vessel = data.vessel;
      stageUpdate.signOn = data.signOn;
      stageUpdate.appraisalPeriodFrom = data.appraisalPeriodFrom;
      stageUpdate.appraisalPeriodTo = data.appraisalPeriodTo;
      stageUpdate.personalityIndexCategory = data.personalityIndexCategory;
      stageUpdate.primaryAppraiser = data.primaryAppraiser;
      if (data.appraisalType) stageUpdate.appraisalType = data.appraisalType;
    } else if (stage === "stage2") {
      stageUpdate.stage2Status = "completed";
      stageUpdate.stage2SubmittedAt = new Date().toISOString();
      stageUpdate.stage2SubmittedBy = submittedBy;
      // Persist calculated scores so the Crew Appraisals table reflects the
      // Overall score immediately after Stage 2 submission (no reopen/save-draft needed).
      if (extra) {
        if (extra.competenceRating !== undefined) stageUpdate.competenceRating = extra.competenceRating;
        if (extra.behavioralRating !== undefined) stageUpdate.behavioralRating = extra.behavioralRating;
        if (extra.overallRating !== undefined) stageUpdate.overallRating = extra.overallRating;
      }
      // Task #500: snapshot the form's current lock-form flag onto this
      // appraisal so admin-side toggles after Stage 2 do not retroactively
      // unlock (or lock) already-submitted appraisals.
      try {
        const rank = (appraisal as any).seafarersRank as string | null | undefined;
        if (rank) {
          const formForRank = await formsService.getFormForRank(rank, "appraisal");
          stageUpdate.isLockForm = !!(formForRank as any)?.isLockForm;
        }
      } catch (e) {
        console.warn("[Appraisals V2] Failed to resolve isLockForm for stage2 snapshot:", e);
      }
    } else if (stage === "stage3") {
      stageUpdate.stage3Status = "completed";
      stageUpdate.stage3SubmittedAt = new Date().toISOString();
      stageUpdate.stage3SubmittedBy = submittedBy;
    }

    await appraisalResultsRepo.updateByAppraisalUuid(appraisal.appraisalUuid, stageUpdate);

    if (stage === "stage1") {
      await Promise.all([
        trainingsRepo.syncForAppraisal(appraisal.appraisalUuid, data.trainings || [], auditUserUuid),
        targetsRepo.syncForAppraisal(appraisal.appraisalUuid, data.targets || [], auditUserUuid),
      ]);
    } else if (stage === "stage2") {
      // Task #500: persist the current B1 trainings (and targets) snapshot
      // alongside the Stage-2 C-F writes. Only sync them when the payload
      // includes them so legacy callers that omit `trainings`/`targets`
      // leave existing persisted rows untouched.
      const reviewerList: { userUuid?: string; reviewerName?: string; designation?: string }[] =
        Array.isArray((data as any)?.reviewers) ? (data as any).reviewers : [];

      const stage2Writes: Promise<unknown>[] = [
        competenceAssessmentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.competenceAssessments || [], auditUserUuid),
        behaviouralAssessmentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.behaviouralAssessments || [], auditUserUuid),
        trainingNeedsRepo.syncForAppraisal(appraisal.appraisalUuid, data.trainingNeeds || [], auditUserUuid),
        recommendationsRepo.syncForAppraisal(appraisal.appraisalUuid, data.recommendations || [], auditUserUuid),
        appraiserCommentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.appraiserComments || [], auditUserUuid),
        seafarerCommentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.seafarerComments || [], auditUserUuid),
        reviewersRepo.syncForAppraisal(appraisal.appraisalUuid, reviewerList, auditUserUuid),
      ];
      if (Array.isArray((data as any)?.trainings)) {
        stage2Writes.push(trainingsRepo.syncForAppraisal(appraisal.appraisalUuid, (data as any).trainings, auditUserUuid));
      }
      if (Array.isArray((data as any)?.targets)) {
        stage2Writes.push(targetsRepo.syncForAppraisal(appraisal.appraisalUuid, (data as any).targets, auditUserUuid));
      }
      await Promise.all(stage2Writes);

      // Send review assignment notification emails to each assigned reviewer
      if (reviewerList.length > 0) {
        triggerAppraisalReviewNotification(
          reviewerList,
          appraisal.seafarersName || 'Seafarer',
          appraisal.seafarersRank || 'N/A',
          appraisal.appraisalUuid,
        ).catch((e) => logEmailEvent('ERROR', '[Appraisals V2] Review notification error:', e?.message || e));
      }
    } else if (stage === "stage3") {
      // Task #500: persist any post-Stage-2 B1 Evaluation edits alongside
      // Section G. If the client omits `trainings` we leave the existing
      // persisted rows untouched.
      const stage3Writes: Promise<unknown>[] = [
        officeReviewsRepo.syncForAppraisal(appraisal.appraisalUuid, data.officeReviews || [], auditUserUuid),
        trainingFollowupsRepo.syncForAppraisal(appraisal.appraisalUuid, data.trainingFollowups || [], auditUserUuid),
      ];
      if (Array.isArray((data as any)?.trainings)) {
        stage3Writes.push(trainingsRepo.syncForAppraisal(appraisal.appraisalUuid, (data as any).trainings, auditUserUuid));
      }
      await Promise.all(stage3Writes);
    }

    return this.getById(id);
  }
}
