import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../db";
import { admFormsV2, admFormVersionsV2 } from "../../../shared/v2/admin/schema";
import { crewDebriefings } from "../../../shared/v2/crew-pool/schema";
import {
  crewDebriefingSubmissions, frmAnswers, frmFormParts, frmOptions, frmQuestions, frmSectionStates,
  frmSections, frmSignatureAttachments, frmSectionSignatures,
} from "../../../shared/v2/forms-engine/schema";

export const debriefingRepository = {
  async g1(uuid: string) {
    return (await getDb().select().from(crewDebriefings).where(and(
      eq(crewDebriefings.debriefingUuid, uuid),
      eq(crewDebriefings.isDeleted, false),
    )).limit(1))[0];
  },
  async releasedVersion(formUuid: string) {
    const releases = await getDb().select({ form: admFormsV2, version: admFormVersionsV2 })
      .from(admFormsV2).innerJoin(admFormVersionsV2, eq(admFormVersionsV2.formId, admFormsV2.id))
      .where(and(eq(admFormsV2.formUuid, formUuid), eq(admFormsV2.isDeleted, false),
        sql`lower(btrim(${admFormsV2.category})) = 'debriefing'`,
        eq(admFormVersionsV2.isDeleted, false), eq(admFormVersionsV2.status, "released")));
    // version_no is text in the legacy schema. Sort numerically when possible,
    // then use release/create timestamps for a deterministic tie-break.
    return releases.sort((a: any, b: any) => {
      const aVersion = Number.parseInt(a.version.versionNo ?? "", 10);
      const bVersion = Number.parseInt(b.version.versionNo ?? "", 10);
      if (Number.isFinite(aVersion) && Number.isFinite(bVersion) && aVersion !== bVersion) return bVersion - aVersion;
      if (Number.isFinite(aVersion) !== Number.isFinite(bVersion)) return Number.isFinite(bVersion) ? 1 : -1;
      const aDate = new Date(a.version.releasedAt ?? a.version.createdAt ?? 0).getTime();
      const bDate = new Date(b.version.releasedAt ?? b.version.createdAt ?? 0).getTime();
      return bDate - aDate || String(b.version.fvUuid).localeCompare(String(a.version.fvUuid));
    })[0];
  },
  async submission(uuid: string) {
    return (await getDb().select().from(crewDebriefingSubmissions).where(and(
      eq(crewDebriefingSubmissions.debriefingSubmissionUuid, uuid), eq(crewDebriefingSubmissions.isDeleted, false),
    )))[0];
  },
  async state(submissionUuid: string, sectionUuid: string) {
    return (await getDb().select().from(frmSectionStates).where(and(
      eq(frmSectionStates.submissionUuid, submissionUuid), eq(frmSectionStates.sectionUuid, sectionUuid),
      eq(frmSectionStates.isDeleted, false),
    )))[0];
  },
  async signature(uuid: string) {
    return (await getDb().select().from(frmSignatureAttachments).where(and(
      eq(frmSignatureAttachments.sigAttUuid, uuid), eq(frmSignatureAttachments.isDeleted, false),
    )))[0];
  },
  async signatureParent(uuid: string) {
    const db = getDb();
    const rows = await db.select({
      attachment: frmSignatureAttachments,
      signature: frmSectionSignatures,
      state: frmSectionStates,
      submission: crewDebriefingSubmissions,
    }).from(frmSignatureAttachments)
      .innerJoin(frmSectionSignatures, eq(frmSectionSignatures.signatureAttUuid, frmSignatureAttachments.sigAttUuid))
      .innerJoin(frmSectionStates, eq(frmSectionStates.sectionStateUuid, frmSectionSignatures.sectionStateUuid))
      .innerJoin(crewDebriefingSubmissions, eq(crewDebriefingSubmissions.debriefingSubmissionUuid, frmSectionStates.submissionUuid))
      .where(and(
        eq(frmSignatureAttachments.sigAttUuid, uuid),
        eq(frmSignatureAttachments.isDeleted, false),
        eq(frmSectionSignatures.isDeleted, false),
        eq(frmSectionStates.isDeleted, false),
        eq(crewDebriefingSubmissions.isDeleted, false),
      )).limit(1);
    return rows[0];
  },
  async structure(versionUuid: string, includeDeleted = false, executor: any = getDb()) {
    const db = executor;
    const sections = await db.select().from(frmSections).where(and(
      eq(frmSections.formVersionUuid, versionUuid),
      ...(includeDeleted ? [] : [eq(frmSections.isDeleted, false)]),
    )).orderBy(asc(frmSections.sortOrder));
    const ids = sections.map((x: any) => x.sectionUuid);
    const questions = ids.length ? await db.select().from(frmQuestions).where(and(
      inArray(frmQuestions.sectionUuid, ids),
      ...(includeDeleted ? [] : [eq(frmQuestions.isDeleted, false)]),
    )).orderBy(asc(frmQuestions.sortOrder)) : [];
    const setIds = [...new Set([...sections.map((x: any) => x.defaultOptionSetUuid), ...questions.map((x: any) => x.optionSetUuid)].filter((x: any): x is string => !!x))];
    const options = setIds.length ? await db.select().from(frmOptions).where(and(
      inArray(frmOptions.optionSetUuid, setIds),
      ...(includeDeleted ? [] : [eq(frmOptions.isDeleted, false)]),
    )).orderBy(asc(frmOptions.sortOrder)) : [];
    return { sections, questions, options };
  },
  async formParts(formUuid: string) {
    return getDb().select().from(frmFormParts).where(and(
      eq(frmFormParts.formUuid, formUuid),
      eq(frmFormParts.isDeleted, false),
    )).orderBy(asc(frmFormParts.sortOrder), asc(frmFormParts.id));
  },
  async readData(submissionUuid: string) {
    const db = getDb();
    const states = await db.select().from(frmSectionStates).where(and(eq(frmSectionStates.submissionUuid, submissionUuid), eq(frmSectionStates.isDeleted, false)));
    const answers = await db.select().from(frmAnswers).where(and(eq(frmAnswers.submissionUuid, submissionUuid), eq(frmAnswers.isDeleted, false)));
    const stateUuids = states.map((x: any) => x.sectionStateUuid);
    const signatureRows = stateUuids.length ? await db.select().from(frmSectionSignatures).where(and(
      inArray(frmSectionSignatures.sectionStateUuid, stateUuids),
      eq(frmSectionSignatures.isDeleted, false),
    )) : [];
    const attachmentUuids = signatureRows.map((x: any) => x.signatureAttUuid);
    const attachments = attachmentUuids.length ? await db.select().from(frmSignatureAttachments).where(and(
      inArray(frmSignatureAttachments.sigAttUuid, attachmentUuids),
      eq(frmSignatureAttachments.isDeleted, false),
    )) : [];
    const attachmentByUuid = new Map(attachments.map((x: any) => [x.sigAttUuid, x]));
    const signatures = signatureRows.map((signature: any) => ({
      ...signature,
      attachment: attachmentByUuid.get(signature.signatureAttUuid) ?? null,
    })).filter((signature: any) => signature.attachment);
    return { states, answers, signatures };
  },
};