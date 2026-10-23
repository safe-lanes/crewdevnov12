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
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { sendEmail, logEmailEvent } from "../../shared/emailService";
import { buildAppraisalReviewEmail } from "../templates/appraisalReviewNotificationTemplate";
import { apprOfficeReviewsV2 } from "../../../../shared/v2/appraisals/schema";
import {
  HEADER_FIELDS,
  PART_A_FIELDS,
  SECTION_KEYS,
  sameValue,
  type AppraisalChanges,
  type AppraisalSectionKey,
} from "../../../../shared/v2/appraisals/appraisalChanges";

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

// Main-row columns that are NOT NULL: a save draft can change but never clear them.
const REQUIRED_HEADER_FIELDS = new Set<string>(["appraisalType", "appraisalDate", "status"]);

const APPRAISAL_PINNED_STATUSES = new Set([
  "preliminary",
  "submitted",
  "pending_review",
  "stage2_submitted",
  "reviewed",
  "stage3_submitted",
]);

export class FormVersionPinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormVersionPinError";
  }
}

export class CrewReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrewReferenceError";
  }
}

export class AppraisalIdConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppraisalIdConflictError";
  }
}

function statusRequiresAppraisalVersionPin(status: string | null | undefined): boolean {
  return APPRAISAL_PINNED_STATUSES.has((status ?? "").trim().toLowerCase());
}

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
 * Fire-and-forget helper: after G1 rows are synced on Save Draft, finds any
 * manually-added reviewer rows (isAssigned=false, userUuid set, emailSentAt null)
 * and sends them a notification email, then stamps emailSentAt so repeat saves
 * don't re-send.
 */
