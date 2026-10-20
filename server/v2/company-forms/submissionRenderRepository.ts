import { and, asc, eq, inArray } from "drizzle-orm";
import { admFormVersionsV2, admFormsV2, admRoleMasterAc } from "../../../shared/v2/admin/schema";
import { masterVesselTypes } from "../../../shared/schema";
import {
  frmAnswers,
  frmFormParts,
  frmOptions,
  frmOptionSets,
  frmQuestions,
  frmSectionSignatures,
  frmSectionStates,
  frmSections,
  frmSignatureAttachments,
} from "../../../shared/v2/forms-engine/schema";
import {
  frmCompanySubmissionSystemSnapshots,
  frmCompanySubmissions,
} from "../../../shared/v2/forms-engine/submissions";
import { getDb } from "../db";
import { readDocumentEvidenceStatus } from "./documentEvidenceRepository";

type Executor = any;

export class CompanyFormSubmissionRenderRepository {
  async findSubmission(submissionUuid: string, executor: Executor = getDb()) {
    const rows = await executor.select({
      submissionUuid: frmCompanySubmissions.submissionUuid,
      subjectType: frmCompanySubmissions.subjectType,
      subjectRef: frmCompanySubmissions.subjectRef,
      formUuid: frmCompanySubmissions.formUuid,
      formVersionUuid: frmCompanySubmissions.formVersionUuid,
      stageKey: frmCompanySubmissions.stageKey,
      status: frmCompanySubmissions.status,
      completedAt: frmCompanySubmissions.completedAt,
      voidedAt: frmCompanySubmissions.voidedAt,
      voidedByUuid: frmCompanySubmissions.voidedByUuid,
      voidedByName: frmCompanySubmissions.voidedByName,
      voidedByDesignation: frmCompanySubmissions.voidedByDesignation,
      applicableSectionUuids: frmCompanySubmissions.applicableSectionUuids,
      voidReason: frmCompanySubmissions.voidReason,
      voidedPreviousStatus: frmCompanySubmissions.voidedPreviousStatus,
      replacedBySubmissionUuid: frmCompanySubmissions.replacedBySubmissionUuid,
      replacesSubmissionUuid: frmCompanySubmissions.replacesSubmissionUuid,
      systemSnapshotAt: frmCompanySubmissions.systemSnapshotAt,
      systemSnapshotEvent: frmCompanySubmissions.systemSnapshotEvent,
      createdAt: frmCompanySubmissions.createdAt,
    }).from(frmCompanySubmissions).where(and(
      eq(frmCompanySubmissions.submissionUuid, submissionUuid),
      eq(frmCompanySubmissions.isDeleted, false),
    )).limit(1);
    return rows[0];
  }

