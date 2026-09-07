import { and, eq, inArray, or, sql } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import type { Request } from "express";
import { getDb } from "../db";
import { formsService } from "../admin/services/formsService";
import { masterNationalities, masterUsers } from "../../../shared/schema";
import { crewInterviewSubmissions, frmAnswers, frmSectionStates, frmSignatureAttachments, frmSectionSignatures, frmSections } from "../../../shared/v2/forms-engine/schema";
import { interviewRepository } from "./repository";
import { fileStorageService, MAX_ATTACHMENT_BYTES } from "../shared/fileStorageService";
import { resolveRequestRole } from "../auth/roleResolutionService";
import { recruitmentCandidatesV2, screeningB6InterviewItems, screeningB6Interviews } from "../../../shared/v2/recruitment/schema";
import { admRoleMasterAc } from "../../../shared/v2/admin/schema";

export class InterviewError extends Error { constructor(message: string, public statusCode: 400|403|404|409 = 400) { super(message); } }
const valueIsPresent = (v: string | null) => v !== null && v.trim() !== "";
export function isMandatoryInterviewAnswerPresent(responseType: string, answerValue: string | null) {
  if (responseType === "info_only") return true;
  if (!valueIsPresent(answerValue)) return false;
  if (responseType !== "multi_select") return true;
  try { const values = JSON.parse(answerValue as string); return Array.isArray(values) && values.length > 0; } catch { return false; }
}
export function serializeInterviewFormParts(parts: any[]) {
  return parts.map((part: any) => ({ form_part_uuid: part.formPartUuid, part_code: part.partCode, part_title: part.partTitle, part_type: part.partType, is_office_only: part.isOfficeOnly, sort_order: part.sortOrder }));
}
export function serializeInterviewStructure(tree: any, responsibleRoleNames = new Map<string, string>()) {
  return {
    sections: tree.sections.map((section: any) => ({ section_uuid:section.sectionUuid, form_part_uuid:section.formPartUuid, section_code:section.sectionCode, section_title:section.sectionTitle, applicable_vessel_types:section.applicableVesselTypes, responsible_mode:section.responsibleMode, responsible_role_uuid:section.responsibleRoleUuid, responsible_role_name:section.responsibleMode === "role" ? responsibleRoleNames.get(section.responsibleRoleUuid) ?? null : null, responsible_department:section.responsibleDepartment, comment_box_required:section.commentBoxRequired, signature_officer_required:section.signatureOfficerRequired, signature_seafarer_required:section.signatureSeafarerRequired, default_option_set_uuid:section.defaultOptionSetUuid, layout_preference:section.layoutPreference, sort_order:section.sortOrder })),
    questions: tree.questions.map((question: any) => ({ question_uuid:question.questionUuid, section_uuid:question.sectionUuid, question_code:question.questionCode, question_text:question.questionText, response_type:question.responseType, is_mandatory:question.isMandatory, comment_enabled:question.commentEnabled, option_set_uuid:question.optionSetUuid, sort_order:question.sortOrder })),
    options: tree.options.map((option: any) => ({ option_uuid:option.optionUuid, option_set_uuid:option.optionSetUuid, option_label:option.optionLabel, option_value:option.optionValue, sort_order:option.sortOrder })),
  };
}
export function resolveInterviewInterviewerName(interviewerReference: string | null | undefined, users: any[]) {
  if (!interviewerReference) return null;
  // Prefer a canonical UUID hit when a legacy display name happens to collide.
  const user = users.find((candidate: any) => candidate.userUuid === interviewerReference)
    ?? users.find((candidate: any) => candidate.fullname === interviewerReference || candidate.displayName === interviewerReference);
  if (!user) return null;
  return user.fullname ?? user.displayName ??
    (`${user.firstname ?? ""} ${user.lastname ?? ""}`.trim() || null);
}
export async function authorizeInterviewRead(req: Request) {
  if (!req.user) throw new InterviewError("Office access is required", 403);
  const user = (await getDb().select({ id: masterUsers.id, userType: masterUsers.userType }).from(masterUsers).where(eq(masterUsers.id, req.user.id)).limit(1))[0];
  const jwtType = req.user.userType?.trim().toLowerCase(), masterType = user?.userType?.trim().toLowerCase();
  if (!user || jwtType !== "office" || masterType !== "office" || jwtType !== masterType) throw new InterviewError("Office access is required", 403);
}
export async function resolveInterviewCreationTarget(rankAppliedFor: string | null | undefined) {
  const rank = rankAppliedFor?.trim() ?? "";
  if (!rank) throw new InterviewError("The recruitment candidate has no rank applied for. Set rank applied for before creating a Crew Interview submission.");
  const found = await formsService.getFormForRank(rank, "interview");
  if (!found?.rankGroupName || !found?.formUuid) throw new InterviewError(`No Crew Interview Rank Group assigned from Admin Module for rank ${rank}. Please configure rank groups in Admin > Forms Configuration.`, 404);
  if (found.noReleasedVersion || !Number.isInteger(found.formVersionId) || !found.formVersionUuid) throw new InterviewError(`No released Crew Interview form version exists for rank group ${found.rankGroupName} (rank ${rank}). Please release a version in Admin > Forms Configuration.`, 404);
  return { formUuid: found.formUuid, formVersionUuid: found.formVersionUuid, formVersionId: found.formVersionId, rank, rankGroupName: found.rankGroupName };
}
async function writable(tx: any, submissionUuid: string, sectionUuid?: string) {
  await tx.execute(sql`SELECT 1 FROM crew_interview_submissions WHERE interview_submission_uuid=${submissionUuid} AND COALESCE(is_deleted,false)=false FOR UPDATE`);
  const s = (await tx.select().from(crewInterviewSubmissions).where(and(eq(crewInterviewSubmissions.interviewSubmissionUuid, submissionUuid), eq(crewInterviewSubmissions.isDeleted, false))).limit(1))[0];
  if (!s) throw new InterviewError("Crew Interview submission not found", 404);
  if (s.status === "completed") throw new InterviewError("Completed Crew Interview submissions are read-only", 409);
  if (sectionUuid) {
    const state = (await tx.select().from(frmSectionStates).where(and(eq(frmSectionStates.submissionUuid, submissionUuid), eq(frmSectionStates.sectionUuid, sectionUuid), eq(frmSectionStates.isDeleted, false))).limit(1))[0];
    if (!state) throw new InterviewError("Submission section not found", 404);
    if (state.status === "submitted") throw new InterviewError("Submitted sections are immutable", 409);
    return { s, state };
  }
  return { s };
}
async function assertOwner(req: Request, section: any) {
  if (!req.user) throw new InterviewError("Authentication required", 403);
  const user = (await getDb().select().from(masterUsers).where(eq(masterUsers.id, req.user.id)).limit(1))[0];
  if (!user) throw new InterviewError("Authenticated user not found", 403);
  if ((user.role ?? "").trim().toLowerCase() === "admin" || section.responsibleMode === "not_applicable") return user;
  if (section.responsibleMode === "department" && (user.department ?? "").trim().toLowerCase() === (section.responsibleDepartment ?? "").trim().toLowerCase()) return user;
  if (section.responsibleMode === "role") { const role = await resolveRequestRole(req); if (role.ok && role.role.roleId === section.responsibleRoleUuid) return user; }
  throw new InterviewError("You are not responsible for this section", 403);
}
export const interviewService = {
  async resolveCreation(input: { interviewItemUuid: string }, req: Request) {
    await authorizeInterviewRead(req);
    const row = await interviewRepository.item(input.interviewItemUuid);
    if (!row) throw new InterviewError("Active B6 interview item not found", 404);
    return resolveInterviewCreationTarget(row.candidate.rankAppliedFor);
  },
  async create(input: { interviewItemUuid: string }, req: Request) {
    await authorizeInterviewRead(req);
    const id = uuid(), db = getDb();
    const result = await db.transaction(async (tx: any) => {
      // B6, its parent, and its candidate are authoritative and locked together
      // before resolution/insert so an in-flight soft delete cannot be used.
      await tx.execute(sql`SELECT 1 FROM screening_b6_interview_items WHERE int_uuid=${input.interviewItemUuid} AND COALESCE(is_deleted,false)=false FOR UPDATE`);
      const item = (await tx.select().from(screeningB6InterviewItems).where(and(eq(screeningB6InterviewItems.intUuid, input.interviewItemUuid), eq(screeningB6InterviewItems.isDeleted, false))).limit(1))[0];
      if (!item) throw new InterviewError("Active B6 interview item not found", 404);
      await tx.execute(sql`SELECT 1 FROM screening_b6_interviews WHERE b6_uuid=${item.b6Uuid} AND COALESCE(is_deleted,false)=false FOR UPDATE`);
      const parent = (await tx.select().from(screeningB6Interviews).where(and(eq(screeningB6Interviews.b6Uuid, item.b6Uuid), eq(screeningB6Interviews.isDeleted, false))).limit(1))[0];
      if (!parent) throw new InterviewError("Active B6 interview item not found", 404);
      await tx.execute(sql`SELECT 1 FROM recruitment_candidates_v2 WHERE rec_can_uuid=${parent.recCanUuid} AND COALESCE(is_deleted,false)=false FOR UPDATE`);
      const candidate = (await tx.select().from(recruitmentCandidatesV2).where(and(eq(recruitmentCandidatesV2.recCanUuid, parent.recCanUuid), eq(recruitmentCandidatesV2.isDeleted, false))).limit(1))[0];
      if (!candidate) throw new InterviewError("Active B6 interview item not found", 404);
      const exists = (await tx.select({ id: crewInterviewSubmissions.id }).from(crewInterviewSubmissions).where(eq(crewInterviewSubmissions.interviewItemUuid, input.interviewItemUuid)).limit(1))[0];
      if (exists) throw new InterviewError("This B6 interview item already has a Crew Interview submission", 409);
      const resolved = await resolveInterviewCreationTarget(candidate.rankAppliedFor);
      const tree = await tx.select().from(frmSections).where(and(eq(frmSections.formVersionUuid, resolved.formVersionUuid), eq(frmSections.isDeleted, false)));
      try { await tx.insert(crewInterviewSubmissions).values({ interviewSubmissionUuid: id, interviewItemUuid: input.interviewItemUuid, recCanUuid: parent.recCanUuid, formUuid: resolved.formUuid, formVersionUuid: resolved.formVersionUuid, createdByUuid: String((req.user as any).id), isSync: false }); }
      catch (error: any) { if (error?.code === "23505") throw new InterviewError("This B6 interview item already has a Crew Interview submission", 409); throw error; }
      // Candidates are not vessel-assigned: every pinned section is applicable.
      if (tree.length) await tx.insert(frmSectionStates).values(tree.map((section: any) => ({ sectionStateUuid: uuid(), submissionUuid: id, sectionUuid: section.sectionUuid, status: "not_started", createdByUuid: String(req.user!.id), isSync: false })));
      return resolved;
    });
    return { interview_submission_uuid: id, interview_item_uuid: input.interviewItemUuid, form_uuid: result.formUuid, form_version_uuid: result.formVersionUuid, form_version_id: result.formVersionId, rank: result.rank, rank_group_name: result.rankGroupName, status: "in_progress" };
  },
  async read(submissionUuid: string, req: Request) {
    await authorizeInterviewRead(req);
    const submission = await interviewRepository.submission(submissionUuid); if (!submission) throw new InterviewError("Crew Interview submission not found", 404);
    const [tree, data, parts] = await Promise.all([interviewRepository.structure(submission.formVersionUuid), interviewRepository.data(submissionUuid), interviewRepository.parts(submission.formUuid)]);
    // B6 is read fresh and never mutated. A deleted/missing B6 item is represented as unavailable.
    const b6 = submission.interviewItemUuid ? await interviewRepository.item(submission.interviewItemUuid) : null;
    const candidate = b6?.candidate;
    const nationality = candidate?.nationalityUuid ? (await getDb().select({ name: masterNationalities.nationality }).from(masterNationalities).where(eq(masterNationalities.natUuid, candidate.nationalityUuid)).limit(1))[0]?.name ?? null : null;
    const interviewerReference = b6?.item.interviewerUuid ?? null;
    const interviewers = interviewerReference
      ? await getDb().select().from(masterUsers).where(or(
        eq(masterUsers.userUuid, interviewerReference),
        eq(masterUsers.fullname, interviewerReference),
        eq(masterUsers.displayName, interviewerReference),
      ))
      : [];
    const interviewerName = resolveInterviewInterviewerName(interviewerReference, interviewers);
    const responsibleIds: string[] = Array.from(new Set<string>(tree.sections.filter((section: any) => section.responsibleMode === "role" && section.responsibleRoleUuid).map((section: any) => String(section.responsibleRoleUuid))));
    const roles = responsibleIds.length ? await getDb().select({ ruid: admRoleMasterAc.ruid, assignedRole: admRoleMasterAc.assignedRole }).from(admRoleMasterAc).where(inArray(admRoleMasterAc.ruid, responsibleIds)) : [];
    const roleNames = new Map<string, string>(roles.map((role: any) => [String(role.ruid), String(role.assignedRole)]));
    const officer = (await getDb().select().from(masterUsers).where(eq(masterUsers.id, req.user!.id)).limit(1))[0];
    const signerIds: string[] = Array.from(new Set<string>(data.signatures.map((signature: any) => String(signature.signedByUuid)).filter(Boolean)));
    const witnesses = signerIds.length ? await getDb().select().from(masterUsers).where(inArray(masterUsers.userUuid, signerIds)) : [];
    const witnessNames = new Map(witnesses.map((witness: any) => [witness.userUuid, witness.fullname ?? witness.displayName ?? (`${witness.firstname ?? ""} ${witness.lastname ?? ""}`.trim() || null)]));
    const candidateName = candidate ? [candidate.firstName, candidate.middleName, candidate.familyName].filter(Boolean).join(" ") || null : null;
    return { submission: { interview_submission_uuid: submission.interviewSubmissionUuid, interview_item_uuid: submission.interviewItemUuid, rec_can_uuid: submission.recCanUuid, form_uuid: submission.formUuid, form_version_uuid: submission.formVersionUuid, status: submission.status, completed_at: submission.completedAt },
      b6_data_available: !!b6,
      partA: { candidate_name: candidateName, rank: candidate?.rankAppliedFor ?? null, nationality, interview_date: b6?.item.interviewDate ?? null, interviewer_name: interviewerName, interview_category: submission.interviewCategory, interview_stage: submission.interviewStage },
      partC: {
        status: b6?.item.status ?? null,
        result: b6?.item.result ?? null,
        interviewer_comments: submission.interviewerComments,
        office_reviewed_by_uuid: submission.officeReviewedByUuid,
        office_reviewed_by_name: submission.officeReviewedByName,
        office_reviewed_at: submission.officeReviewedAt,
      },
      parts: serializeInterviewFormParts(parts), structure: serializeInterviewStructure(tree, roleNames),
      section_states: data.states.map((state:any) => ({ section_state_uuid:state.sectionStateUuid, section_uuid:state.sectionUuid, status:state.status, section_comment:state.sectionComment, submitted_by_uuid:state.submittedByUuid, submitted_by_name:state.submittedByName, submitted_at:state.submittedAt })),
      answers: data.answers.map((answer:any) => ({ answer_uuid:answer.answerUuid, question_uuid:answer.questionUuid, answer_value:answer.answerValue, answer_comment:answer.answerComment })),
      seafarer_default: { signer_name:candidateName, signer_rank:candidate?.rankAppliedFor ?? null },
      officer_default: { signer_name: officer?.fullname ?? officer?.displayName ?? (`${officer?.firstname ?? ""} ${officer?.lastname ?? ""}`.trim() || null), signer_rank: officer?.designation ?? null },
      signatures: data.signatures.map((signature: any) => ({ section_signature_uuid: signature.sectionSignatureUuid, section_state_uuid: signature.sectionStateUuid, signature_type: signature.signatureType, sig_att_uuid: signature.signatureAttUuid, signer_name: signature.signerName, signer_rank: signature.signerRank, signed_at: signature.signedAt, signed_by_uuid: signature.signedByUuid, witnessed_by_name:witnessNames.get(signature.signedByUuid) ?? null, signature_method: signature.signatureMethod, file_name: signature.attachment.fileName, file_type: signature.attachment.fileType, file_size: signature.attachment.fileSize })) };
  },
  async list(recCanUuid: string, req: Request) { await authorizeInterviewRead(req); return (await getDb().select().from(crewInterviewSubmissions).where(and(eq(crewInterviewSubmissions.recCanUuid, recCanUuid), eq(crewInterviewSubmissions.isDeleted, false)))).map((submission:any) => ({ interview_submission_uuid:submission.interviewSubmissionUuid, interview_item_uuid:submission.interviewItemUuid, rec_can_uuid:submission.recCanUuid, form_uuid:submission.formUuid, form_version_uuid:submission.formVersionUuid, status:submission.status, completed_at:submission.completedAt, created_at:submission.createdAt })); },
  async savePartA(uuid: string, input: { interviewCategory: string|null; interviewStage: string|null }, req: Request) {
    await authorizeInterviewRead(req); await getDb().transaction(async (tx: any) => { await writable(tx, uuid); await tx.update(crewInterviewSubmissions).set({ interviewCategory: input.interviewCategory, interviewStage: input.interviewStage, updatedByUuid: String(req.user!.id) }).where(eq(crewInterviewSubmissions.interviewSubmissionUuid, uuid)); }); return input;
  },
  async savePartC(uuid: string, input: { interviewerComments: string|null }, req: Request) {
    await authorizeInterviewRead(req);
    const user = (await getDb().select().from(masterUsers).where(eq(masterUsers.id, req.user!.id)).limit(1))[0];
    if (!user) throw new InterviewError("Authenticated user not found", 403);
    const reviewerName = user.fullname ?? user.displayName ??
      (`${user.firstname ?? ""} ${user.lastname ?? ""}`.trim() || null);
    const reviewedAt = new Date();
    const reviewerUuid = user.userUuid ?? String(user.id);
    await getDb().transaction(async (tx: any) => {
      await writable(tx, uuid);
      await tx.update(crewInterviewSubmissions).set({
        interviewerComments: input.interviewerComments,
        officeReviewedByUuid: reviewerUuid,
        officeReviewedByName: reviewerName,
        officeReviewedAt: reviewedAt,
        updatedByUuid: String(req.user!.id),
        updatedAt: reviewedAt,
      }).where(eq(crewInterviewSubmissions.interviewSubmissionUuid, uuid));
    });
    return {
      interviewer_comments: input.interviewerComments,
      office_reviewed_by_uuid: reviewerUuid,
      office_reviewed_by_name: reviewerName,
      office_reviewed_at: reviewedAt,
    };
  },
  async saveAnswers(submissionUuid: string, sectionUuid: string, answers: any[], sectionComment: string|null|undefined, req: Request) {
    await authorizeInterviewRead(req);
    const s = await interviewRepository.submission(submissionUuid); if (!s) throw new InterviewError("Crew Interview submission not found", 404);
    const tree: any = await interviewRepository.structure(s.formVersionUuid);
    const section = tree.sections.find((q: any) => q.sectionUuid === sectionUuid);
    if (!section) throw new InterviewError("Section not found", 404);
    await assertOwner(req, section);
    for (const a of answers) {
      const question = tree.questions.find((q: any) => q.questionUuid === a.questionUuid && q.sectionUuid === sectionUuid);
      if (!question) throw new InterviewError("Question does not belong to this pinned section");
      const type = question.responseType, value = a.value;
      if (type === "info_only" && value !== null) throw new InterviewError("Informational questions cannot be answered");
      if (value !== null) {
        if (type === "yes_no" && (typeof value !== "string" || !["yes", "no"].includes(value.toLowerCase()))) throw new InterviewError("Expected yes or no");
        if (type === "yes_no_na" && (typeof value !== "string" || !["yes", "no", "na"].includes(value.toLowerCase()))) throw new InterviewError("Expected yes, no, or na");
        if (type === "checkbox" && typeof value !== "boolean") throw new InterviewError("Expected a boolean");
        if (type === "multi_select" && !Array.isArray(value)) throw new InterviewError("Expected an array");
        if (["free_text", "date", "number", "single_select"].includes(type) && typeof value !== "string") throw new InterviewError("Expected a string");
        if (type === "number" && !Number.isFinite(Number(value))) throw new InterviewError("Expected a finite number");
        if (type === "date" && Number.isNaN(Date.parse(String(value)))) throw new InterviewError("Expected a valid date");
        if (["single_select", "multi_select"].includes(type)) {
          const allowed = new Set(tree.options.filter((option: any) => option.optionSetUuid === (question.optionSetUuid ?? section.defaultOptionSetUuid)).map((option: any) => option.optionValue));
          if ((Array.isArray(value) ? value : [value]).some((item: any) => typeof item !== "string" || !allowed.has(item))) throw new InterviewError("Answer contains an option outside this question's option set");
        }
      }
      if (!question.commentEnabled && valueIsPresent(a.comment ?? null)) throw new InterviewError("Comments are not enabled for this question");
    }
    await getDb().transaction(async (tx: any) => { await writable(tx, submissionUuid, sectionUuid); for (const a of answers) await tx.insert(frmAnswers).values({ answerUuid: uuid(), submissionUuid, questionUuid: a.questionUuid, answerValue: a.value === null ? null : Array.isArray(a.value) ? JSON.stringify(a.value) : String(a.value), answerComment: a.comment ?? null, createdByUuid: String(req.user!.id), isSync:false }).onConflictDoUpdate({ target:[frmAnswers.submissionUuid, frmAnswers.questionUuid], set:{ answerValue:a.value === null ? null : Array.isArray(a.value) ? JSON.stringify(a.value) : String(a.value), answerComment:a.comment ?? null } }); if(sectionComment !== undefined) await tx.update(frmSectionStates).set({sectionComment}).where(and(eq(frmSectionStates.submissionUuid,submissionUuid),eq(frmSectionStates.sectionUuid,sectionUuid))); });
  },
  async submit(submissionUuid: string, sectionUuid: string, comment: string|null|undefined, req: Request) {
    await authorizeInterviewRead(req); const s=await interviewRepository.submission(submissionUuid); if(!s) throw new InterviewError("Crew Interview submission not found",404); const tree:any=await interviewRepository.structure(s.formVersionUuid), data:any=await interviewRepository.data(submissionUuid); const section=tree.sections.find((q:any)=>q.sectionUuid===sectionUuid); if(!section) throw new InterviewError("Section not found",404); const user=await assertOwner(req, section);
    const missing=tree.questions.filter((q:any)=>q.sectionUuid===sectionUuid&&q.isMandatory&&!isMandatoryInterviewAnswerPresent(q.responseType,data.answers.find((a:any)=>a.questionUuid===q.questionUuid)?.answerValue??null)); if(missing.length) throw new InterviewError(`Mandatory questions unanswered: ${missing.map((x:any)=>x.questionText).join(", ")}`);
    if (section.commentBoxRequired && !valueIsPresent(comment ?? null)) throw new InterviewError("A section comment is required");
    const needed = [...(section.signatureOfficerRequired ? ["officer"] : []), ...(section.signatureSeafarerRequired ? ["seafarer"] : [])];
    const present = new Set(data.signatures.filter((signature:any) => data.states.find((state:any) => state.sectionStateUuid === signature.sectionStateUuid)?.sectionUuid === sectionUuid).map((signature:any) => signature.signatureType));
    const absent = needed.find(type => !present.has(type)); if (absent) throw new InterviewError(`A ${absent} signature is required`);
    await getDb().transaction(async (tx:any)=>{const locked=await writable(tx,submissionUuid,sectionUuid); const transactionAnswers=await tx.select().from(frmAnswers).where(and(eq(frmAnswers.submissionUuid,submissionUuid),eq(frmAnswers.isDeleted,false))); const transactionMissing=tree.questions.filter((q:any)=>q.sectionUuid===sectionUuid&&q.isMandatory&&!isMandatoryInterviewAnswerPresent(q.responseType,transactionAnswers.find((a:any)=>a.questionUuid===q.questionUuid)?.answerValue??null)); if(transactionMissing.length) throw new InterviewError(`Mandatory questions unanswered: ${transactionMissing.map((q:any)=>q.questionText).join(", ")}`); if(section.commentBoxRequired&&!valueIsPresent(comment??null)) throw new InterviewError("A section comment is required"); const transactionSignatures=await tx.select().from(frmSectionSignatures).where(and(eq(frmSectionSignatures.sectionStateUuid,locked.state.sectionStateUuid),eq(frmSectionSignatures.isDeleted,false))); const transactionTypes=new Set(transactionSignatures.map((item:any)=>item.signatureType)); const missingSignature=needed.find(type=>!transactionTypes.has(type)); if(missingSignature) throw new InterviewError(`A ${missingSignature} signature is required`); await tx.update(frmSectionStates).set({status:"submitted",sectionComment:comment??null,submittedByUuid:user.userUuid??String(user.id),submittedByName:user.fullname??user.displayName??`${user.firstname??""} ${user.lastname??""}`.trim(),submittedAt:new Date()}).where(eq(frmSectionStates.sectionStateUuid,locked.state.sectionStateUuid)); const states=await tx.select().from(frmSectionStates).where(and(eq(frmSectionStates.submissionUuid,submissionUuid),eq(frmSectionStates.isDeleted,false))); if(states.every((x:any)=>x.status==="submitted")) await tx.update(crewInterviewSubmissions).set({status:"completed",completedAt:new Date()}).where(eq(crewInterviewSubmissions.interviewSubmissionUuid,submissionUuid));});
  },
  async uploadSignature(submissionUuid: string, sectionUuid: string, input: { type: "officer"|"seafarer"; data: string; signerName?: string; signerRank?: string }, req: Request) {
    await authorizeInterviewRead(req);
    const submission = await interviewRepository.submission(submissionUuid); if (!submission) throw new InterviewError("Crew Interview submission not found", 404);
    const section = (await interviewRepository.structure(submission.formVersionUuid)).sections.find((item: any) => item.sectionUuid === sectionUuid);
    if (!section) throw new InterviewError("Section not found", 404);
    const user = await assertOwner(req, section);
    const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.data);
    if (!match || input.data.length > Math.ceil(MAX_ATTACHMENT_BYTES * 4 / 3) + 100) throw new InterviewError("Signature must be a PNG base64 data URL");
    const bytes = Buffer.from(match[1], "base64");
    if (bytes.length > MAX_ATTACHMENT_BYTES || fileStorageService.detectMimeBySignature(bytes) !== "image/png") throw new InterviewError("Signature must be a PNG within the size limit");
    const path = await fileStorageService.writeAttachment("interviews/signatures", "signature.png", bytes), att = uuid();
    let previousPath: string | null = null;
    try {
      await getDb().transaction(async (tx: any) => {
        const locked = await writable(tx, submissionUuid, sectionUuid);
        const previous = (await tx.select().from(frmSectionSignatures).where(and(eq(frmSectionSignatures.sectionStateUuid, locked.state.sectionStateUuid), eq(frmSectionSignatures.signatureType, input.type), eq(frmSectionSignatures.isDeleted, false))).limit(1))[0];
        if (previous) previousPath = (await tx.select().from(frmSignatureAttachments).where(eq(frmSignatureAttachments.sigAttUuid, previous.signatureAttUuid)).limit(1))[0]?.filePath ?? null;
        await tx.insert(frmSignatureAttachments).values({ sigAttUuid: att, fileName: "signature.png", fileType: "image/png", fileSize: String(bytes.length), filePath: path, createdByUuid: String(req.user!.id), isSync: false });
        const values = { signatureAttUuid: att, signerName: input.type === "seafarer" ? input.signerName!.trim() : (user.fullname ?? user.displayName ?? (`${user.firstname ?? ""} ${user.lastname ?? ""}`.trim() || "Officer")), signerRank: input.type === "seafarer" ? input.signerRank!.trim() : null, signedAt: new Date(), signedByUuid: user.userUuid ?? String(user.id), signatureMethod: input.type === "officer" ? "officer" : "witnessed", updatedByUuid: String(req.user!.id), updatedAt: new Date(), isDeleted: false };
        if (previous) { await tx.update(frmSectionSignatures).set(values).where(eq(frmSectionSignatures.sectionSignatureUuid, previous.sectionSignatureUuid)); await tx.delete(frmSignatureAttachments).where(eq(frmSignatureAttachments.sigAttUuid, previous.signatureAttUuid)); }
        else await tx.insert(frmSectionSignatures).values({ sectionSignatureUuid: uuid(), sectionStateUuid: locked.state.sectionStateUuid, signatureType: input.type, ...values, createdByUuid: String(req.user!.id), isSync: false });
      });
    } catch (error) { await fileStorageService.deleteAttachment(path); throw error; }
    if (previousPath) await fileStorageService.deleteAttachment(previousPath);
    return att;
  },
  async deleteSignature(submissionUuid: string, sectionUuid: string, type: "officer"|"seafarer", req: Request) {
    await authorizeInterviewRead(req); const submission = await interviewRepository.submission(submissionUuid); if (!submission) throw new InterviewError("Crew Interview submission not found", 404);
    const section = (await interviewRepository.structure(submission.formVersionUuid)).sections.find((item: any) => item.sectionUuid === sectionUuid); if (!section) throw new InterviewError("Section not found", 404); await assertOwner(req, section);
    let path: string | null = null;
    await getDb().transaction(async (tx: any) => { const locked = await writable(tx, submissionUuid, sectionUuid); const signature = (await tx.select().from(frmSectionSignatures).where(and(eq(frmSectionSignatures.sectionStateUuid, locked.state.sectionStateUuid),eq(frmSectionSignatures.signatureType,type),eq(frmSectionSignatures.isDeleted,false))).limit(1))[0]; if (!signature) return; path=(await tx.select().from(frmSignatureAttachments).where(eq(frmSignatureAttachments.sigAttUuid,signature.signatureAttUuid)).limit(1))[0]?.filePath??null; await tx.delete(frmSectionSignatures).where(eq(frmSectionSignatures.sectionSignatureUuid,signature.sectionSignatureUuid)); await tx.delete(frmSignatureAttachments).where(eq(frmSignatureAttachments.sigAttUuid,signature.signatureAttUuid)); });
    if(path) await fileStorageService.deleteAttachment(path);
  },
  async rawSignature(attUuid: string, req: Request) { await authorizeInterviewRead(req); const parent = await interviewRepository.signatureParent(attUuid); if (!parent) throw new InterviewError("Signature parent not found", 404); return parent.attachment; },
};