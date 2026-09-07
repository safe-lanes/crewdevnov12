import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { getDb } from "../db";
import { getBaseRank } from "../../../shared/crew-mapping";
import { masterNationalities, masterUsers, masterVessels, masterVesselTypes } from "../../../shared/schema";
import { resolveRequestRole } from "../auth/roleResolutionService";
import { fileStorageService, MAX_ATTACHMENT_BYTES } from "../shared/fileStorageService";
import { crewMembersService } from "../crew-pool/services/crewMembersService";
import { crewDebriefingSubmissions, frmAnswers, frmSectionStates, frmSignatureAttachments, frmSectionSignatures } from "../../../shared/v2/forms-engine/schema";
import { admFormsV2, admFormVersionsV2, admRankGroupsV2, admRoleMasterAc } from "../../../shared/v2/admin/schema";
import { crewDebriefings } from "../../../shared/v2/crew-pool/schema";
import { debriefingRepository } from "./repository";
import type { Request } from "express";

export class DebriefingError extends Error { constructor(message: string, public statusCode: 400|403|404|409 = 400) { super(message); } }
export function isDebriefingSectionApplicable(raw: string | null, vesselType: string | null): boolean {
  let types: string[] = []; try { types = raw ? JSON.parse(raw) : []; } catch { throw new DebriefingError("Invalid pinned vessel applicability"); }
  // An empty list applies universally; a constrained list cannot apply when vessel type is unknown.
  return types.length === 0 || (!!vesselType && types.includes(vesselType));
}
const valueIsPresent = (v: string | null) => v !== null && v.trim() !== "";

export type DebriefingCreationTarget = {
  formUuid: string;
  formVersionId: number;
  formVersionUuid: string;
  rank: string;
  rankGroupName: string;
};

/** Parse rank-group membership exactly as Admin Forms does: a JSON rank array. */
export function parseDebriefingRankGroupRanks(ranks: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(ranks ?? "");
    return Array.isArray(parsed) ? parsed.map((rank) => String(rank).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function resolveDebriefingCreationTarget(input: {
  rankServed: string | null | undefined;
}, executor: any = getDb()): Promise<DebriefingCreationTarget> {
  const rank = (input.rankServed ?? "").trim();
  if (!rank) {
    throw new DebriefingError(
      "The selected G2 row has no rank served. Set the rank served before creating a Debriefing submission.",
      400,
    );
  }
  // Rank assignment is authoritative only in actual adm_rank_groups_v2 rows.
  // Do not consult the legacy adm_forms_v2.rank_group metadata or present rank.
  const candidates = await executor.select({
    form: admFormsV2,
    group: admRankGroupsV2,
  }).from(admRankGroupsV2).innerJoin(admFormsV2, eq(admFormsV2.id, admRankGroupsV2.formId))
    // Mirrors Forms: newest forms first, then the stable ascending group ID.
    .orderBy(desc(admFormsV2.createdAt), asc(admRankGroupsV2.id))
    .where(and(eq(admRankGroupsV2.isDeleted, false), isNull(admRankGroupsV2.archivedAt), eq(admFormsV2.isDeleted, false),
      sql`lower(btrim(${admFormsV2.category})) = 'debriefing'`));
  // Preserve Forms' literal-then-base-rank precedence while deriving all
  // membership solely from adm_rank_groups_v2.ranks.
  const labels = [rank, getBaseRank(rank)].filter((item, index, all) =>
    !!item && all.indexOf(item) === index).map((item) => item.toLowerCase());
  // Do not let a base-rank match in an earlier row eclipse a literal match.
  const matching = labels.map((label) => candidates.filter((candidate: any) =>
    parseDebriefingRankGroupRanks(candidate.group.ranks)
      .some((member) => member.toLowerCase() === label))).find((items) => items.length > 0) ?? [];
  if (!matching.length) {
    throw new DebriefingError(
      `No Debriefing Rank Group assigned from Admin Module for rank ${rank}. Please configure rank groups in Admin > Forms Configuration.`,
      404,
    );
  }
  let assigned: any;
  let version: any;
  for (const candidate of matching) {
    const versions = await executor.select().from(admFormVersionsV2).where(and(
      eq(admFormVersionsV2.formId, candidate.form.id),
      eq(admFormVersionsV2.rankGroupId, candidate.group.id),
      eq(admFormVersionsV2.isDeleted, false),
      eq(admFormVersionsV2.status, "released"),
    ));
    const released = versions.sort((a: any, b: any) =>
      Number(b.versionNo ?? 0) - Number(a.versionNo ?? 0) ||
      new Date(b.releasedAt ?? b.createdAt ?? 0).getTime() - new Date(a.releasedAt ?? a.createdAt ?? 0).getTime())[0];
    if (released) { assigned = candidate; version = released; break; }
  }
  const rankGroupName = (assigned ?? matching[0]).group.name?.trim();
  if (!assigned || !rankGroupName || !assigned.form.formUuid) {
    throw new DebriefingError(
      `No released Debriefing form version exists for rank group ${rankGroupName} (rank ${rank}). Please release a version in Admin > Forms Configuration.`,
      404,
    );
  }

  return { formUuid: assigned.form.formUuid, formVersionId: version.id, formVersionUuid: version.fvUuid, rank, rankGroupName };
}

export function formatDebriefingDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) return null;
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()];
  return `${String(date.getUTCDate()).padStart(2, "0")}-${month}-${date.getUTCFullYear()}`;
}