  async readPinnedRenderData(submissionUuid: string, executor: Executor = getDb(), previewRequirement?: any) {
    const parentRows = await executor.select({
      submission: frmCompanySubmissions,
      form: admFormsV2,
      version: admFormVersionsV2,
    }).from(frmCompanySubmissions)
      .innerJoin(admFormsV2, eq(admFormsV2.formUuid, frmCompanySubmissions.formUuid))
      .innerJoin(admFormVersionsV2, and(
        eq(admFormVersionsV2.fvUuid, frmCompanySubmissions.formVersionUuid),
        eq(admFormVersionsV2.formId, admFormsV2.id),
      ))
      .where(and(
        eq(frmCompanySubmissions.submissionUuid, submissionUuid),
        eq(frmCompanySubmissions.isDeleted, false),
      )).limit(1);
    let parent = parentRows[0];
    if (previewRequirement) {
      const versions = await executor.select({ form: admFormsV2, version: admFormVersionsV2 })
        .from(admFormVersionsV2).innerJoin(admFormsV2, eq(admFormVersionsV2.formId, admFormsV2.id))
        .where(and(eq(admFormVersionsV2.fvUuid, previewRequirement.form_version_uuid),
          eq(admFormsV2.formUuid, previewRequirement.form_uuid))).limit(1);
      if (versions[0]) parent = { ...versions[0], submission: {
        submissionUuid: "", subjectType: previewRequirement.subject_type,
        subjectRef: previewRequirement.subject_ref, formUuid: previewRequirement.form_uuid,
        formVersionUuid: previewRequirement.form_version_uuid, stageKey: previewRequirement.stage_key,
        status: "in_progress", createdAt: previewRequirement.created_at,
        systemSnapshotAt: null, systemSnapshotEvent: null, applicableSectionUuids: null,
        origin: "REQUIRED", requirementUuid: previewRequirement.requirement_uuid,
      } } as typeof parent;
    }
    if (!parent) return undefined;

    const [parts, sections, optionSets, states, systemSnapshots, signatureHistory] = await Promise.all([
      executor.select().from(frmFormParts).where(and(
        eq(frmFormParts.formUuid, parent.submission.formUuid),
        eq(frmFormParts.formVersionUuid, parent.submission.formVersionUuid),
        eq(frmFormParts.isDeleted, false),
      )).orderBy(asc(frmFormParts.sortOrder), asc(frmFormParts.id)),
      executor.select({ section: frmSections }).from(frmSections)
        .innerJoin(frmFormParts, and(
          eq(frmFormParts.formPartUuid, frmSections.formPartUuid),
          eq(frmFormParts.formVersionUuid, parent.submission.formVersionUuid),
          eq(frmFormParts.formUuid, parent.submission.formUuid),
          eq(frmFormParts.isDeleted, false),
        ))
        .where(and(
          eq(frmSections.formVersionUuid, parent.submission.formVersionUuid),
          eq(frmSections.isDeleted, false),
        ))
        .orderBy(asc(frmSections.sortOrder), asc(frmSections.id))
        .then((rows: any[]) => rows.map((row) => row.section)),
      executor.select().from(frmOptionSets).where(and(
        eq(frmOptionSets.formVersionUuid, parent.submission.formVersionUuid),
        eq(frmOptionSets.isDeleted, false),
      )).orderBy(asc(frmOptionSets.sortOrder), asc(frmOptionSets.id)),
      executor.select({ state: frmSectionStates }).from(frmSectionStates)
        .innerJoin(frmSections, eq(frmSections.sectionUuid, frmSectionStates.sectionUuid))
        .innerJoin(frmFormParts, and(
          eq(frmFormParts.formPartUuid, frmSections.formPartUuid),
          eq(frmFormParts.formVersionUuid, parent.submission.formVersionUuid),
          eq(frmFormParts.formUuid, parent.submission.formUuid),
          eq(frmFormParts.isDeleted, false),
        ))
        .where(and(
          eq(frmSectionStates.submissionUuid, parent.submission.submissionUuid),
          eq(frmSectionStates.isDeleted, false),
          eq(frmSections.formVersionUuid, parent.submission.formVersionUuid),
          eq(frmSections.isDeleted, false),
        )),
      executor.select().from(frmCompanySubmissionSystemSnapshots).where(and(
        eq(frmCompanySubmissionSystemSnapshots.submissionUuid, parent.submission.submissionUuid),
        eq(frmCompanySubmissionSystemSnapshots.isDeleted, false),
      )),
      executor.select({ sectionSignatureUuid: frmSectionSignatures.sectionSignatureUuid })
        .from(frmSectionSignatures)
        .innerJoin(frmSectionStates, eq(frmSectionStates.sectionStateUuid, frmSectionSignatures.sectionStateUuid))
        .where(and(
          eq(frmSectionStates.submissionUuid, parent.submission.submissionUuid),
        )).limit(1),
    ]);

    const sectionUuids = sections.map((section: any) => section.sectionUuid);
    const questions = sectionUuids.length
      ? await executor.select().from(frmQuestions).where(and(
        inArray(frmQuestions.sectionUuid, sectionUuids),
        eq(frmQuestions.isDeleted, false),
      )).orderBy(asc(frmQuestions.sortOrder), asc(frmQuestions.id))
      : [];
    const optionSetUuids = optionSets.map((set: any) => set.optionSetUuid);
    const options = optionSetUuids.length
      ? await executor.select().from(frmOptions).where(and(
        inArray(frmOptions.optionSetUuid, optionSetUuids),
        eq(frmOptions.isDeleted, false),
      )).orderBy(asc(frmOptions.sortOrder), asc(frmOptions.id))
      : [];

    const [answerRows, signatureRows] = await Promise.all([
      executor.select({ answer: frmAnswers }).from(frmAnswers)
        .innerJoin(frmQuestions, eq(frmQuestions.questionUuid, frmAnswers.questionUuid))
        .innerJoin(frmSections, eq(frmSections.sectionUuid, frmQuestions.sectionUuid))
        .innerJoin(frmFormParts, and(
          eq(frmFormParts.formPartUuid, frmSections.formPartUuid),
          eq(frmFormParts.formVersionUuid, parent.submission.formVersionUuid),
          eq(frmFormParts.formUuid, parent.submission.formUuid),
          eq(frmFormParts.isDeleted, false),
        ))
        .where(and(
          eq(frmAnswers.submissionUuid, parent.submission.submissionUuid),
          eq(frmAnswers.isDeleted, false),
          eq(frmQuestions.isDeleted, false),
          eq(frmSections.formVersionUuid, parent.submission.formVersionUuid),
          eq(frmSections.isDeleted, false),
        )),
      executor.select({
        signature: frmSectionSignatures,
        attachment: frmSignatureAttachments,
        state: frmSectionStates,
        section: frmSections,
        part: frmFormParts,
      }).from(frmSectionSignatures)
        .innerJoin(frmSignatureAttachments, eq(
          frmSignatureAttachments.sigAttUuid,
          frmSectionSignatures.signatureAttUuid,
        ))
        .innerJoin(frmSectionStates, eq(
          frmSectionStates.sectionStateUuid,
          frmSectionSignatures.sectionStateUuid,
        ))
        .innerJoin(frmSections, eq(frmSections.sectionUuid, frmSectionStates.sectionUuid))
        .innerJoin(frmFormParts, and(
          eq(frmFormParts.formPartUuid, frmSections.formPartUuid),
          eq(frmFormParts.formVersionUuid, parent.submission.formVersionUuid),
          eq(frmFormParts.formUuid, parent.submission.formUuid),
          eq(frmFormParts.isDeleted, false),
        ))
        .where(and(
          eq(frmSectionSignatures.isDeleted, false),
          eq(frmSignatureAttachments.isDeleted, false),
          eq(frmSectionStates.submissionUuid, parent.submission.submissionUuid),
          eq(frmSectionStates.isDeleted, false),
          eq(frmSections.formVersionUuid, parent.submission.formVersionUuid),
          eq(frmSections.isDeleted, false),
        )),
    ]);

    const [vesselTypeRows, roleRows] = await Promise.all([
      (() => {
        const vesselTypeUuids: string[] = [...new Set<string>(sections.flatMap((section: any) => {
          try {
            const parsed = section.applicableVesselTypes
              ? JSON.parse(section.applicableVesselTypes)
              : [];
            return Array.isArray(parsed)
              ? parsed.filter((value: unknown): value is string => typeof value === "string")
              : [];
          } catch {
            return [];
          }
        }))];
        return vesselTypeUuids.length
          ? executor.select({
            vesselTypeUuid: masterVesselTypes.vtUuid,
            vesselType: masterVesselTypes.vesselType,
          }).from(masterVesselTypes).where(inArray(masterVesselTypes.vtUuid, vesselTypeUuids))
          : Promise.resolve([]);
      })(),
      (() => {
        const roleUuids: string[] = [...new Set<string>(sections
          .map((section: any) => section.responsibleRoleUuid)
          .filter((value: unknown): value is string => typeof value === "string" && value.length > 0))];
        return roleUuids.length
          ? executor.select({
            roleUuid: admRoleMasterAc.ruid,
            roleName: admRoleMasterAc.assignedRole,
            roleType: admRoleMasterAc.roletype,
          }).from(admRoleMasterAc).where(inArray(admRoleMasterAc.ruid, roleUuids))
          : Promise.resolve([]);
      })(),
    ]);

    return {
      submission: parent.submission,
      form: parent.form,
      version: parent.version,
      parts,
      sections,
      questions,
      optionSets,
      options,
      states: states.map((row: any) => row.state),
      answers: answerRows.map((row: any) => row.answer),
      signatures: signatureRows,
      systemSnapshots,
      hasSignatureHistory: signatureHistory.length > 0,
      vesselTypes: vesselTypeRows,
      roles: roleRows,
      documentEvidence: previewRequirement
        ? undefined : await readDocumentEvidenceStatus(executor, parent.submission),
    };
  }