async function notifyNewManualG1Reviewers(
  appraisalUuid: string,
  seafarerName: string,
  rank: string,
): Promise<void> {
  const db = getDb();
  try {
    const pendingRows = await db
      .select()
      .from(apprOfficeReviewsV2)
      .where(and(
        eq(apprOfficeReviewsV2.appraisalUuid, appraisalUuid),
        eq(apprOfficeReviewsV2.isAssigned, false),
        eq(apprOfficeReviewsV2.isDeleted, false),
        isNull(apprOfficeReviewsV2.emailSentAt),
        isNotNull(apprOfficeReviewsV2.userUuid),
      ));

    if (pendingRows.length === 0) return;

    await triggerAppraisalReviewNotification(
      pendingRows.map((r: typeof apprOfficeReviewsV2.$inferSelect) => ({
        userUuid: r.userUuid!,
        reviewerName: r.name || undefined,
        designation: r.position || undefined,
      })),
      seafarerName,
      rank,
      appraisalUuid,
    );

    const now = new Date();
    await Promise.all(
      pendingRows.map((r: typeof apprOfficeReviewsV2.$inferSelect) =>
        db.update(apprOfficeReviewsV2)
          .set({ emailSentAt: now })
          .where(eq(apprOfficeReviewsV2.id, r.id))
      )
    );
  } catch (err: any) {
    logEmailEvent('ERROR', `[Appraisals V2] notifyNewManualG1Reviewers failed for ${appraisalUuid}:`, err?.message || err);
  }
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
  // crew_member_id must hold a crew_uuid that exists in the crew pool. Local
  // serial ids (of the appraisal or the crew) are not portable between ship
  // and shore, so they are never accepted as a crew reference.
  private async assertCrewReference(value: unknown): Promise<string> {
    const crewUuid = value == null ? "" : String(value).trim();
    if (!crewUuid) {
      throw new CrewReferenceError("Cannot save this appraisal without a crew member.");
    }
    const crew = await crewMembersRepo.findByUuid(crewUuid);
    if (!crew) {
      throw new CrewReferenceError(`Crew member ${crewUuid} was not found.`);
    }
    return crewUuid;
  }

  // A create that names an appraisal_uuid which already exists is a retry or
  // replay of an earlier create: return that appraisal instead of a new one.
  private async resolveExistingCreate(appraisalUuid: string, crewMemberId: unknown) {
    const existing = await appraisalResultsRepo.findByAppraisalUuidIncludingDeleted(appraisalUuid);
    if (!existing) return null;
    if (existing.isDeleted) {
      throw new AppraisalIdConflictError("This appraisal was deleted and can't be created again.");
    }
    const requestedCrew = crewMemberId == null ? "" : String(crewMemberId).trim();
    if (existing.crewMemberId !== requestedCrew) {
      throw new AppraisalIdConflictError("This appraisal id is already used for another crew member.");
    }
    return this.getByUuid(appraisalUuid);
  }

  private async resolveRequiredAppraisalFormVersion(
    rank: string | null | undefined,
  ): Promise<{ formVersionId: number; formVersionUuid: string }> {
    const normalizedRank = (rank ?? "").trim();
    if (!normalizedRank) {
      throw new FormVersionPinError(
        "Cannot save this appraisal without a seafarer rank and a released appraisal form version.",
      );
    }

    try {
      const formForRank = await formsService.getFormForRank(normalizedRank, "appraisal");
      if (!formForRank) {
        throw new FormVersionPinError(
          `No appraisal form configured for rank "${normalizedRank}". Assign the rank to an active appraisal rank group before saving this appraisal.`,
        );
      }
      const formVersionId = formForRank?.formVersionId;
      const formVersionUuid = formForRank?.formVersionUuid;
      if (
        formForRank?.noReleasedVersion ||
        !Number.isInteger(formVersionId) ||
        !formVersionUuid
      ) {
        throw new FormVersionPinError(
          `No released appraisal form version exists for rank "${normalizedRank}". Release a form version before saving this appraisal.`,
        );
      }
      return { formVersionId, formVersionUuid };
    } catch (error) {
      if (error instanceof FormVersionPinError) throw error;
      throw new FormVersionPinError(
        `Unable to resolve a released appraisal form version for rank "${normalizedRank}". This appraisal was not saved.`,
      );
    }
  }

  private async resolveAppraisalPinForSubmittedStatus(params: {
    status: string | null | undefined;
    rank: string | null | undefined;
    formVersionId: number | null | undefined;
    formVersionUuid: string | null | undefined;
  }): Promise<{ formVersionId: number; formVersionUuid: string } | null> {
    if (!statusRequiresAppraisalVersionPin(params.status)) return null;

    const hasId = params.formVersionId != null;
    const hasUuid = !!params.formVersionUuid;
    if (hasId !== hasUuid) {
      throw new FormVersionPinError(
        "This appraisal has an incomplete form-version pin. Both form-version values are required before it can be submitted.",
      );
    }
    if (hasId && hasUuid) return null;

    return this.resolveRequiredAppraisalFormVersion(params.rank);
  }

  async getAll() {
    const appraisals = await appraisalResultsRepo.findAll();
    if (appraisals.length === 0) return [];
    const uuids = appraisals.map(a => a.appraisalUuid);
    const childData = await fetchChildDataForUuids(uuids);
    return appraisals.map(a => assembleOne(a, childData));
  }

  async getByUuid(appraisalUuid: string) {
    const appraisal = await appraisalResultsRepo.findByAppraisalUuid(appraisalUuid);
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
    // (from the Promotion form) but could also be a crew_uuid. The serial crew
    // id is never used, either to resolve the crew or as a candidate key: it
    // differs between ship and shore, so a value from the other server can
    // point at a different crew member here.
    // Repo errors are intentionally allowed to propagate so real DB issues
    // surface as 5xx rather than silently undercounting.
    let crew = await crewMembersRepo.findByEmpNo(crewMemberId);
    if (!crew) {
      crew = await crewMembersRepo.findByUuid(crewMemberId);
    }
    if (crew) {
      if (crew.empNo) candidateIds.add(crew.empNo);
      if (crew.crewUuid) candidateIds.add(crew.crewUuid);
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

  // The client names a new appraisal (appraisalUuid) so a retried or replayed
  // create returns the first one instead of inserting a duplicate. Callers
  // that send no id still get a server-generated one.
  async create(body: any): Promise<{ appraisal: any; created: boolean }> {
    const auditData = applyAuditUser(body, true);
    const requestedUuid: string | null = auditData.appraisalUuid || null;

    // Checked before the crew and form lookups, so a repeat still succeeds
    // after the crew or form has changed since the first save.
    if (requestedUuid) {
      const existing = await this.resolveExistingCreate(requestedUuid, auditData.crewMemberId);
      if (existing) return { appraisal: existing, created: false };
    }

    const appraisalData = typeof auditData.appraisalData === "object"
      ? auditData.appraisalData
      : JSON.parse(auditData.appraisalData || "{}");

    const crewMemberId = await this.assertCrewReference(auditData.crewMemberId);

    const appraisalUuid = requestedUuid ?? uuidv4();

    // Appraisals are pinned at creation time. Never create a record that can
    // later become a submitted appraisal without a frozen form version.
    const { formVersionId, formVersionUuid } =
      await this.resolveRequiredAppraisalFormVersion(appraisalData?.seafarersRank);

    // The main row and all its sections commit together or not at all, so a
    // failed save never leaves a half-created appraisal to be synced.
    const auditUserUuid = auditData.createdByUuid || null;
    const created = await getDb().transaction(async (tx: any) => {
      const row = await appraisalResultsRepo.createIfAbsent({
        appraisalUuid,
        crewMemberId,
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
      }, tx);

      // A parallel request with the same id inserted it first. Its sections
      // are already saved, so write nothing here.
      if (!row) return null;

      // Sequential: one transaction runs on one connection.
      await trainingsRepo.syncForAppraisal(appraisalUuid, appraisalData.trainings || [], auditUserUuid, tx);
      await targetsRepo.syncForAppraisal(appraisalUuid, appraisalData.targets || [], auditUserUuid, tx);
      await competenceAssessmentsRepo.syncForAppraisal(appraisalUuid, appraisalData.competenceAssessments || [], auditUserUuid, tx);
      await behaviouralAssessmentsRepo.syncForAppraisal(appraisalUuid, appraisalData.competenceAssessments ? appraisalData.behaviouralAssessments || [] : [], auditUserUuid, tx);
      await trainingNeedsRepo.syncForAppraisal(appraisalUuid, appraisalData.trainingNeeds || [], auditUserUuid, tx);
      await recommendationsRepo.syncForAppraisal(appraisalUuid, appraisalData.recommendations || [], auditUserUuid, tx);
      await appraiserCommentsRepo.syncForAppraisal(appraisalUuid, appraisalData.appraiserComments || [], auditUserUuid, tx);
      await seafarerCommentsRepo.syncForAppraisal(appraisalUuid, appraisalData.seafarerComments || [], auditUserUuid, tx);
      await officeReviewsRepo.syncForAppraisal(appraisalUuid, appraisalData.officeReviews || [], auditUserUuid, tx);
      await trainingFollowupsRepo.syncForAppraisal(appraisalUuid, appraisalData.trainingFollowups || [], auditUserUuid, tx);
      return row;
    });

    if (!created) {
      // The winner has committed by now, so its row is visible.
      const existing = await this.resolveExistingCreate(appraisalUuid, crewMemberId);
      if (!existing) throw new Error(`Appraisal ${appraisalUuid} was neither created nor found.`);
      return { appraisal: existing, created: false };
    }

    // Fire-and-forget, after commit: email any newly-added manual G1 reviewers (not assigned, not yet notified).
    void notifyNewManualG1Reviewers(
      appraisalUuid,
      appraisalData.seafarersName || '',
      appraisalData.seafarersRank || '',
    );

    return { appraisal: await this.getByUuid(created.appraisalUuid), created: true };
  }

  // Save draft. `changes` holds only what the user changed since the form was
  // loaded (APD-16), so only those fields of those rows are written: a stale
  // copy of the form cannot overwrite someone else's edits. Child rows are
  // matched by uuid, sections that are not sent are left alone, and a save
  // with no real change writes nothing at all.
  async update(appraisalUuid: string, body: { changes: AppraisalChanges; auditUserUuid?: string | null }) {
    const existing = await appraisalResultsRepo.findByAppraisalUuid(appraisalUuid);
    if (!existing) return null;

    const auditUserUuid = body.auditUserUuid || null;
    const header = body.changes.header ?? {};
    const sections = body.changes.sections ?? {};

    const updateFields: Record<string, unknown> = {};
    for (const field of HEADER_FIELDS) {
      if (!(field in header)) continue;
      let value = header[field];
      if ((PART_A_FIELDS as readonly string[]).includes(field)) value = value || null;
      // Required columns: an empty value never clears them.
      else if (REQUIRED_HEADER_FIELDS.has(field) && !value) continue;
      if (!sameValue((existing as any)[field], value)) updateFields[field] = value;
    }

    const resolvedPin = await this.resolveAppraisalPinForSubmittedStatus({
      status: (updateFields.status as string | undefined) ?? existing.status,
      rank: header.seafarersRank ?? existing.seafarersRank,
      formVersionId: existing.formVersionId,
      formVersionUuid: existing.formVersionUuid,
    });
    if (resolvedPin) {
      updateFields.formVersionId = resolvedPin.formVersionId;
      updateFields.formVersionUuid = resolvedPin.formVersionUuid;
    }

    const sectionRepos: Record<AppraisalSectionKey, { applyChanges: typeof trainingsRepo.applyChanges }> = {
      trainings: trainingsRepo,
      targets: targetsRepo,
      competenceAssessments: competenceAssessmentsRepo,
      behaviouralAssessments: behaviouralAssessmentsRepo,
      trainingNeeds: trainingNeedsRepo,
      recommendations: recommendationsRepo,
      appraiserComments: appraiserCommentsRepo,
      seafarerComments: seafarerCommentsRepo,
      officeReviews: officeReviewsRepo,
      trainingFollowups: trainingFollowupsRepo,
    };

    // The main row and its sections are saved in one transaction.
    await getDb().transaction(async (tx: any) => {
      let rowsWritten = 0;
      // Sequential: one transaction runs on one connection.
      for (const key of SECTION_KEYS) {
        const section = sections[key];
        if (section) {
          rowsWritten += await sectionRepos[key].applyChanges(existing.appraisalUuid, section, auditUserUuid ?? undefined, tx);
        }
      }

      // Any UPDATE stamps updated_at, so the main row is written only when the
      // appraisal really changed.
      if (Object.keys(updateFields).length === 0 && rowsWritten === 0) return;
      if (auditUserUuid) updateFields.updatedByUuid = auditUserUuid;
      await appraisalResultsRepo.updateByAppraisalUuid(existing.appraisalUuid, updateFields, tx);
    });

    if (sections.officeReviews) {
      // Fire-and-forget, after commit: email any newly-added manual G1 reviewers (not assigned, not yet notified).
      void notifyNewManualG1Reviewers(
        existing.appraisalUuid,
        header.seafarersName || existing.seafarersName || '',
        header.seafarersRank || existing.seafarersRank || '',
      );
    }

    return this.getByUuid(existing.appraisalUuid);
  }

  async delete(appraisalUuid: string) {
    return appraisalResultsRepo.softDeleteByAppraisalUuid(appraisalUuid);
  }

  async submitStage(
    appraisalUuid: string,
    stage: "stage1" | "stage2" | "stage3",
    data: any,
    submittedBy: string,
    extra?: { competenceRating?: string | null; behavioralRating?: string | null; overallRating?: string | null },
  ) {
    const auditUserUuid = (data as any)?.auditUserUuid ?? null;

    const appraisal = await appraisalResultsRepo.findByAppraisalUuid(appraisalUuid);
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
    const rankForVersionResolution = stage === "stage1"
      ? data.seafarersRank
      : appraisal.seafarersRank;
    const resolvedPin = await this.resolveAppraisalPinForSubmittedStatus({
      status: newStatus,
      rank: rankForVersionResolution,
      formVersionId: appraisal.formVersionId,
      formVersionUuid: appraisal.formVersionUuid,
    });

    const stageUpdate: any = {
      status: newStatus,
      submittedBy,
      submittedAt: new Date(),
      updatedByUuid: auditUserUuid,
    };
    if (resolvedPin) {
      stageUpdate.formVersionId = resolvedPin.formVersionId;
      stageUpdate.formVersionUuid = resolvedPin.formVersionUuid;
    }

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
          if (!formForRank) {
            throw new FormVersionPinError(
              `No appraisal form configured for rank "${rank}". Assign the rank to an active appraisal rank group before submitting Stage 2.`,
            );
          }
          stageUpdate.isLockForm = !!formForRank.isLockForm;
        }
      } catch (e) {
        if (e instanceof FormVersionPinError) throw e;
        console.warn("[Appraisals V2] Failed to resolve isLockForm for stage2 snapshot:", e);
      }
    } else if (stage === "stage3") {
      stageUpdate.stage3Status = "completed";
      stageUpdate.stage3SubmittedAt = new Date().toISOString();
      stageUpdate.stage3SubmittedBy = submittedBy;
    }

    const reviewerList: { userUuid?: string; reviewerName?: string; designation?: string }[] =
      stage === "stage2" && Array.isArray((data as any)?.reviewers) ? (data as any).reviewers : [];

    // The stage status and that stage's sections are saved in one transaction.
    // Writes run one after another: one transaction runs on one connection.
    await getDb().transaction(async (tx: any) => {
      await appraisalResultsRepo.updateByAppraisalUuid(appraisal.appraisalUuid, stageUpdate, tx);

      if (stage === "stage1") {
        await trainingsRepo.syncForAppraisal(appraisal.appraisalUuid, data.trainings || [], auditUserUuid, tx);
        await targetsRepo.syncForAppraisal(appraisal.appraisalUuid, data.targets || [], auditUserUuid, tx);
      } else if (stage === "stage2") {
        await competenceAssessmentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.competenceAssessments || [], auditUserUuid, tx);
        await behaviouralAssessmentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.behaviouralAssessments || [], auditUserUuid, tx);
        await trainingNeedsRepo.syncForAppraisal(appraisal.appraisalUuid, data.trainingNeeds || [], auditUserUuid, tx);
        await recommendationsRepo.syncForAppraisal(appraisal.appraisalUuid, data.recommendations || [], auditUserUuid, tx);
        await appraiserCommentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.appraiserComments || [], auditUserUuid, tx);
        await seafarerCommentsRepo.syncForAppraisal(appraisal.appraisalUuid, data.seafarerComments || [], auditUserUuid, tx);
        await reviewersRepo.syncForAppraisal(appraisal.appraisalUuid, reviewerList, auditUserUuid, tx);
        // Task #500: persist the current B1 trainings (and targets) snapshot
        // alongside the Stage-2 C-F writes. Only sync them when the payload
        // includes them so legacy callers that omit `trainings`/`targets`
        // leave existing persisted rows untouched.
        if (Array.isArray((data as any)?.trainings)) {
          await trainingsRepo.syncForAppraisal(appraisal.appraisalUuid, (data as any).trainings, auditUserUuid, tx);
        }
        if (Array.isArray((data as any)?.targets)) {
          await targetsRepo.syncForAppraisal(appraisal.appraisalUuid, (data as any).targets, auditUserUuid, tx);
        }
      } else if (stage === "stage3") {
        await officeReviewsRepo.syncForAppraisal(appraisal.appraisalUuid, data.officeReviews || [], auditUserUuid, tx);
        await trainingFollowupsRepo.syncForAppraisal(appraisal.appraisalUuid, data.trainingFollowups || [], auditUserUuid, tx);
        // Task #500: persist any post-Stage-2 B1 Evaluation edits alongside
        // Section G. If the client omits `trainings` we leave the existing
        // persisted rows untouched.
        if (Array.isArray((data as any)?.trainings)) {
          await trainingsRepo.syncForAppraisal(appraisal.appraisalUuid, (data as any).trainings, auditUserUuid, tx);
        }
      }
    });

    // After commit: send review assignment notification emails to each assigned reviewer
    if (reviewerList.length > 0) {
      triggerAppraisalReviewNotification(
        reviewerList,
        appraisal.seafarersName || 'Seafarer',
        appraisal.seafarersRank || 'N/A',
        appraisal.appraisalUuid,
      ).catch((e) => logEmailEvent('ERROR', '[Appraisals V2] Review notification error:', e?.message || e));
    }

    return this.getByUuid(appraisal.appraisalUuid);
  }
}
