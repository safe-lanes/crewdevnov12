import { and, eq, inArray, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { getDb } from "../db";
import { masterUsers } from "../../../shared/schema";
import { resolveRequestRole } from "../auth/roleResolutionService";
import { fileStorageService, MAX_ATTACHMENT_BYTES } from "../shared/fileStorageService";
import { formsService } from "../admin/services/formsService";
import { crewMembersService } from "../crew-pool/services/crewMembersService";
import { crewBriefingSubmissions, frmAnswers, frmSectionStates, frmSignatureAttachments, frmSectionSignatures } from "../../../shared/v2/forms-engine/schema";
import { admRoleMasterAc } from "../../../shared/v2/admin/schema";
import { briefingRepository } from "./repository";
import type { Request } from "express";

export class BriefingError extends Error { constructor(message: string, public statusCode: 400|403|404|409 = 400) { super(message); } }
export function isBriefingSectionApplicable(raw: string | null, vesselType: string | null): boolean {
  let types: string[] = []; try { types = raw ? JSON.parse(raw) : []; } catch { throw new BriefingError("Invalid pinned vessel applicability"); }
  // An empty list applies universally; a constrained list cannot apply when vessel type is unknown.
  return types.length === 0 || (!!vesselType && types.includes(vesselType));
}
const valueIsPresent = (v: string | null) => v !== null && v.trim() !== "";

export type BriefingCreationTarget = {
  formUuid: string;
  formVersionId: number;
  formVersionUuid: string;
  rank: string;
  rankGroupName: string;
};

export async function resolveBriefingCreationTarget(input: {
  formUuid: string;
  crewUuid: string;
}): Promise<BriefingCreationTarget> {
  let crew;
  try {
    crew = await crewMembersService.getByUuid(input.crewUuid);
  } catch {
    throw new BriefingError("Crew member not found", 404);
  }

  const rank = (crew.presentRank ?? "").trim();
  if (!rank) {
    throw new BriefingError(
      "The selected crew member has no current rank. Set the current rank before creating a Briefing submission.",
      400,
    );
  }

  const formForRank = await formsService.getFormForRank(rank, "briefing");
  const rankGroupName = formForRank?.rankGroupName?.trim();
  const resolvedFormUuid = formForRank?.formUuid;

  if (!rankGroupName || resolvedFormUuid !== input.formUuid) {
    throw new BriefingError(
      `No Briefing Rank Group assigned from Admin Module for rank ${rank}. Please configure rank groups in Admin > Forms Configuration.`,
      404,
    );
  }

  const formVersionId = formForRank?.formVersionId;
  const formVersionUuid = formForRank?.formVersionUuid;
  if (
    formForRank.noReleasedVersion ||
    !Number.isInteger(formVersionId) ||
    !formVersionUuid
  ) {
    throw new BriefingError(
      `No released Briefing form version exists for rank group ${rankGroupName} (rank ${rank}). Please release a version in Admin > Forms Configuration.`,
      404,
    );
  }

  return {
    formUuid: resolvedFormUuid,
    formVersionId,
    formVersionUuid,
    rank,
    rankGroupName,
  };
}

export function isMandatoryBriefingAnswerPresent(
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
export async function authorizeBriefingRead(req: Request): Promise<void> {
  if (!req.user) {
    throw new BriefingError("Office access is required", 403);
  }
  const user = (await getDb().select({
    id: masterUsers.id,
    userType: masterUsers.userType,
  }).from(masterUsers).where(eq(masterUsers.id, req.user.id)).limit(1))[0];
  const jwtType = req.user.userType?.trim().toLocaleLowerCase();
  const masterType = user?.userType?.trim().toLocaleLowerCase();
  if (!user || jwtType !== "office" || masterType !== "office" || jwtType !== masterType) {
    throw new BriefingError("Office access is required", 403);
  }
}

/**
 * Serialize every mutation for a submission.  The parent is locked before its
 * child state, which is the one lock order used by all mutation paths.
 */
async function lockWritableSection(tx: any, submissionUuid: string, sectionUuid: string) {
  await tx.execute(sql`
    SELECT 1 FROM crew_briefing_submissions
    WHERE briefing_submission_uuid = ${submissionUuid} AND COALESCE(is_deleted, false) = false
    FOR UPDATE
  `);
  const submission = (await tx.select().from(crewBriefingSubmissions).where(and(
    eq(crewBriefingSubmissions.briefingSubmissionUuid, submissionUuid),
    eq(crewBriefingSubmissions.isDeleted, false),
  )).limit(1))[0];
  if (!submission) throw new BriefingError("Briefing submission not found", 404);
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
  if (!state) throw new BriefingError("Submission section not found", 404);
  if (state.status === "submitted" || state.status === "not_applicable") {
    throw new BriefingError("Submitted or inapplicable sections are immutable", 409);
  }
  return { submission, state };
}

export const briefingService = {
  async resolveCreation(input: { formUuid: string; crewUuid: string }) {
    return resolveBriefingCreationTarget(input);
  },

  async create(input: { formUuid: string; crewUuid: string; vesselUuid?: string | null; vesselTypeUuid?: string | null }, req: Request) {
    if (!req.user) throw new BriefingError("Authentication required", 403);
    const target = await resolveBriefingCreationTarget(input);
    const tree = await briefingRepository.structure(target.formVersionUuid);
    const id = uuid(), db = getDb();
    await db.transaction(async (tx: any) => {
      await tx.insert(crewBriefingSubmissions).values({ briefingSubmissionUuid: id, crewUuid: input.crewUuid, vesselUuid: input.vesselUuid ?? null, vesselTypeUuid: input.vesselTypeUuid ?? null, formUuid: target.formUuid, formVersionUuid: target.formVersionUuid, createdByUuid: String(req.user!.id), isSync: false });
      if (tree.sections.length) await tx.insert(frmSectionStates).values(tree.sections.map((section: any) => ({ sectionStateUuid: uuid(), submissionUuid: id, sectionUuid: section.sectionUuid, status: isBriefingSectionApplicable(section.applicableVesselTypes, input.vesselTypeUuid ?? null) ? "not_started" : "not_applicable", createdByUuid: String(req.user!.id), isSync: false })));
    });
    return {
      briefing_submission_uuid: id,
      form_uuid: target.formUuid,
      form_version_uuid: target.formVersionUuid,
      form_version_id: target.formVersionId,
      rank: target.rank,
      rank_group_name: target.rankGroupName,
      status: "in_progress",
    };
  },
  async read(submissionUuid: string, req: Request) {
    await authorizeBriefingRead(req);
    const submission = await briefingRepository.submission(submissionUuid); if (!submission) throw new BriefingError("Briefing submission not found", 404);
    const [structure, data] = await Promise.all([briefingRepository.structure(submission.formVersionUuid), briefingRepository.readData(submissionUuid)]);
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
      throw new BriefingError("Submission crew member not found", 404);
    }
    const crewName = [crew.firstName, crew.middleName, crew.familyName]
      .filter((part: unknown) => typeof part === "string" && part.trim())
      .join(" ").trim();
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
        briefing_submission_uuid: submission.briefingSubmissionUuid,
        crew_uuid: submission.crewUuid,
        vessel_uuid: submission.vesselUuid,
        vessel_type_uuid: submission.vesselTypeUuid,
        form_uuid: submission.formUuid,
        form_version_uuid: submission.formVersionUuid,
        status: submission.status,
        completed_at: submission.completedAt,
      },
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
        signer_rank: crew.presentRank ?? null,
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
    await authorizeBriefingRead(req);
    const rows = await getDb().select().from(crewBriefingSubmissions).where(and(eq(crewBriefingSubmissions.crewUuid, crewUuid), eq(crewBriefingSubmissions.isDeleted, false)));
    return rows.map((submission: any) => ({
      briefing_submission_uuid: submission.briefingSubmissionUuid,
      crew_uuid: submission.crewUuid, vessel_uuid: submission.vesselUuid,
      vessel_type_uuid: submission.vesselTypeUuid, form_uuid: submission.formUuid,
      form_version_uuid: submission.formVersionUuid, status: submission.status,
      completed_at: submission.completedAt, created_at: submission.createdAt,
    }));
  },
  async writable(submissionUuid: string, sectionUuid: string) {
    const [submission, state] = await Promise.all([briefingRepository.submission(submissionUuid), briefingRepository.state(submissionUuid, sectionUuid)]);
    if (!submission || !state) throw new BriefingError("Submission section not found", 404);
    if (state.status === "submitted") throw new BriefingError("Submitted sections are immutable", 409);
    if (state.status === "not_applicable") throw new BriefingError("Section is not applicable", 409);
    return { submission, state };
  },
  async assertOwner(req: Request, section: any) {
    if (!req.user) throw new BriefingError("Authentication required", 403);
    const user = (await getDb().select().from(masterUsers).where(eq(masterUsers.id, req.user.id)).limit(1))[0];
    if (!user) throw new BriefingError("Authenticated user not found", 403);
    if ((user.role ?? "").trim().toLowerCase() === "admin") return user;
    if (section.responsibleMode === "not_applicable") return user;
    if (section.responsibleMode === "department" && (user.department ?? "").trim().toLowerCase() === (section.responsibleDepartment ?? "").trim().toLowerCase()) return user;
    if (section.responsibleMode === "role") {
      const role = await resolveRequestRole(req);
      if (role.ok && role.role.roleId === section.responsibleRoleUuid) return user;
    }
    throw new BriefingError("You are not responsible for this section", 403);
  },
  async saveAnswers(
    submissionUuid: string,
    sectionUuid: string,
    rawAnswers: Array<{ questionUuid: string; value: string | string[] | boolean | null; comment?: string | null }>
      | Record<string, { value: string | string[] | boolean | null; comment?: string | null }>,
    sectionComment: string | null | undefined,
    req: Request,
  ) {
    const answerItems = Array.isArray(rawAnswers)
      ? rawAnswers
      : Object.entries(rawAnswers).map(([questionUuid, answer]) => ({ questionUuid, ...answer }));
    const { submission } = await this.writable(submissionUuid, sectionUuid);
    const tree = await briefingRepository.structure(submission.formVersionUuid);
    const section = tree.sections.find((candidate: any) => candidate.sectionUuid === sectionUuid);
    if (!section) throw new BriefingError("Section not found", 404);
    await this.assertOwner(req, section);

    const validatedAnswers = answerItems.map((item) => {
      const question = tree.questions.find((candidate: any) => candidate.questionUuid === item.questionUuid);
      if (!question || question.sectionUuid !== sectionUuid) {
        throw new BriefingError("Question does not belong to this pinned section", 400);
      }

      const value = item.value;
      const type = question.responseType;
      let stored: string | null = null;
      if (value !== null) {
        if (type === "yes_no" && (typeof value !== "string" || !["yes", "no"].includes(value.toLowerCase()))) throw new BriefingError("Expected yes or no");
        if (type === "yes_no_na" && (typeof value !== "string" || !["yes", "no", "na"].includes(value.toLowerCase()))) throw new BriefingError("Expected yes, no, or na");
        if (type === "checkbox" && typeof value !== "boolean") throw new BriefingError("Expected a boolean");
        if (type === "multi_select" && !Array.isArray(value)) throw new BriefingError("Expected an array");
        if (["free_text", "date", "number", "single_select", "info_only"].includes(type) && typeof value !== "string") throw new BriefingError("Expected a string");
        stored = Array.isArray(value) ? JSON.stringify(value) : String(value);
      }
      if (type === "info_only" && value !== null) throw new BriefingError("Informational questions cannot be answered");
      if (type === "number" && value !== null && !Number.isFinite(Number(value))) throw new BriefingError("Expected a finite number");
      if (type === "date" && value !== null && Number.isNaN(Date.parse(String(value)))) throw new BriefingError("Expected a valid date");
      if (!question.commentEnabled && valueIsPresent(item.comment ?? null)) throw new BriefingError("Comments are not enabled for this question");
      if (["single_select", "multi_select"].includes(type) && stored !== null) {
        const allowed = new Set(tree.options
          .filter((option: any) => option.optionSetUuid === (question.optionSetUuid ?? section.defaultOptionSetUuid))
          .map((option: any) => option.optionValue));
        const values = Array.isArray(value) ? value : [value];
        if (values.some((candidate) => typeof candidate !== "string" || !allowed.has(candidate))) {
          throw new BriefingError("Answer contains an option outside this question's option set");
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
    await authorizeBriefingRead(req);
    const { state, submission } = await this.writable(submissionUuid, sectionUuid); const section = (await briefingRepository.structure(submission.formVersionUuid)).sections.find((s: any) => s.sectionUuid === sectionUuid); if (!section) throw new BriefingError("Section not found", 404); const user = await this.assertOwner(req, section);
    const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.data); if (!match || input.data.length > Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 100) throw new BriefingError("Signature must be a PNG base64 data URL");
    const bytes = Buffer.from(match[1], "base64"); if (bytes.length > MAX_ATTACHMENT_BYTES || fileStorageService.detectMimeBySignature(bytes) !== "image/png") throw new BriefingError("Signature must be a PNG within the size limit");
    const path = await fileStorageService.writeAttachment("briefings/signatures", "signature.png", bytes);
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
    const { submission, state } = await this.writable(submissionUuid, sectionUuid); const tree = await briefingRepository.structure(submission.formVersionUuid); const section = tree.sections.find((s: any) => s.sectionUuid === sectionUuid); if (!section) throw new BriefingError("Section not found", 404); const user = await this.assertOwner(req, section);
    const data = await briefingRepository.readData(submissionUuid), answered = new Map<string, any>(data.answers.map((a: any) => [a.questionUuid, a]));
    const missing = tree.questions.filter((q: any) =>
      q.sectionUuid === sectionUuid &&
      q.isMandatory &&
      !isMandatoryBriefingAnswerPresent(
        q.responseType,
        answered.get(q.questionUuid)?.answerValue ?? null,
      ),
    ).map((q: any) => ({
      question_uuid: q.questionUuid,
      question_text: q.questionText,
    }));
    if (missing.length) throw new BriefingError(`Mandatory questions unanswered: ${missing.map((x: any) => x.question_text).join(", ")}`);
    if (section.commentBoxRequired && !valueIsPresent(comment ?? null)) throw new BriefingError("A section comment is required");
    const requiredTypes = [
      ...(section.signatureOfficerRequired ? ["officer"] : []),
      ...(section.signatureSeafarerRequired ? ["seafarer"] : []),
    ];
    const presentTypes = new Set(data.signatures
      .filter((signature: any) => signature.sectionStateUuid === state.sectionStateUuid)
      .map((signature: any) => signature.signatureType));
    const missingSignatureType = requiredTypes.find((type) => !presentTypes.has(type));
    if (missingSignatureType) throw new BriefingError(`A ${missingSignatureType} signature is required`);
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
        !isMandatoryBriefingAnswerPresent(
          question.responseType,
          transactionAnswered.get(question.questionUuid)?.answerValue ?? null,
        ),
      );
      if (transactionMissing.length) {
        throw new BriefingError(`Mandatory questions unanswered: ${transactionMissing.map((question: any) => question.questionText).join(", ")}`);
      }
      const transactionSignatures = await tx.select().from(frmSectionSignatures).where(and(
        eq(frmSectionSignatures.sectionStateUuid, locked.state.sectionStateUuid),
        eq(frmSectionSignatures.isDeleted, false),
      ));
      const transactionTypes = new Set(transactionSignatures.map((signature: any) => signature.signatureType));
      const missingType = requiredTypes.find((type) => !transactionTypes.has(type));
      if (missingType) throw new BriefingError(`A ${missingType} signature is required`);
      await tx.update(frmSectionStates).set({ status:"submitted", sectionComment:comment ?? null, submittedByUuid: user.userUuid ?? String(user.id), submittedByName:user.fullname ?? user.displayName ?? `${user.firstname ?? ""} ${user.lastname ?? ""}`.trim(), submittedAt:new Date(), updatedByUuid: String(req.user!.id), updatedAt: new Date() }).where(eq(frmSectionStates.sectionStateUuid, locked.state.sectionStateUuid));
      const states = await tx.select({ status: frmSectionStates.status }).from(frmSectionStates).where(and(eq(frmSectionStates.submissionUuid, submissionUuid), eq(frmSectionStates.isDeleted, false)));
      if (states.every((item: { status: string }) => item.status === "submitted" || item.status === "not_applicable")) {
        await tx.update(crewBriefingSubmissions).set({ status:"completed", completedAt:new Date(), updatedByUuid: String(req.user!.id), updatedAt: new Date() }).where(eq(crewBriefingSubmissions.briefingSubmissionUuid, submissionUuid));
      }
    });
    return { missing_questions: missing };
  },
  async rawSignature(attUuid: string, req: Request) {
    await authorizeBriefingRead(req);
    const parent = await briefingRepository.signatureParent(attUuid);
    if (!parent) throw new BriefingError("Signature parent not found", 404);
    return parent.attachment;
  },
  async deleteSignature(submissionUuid: string, sectionUuid: string, type: "officer" | "seafarer", req: Request) {
    await authorizeBriefingRead(req);
    const { state, submission } = await this.writable(submissionUuid, sectionUuid);
    const section = (await briefingRepository.structure(submission.formVersionUuid)).sections.find((s: any) => s.sectionUuid === sectionUuid);
    if (!section) throw new BriefingError("Section not found", 404);
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