  async findOwnedSignatureAttachment(
    submissionUuid: string,
    assetUuid: string,
    executor: Executor = getDb(),
  ) {
    const rows = await executor.select({
      filePath: frmSignatureAttachments.filePath,
      fileName: frmSignatureAttachments.fileName,
      fileType: frmSignatureAttachments.fileType,
      fileSize: frmSignatureAttachments.fileSize,
    }).from(frmSignatureAttachments)
      .innerJoin(frmSectionSignatures, eq(
        frmSectionSignatures.signatureAttUuid,
        frmSignatureAttachments.sigAttUuid,
      ))
      .innerJoin(frmSectionStates, eq(
        frmSectionStates.sectionStateUuid,
        frmSectionSignatures.sectionStateUuid,
      ))
      .innerJoin(frmCompanySubmissions, eq(
        frmCompanySubmissions.submissionUuid,
        frmSectionStates.submissionUuid,
      ))
      .innerJoin(frmSections, eq(frmSections.sectionUuid, frmSectionStates.sectionUuid))
      .innerJoin(frmFormParts, and(
        eq(frmFormParts.formPartUuid, frmSections.formPartUuid),
        eq(frmFormParts.formVersionUuid, frmCompanySubmissions.formVersionUuid),
        eq(frmFormParts.formUuid, frmCompanySubmissions.formUuid),
        eq(frmFormParts.isDeleted, false),
      ))
      .where(and(
        eq(frmSignatureAttachments.sigAttUuid, assetUuid),
        eq(frmSignatureAttachments.isDeleted, false),
        eq(frmSectionSignatures.isDeleted, false),
        eq(frmSectionStates.submissionUuid, submissionUuid),
        eq(frmSectionStates.isDeleted, false),
        eq(frmCompanySubmissions.submissionUuid, submissionUuid),
        eq(frmCompanySubmissions.isDeleted, false),
        eq(frmSections.formVersionUuid, frmCompanySubmissions.formVersionUuid),
        eq(frmSections.isDeleted, false),
      )).limit(1);
    return rows[0];
  }
}

export const companyFormSubmissionRenderRepository = new CompanyFormSubmissionRenderRepository();