export function serializeFormParts(parts: any[]) {
  return parts.map((part: any) => ({
    form_part_uuid: part.formPartUuid,
    part_code: part.partCode,
    part_title: part.partTitle,
    part_type: part.partType,
    is_office_only: part.isOfficeOnly,
    sort_order: part.sortOrder,
  }));
}

async function lockWritableSubmission(tx: any, submissionUuid: string) {
  await tx.execute(sql`
    SELECT 1 FROM crew_debriefing_submissions
    WHERE debriefing_submission_uuid = ${submissionUuid} AND COALESCE(is_deleted, false) = false
    FOR UPDATE
  `);
  const submission = (await tx.select().from(crewDebriefingSubmissions).where(and(
    eq(crewDebriefingSubmissions.debriefingSubmissionUuid, submissionUuid),
    eq(crewDebriefingSubmissions.isDeleted, false),
  )).limit(1))[0];
  if (!submission) throw new DebriefingError("Debriefing submission not found", 404);
  if (submission.status === "completed") throw new DebriefingError("Completed Debriefing submissions are read-only", 409);
  return submission;
}

export function isMandatoryDebriefingAnswerPresent(
  responseType: string,
  answerValue: string | null,
): boolean {
  if (responseType === "info_only") return true;
  if (!valueIsPresent(answerValue)) return false;
  if (responseType !== "multi_select") return true;

  try {
    const selected = JSON.parse(answerValue as string);
    return Array.isArray(selected) && selected.length > 0;
  } catch {
    return false;
  }
}
/** The sole parent-read policy. Raw signature reads deliberately use this too. */
export async function authorizeDebriefingRead(req: Request): Promise<void> {
  if (!req.user) {
    throw new DebriefingError("Office access is required", 403);
  }
  const user = (await getDb().select({
    id: masterUsers.id,
    userType: masterUsers.userType,
  }).from(masterUsers).where(eq(masterUsers.id, req.user.id)).limit(1))[0];
  const jwtType = req.user.userType?.trim().toLocaleLowerCase();
  const masterType = user?.userType?.trim().toLocaleLowerCase();
  if (!user || jwtType !== "office" || masterType !== "office" || jwtType !== masterType) {
    throw new DebriefingError("Office access is required", 403);
  }
}

/**
 * Serialize every mutation for a submission.  The parent is locked before its
 * child state, which is the one lock order used by all mutation paths.
 */
async function lockWritableSection(tx: any, submissionUuid: string, sectionUuid: string) {
  await tx.execute(sql`
    SELECT 1 FROM crew_debriefing_submissions
    WHERE debriefing_submission_uuid = ${submissionUuid} AND COALESCE(is_deleted, false) = false
    FOR UPDATE
  `);
  const submission = (await tx.select().from(crewDebriefingSubmissions).where(and(
    eq(crewDebriefingSubmissions.debriefingSubmissionUuid, submissionUuid),
    eq(crewDebriefingSubmissions.isDeleted, false),
  )).limit(1))[0];
  if (!submission) throw new DebriefingError("Debriefing submission not found", 404);
  await tx.execute(sql`
    SELECT 1 FROM frm_section_states
    WHERE submission_uuid = ${submissionUuid} AND section_uuid = ${sectionUuid}
      AND COALESCE(is_deleted, false) = false
    FOR UPDATE
  `);
  const state = (await tx.select().from(frmSectionStates).where(and(
    eq(frmSectionStates.submissionUuid, submissionUuid),
    eq(frmSectionStates.sectionUuid, sectionUuid),
    eq(frmSectionStates.isDeleted, false),
  )).limit(1))[0];
  if (!state) throw new DebriefingError("Submission section not found", 404);
  if (state.status === "submitted" || state.status === "not_applicable") {
    throw new DebriefingError("Submitted or inapplicable sections are immutable", 409);
  }
  return { submission, state };
}

