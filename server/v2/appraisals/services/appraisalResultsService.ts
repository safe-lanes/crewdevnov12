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
import { softDeleteAppraisalChildRows } from "../repositories/childRowSync";
import { CrewMembersRepository } from "../../crew-pool/repositories";
import { assembleV1Response } from "../utils/responseAssembler";
import { loadAppraisalTypeNames, resolveAppraisalTypeRef, resolveAppraisalVesselRef } from "../utils/masterRefs";
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
  AppraisalRatingVersionError,
  readEffectivenessOptions,
  validateEffectivenessSelections,
  type EffectivenessOption,
  type EffectivenessSelections,
} from "../../../../shared/appraisal-effectiveness";

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

type ResolvedAppraisalFormVersion = {
  formVersionId: number;
  formVersionUuid: string;
  rankGroupConfig: unknown;
  isLockForm?: boolean;
};

export class FormVersionPinError extends Error {
  constructor(message: string, public readonly reason?: "no_rank" | "unconfigured_rank" | "no_release") {
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

// A create whose checks have passed, ready to be written (in a transaction).
type PreparedCreate = {
  row: InsertAppraisalResultV2 & { appraisalUuid: string; crewMemberId: string };
  appraisalData: any;
  auditUserUuid?: string;
};

type SubmitStageName = "stage1" | "stage2" | "stage3";

// A stage submit whose checks have passed, ready to be written (in a transaction).
type PreparedStage = {
  stage: SubmitStageName;
  stageUpdate: Record<string, any>;
  // The stage's request data, with the acting user as `auditUserUuid`.
  data: any;
  reviewerList: { userUuid?: string; reviewerName?: string; designation?: string }[];
  // Each assigned reviewer gets a G1 row at Stage 2, but never after Stage 3 (APD-20).
  addAssignedReviewers: boolean;
};

function statusRequiresAppraisalVersionPin(status: string | null | undefined): boolean {
  return APPRAISAL_PINNED_STATUSES.has((status ?? "").trim().toLowerCase());
}

// The derived ratings that differ from the stored ones.
function changedRatings(ratings: AppraisalRatings, stored: Partial<AppraisalRatings>): Partial<AppraisalRatings> {
  const changed: Partial<AppraisalRatings> = {};
  for (const field of DERIVED_RATING_FIELDS) {
    if (!sameValue(stored[field], ratings[field])) changed[field] = ratings[field];
  }
  return changed;
}

async function fetchChildDataForUuids(appraisalUuids: string[]) {
  if (appraisalUuids.length === 0) {
    return {
      trainings: new Map(), targets: new Map(),
      competenceAssessments: new Map(), behaviouralAssessments: new Map(),
      trainingNeeds: new Map(), recommendations: new Map(),
      appraiserComments: new Map(), seafarerComments: new Map(),
      officeReviews: new Map(), trainingFollowups: new Map(),
      reviewers: new Map(), appraisalTypeNames: new Map(),
    };
  }
  const [trainings, targets, competenceAssessments, behaviouralAssessments,
         trainingNeeds, recommendations, appraiserComments, seafarerComments,
         officeReviews, trainingFollowups, reviewers, appraisalTypeNames] = await Promise.all([
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
    loadAppraisalTypeNames(),
  ]);
  return { trainings, targets, competenceAssessments, behaviouralAssessments,
           trainingNeeds, recommendations, appraiserComments, seafarerComments,
           officeReviews, trainingFollowups, reviewers, appraisalTypeNames };
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
    childData.appraisalTypeNames,
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
    const existing = await this.findExistingCreate(appraisalUuid, crewMemberId);
    if (!existing) return null;
    return this.getByUuid(appraisalUuid);
  }

  // The stored row a repeated create refers to, or null if there is none.
  private async findExistingCreate(appraisalUuid: string, crewMemberId: unknown) {
    const existing = await appraisalResultsRepo.findByAppraisalUuidIncludingDeleted(appraisalUuid);
    if (!existing) return null;
    if (existing.isDeleted) {
      throw new AppraisalIdConflictError("This appraisal was deleted and can't be created again.");
    }
    const requestedCrew = crewMemberId == null ? "" : String(crewMemberId).trim();
    if (existing.crewMemberId !== requestedCrew) {
      throw new AppraisalIdConflictError("This appraisal id is already used for another crew member.");
    }
    return existing;
  }

  private async resolveRequiredAppraisalFormVersion(
    rank: string | null | undefined,
  ): Promise<ResolvedAppraisalFormVersion> {
    const normalizedRank = (rank ?? "").trim();
    if (!normalizedRank) {
      throw new FormVersionPinError(
        "Cannot save this appraisal without a seafarer rank and a released appraisal form version.",
        "no_rank",
      );
    }

    try {
      const formForRank = await formsService.getFormForRank(normalizedRank, "appraisal");
      if (!formForRank) {
        throw new FormVersionPinError(
          `No appraisal form configured for rank "${normalizedRank}". Assign the rank to an active appraisal rank group before saving this appraisal.`,
          "unconfigured_rank",
        );
      }
      const formVersionId = formForRank?.formVersionId;
      const formVersionUuid = formForRank?.formVersionUuid;
      if (formForRank.noReleasedVersion) {
        throw new FormVersionPinError(
          `No released appraisal form version exists for rank "${normalizedRank}". Release a form version before saving this appraisal.`,
          "no_release",
        );
      }
      if (
        typeof formVersionId !== "number" ||
        !Number.isInteger(formVersionId) ||
        formVersionId < 1 ||
        !formVersionUuid
      ) {
        throw new FormVersionPinError(
          `No released appraisal form version exists for rank "${normalizedRank}". Release a form version before saving this appraisal.`,
        );
      }
      return { formVersionId, formVersionUuid, rankGroupConfig: formForRank.rankGroupConfig, isLockForm: formForRank.isLockForm };
    } catch (error) {
      if (error instanceof FormVersionPinError) throw error;
      throw new FormVersionPinError(
        `Unable to resolve a released appraisal form version for rank "${normalizedRank}". This appraisal was not saved.`,
      );
    }
  }

  private async resolveAppraisalRatingVersion(params: {
    status: string | null | undefined;
    rank: string | null | undefined;
    formVersionId: number | null | undefined;
    formVersionUuid: string | null | undefined;
    expectedFormVersionId: unknown;
  }) {
    const hasId = params.formVersionId != null;
    const hasUuid = !!params.formVersionUuid;
    if (hasId !== hasUuid || (hasId && (!Number.isInteger(params.formVersionId) || params.formVersionId! < 1))) {
      throw new FormVersionPinError(
        "This appraisal has an incomplete form-version pin. Both valid form-version values are required before it can be saved or submitted.",
      );
    }
    const expected = params.expectedFormVersionId;
    if (expected !== undefined && (typeof expected !== "number" || !Number.isInteger(expected) || expected < 1)) {
      throw new AppraisalRatingVersionError("The appraisal form version could not be confirmed. Reopen the form.");
    }
    let version: ResolvedAppraisalFormVersion;
    try {
      version = hasId
        ? await formsService.getVersionConfiguration(params.formVersionId!)
        : await this.resolveRequiredAppraisalFormVersion(params.rank);
    } catch (error) {
      if (
        !hasId && expected === undefined && !statusRequiresAppraisalVersionPin(params.status) &&
        error instanceof FormVersionPinError && error.reason !== undefined
      ) {
        // Historical drafts may predate rank mapping or released forms.
        // Only explicit missing-configuration results preserve that path.
        return { version: null, options: null, newPin: null };
      }
      if (expected !== undefined) {
        throw new AppraisalRatingVersionError("The appraisal form version is unavailable. Reopen the appraisal before saving.");
      }
      if (error instanceof FormVersionPinError) throw error;
      throw new FormVersionPinError("The pinned appraisal form configuration could not be loaded. This appraisal was not saved.");
    }
    if (hasId && (version.formVersionId !== params.formVersionId || version.formVersionUuid !== params.formVersionUuid)) {
      throw new FormVersionPinError("The stored appraisal form-version pin does not match its configuration. This appraisal was not saved.");
    }
    if (expected !== undefined && version.formVersionId !== expected) {
      throw new AppraisalRatingVersionError("The appraisal form version has changed. Reopen the appraisal before saving.");
    }
    const options = readEffectivenessOptions(version.rankGroupConfig);
    if (!hasId && options !== null && expected === undefined) {
      throw new AppraisalRatingVersionError("This form uses configurable ratings. Reopen it before saving.");
    }
    return {
      version,
      options,
      newPin: !hasId && (statusRequiresAppraisalVersionPin(params.status) || options !== null) ? version : null,
    };
  }

  private async validatePersistedAppraisalRatings(
    appraisalUuid: string,
    incoming: EffectivenessSelections,
    options: readonly EffectivenessOption[] | null,
  ) {
    if (options === null) return;
    const [trainings, targets, competenceAssessments, behaviouralAssessments] = await Promise.all([
      incoming.trainings ?? trainingsRepo.findByAppraisalUuids([appraisalUuid]).then(rows => rows.get(appraisalUuid) || []),
      incoming.targets ?? targetsRepo.findByAppraisalUuids([appraisalUuid]).then(rows => rows.get(appraisalUuid) || []),
      incoming.competenceAssessments ?? competenceAssessmentsRepo.findByAppraisalUuids([appraisalUuid]).then(rows => rows.get(appraisalUuid) || []),
      incoming.behaviouralAssessments ?? behaviouralAssessmentsRepo.findByAppraisalUuids([appraisalUuid]).then(rows => rows.get(appraisalUuid) || []),
    ]);
    validateEffectivenessSelections({ trainings, targets, competenceAssessments, behaviouralAssessments }, options);
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

    const prepared = await this.prepareCreate(auditData, requestedUuid ?? uuidv4());
    const { appraisalUuid } = prepared.row;

    // The main row and all its sections commit together or not at all, so a
    // failed save never leaves a half-created appraisal to be synced.
    const created = await getDb().transaction((tx: any) => this.writeCreate(prepared, tx));

    if (!created) {
      // The winner has committed by now, so its row is visible.
      const existing = await this.resolveExistingCreate(appraisalUuid, prepared.row.crewMemberId);
      if (!existing) throw new Error(`Appraisal ${appraisalUuid} was neither created nor found.`);
      return { appraisal: existing, created: false };
    }

    // Fire-and-forget, after commit: email any newly-added manual G1 reviewers (not assigned, not yet notified).
    void notifyNewManualG1Reviewers(
      appraisalUuid,
      prepared.appraisalData.seafarersName || '',
      prepared.appraisalData.seafarersRank || '',
    );

    return { appraisal: await this.getByUuid(created.appraisalUuid), created: true };
  }

  // The checks and lookups of a create, without writing anything. `auditData`
  // is the create body after applyAuditUser.
  private async prepareCreate(auditData: any, appraisalUuid: string): Promise<PreparedCreate> {
    const appraisalData = typeof auditData.appraisalData === "object"
      ? auditData.appraisalData
      : JSON.parse(auditData.appraisalData || "{}");

    const appraisalUuid = uuidv4();

    const expectedVersionId: unknown = auditData.expectedFormVersionId;
    if (expectedVersionId !== undefined && (
      typeof expectedVersionId !== "number" ||
      !Number.isInteger(expectedVersionId) ||
      expectedVersionId < 1
    )) {
      throw new AppraisalRatingVersionError(
        "The appraisal form version could not be confirmed. Reopen the form."
      );
    }

    // Pin and validate against one resolved released version, including for
    // legacy callers that do not send an expected version.
    let resolvedForm: ResolvedAppraisalFormVersion;
    try {
      resolvedForm = await this.resolveRequiredAppraisalFormVersion(appraisalData?.seafarersRank);
    } catch (error) {
      if (expectedVersionId !== undefined && error instanceof FormVersionPinError) {
        throw new AppraisalRatingVersionError(
          "The released form version has changed or is unavailable. " +
          "Reopen the appraisal before saving."
        );
      }
      throw error;
    }
    const { formVersionId, formVersionUuid, rankGroupConfig } = resolvedForm;
    if (expectedVersionId !== undefined && formVersionId !== expectedVersionId) {
      throw new AppraisalRatingVersionError(
        "The released form version has changed or is unavailable. " +
        "Reopen the appraisal before saving."
      );
    }
    const options = readEffectivenessOptions(rankGroupConfig);
    if (expectedVersionId === undefined && options !== null) {
      throw new AppraisalRatingVersionError(
        "This form uses configurable ratings. Reopen it before saving."
      );
    }
    validateEffectivenessSelections(appraisalData, options);

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

    // Fire-and-forget: email any newly-added manual G1 reviewers (not assigned, not yet notified).
    void notifyNewManualG1Reviewers(
      appraisalUuid,
      appraisalData.seafarersName || '',
      appraisalData.seafarersRank || '',
    );

    return this.getById(created.id);
  }

  async update(id: number, body: any) {
    const existing = await appraisalResultsRepo.findById(id);
    if (!existing) return null;

    const auditUserUuid = body.auditUserUuid || null;
    const header = body.changes.header ?? {};
    const sections = body.changes.sections ?? {};

    const updateFields: Record<string, unknown> = {};
    for (const field of HEADER_FIELDS) {
      if (!(field in header)) continue;
      // APD-49: derived from the Part C/D rows below, never taken from the client.
      if ((DERIVED_RATING_FIELDS as readonly string[]).includes(field)) continue;
      let value = header[field];
      if ((PART_A_FIELDS as readonly string[]).includes(field)) value = value || null;
      // Required columns: an empty value never clears them.
      else if (REQUIRED_HEADER_FIELDS.has(field) && !value) continue;
      // APD-17: status only moves forward, as in submitStage. A lower status
      // (a stale form, or a sync replay) is ignored; the rest of the save applies.
      if (field === "status" && isAppraisalStatusRegression(existing.status, value)) continue;
      // APD-56: stored as master keys, not names.
      if (field === "appraisalType") value = await resolveAppraisalTypeRef(value, existing.appraisalType);
      else if (field === "vessel") value = await resolveAppraisalVesselRef(value, existing.vessel);
      if (!sameValue((existing as any)[field], value)) updateFields[field] = value;
    }

    const resolvedPin = await this.resolveAppraisalPinForSubmittedStatus({
      status: (updateFields.status as string | undefined) ?? existing.status,
      rank: header.seafarersRank ?? existing.seafarersRank,
      formVersionId: existing.formVersionId,
      formVersionUuid: existing.formVersionUuid,
      expectedFormVersionId: auditData.expectedFormVersionId,
    });
    const resolvedPin = ratingVersion.newPin;
    if (appraisalData) {
      validateEffectivenessSelections(appraisalData, ratingVersion.options);
    } else {
      await this.validatePersistedAppraisalRatings(existing.appraisalUuid, {}, ratingVersion.options);
    }
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

      // APD-49: the ratings follow the Part C/D rows as they are now, with this
      // save's changes merged into what other saves wrote.
      if (sections.competenceAssessments || sections.behaviouralAssessments) {
        Object.assign(updateFields, changedRatings(await this.deriveRatings(existing.appraisalUuid, tx), existing));
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

  // Soft-deletes the appraisal and all its live child rows in one transaction
  // (APD-33), so the sync never sees live rows of a deleted appraisal.
  // Returns false when the appraisal is not found or already deleted; its
  // child rows are then left alone.
  async delete(appraisalUuid: string, auditUserUuid?: string) {
    return getDb().transaction(async (tx: any) => {
      const deleted = await appraisalResultsRepo.softDeleteByAppraisalUuid(appraisalUuid, auditUserUuid, tx);
      if (!deleted) return false;
      await softDeleteAppraisalChildRows(tx, appraisalUuid, auditUserUuid);
      return true;
    });
  }

  // A stage submit, saved in one transaction (APD-30). One click of Submit
  // sends one request, so everything the click does commits together or not
  // at all:
  //  - `options.create` (the body POST / takes) creates the appraisal first,
  //    for a form that was never saved;
  //  - `options.stage1` (Stage 2 only) submits Stage 1 first when it is not
  //    done yet, for a form whose Part B2 is hidden (it has no Stage 1 button).
  // Every check runs before the transaction, so a failed check writes nothing.
  async submitStage(
    appraisalUuid: string,
    stage: SubmitStageName,
    data: any,
    submittedBy: string,
    options?: { create?: any; stage1?: any },
  ) {
    const auditUserUuid = (data as any)?.auditUserUuid ?? null;

    let appraisal: any;
    let newAppraisal: PreparedCreate | null = null;
    if (options?.create) {
      // The actor of the submit wins over any the create body carries (APD-31).
      const createData = applyAuditUser({ ...options.create, submittedBy, auditUserUuid }, true);
      // Found: a repeat of a submit that already created it (a retry after a
      // lost response), so it is not created again.
      appraisal = await this.findExistingCreate(appraisalUuid, createData.crewMemberId);
      if (!appraisal) {
        newAppraisal = await this.prepareCreate({ ...createData, status: "draft" }, appraisalUuid);
        appraisal = newAppraisal.row;
      }
    } else {
      appraisal = await appraisalResultsRepo.findByAppraisalUuid(appraisalUuid);
    }
    if (!appraisal) return null;

    const steps: PreparedStage[] = [];
    if (stage === "stage2" && options?.stage1 && !appraisal.stage1Status) {
      const stage1Step = await this.prepareStage(appraisal, "stage1", { ...options.stage1, auditUserUuid }, submittedBy);
      steps.push(stage1Step);
      // Stage 2 is checked against the appraisal as Stage 1 leaves it.
      appraisal = { ...appraisal, ...stage1Step.stageUpdate };
    }
    steps.push(await this.prepareStage(appraisal, stage, data, submittedBy));

    await getDb().transaction(async (tx: any) => {
      if (newAppraisal && !(await this.writeCreate(newAppraisal, tx))) {
        // A parallel request created it after the checks above. A retry finds it.
        throw new AppraisalIdConflictError("This appraisal was saved by another request at the same time. Please try again.");
      }
      // Sequential: one transaction runs on one connection.
      for (const step of steps) {
        await this.writeStage(appraisalUuid, step, tx);
      }
    });

    // Fire-and-forget, after commit: email any manual G1 reviewers the create
    // added, and the reviewers assigned at Stage 2.
    if (newAppraisal) {
      void notifyNewManualG1Reviewers(
        appraisalUuid,
        newAppraisal.appraisalData.seafarersName || '',
        newAppraisal.appraisalData.seafarersRank || '',
      );
    }
    for (const step of steps) {
      if (step.reviewerList.length === 0) continue;
      triggerAppraisalReviewNotification(
        step.reviewerList,
        appraisal.seafarersName || 'Seafarer',
        appraisal.seafarersRank || 'N/A',
        appraisalUuid,
      ).catch((e) => logEmailEvent('ERROR', '[Appraisals V2] Review notification error:', e?.message || e));
    }

    return this.getByUuid(appraisalUuid);
  }

  // The checks of one stage submit, without writing anything. `appraisal` is
  // the stored row, or the row as an earlier step of the same submit leaves it.
  private async prepareStage(
    appraisal: any,
    stage: SubmitStageName,
    data: any,
    submittedBy: string,
  ): Promise<PreparedStage> {
    const auditUserUuid = (data as any)?.auditUserUuid ?? null;

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
    let stage3Trainings: any[] | undefined;
    if (stage === "stage3") {
      const incoming = Array.isArray((data as any)?.trainings) ? (data as any).trainings as any[] : null;
      const source = incoming
        ?? ((await trainingsRepo.findByAppraisalUuids([appraisal.appraisalUuid])).get(appraisal.appraisalUuid) || []);
      stage3Trainings = source;
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
    // The order is shared with save draft (APD-17).
    // Stage 2 now advances to `pending_review` (awaiting office review)
    // rather than `submitted`, so the form locks and reviewers get notified.
    const nominalForStage =
      stage === "stage1" ? "preliminary"
      : stage === "stage2" ? "pending_review"
      : "reviewed";
    const newStatus = isAppraisalStatusRegression(appraisal.status, nominalForStage)
      ? normalizeAppraisalStatus(appraisal.status)
      : nominalForStage;
    const rankForVersionResolution = stage === "stage1"
      ? data.seafarersRank
      : appraisal.seafarersRank;
    const ratingVersion = await this.resolveAppraisalRatingVersion({
      status: newStatus,
      rank: rankForVersionResolution,
      formVersionId: appraisal.formVersionId,
      formVersionUuid: appraisal.formVersionUuid,
      expectedFormVersionId: data.expectedFormVersionId,
    });
    const resolvedPin = ratingVersion.newPin;
    const incomingRatings: EffectivenessSelections = stage === "stage1"
      ? { trainings: data.trainings || [], targets: data.targets || [] }
      : stage === "stage2"
        ? {
            competenceAssessments: data.competenceAssessments || [],
            behaviouralAssessments: data.behaviouralAssessments || [],
            ...(Array.isArray(data.trainings) ? { trainings: data.trainings } : {}),
            ...(Array.isArray(data.targets) ? { targets: data.targets } : {}),
          }
        : { trainings: stage3Trainings };
    await this.validatePersistedAppraisalRatings(appraisal.appraisalUuid, incomingRatings, ratingVersion.options);

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
      // APD-56: vessel and type are stored as master keys, not names.
      stageUpdate.vessel = await resolveAppraisalVesselRef(data.vessel, appraisal.vessel);
      stageUpdate.signOn = data.signOn;
      stageUpdate.appraisalPeriodFrom = data.appraisalPeriodFrom;
      stageUpdate.appraisalPeriodTo = data.appraisalPeriodTo;
      stageUpdate.personalityIndexCategory = data.personalityIndexCategory;
      stageUpdate.primaryAppraiser = data.primaryAppraiser;
      if (data.appraisalType) stageUpdate.appraisalType = await resolveAppraisalTypeRef(data.appraisalType, appraisal.appraisalType);
    } else if (stage === "stage2") {
      stageUpdate.stage2Status = "completed";
      stageUpdate.stage2SubmittedAt = new Date().toISOString();
      stageUpdate.stage2SubmittedBy = submittedBy;
      // The ratings are derived from the Part C/D rows once writeStage has
      // saved them (APD-49).
      // Task #500: snapshot the form's current lock-form flag onto this
      // appraisal so admin-side toggles after Stage 2 do not retroactively
      // unlock (or lock) already-submitted appraisals.
      stageUpdate.isLockForm = !!ratingVersion.version?.isLockForm;
    } else if (stage === "stage3") {
      stageUpdate.stage3Status = "completed";
      stageUpdate.stage3SubmittedAt = new Date().toISOString();
      stageUpdate.stage3SubmittedBy = submittedBy;
    }

    const reviewerList: { userUuid?: string; reviewerName?: string; designation?: string }[] =
      stage === "stage2" && Array.isArray((data as any)?.reviewers) ? (data as any).reviewers : [];

    return {
      stage,
      stageUpdate,
      data,
      reviewerList,
      addAssignedReviewers: !appraisal.stage3Status,
    };
  }

  // Writes a prepared stage inside `tx`: the stage status and that stage's
  // sections (STAGE_SECTIONS in shared/v2/appraisals/appraisalChanges.ts).
  // Writes run one after another: one transaction runs on one connection.
  private async writeStage(appraisalUuid: string, step: PreparedStage, tx: any) {
    const { stage, stageUpdate, data, reviewerList } = step;
    const auditUserUuid = data?.auditUserUuid ?? null;
    const row = await appraisalResultsRepo.updateByAppraisalUuid(appraisalUuid, stageUpdate, tx);

    if (stage === "stage1") {
      await trainingsRepo.syncForAppraisal(appraisalUuid, data.trainings || [], auditUserUuid, tx);
      await targetsRepo.syncForAppraisal(appraisalUuid, data.targets || [], auditUserUuid, tx);
    } else if (stage === "stage2") {
      await competenceAssessmentsRepo.syncForAppraisal(appraisalUuid, data.competenceAssessments || [], auditUserUuid, tx);
      await behaviouralAssessmentsRepo.syncForAppraisal(appraisalUuid, data.behaviouralAssessments || [], auditUserUuid, tx);
      await this.refreshRatings(appraisalUuid, tx, row);
      await trainingNeedsRepo.syncForAppraisal(appraisalUuid, data.trainingNeeds || [], auditUserUuid, tx);
      await recommendationsRepo.syncForAppraisal(appraisalUuid, data.recommendations || [], auditUserUuid, tx);
      await appraiserCommentsRepo.syncForAppraisal(appraisalUuid, data.appraiserComments || [], auditUserUuid, tx);
      await seafarerCommentsRepo.syncForAppraisal(appraisalUuid, data.seafarerComments || [], auditUserUuid, tx);
      await reviewersRepo.syncForAppraisal(appraisalUuid, reviewerList, auditUserUuid, tx);
      // Each assigned reviewer gets a G1 row here, once (APD-20). Not after
      // Stage 3: a reviewed appraisal never gains G1 rows.
      if (step.addAssignedReviewers) {
        await officeReviewsRepo.addAssignedReviewers(appraisalUuid, reviewerList, auditUserUuid, tx);
      }
      // Task #500: persist the current B1 trainings (and targets) snapshot
      // alongside the Stage-2 C-F writes. Only sync them when the payload
      // includes them so legacy callers that omit `trainings`/`targets`
      // leave existing persisted rows untouched.
      if (Array.isArray((data as any)?.trainings)) {
        await trainingsRepo.syncForAppraisal(appraisalUuid, (data as any).trainings, auditUserUuid, tx);
      }
      if (Array.isArray((data as any)?.targets)) {
        await targetsRepo.syncForAppraisal(appraisalUuid, (data as any).targets, auditUserUuid, tx);
      }
    } else if (stage === "stage3") {
      await officeReviewsRepo.syncForAppraisal(appraisalUuid, data.officeReviews || [], auditUserUuid, tx);
      await trainingFollowupsRepo.syncForAppraisal(appraisalUuid, data.trainingFollowups || [], auditUserUuid, tx);
      // Task #500: persist any post-Stage-2 B1 Evaluation edits alongside
      // Section G. If the client omits `trainings` we leave the existing
      // persisted rows untouched.
      if (Array.isArray((data as any)?.trainings)) {
        await trainingsRepo.syncForAppraisal(appraisalUuid, (data as any).trainings, auditUserUuid, tx);
      }
    }
  }
}
