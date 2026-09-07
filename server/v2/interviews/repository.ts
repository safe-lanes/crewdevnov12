import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { crewInterviewSubmissions, frmAnswers, frmFormParts, frmOptions, frmQuestions, frmSectionStates, frmSignatureAttachments, frmSectionSignatures } from "../../../shared/v2/forms-engine/schema";
import { frmSections } from "../../../shared/v2/forms-engine/schema";
import { recruitmentCandidatesV2, screeningB6InterviewItems, screeningB6Interviews } from "../../../shared/v2/recruitment/schema";

export const interviewRepository = {
  async item(intUuid: string) {
    const rows = await getDb().select({ item: screeningB6InterviewItems, parent: screeningB6Interviews, candidate: recruitmentCandidatesV2 })
      .from(screeningB6InterviewItems)
      .innerJoin(screeningB6Interviews, eq(screeningB6Interviews.b6Uuid, screeningB6InterviewItems.b6Uuid))
      .innerJoin(recruitmentCandidatesV2, eq(recruitmentCandidatesV2.recCanUuid, screeningB6Interviews.recCanUuid))
      .where(and(eq(screeningB6InterviewItems.intUuid, intUuid), eq(screeningB6InterviewItems.isDeleted, false),
        eq(screeningB6Interviews.isDeleted, false), eq(recruitmentCandidatesV2.isDeleted, false))).limit(1);
    return rows[0];
  },
  async submission(uuid: string) {
    return (await getDb().select().from(crewInterviewSubmissions).where(and(
      eq(crewInterviewSubmissions.interviewSubmissionUuid, uuid), eq(crewInterviewSubmissions.isDeleted, false),
    )).limit(1))[0];
  },
  async state(submissionUuid: string, sectionUuid: string) {
    return (await getDb().select().from(frmSectionStates).where(and(eq(frmSectionStates.submissionUuid, submissionUuid),
      eq(frmSectionStates.sectionUuid, sectionUuid), eq(frmSectionStates.isDeleted, false))).limit(1))[0];
  },
  async structure(versionUuid: string) {
    const db = getDb();
    const sections = await db.select().from(frmSections).where(and(eq(frmSections.formVersionUuid, versionUuid), eq(frmSections.isDeleted, false))).orderBy(asc(frmSections.sortOrder));
    const ids = sections.map((x: any) => x.sectionUuid);
    const questions = ids.length ? await db.select().from(frmQuestions).where(and(inArray(frmQuestions.sectionUuid, ids), eq(frmQuestions.isDeleted, false))).orderBy(asc(frmQuestions.sortOrder)) : [];
    const optionIds = [...new Set([...sections.map((x: any) => x.defaultOptionSetUuid), ...questions.map((x: any) => x.optionSetUuid)].filter((x: any): x is string => !!x))];
    const options = optionIds.length ? await db.select().from(frmOptions).where(and(inArray(frmOptions.optionSetUuid, optionIds), eq(frmOptions.isDeleted, false))) : [];
    return { sections, questions, options };
  },
  async data(submissionUuid: string) {
    const db = getDb();
    const [states, answers] = await Promise.all([
      db.select().from(frmSectionStates).where(and(eq(frmSectionStates.submissionUuid, submissionUuid), eq(frmSectionStates.isDeleted, false))),
      db.select().from(frmAnswers).where(and(eq(frmAnswers.submissionUuid, submissionUuid), eq(frmAnswers.isDeleted, false))),
    ]);
    const stateIds = states.map((state: any) => state.sectionStateUuid);
    const signatures = stateIds.length ? await db.select().from(frmSectionSignatures).where(and(inArray(frmSectionSignatures.sectionStateUuid, stateIds), eq(frmSectionSignatures.isDeleted, false))) : [];
    const attachmentIds = signatures.map((signature: any) => signature.signatureAttUuid);
    const attachments = attachmentIds.length ? await db.select().from(frmSignatureAttachments).where(and(inArray(frmSignatureAttachments.sigAttUuid, attachmentIds), eq(frmSignatureAttachments.isDeleted, false))) : [];
    const attachmentByUuid = new Map(attachments.map((attachment: any) => [attachment.sigAttUuid, attachment]));
    return { states, answers, signatures: signatures.map((signature: any) => ({ ...signature, attachment: attachmentByUuid.get(signature.signatureAttUuid) })).filter((signature: any) => signature.attachment) };
  },
  async signatureParent(attachmentUuid: string) {
    const rows = await getDb().select({ attachment: frmSignatureAttachments }).from(frmSignatureAttachments)
      .innerJoin(frmSectionSignatures, eq(frmSectionSignatures.signatureAttUuid, frmSignatureAttachments.sigAttUuid))
      .innerJoin(frmSectionStates, eq(frmSectionStates.sectionStateUuid, frmSectionSignatures.sectionStateUuid))
      .innerJoin(crewInterviewSubmissions, eq(crewInterviewSubmissions.interviewSubmissionUuid, frmSectionStates.submissionUuid))
      .where(and(eq(frmSignatureAttachments.sigAttUuid, attachmentUuid), eq(frmSignatureAttachments.isDeleted, false),
        eq(frmSectionSignatures.isDeleted, false), eq(frmSectionStates.isDeleted, false), eq(crewInterviewSubmissions.isDeleted, false))).limit(1);
    return rows[0];
  },
  async parts(formUuid: string) {
    return getDb().select().from(frmFormParts).where(and(eq(frmFormParts.formUuid, formUuid), eq(frmFormParts.isDeleted, false))).orderBy(asc(frmFormParts.sortOrder));
  },
};