export const debriefingService = {
  async resolveCreation(input: { debriefingUuid: string }, req: Request) {
    await authorizeDebriefingRead(req);
    const g1 = await debriefingRepository.g1(input.debriefingUuid);
    if (!g1) throw new DebriefingError("G2 Debriefing row not found", 404);
    return resolveDebriefingCreationTarget({ rankServed: g1.rankServed });
  },

  async create(input: { debriefingUuid: string }, req: Request) {
    await authorizeDebriefingRead(req);
    const id = uuid(), db = getDb();
    const target = await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT 1 FROM crew_debriefings WHERE debriefing_uuid = ${input.debriefingUuid} FOR UPDATE`);
      const g1 = (await tx.select().from(crewDebriefings).where(and(
        eq(crewDebriefings.debriefingUuid, input.debriefingUuid),
        eq(crewDebriefings.isDeleted, false),
      )).limit(1))[0];
      if (!g1) throw new DebriefingError("G2 Debriefing row not found", 404);
      const existing = (await tx.select({ id: crewDebriefingSubmissions.id }).from(crewDebriefingSubmissions).where(and(
        eq(crewDebriefingSubmissions.debriefingUuid, input.debriefingUuid),
      )).limit(1))[0];
      if (existing) throw new DebriefingError("This G2 row already has a Debriefing submission", 409);
      const resolvedTarget = await resolveDebriefingCreationTarget({ rankServed: g1.rankServed }, tx);
      const tree = await debriefingRepository.structure(resolvedTarget.formVersionUuid, false, tx);
      let vesselTypeUuid: string | null = null;
      if (g1.vesselUuid) {
        const vessel = (await tx.select({ vesselType: masterVessels.vesselType }).from(masterVessels)
          .where(and(
            eq(masterVessels.vesselUuid, g1.vesselUuid),
            sql`COALESCE(${masterVessels.isDeleted}, false) = false`,
            sql`COALESCE(${masterVessels.isActive}, true) = true`,
          )).limit(1))[0];
        if (vessel?.vesselType) {
          const vesselType = (await tx.select({ uuid: masterVesselTypes.vtUuid }).from(masterVesselTypes)
            .where(and(
              or(
                eq(masterVesselTypes.vtUuid, vessel.vesselType),
                sql`lower(btrim(${masterVesselTypes.vesselType})) = lower(btrim(${vessel.vesselType}))`,
              ),
              sql`COALESCE(${masterVesselTypes.isDeleted}, false) = false`,
              sql`COALESCE(${masterVesselTypes.isActive}, true) = true`,
            )).limit(1))[0];
          vesselTypeUuid = vesselType?.uuid ?? null;
        }
      }
      await tx.insert(crewDebriefingSubmissions).values({ debriefingSubmissionUuid: id, debriefingUuid: input.debriefingUuid, crewUuid: g1.crewUuid, formUuid: resolvedTarget.formUuid, formVersionUuid: resolvedTarget.formVersionUuid, createdByUuid: String(req.user!.id), isSync: false });
      if (tree.sections.length) await tx.insert(frmSectionStates).values(tree.sections.map((section: any) => ({ sectionStateUuid: uuid(), submissionUuid: id, sectionUuid: section.sectionUuid, status: isDebriefingSectionApplicable(section.applicableVesselTypes, vesselTypeUuid) ? "not_started" : "not_applicable", createdByUuid: String(req.user!.id), isSync: false })));
      return resolvedTarget;
    });
    return {
      debriefing_submission_uuid: id,
      debriefing_uuid: input.debriefingUuid,
      form_uuid: target.formUuid,
      form_version_uuid: target.formVersionUuid,
      form_version_id: target.formVersionId,
      rank: target.rank,
      rank_group_name: target.rankGroupName,
      status: "in_progress",
    };
  },
  async read(submissionUuid: string, req: Request) {
    await authorizeDebriefingRead(req);
    const submission = await debriefingRepository.submission(submissionUuid); if (!submission) throw new DebriefingError("Debriefing submission not found", 404);
    const [structure, data, g1, formParts] = await Promise.all([
      debriefingRepository.structure(submission.formVersionUuid),
      debriefingRepository.readData(submissionUuid),
      submission.debriefingUuid ? debriefingRepository.g1(submission.debriefingUuid) : Promise.resolve(null),
      debriefingRepository.formParts(submission.formUuid),
    ]);
    const responsibleRoleUuids = Array.from(new Set<string>(
      structure.sections.flatMap((section: any) =>
        section.responsibleMode === "role" && section.responsibleRoleUuid
          ? [String(section.responsibleRoleUuid)]
          : [],
      ),
    ));
    const responsibleRoles = responsibleRoleUuids.length
      ? await getDb().select({
          ruid: admRoleMasterAc.ruid,
          assignedRole: admRoleMasterAc.assignedRole,
        }).from(admRoleMasterAc).where(inArray(admRoleMasterAc.ruid, responsibleRoleUuids))
      : [];
    const responsibleRoleNames = new Map(
      responsibleRoles.map((role: { ruid: string; assignedRole: string }) => [role.ruid, role.assignedRole]),
    );
    let crew: any;
    try {
      crew = await crewMembersService.getByUuid(submission.crewUuid);
    } catch {
      throw new DebriefingError("Submission crew member not found", 404);
    }
    const crewName = [crew.firstName, crew.middleName, crew.familyName]
      .filter((part: unknown) => typeof part === "string" && part.trim())
      .join(" ").trim();
    const nationality = crew.nationalityUuid
      ? (await getDb().select({ name: masterNationalities.nationality }).from(masterNationalities)
          .where(eq(masterNationalities.natUuid, crew.nationalityUuid)).limit(1))[0]?.name ?? null
      : null;
    let resolvedVesselName = g1?.vesselName?.trim() || null;
    if (!resolvedVesselName && g1?.vesselUuid) {
      const vessel = (await getDb().select({ name: masterVessels.vessel }).from(masterVessels)
        .where(eq(masterVessels.vesselUuid, g1.vesselUuid)).limit(1))[0];
      resolvedVesselName = vessel?.name ?? null;
    }
    const officer = (await getDb().select().from(masterUsers)
      .where(eq(masterUsers.id, req.user!.id)).limit(1))[0];
    const officerName = officer?.fullname ?? officer?.displayName ??
      (`${officer?.firstname ?? ""} ${officer?.lastname ?? ""}`.trim() || null);
    const witnessUuids = Array.from(new Set<string>(
      data.signatures.map((signature: any) => signature.signedByUuid).filter(Boolean),
    ));
    const witnesses = witnessUuids.length
      ? await getDb().select({
          userUuid: masterUsers.userUuid,
          fullname: masterUsers.fullname,
          displayName: masterUsers.displayName,
          firstname: masterUsers.firstname,
          lastname: masterUsers.lastname,
        }).from(masterUsers).where(inArray(masterUsers.userUuid, witnessUuids))
      : [];
    const witnessNames = new Map(witnesses.map((witness: any) => [
      witness.userUuid,
      witness.fullname ?? witness.displayName ??
        (`${witness.firstname ?? ""} ${witness.lastname ?? ""}`.trim() || null),
    ]));
    return {
      submission: {
        debriefing_submission_uuid: submission.debriefingSubmissionUuid,
        debriefing_uuid: submission.debriefingUuid,
        crew_uuid: submission.crewUuid,
        form_uuid: submission.formUuid,
        form_version_uuid: submission.formVersionUuid,
        status: submission.status,
        completed_at: submission.completedAt,
      },
      // The mutable G2 source is deliberately read fresh.  A historical
      // submission remains readable after source soft deletion, with only
      // source-derived context unavailable.
      g2_data_available: !!g1,
      partA: {
        seafarer_name: crewName || null,
        rank_served: g1?.rankServed ?? null,
        nationality,
        vessel_name: resolvedVesselName,
        sign_on_date: g1?.dateSignOn ?? null,
        sign_off_date: g1?.dateSignedOff ?? null,
        reason_for_sign_off: g1?.reasonForSignOff ?? null,
        debriefing_date: submission.debriefingDate,
        mode_of_debriefing: submission.modeOfDebriefing,
      },
      partC: {
        office_review_comments: submission.officeReviewComments,
        office_reviewed_by_uuid: submission.officeReviewedByUuid,
        office_reviewed_by_name: submission.officeReviewedByName,
        office_reviewed_at: submission.officeReviewedAt,
      },
      parts: serializeFormParts(formParts),
      structure: {
        sections: structure.sections.map((section: any) => ({
          section_uuid: section.sectionUuid,
          form_part_uuid: section.formPartUuid,
          section_code: section.sectionCode,
          section_title: section.sectionTitle,
          applicable_vessel_types: section.applicableVesselTypes,
          responsible_mode: section.responsibleMode,
          responsible_role_uuid: section.responsibleRoleUuid,
          responsible_role_name: section.responsibleMode === "role"
            ? responsibleRoleNames.get(section.responsibleRoleUuid) ?? null
            : null,
          responsible_department: section.responsibleDepartment,
          comment_box_required: section.commentBoxRequired,
          signature_officer_required: section.signatureOfficerRequired,
          signature_seafarer_required: section.signatureSeafarerRequired,
          default_option_set_uuid: section.defaultOptionSetUuid,
          layout_preference: section.layoutPreference,
          sort_order: section.sortOrder,
        })),
        questions: structure.questions.map((question: any) => ({
          question_uuid: question.questionUuid,
          section_uuid: question.sectionUuid,
          question_code: question.questionCode,
          question_text: question.questionText,
          response_type: question.responseType,
          is_mandatory: question.isMandatory,
          comment_enabled: question.commentEnabled,
          option_set_uuid: question.optionSetUuid,
          sort_order: question.sortOrder,
        })),
        options: structure.options.map((option: any) => ({
          option_uuid: option.optionUuid,
          option_set_uuid: option.optionSetUuid,
          option_label: option.optionLabel,
          option_value: option.optionValue,
          sort_order: option.sortOrder,
        })),
      },
      section_states: data.states.map((state: any) => ({
        section_state_uuid: state.sectionStateUuid, section_uuid: state.sectionUuid,
        status: state.status, section_comment: state.sectionComment,
        submitted_by_uuid: state.submittedByUuid, submitted_by_name: state.submittedByName,
        submitted_at: state.submittedAt,
      })),
      answers: data.answers.map((answer: any) => ({
        answer_uuid: answer.answerUuid, question_uuid: answer.questionUuid,
        answer_value: answer.answerValue, answer_comment: answer.answerComment,
      })),
      seafarer_default: {
        signer_name: crewName || null,
        signer_rank: g1?.rankServed ?? null,
      },
      officer_default: {
        signer_name: officerName,
        signer_rank: officer?.designation ?? null,
      },
      signatures: data.signatures.map((signature: any) => ({
        section_signature_uuid: signature.sectionSignatureUuid,
        signature_type: signature.signatureType,
        sig_att_uuid: signature.signatureAttUuid,
        section_state_uuid: signature.sectionStateUuid,
        signer_name: signature.signerName,
        signer_rank: signature.signerRank,
        signed_at: signature.signedAt,
        signed_by_uuid: signature.signedByUuid,
        witnessed_by_name: witnessNames.get(signature.signedByUuid) ?? null,
        signature_method: signature.signatureMethod,
        file_name: signature.attachment.fileName, file_type: signature.attachment.fileType,
        file_size: signature.attachment.fileSize,
      })),
    };
  },
  async list(crewUuid: string, req: Request) {
    await authorizeDebriefingRead(req);
    const rows = await getDb().select().from(crewDebriefingSubmissions).where(and(eq(crewDebriefingSubmissions.crewUuid, crewUuid), eq(crewDebriefingSubmissions.isDeleted, false)));
    return rows.map((submission: any) => ({
      debriefing_submission_uuid: submission.debriefingSubmissionUuid,
      crew_uuid: submission.crewUuid, form_uuid: submission.formUuid,
      form_version_uuid: submission.formVersionUuid, status: submission.status,
      completed_at: submission.completedAt, created_at: submission.createdAt,
    }));
  },
  async savePartA(submissionUuid: string, input: { debriefingDate: string | null; modeOfDebriefing: "company_office" | "manning_agent" | "video_call" | null }, req: Request) {
    await authorizeDebriefingRead(req);
    const db = getDb();
    await db.transaction(async (tx: any) => {
      await lockWritableSubmission(tx, submissionUuid);
      await tx.update(crewDebriefingSubmissions).set({
        debriefingDate: input.debriefingDate,
        modeOfDebriefing: input.modeOfDebriefing,
        updatedByUuid: String(req.user!.id),
        updatedAt: new Date(),
      }).where(eq(crewDebriefingSubmissions.debriefingSubmissionUuid, submissionUuid));
    });
    return { debriefing_date: input.debriefingDate, mode_of_debriefing: input.modeOfDebriefing };
  },
  async savePartC(submissionUuid: string, input: { officeReviewComments: string | null }, req: Request) {
    await authorizeDebriefingRead(req);
    const user = (await getDb().select().from(masterUsers).where(eq(masterUsers.id, req.user!.id)).limit(1))[0];
    if (!user) throw new DebriefingError("Authenticated user not found", 403);
    const reviewerName = user.fullname ?? user.displayName ??
      (`${user.firstname ?? ""} ${user.lastname ?? ""}`.trim() || null);
    const reviewedAt = new Date();
    const db = getDb();
    await db.transaction(async (tx: any) => {
      await lockWritableSubmission(tx, submissionUuid);
      await tx.update(crewDebriefingSubmissions).set({
        officeReviewComments: input.officeReviewComments,
        officeReviewedByUuid: user.userUuid ?? String(user.id),
        officeReviewedByName: reviewerName,
        officeReviewedAt: reviewedAt,
        updatedByUuid: String(req.user!.id),
        updatedAt: reviewedAt,
      }).where(eq(crewDebriefingSubmissions.debriefingSubmissionUuid, submissionUuid));
    });
    return {
      office_review_comments: input.officeReviewComments,
      office_reviewed_by_uuid: user.userUuid ?? String(user.id),
      office_reviewed_by_name: reviewerName,
      office_reviewed_at: reviewedAt,
    };
  },
  async writable(submissionUuid: string, sectionUuid: string) {
    const [submission, state] = await Promise.all([debriefingRepository.submission(submissionUuid), debriefingRepository.state(submissionUuid, sectionUuid)]);
    if (!submission || !state) throw new DebriefingError("Submission section not found", 404);
    if (state.status === "submitted") throw new DebriefingError("Submitted sections are immutable", 409);
    if (state.status === "not_applicable") throw new DebriefingError("Section is not applicable", 409);
    return { submission, state };
  },
  async assertOwner(req: Request, section: any) {
    if (!req.user) throw new DebriefingError("Authentication required", 403);
    const user = (await getDb().select().from(masterUsers).where(eq(masterUsers.id, req.user.id)).limit(1))[0];
    if (!user) throw new DebriefingError("Authenticated user not found", 403);
    if ((user.role ?? "").trim().toLowerCase() === "admin") return user;
    if (section.responsibleMode === "not_applicable") return user;
    if (section.responsibleMode === "department" && (user.department ?? "").trim().toLowerCase() === (section.responsibleDepartment ?? "").trim().toLowerCase()) return user;
    if (section.responsibleMode === "role") {
      const role = await resolveRequestRole(req);
      if (role.ok && role.role.roleId === section.responsibleRoleUuid) return user;
    }
    throw new DebriefingError("You are not responsible for this section", 403);
  },
  async saveAnswers(
    submissionUuid: string,
    sectionUuid: string,
    rawAnswers: Array<{ questionUuid: string; value: string | string[] | boolean | null; comment?: string | null }>
      | Record<string, { value: string | string[] | boolean | null; comment?: string | null }>,
    sectionComment: string | null | undefined,
    req: Request,
  ) {
    await authorizeDebriefingRead(req);
    const answerItems = Array.isArray(rawAnswers)
      ? rawAnswers
      : Object.entries(rawAnswers).map(([questionUuid, answer]) => ({ questionUuid, ...answer }));
    const { submission } = await this.writable(submissionUuid, sectionUuid);
    const tree = await debriefingRepository.structure(submission.formVersionUuid);
    const section = tree.sections.find((candidate: any) => candidate.sectionUuid === sectionUuid);
    if (!section) throw new DebriefingError("Section not found", 404);
    await this.assertOwner(req, section);

    const validatedAnswers = answerItems.map((item) => {
      const question = tree.questions.find((candidate: any) => candidate.questionUuid === item.questionUuid);
      if (!question || question.sectionUuid !== sectionUuid) {
        throw new DebriefingError("Question does not belong to this pinned section", 400);
      }

      const value = item.value;
      const type = question.responseType;
      let stored: string | null = null;
      if (value !== null) {
        if (type === "yes_no" && (typeof value !== "string" || !["yes", "no"].includes(value.toLowerCase()))) throw new DebriefingError("Expected yes or no");
        if (type === "yes_no_na" && (typeof value !== "string" || !["yes", "no", "na"].includes(value.toLowerCase()))) throw new DebriefingError("Expected yes, no, or na");
        if (type === "checkbox" && typeof value !== "boolean") throw new DebriefingError("Expected a boolean");
        if (type === "multi_select" && !Array.isArray(value)) throw new DebriefingError("Expected an array");
        if (["free_text", "date", "number", "single_select", "info_only"].includes(type) && typeof value !== "string") throw new DebriefingError("Expected a string");
        stored = Array.isArray(value) ? JSON.stringify(value) : String(value);
      }
      if (type === "info_only" && value !== null) throw new DebriefingError("Informational questions cannot be answered");
      if (type === "number" && value !== null && !Number.isFinite(Number(value))) throw new DebriefingError("Expected a finite number");
      if (type === "date" && value !== null && Number.isNaN(Date.parse(String(value)))) throw new DebriefingError("Expected a valid date");
      if (!question.commentEnabled && valueIsPresent(item.comment ?? null)) throw new DebriefingError("Comments are not enabled for this question");
      if (["single_select", "multi_select"].includes(type) && stored !== null) {
        const allowed = new Set(tree.options
          .filter((option: any) => option.optionSetUuid === (question.optionSetUuid ?? section.defaultOptionSetUuid))
          .map((option: any) => option.optionValue));
        const values = Array.isArray(value) ? value : [value];
        if (values.some((candidate) => typeof candidate !== "string" || !allowed.has(candidate))) {
          throw new DebriefingError("Answer contains an option outside this question's option set");
        }
      }
      return { questionUuid: item.questionUuid, answerValue: stored, answerComment: item.comment ?? null };
    });

    const db = getDb();
    await db.transaction(async (tx: any) => {
      await lockWritableSection(tx, submissionUuid, sectionUuid);
      for (const answer of validatedAnswers) {
        const row = {
          answerValue: answer.answerValue,
          answerComment: answer.answerComment,
          updatedByUuid: String(req.user!.id),
          updatedAt: new Date(),
        };
        await tx.insert(frmAnswers).values({
          answerUuid: uuid(),
          submissionUuid,
          questionUuid: answer.questionUuid,
          ...row,
          createdByUuid: String(req.user!.id),
          isSync: false,
        }).onConflictDoUpdate({
          target: [frmAnswers.submissionUuid, frmAnswers.questionUuid],
          set: row,
        });
      }
      if (sectionComment !== undefined) {
        await tx.update(frmSectionStates).set({
          sectionComment,
          updatedByUuid: String(req.user!.id),
          updatedAt: new Date(),
        }).where(and(
          eq(frmSectionStates.submissionUuid, submissionUuid),
          eq(frmSectionStates.sectionUuid, sectionUuid),
          eq(frmSectionStates.isDeleted, false),
        ));
      }
    });
  },
  async uploadSignature(
    submissionUuid: string,
    sectionUuid: string,
    input: { type: "officer" | "seafarer"; data: string; signerName?: string; signerRank?: string },
    req: Request,
  ) {
    // Both signature types are recorded by the authenticated office witness.
    // The officer type additionally derives its displayed identity from this session.
    await authorizeDebriefingRead(req);
    const { state, submission } = await this.writable(submissionUuid, sectionUuid); const section = (await debriefingRepository.structure(submission.formVersionUuid)).sections.find((s: any) => s.sectionUuid === sectionUuid); if (!section) throw new DebriefingError("Section not found", 404); const user = await this.assertOwner(req, section);
    const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.data); if (!match || input.data.length > Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 100) throw new DebriefingError("Signature must be a PNG base64 data URL");
    const bytes = Buffer.from(match[1], "base64"); if (bytes.length > MAX_ATTACHMENT_BYTES || fileStorageService.detectMimeBySignature(bytes) !== "image/png") throw new DebriefingError("Signature must be a PNG within the size limit");
    const path = await fileStorageService.writeAttachment("debriefings/signatures", "signature.png", bytes);
    const db = getDb(), att = uuid();
    let priorPath: string | null = null;
    try {
      await db.transaction(async (tx: any) => {
        const locked = await lockWritableSection(tx, submissionUuid, sectionUuid);
        const priorSignature = (await tx.select().from(frmSectionSignatures).where(and(
          eq(frmSectionSignatures.sectionStateUuid, locked.state.sectionStateUuid),
          eq(frmSectionSignatures.signatureType, input.type),
          eq(frmSectionSignatures.isDeleted, false),
        )).limit(1))[0];
        const priorAttUuid = priorSignature?.signatureAttUuid;
        if (priorAttUuid) {
          const prior = await tx.select().from(frmSignatureAttachments).where(eq(frmSignatureAttachments.sigAttUuid, priorAttUuid)).limit(1);
          priorPath = prior[0]?.filePath ?? null;
        }
        await tx.insert(frmSignatureAttachments).values({ sigAttUuid: att, fileName: "signature.png", fileType: "image/png", fileSize: String(bytes.length), filePath: path, createdByUuid: String(req.user!.id), isSync: false });
        const signerName = input.type === "seafarer"
          ? input.signerName!.trim()
          : (user.fullname ?? user.displayName ?? (`${user.firstname ?? ""} ${user.lastname ?? ""}`.trim() || "Officer"));
        const signerRank = input.type === "seafarer" ? input.signerRank!.trim() : null;
        const values = { signatureAttUuid: att, signerName, signerRank, signedAt: new Date(), signedByUuid: user.userUuid ?? String(req.user!.id), signatureMethod: input.type === "officer" ? "officer" : "witnessed", updatedByUuid: String(req.user!.id), updatedAt: new Date(), isDeleted: false };
        if (priorSignature) {
          await tx.update(frmSectionSignatures).set(values).where(eq(frmSectionSignatures.sectionSignatureUuid, priorSignature.sectionSignatureUuid));
        } else {
          await tx.insert(frmSectionSignatures).values({ sectionSignatureUuid: uuid(), sectionStateUuid: locked.state.sectionStateUuid, signatureType: input.type, ...values, createdByUuid: String(req.user!.id), isSync: false });
        }
        if (priorAttUuid) await tx.delete(frmSignatureAttachments).where(eq(frmSignatureAttachments.sigAttUuid, priorAttUuid));
      });
    } catch (error) {
      await fileStorageService.deleteAttachment(path);
      throw error;
    }
    if (priorPath) await fileStorageService.deleteAttachment(priorPath);
    return att;
  },
  async submit(submissionUuid: string, sectionUuid: string, comment: string | null | undefined, req: Request) {
    await authorizeDebriefingRead(req);
    const { submission, state } = await this.writable(submissionUuid, sectionUuid); const tree = await debriefingRepository.structure(submission.formVersionUuid); const section = tree.sections.find((s: any) => s.sectionUuid === sectionUuid); if (!section) throw new DebriefingError("Section not found", 404); const user = await this.assertOwner(req, section);
    const data = await debriefingRepository.readData(submissionUuid), answered = new Map<string, any>(data.answers.map((a: any) => [a.questionUuid, a]));
    const missing = tree.questions.filter((q: any) =>
      q.sectionUuid === sectionUuid &&
      q.isMandatory &&
      !isMandatoryDebriefingAnswerPresent(
        q.responseType,
        answered.get(q.questionUuid)?.answerValue ?? null,
      ),
    ).map((q: any) => ({
      question_uuid: q.questionUuid,
      question_text: q.questionText,
    }));
    if (missing.length) throw new DebriefingError(`Mandatory questions unanswered: ${missing.map((x: any) => x.question_text).join(", ")}`);
    if (section.commentBoxRequired && !valueIsPresent(comment ?? null)) throw new DebriefingError("A section comment is required");
    const requiredTypes = [
      ...(section.signatureOfficerRequired ? ["officer"] : []),
      ...(section.signatureSeafarerRequired ? ["seafarer"] : []),
    ];
    const presentTypes = new Set(data.signatures
      .filter((signature: any) => signature.sectionStateUuid === state.sectionStateUuid)
      .map((signature: any) => signature.signatureType));
    const missingSignatureType = requiredTypes.find((type) => !presentTypes.has(type));
    if (missingSignatureType) throw new DebriefingError(`A ${missingSignatureType} signature is required`);
    const db = getDb();
    await db.transaction(async (tx: any) => {
      const locked = await lockWritableSection(tx, submissionUuid, sectionUuid);
      const transactionAnswers = await tx.select().from(frmAnswers).where(and(
        eq(frmAnswers.submissionUuid, submissionUuid),
        eq(frmAnswers.isDeleted, false),
      ));
      const transactionAnswered = new Map<string, any>(
        transactionAnswers.map((answer: any) => [answer.questionUuid, answer]),
      );
      const transactionMissing = tree.questions.filter((question: any) =>
        question.sectionUuid === sectionUuid &&
        question.isMandatory &&
        !isMandatoryDebriefingAnswerPresent(
          question.responseType,
          transactionAnswered.get(question.questionUuid)?.answerValue ?? null,
        ),
      );
      if (transactionMissing.length) {
        throw new DebriefingError(`Mandatory questions unanswered: ${transactionMissing.map((question: any) => question.questionText).join(", ")}`);
      }
      const transactionSignatures = await tx.select().from(frmSectionSignatures).where(and(
        eq(frmSectionSignatures.sectionStateUuid, locked.state.sectionStateUuid),
        eq(frmSectionSignatures.isDeleted, false),
      ));
      const transactionTypes = new Set(transactionSignatures.map((signature: any) => signature.signatureType));
      const missingType = requiredTypes.find((type) => !transactionTypes.has(type));
      if (missingType) throw new DebriefingError(`A ${missingType} signature is required`);
      await tx.update(frmSectionStates).set({ status:"submitted", sectionComment:comment ?? null, submittedByUuid: user.userUuid ?? String(user.id), submittedByName:user.fullname ?? user.displayName ?? `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim(), submittedAt:new Date(), updatedByUuid: String(req.user!.id), updatedAt: new Date() }).where(eq(frmSectionStates.sectionStateUuid, locked.state.sectionStateUuid));
      const states = await tx.select({ status: frmSectionStates.status }).from(frmSectionStates).where(and(eq(frmSectionStates.submissionUuid, submissionUuid), eq(frmSectionStates.isDeleted, false)));
      if (states.every((item: { status: string }) => item.status === "submitted" || item.status === "not_applicable")) {
        await tx.update(crewDebriefingSubmissions).set({ status:"completed", completedAt:new Date(), updatedByUuid: String(req.user!.id), updatedAt: new Date() }).where(eq(crewDebriefingSubmissions.debriefingSubmissionUuid, submissionUuid));
      }
    });
    return { missing_questions: missing };
  },
  async rawSignature(attUuid: string, req: Request) {
    await authorizeDebriefingRead(req);
    const parent = await debriefingRepository.signatureParent(attUuid);
    if (!parent) throw new DebriefingError("Signature parent not found", 404);
    return parent.attachment;
  },
  async deleteSignature(submissionUuid: string, sectionUuid: string, type: "officer" | "seafarer", req: Request) {
    await authorizeDebriefingRead(req);
    const { state, submission } = await this.writable(submissionUuid, sectionUuid);
    const section = (await debriefingRepository.structure(submission.formVersionUuid)).sections.find((s: any) => s.sectionUuid === sectionUuid);
    if (!section) throw new DebriefingError("Section not found", 404);
    await this.assertOwner(req, section);
    let priorPath: string | null = null;
    const db = getDb();
    await db.transaction(async (tx: any) => {
      const locked = await lockWritableSection(tx, submissionUuid, sectionUuid);
      const signature = (await tx.select().from(frmSectionSignatures).where(and(
        eq(frmSectionSignatures.sectionStateUuid, locked.state.sectionStateUuid),
        eq(frmSectionSignatures.signatureType, type),
        eq(frmSectionSignatures.isDeleted, false),
      )).limit(1))[0];
      const priorAttUuid = signature?.signatureAttUuid;
      if (!signature || !priorAttUuid) return;
      const prior = await tx.select().from(frmSignatureAttachments)
        .where(eq(frmSignatureAttachments.sigAttUuid, priorAttUuid)).limit(1);
      priorPath = prior[0]?.filePath ?? null;
      await tx.delete(frmSectionSignatures).where(eq(frmSectionSignatures.sectionSignatureUuid, signature.sectionSignatureUuid));
      await tx.delete(frmSignatureAttachments).where(eq(frmSignatureAttachments.sigAttUuid, priorAttUuid));
    });
    if (priorPath) await fileStorageService.deleteAttachment(priorPath);
  },
};