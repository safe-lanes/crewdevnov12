import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { masterUsers } from "../../../shared/schema";
import { admFormsV2 } from "../../../shared/v2/admin/schema";
import {
  frmAnswers,
  frmFormParts,
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
import type {
  CompanyFormPrincipal,
  CompanyFormSubjectAdapter,
  SubjectLookupResult,
} from "./contracts";
import {
  CompanyFormConflictError,
  CompanyFormNotFoundError,
  CompanyFormPermissionError,
  CompanyFormValidationError,
} from "./errors";
import { assertCompanyFormSectionEditable, assertCompanyFormSignatureConfigured } from "./draftSectionPolicy";
import { sectionRequiresSubmission } from "./lifecyclePolicy";
import { getDb } from "../db";
import { ownsCompanyFormSignature } from "./signatureOwnership";
import { captureDocumentHeader, captureDocumentSignature } from "./documentEvidenceRepository";

type Executor = any;
type LifecycleAdapter = CompanyFormSubjectAdapter<any>;

function answerProvided(question: any, value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (question.responseType === "checkbox") return value === "true" || value === "false";
  if (question.responseType === "multi_select" && typeof value === "string") {
    try {
      const selected = JSON.parse(value);
      return Array.isArray(selected) && selected.length > 0;
    } catch {
      return false;
    }
  }
  return typeof value === "string" && value.trim().length > 0;
}

function actorName(user: any): string | null {
  const name = (user.fullname ?? user.displayName ??
    `${user.firstname ?? ""} ${user.lastname ?? ""}`).trim();
  return name || null;
}

async function sectionAndState(
  tx: Executor,
  submission: any,
  sectionUuid: string,
  actorUserId: number,
) {
  const rows = await tx.select({ section: frmSections, part: frmFormParts })
    .from(frmSections)
    .innerJoin(frmFormParts, and(
      eq(frmFormParts.formPartUuid, frmSections.formPartUuid),
      eq(frmFormParts.formVersionUuid, submission.formVersionUuid),
      eq(frmFormParts.formUuid, submission.formUuid),
      eq(frmFormParts.isDeleted, false),
    ))
    .where(and(
      eq(frmSections.sectionUuid, sectionUuid),
      eq(frmSections.formVersionUuid, submission.formVersionUuid),
      eq(frmSections.isDeleted, false),
    )).limit(2);
  if (rows.length !== 1) throw new CompanyFormValidationError("Section does not belong to this pinned submission.");

  const { section, part } = rows[0];
  const questions = await tx.select().from(frmQuestions).where(and(
    eq(frmQuestions.sectionUuid, sectionUuid),
    eq(frmQuestions.isDeleted, false),
  ));
  await tx.execute(sql`
    SELECT section_state_uuid
    FROM frm_section_states
    WHERE submission_uuid = ${submission.submissionUuid}
      AND section_uuid = ${sectionUuid}
      AND COALESCE(is_deleted, false) = false
    FOR UPDATE
  `);
  const states = await tx.select().from(frmSectionStates).where(and(
    eq(frmSectionStates.submissionUuid, submission.submissionUuid),
    eq(frmSectionStates.sectionUuid, sectionUuid),
    eq(frmSectionStates.isDeleted, false),
  ));
  if (states.length > 1) throw new CompanyFormConflictError("Duplicate section states prevent a safe lifecycle change.");
  let state = states[0];
  if (!state) {
    const now = new Date();
    const inserted = await tx.insert(frmSectionStates).values({
      sectionStateUuid: randomUUID(),
      submissionUuid: submission.submissionUuid,
      sectionUuid,
      status: "not_started",
      createdByUuid: String(actorUserId),
      updatedByUuid: String(actorUserId),
      createdAt: now,
      updatedAt: now,
      isDeleted: false,
      isSync: false,
    }).returning();
    state = inserted[0];
  }
  return { section, part, questions, state };
}

async function loadLockedContext(
  tx: Executor,
  submissionUuid: string,
  adapter: LifecycleAdapter,
  principal: CompanyFormPrincipal,
  action: "submit_section" | "save_signature" | "remove_signature" | "void_submission",
) {
  // All writes use subject -> (form/version when needed) -> submission ->
  // section. Starts/voids already lock the subject first. Taking submission
  // first here would deadlock a signature/submit against a concurrent void.
  const observed = await tx.select().from(frmCompanySubmissions).where(and(
    eq(frmCompanySubmissions.submissionUuid, submissionUuid),
    eq(frmCompanySubmissions.isDeleted, false),
  )).limit(1);
  if (!observed[0]) throw new CompanyFormNotFoundError("Company Form submission not found.");
  const lockedSubject = await adapter.lockForStart(observed[0].subjectRef, tx);
  if (!lockedSubject || lockedSubject.subjectRef !== observed[0].subjectRef) {
    throw new CompanyFormNotFoundError("Company Form subject not found.");
  }
  await tx.execute(sql`
    SELECT submission_uuid
    FROM frm_company_submissions
    WHERE submission_uuid = ${submissionUuid}
      AND COALESCE(is_deleted, false) = false
    FOR UPDATE
  `);
  const parents = await tx.select().from(frmCompanySubmissions).where(and(
    eq(frmCompanySubmissions.submissionUuid, submissionUuid),
    eq(frmCompanySubmissions.isDeleted, false),
  )).limit(1);
  const submission = parents[0];
  if (!submission) throw new CompanyFormNotFoundError("Company Form submission not found.");
  if (submission.subjectRef !== observed[0].subjectRef ||
    submission.subjectType !== observed[0].subjectType ||
    submission.formUuid !== observed[0].formUuid ||
    submission.formVersionUuid !== observed[0].formVersionUuid ||
    submission.stageKey !== observed[0].stageKey) {
    throw new CompanyFormConflictError("The Company Form subject or version pin changed; reload the submission.");
  }
  const actualAction = action === "void_submission" && submission.status === "completed"
    ? "void_completed_submission" : action;
  if (!await adapter.authorize(principal, actualAction, lockedSubject.context, tx)) {
    throw new CompanyFormPermissionError();
  }
  if (adapter.authorizeStageAction && !adapter.authorizeStageAction(principal, action, lockedSubject.context, submission.stageKey)) {
    throw new CompanyFormPermissionError("This actor cannot act at this submission stage.");
  }
  return { submission, subject: lockedSubject };
}

async function systemQuestions(tx: Executor, submission: any) {
  const rows = await tx.select({ section: frmSections, question: frmQuestions })
    .from(frmSections)
    .innerJoin(frmFormParts, and(
      eq(frmFormParts.formPartUuid, frmSections.formPartUuid),
      eq(frmFormParts.formUuid, submission.formUuid),
      eq(frmFormParts.formVersionUuid, submission.formVersionUuid),
      eq(frmFormParts.isDeleted, false),
    ))
    .innerJoin(frmQuestions, and(
      eq(frmQuestions.sectionUuid, frmSections.sectionUuid),
      eq(frmQuestions.isDeleted, false),
    ))
    .where(and(
      eq(frmSections.formVersionUuid, submission.formVersionUuid),
      eq(frmSections.isDeleted, false),
      eq(frmQuestions.responseType, "system_field"),
    ));
  return rows;
}

async function freezeSystemFields(input: {
  tx: Executor;
  submission: any;
  subject: SubjectLookupResult<any>;
  adapter: LifecycleAdapter;
  actorUserId: number;
  event: "section_submission" | "signature";
  at: Date;
}) {
  const { tx, submission, subject, adapter, actorUserId, event, at } = input;
  if (submission.systemSnapshotAt) return;
  const priorSubmitted = await tx.select({ sectionStateUuid: frmSectionStates.sectionStateUuid })
    .from(frmSectionStates).where(and(
      eq(frmSectionStates.submissionUuid, submission.submissionUuid),
      eq(frmSectionStates.status, "submitted"),
    )).limit(1);
  const priorSignatures = await tx.select({ sectionSignatureUuid: frmSectionSignatures.sectionSignatureUuid })
    .from(frmSectionSignatures)
    .innerJoin(frmSectionStates, eq(frmSectionStates.sectionStateUuid, frmSectionSignatures.sectionStateUuid))
    .where(and(
      eq(frmSectionStates.submissionUuid, submission.submissionUuid),
    )).limit(1);
  // A pre-migration signed/submitted declaration has no trustworthy historical
  // snapshot. Never turn a later event into a present-day backfill.
  if (priorSubmitted.length || priorSignatures.length) return;
  await captureDocumentHeader(input);
  const fields = await systemQuestions(tx, submission);
  const declarationDate = at.toISOString().slice(0, 10);
  const values = await Promise.all(fields.map(async ({ section, question }: any) => ({
    snapshotUuid: randomUUID(),
    submissionUuid: submission.submissionUuid,
    fieldKey: question.systemFieldKey,
    sectionUuid: section.sectionUuid,
    questionUuid: question.questionUuid,
    value: await adapter.resolveSystemField(question.systemFieldKey, subject.context, {
      submission: { dateOfDeclaration: declarationDate },
      executor: tx,
    }, tx),
    systemValue: await adapter.resolveSystemField(question.systemFieldKey, subject.context, {
      raw: true, submission: { dateOfDeclaration: declarationDate }, executor: tx,
    }, tx),
    createdAt: at,
    createdByUuid: String(actorUserId),
    isDeleted: false,
    isSync: false,
  })));
  if (values.length) await tx.insert(frmCompanySubmissionSystemSnapshots).values(values);
  const sections = await tx.select({ section: frmSections }).from(frmSections)
    .innerJoin(frmFormParts, eq(frmFormParts.formPartUuid, frmSections.formPartUuid))
    .where(and(eq(frmFormParts.formVersionUuid, submission.formVersionUuid),
      eq(frmFormParts.isDeleted, false), eq(frmSections.isDeleted, false)));
  const applicableSectionUuids: string[] = [];
  for (const { section } of sections) {
    if (await (adapter.isSectionApplicable?.(section, subject.context) ?? true)) applicableSectionUuids.push(section.sectionUuid);
  }
  await tx.update(frmCompanySubmissions).set({
    applicableSectionUuids,
    systemSnapshotAt: at,
    systemSnapshotEvent: event,
    updatedByUuid: String(actorUserId),
    updatedAt: at,
  }).where(eq(frmCompanySubmissions.submissionUuid, submission.submissionUuid));
}

export class CompanyFormSubmissionLifecycleRepository {
  async submitSection(input: {
    submissionUuid: string;
    sectionUuid: string;
    actor: CompanyFormPrincipal;
    adapter: LifecycleAdapter;
  }) {
    return getDb().transaction(async (tx: Executor) => {
      const locked = await loadLockedContext(tx, input.submissionUuid, input.adapter, input.actor, "submit_section");
      const { submission, subject } = locked;
      if (submission.status !== "in_progress") {
        throw new CompanyFormConflictError("Only an in-progress Company Form can submit a section.");
      }
      if (!input.adapter.canStart(subject.context)) {
        throw new CompanyFormConflictError("This Company Form subject no longer accepts section submissions.");
      }
      const { section, part, questions, state } = await sectionAndState(
        tx, submission, input.sectionUuid, input.actor.userId,
      );
      if (state.status === "submitted" || state.status === "not_applicable") {
        throw new CompanyFormConflictError("This Company Form section is already locked.");
      }
      if (state.status !== "not_started" && state.status !== "in_progress") {
        throw new CompanyFormConflictError("This Company Form section cannot be submitted.");
      }
      if (!sectionRequiresSubmission({ ...section, questions })) {
        throw new CompanyFormValidationError("Informational sections do not require submission.");
      }
      const applicable = await (input.adapter.isSectionApplicable?.(section, subject.context) ?? true);
      if (!applicable) throw new CompanyFormConflictError("This Company Form section does not apply to the subject.");
      await assertCompanyFormSectionEditable({
        principal: input.actor,
        section,
        part,
        executor: tx,
      });
      await input.adapter.authorizeSectionAction?.({ principal: input.actor, subject: subject.context,
        stageKey: submission.stageKey, section, action: "submit_section", executor: tx });

      const answers = await tx.select({ answer: frmAnswers, question: frmQuestions })
        .from(frmAnswers)
        .innerJoin(frmQuestions, eq(frmQuestions.questionUuid, frmAnswers.questionUuid))
        .where(and(
          eq(frmAnswers.submissionUuid, submission.submissionUuid),
          inArray(frmAnswers.questionUuid, questions.map((q: any) => q.questionUuid)),
          eq(frmAnswers.isDeleted, false),
        ));
      const answerByQuestion = new Map(answers.map((row: any) => [row.answer.questionUuid, row.answer]));
      const missing = questions.filter((question: any) =>
        question.isMandatory &&
        !["content", "system_field", "info_only"].includes(question.responseType) &&
        !answerProvided(question, (answerByQuestion.get(question.questionUuid) as any)?.answerValue));
      if (missing.length) {
        throw new CompanyFormValidationError(
          `Mandatory questions unanswered: ${missing.map((q: any) => q.questionText).join(", ")}`,
        );
      }
      if (section.commentBoxRequired && !state.sectionComment?.trim()) {
        throw new CompanyFormValidationError("A section comment is required before submission.");
      }
      const signatures = await tx.select().from(frmSectionSignatures).where(and(
        eq(frmSectionSignatures.sectionStateUuid, state.sectionStateUuid),
        eq(frmSectionSignatures.isDeleted, false),
      ));
      const presentTypes = new Set(signatures.map((signature: any) => signature.signatureType));
      if (section.signatureOfficerRequired && !presentTypes.has("officer")) {
        throw new CompanyFormValidationError("A Company Representative signature is required.");
      }
      if (section.signatureSeafarerRequired && !presentTypes.has("seafarer")) {
        throw new CompanyFormValidationError("A Seafarer signature is required.");
      }
      if (section.signatureVesselManagementRequired && !presentTypes.has("vessel_management")) {
        throw new CompanyFormValidationError("A Vessel Management signature is required.");
      }

      const now = new Date();
      const users = await tx.select().from(masterUsers).where(eq(masterUsers.id, input.actor.userId)).limit(1);
      const submitterName = users[0] ? actorName(users[0]) : null;
      if (!submitterName) throw new CompanyFormPermissionError("The authenticated submitter identity is unavailable.");
      await freezeSystemFields({
        tx,
        submission,
        subject,
        adapter: input.adapter,
        actorUserId: input.actor.userId,
        event: "section_submission",
        at: now,
      });
      await tx.update(frmSectionStates).set({
        status: "submitted",
        submittedByUuid: String(input.actor.userId),
        submittedByName: submitterName,
        submittedAt: now,
        updatedByUuid: String(input.actor.userId),
        updatedAt: now,
      }).where(eq(frmSectionStates.sectionStateUuid, state.sectionStateUuid));

      const allSections = await tx.select({ section: frmSections, part: frmFormParts })
        .from(frmSections)
        .innerJoin(frmFormParts, and(
          eq(frmFormParts.formPartUuid, frmSections.formPartUuid),
          eq(frmFormParts.formUuid, submission.formUuid),
          eq(frmFormParts.formVersionUuid, submission.formVersionUuid),
          eq(frmFormParts.isDeleted, false),
        ))
        .where(and(
          eq(frmSections.formVersionUuid, submission.formVersionUuid),
          eq(frmSections.isDeleted, false),
        ));
      const allQuestions = allSections.length
        ? await tx.select().from(frmQuestions).where(and(
          inArray(frmQuestions.sectionUuid, allSections.map((row: any) => row.section.sectionUuid)),
          eq(frmQuestions.isDeleted, false),
        ))
        : [];
      const questionsBySection = new Map<string, any[]>();
      for (const question of allQuestions as any[]) {
        const set = questionsBySection.get(question.sectionUuid) ?? [];
        set.push(question);
        questionsBySection.set(question.sectionUuid, set);
      }
      const requiredApplicableSections = [];
      for (const row of allSections as any[]) {
        if (!sectionRequiresSubmission({
          ...row.section,
          questions: questionsBySection.get(row.section.sectionUuid) ?? [],
        })) continue;
        if (await (input.adapter.isSectionApplicable?.(row.section, subject.context) ?? true)) {
          requiredApplicableSections.push(row.section.sectionUuid);
        }
      }
      const allStates = requiredApplicableSections.length
        ? await tx.select().from(frmSectionStates).where(and(
          eq(frmSectionStates.submissionUuid, submission.submissionUuid),
          inArray(frmSectionStates.sectionUuid, requiredApplicableSections),
          eq(frmSectionStates.isDeleted, false),
        ))
        : [];
      const statusBySection = new Map((allStates as any[]).map((item) => [item.sectionUuid, item.status]));
      statusBySection.set(section.sectionUuid, "submitted");
      const complete = requiredApplicableSections.length > 0 &&
        requiredApplicableSections.every((uuid) => statusBySection.get(uuid) === "submitted");
      if (complete) {
        await tx.update(frmCompanySubmissions).set({
          status: "completed",
          completedAt: now,
          updatedByUuid: String(input.actor.userId),
          updatedAt: now,
        }).where(eq(frmCompanySubmissions.submissionUuid, submission.submissionUuid));
      }
      return { completed: complete };
    });
  }

  async saveSignature(input: {
    submissionUuid: string;
    sectionUuid: string;
    signatureType: "officer" | "seafarer" | "vessel_management";
    method: "officer" | "authenticated" | "witnessed" | "vessel_management";
    attachment: {
      uuid: string;
      path: string;
      fileName: string;
      fileType: string;
      fileSize: number;
      bytes?: Buffer;
    };
    actor: CompanyFormPrincipal;
    adapter: LifecycleAdapter;
  }) {
    return getDb().transaction(async (tx: Executor) => {
      const locked = await loadLockedContext(tx, input.submissionUuid, input.adapter, input.actor, "save_signature");
      const { submission, subject } = locked;
      if (submission.status !== "in_progress" || !input.adapter.canStart(subject.context)) {
        throw new CompanyFormConflictError("This Company Form no longer accepts signatures.");
      }
      const { section, part, state } = await sectionAndState(
        tx, submission, input.sectionUuid, input.actor.userId,
      );
      if (state.status === "submitted" || (state.status !== "not_started" && state.status !== "in_progress")) {
        throw new CompanyFormConflictError("Submitted Company Form sections are read-only.");
      }
      assertCompanyFormSignatureConfigured(section, input.signatureType);
      const applicable = await (input.adapter.isSectionApplicable?.(section, subject.context) ?? true);
      if (!applicable) throw new CompanyFormConflictError("This Company Form section does not apply to the subject.");
      await assertCompanyFormSectionEditable({ principal: input.actor, section, part, executor: tx });
      const existingSignatures = await tx.select().from(frmSectionSignatures)
        .where(eq(frmSectionSignatures.sectionStateUuid, state.sectionStateUuid));
      await input.adapter.authorizeSectionAction?.({ principal: input.actor, subject: subject.context,
        stageKey: submission.stageKey, section, action: "save_signature", signatureType: input.signatureType,
        signatures: existingSignatures, executor: tx });
      const declaration = input.adapter.signatories.find((item) => item.signatureType === input.signatureType);
      const allowedMethods = declaration?.methodsByActor?.[input.actor.kind] ??
        (declaration?.allowedActors.includes(input.actor.kind) ? declaration.methods : []);
      if (!declaration || !allowedMethods.includes(input.method)) {
        throw new CompanyFormPermissionError("The current actor is not an allowed signatory for this Company Form.");
      }

      const users = await tx.select().from(masterUsers).where(eq(masterUsers.id, input.actor.userId)).limit(1);
      const user = users[0];
      const userName = user ? actorName(user) : null;
      if (!user || !userName) throw new CompanyFormPermissionError("The authenticated signer identity is unavailable.");
      await input.adapter.authorizeSignature?.(input.actor, input.signatureType, tx);
      const resolvedIdentity = declaration.resolveIdentity
        ? await declaration.resolveIdentity({
          principal: input.actor,
          subject: subject.context,
          submissionUuid: submission.submissionUuid,
          method: input.method,
          executor: tx,
        })
        : null;
      const signerName = resolvedIdentity?.name?.trim() || userName;
      let signerRank = resolvedIdentity?.rank?.trim() || null;
      if (declaration.designationSource === "master_users.designation") {
        signerRank = user.designation?.trim() || null;
        if (!signerRank) throw new CompanyFormValidationError("The Company Representative designation is unavailable.");
      }
      if (input.signatureType === "seafarer") {
        if (!declaration.resolveIdentity) {
          throw new CompanyFormValidationError("The Seafarer identity resolver is unavailable for this Company Form.");
        }
        if (!resolvedIdentity?.name?.trim()) {
          throw new CompanyFormValidationError("The represented Seafarer identity is unavailable.");
        }
        if (!signerRank) {
          throw new CompanyFormValidationError("The represented Seafarer rank is unavailable.");
        }
      }

      const created = await tx.insert(frmSignatureAttachments).values({
        sigAttUuid: input.attachment.uuid,
        fileName: input.attachment.fileName,
        fileType: input.attachment.fileType,
        fileSize: String(input.attachment.fileSize),
        filePath: input.attachment.path,
        createdByUuid: String(input.actor.userId),
        isDeleted: false,
        isSync: false,
      }).returning();
      if (!created.length) throw new Error("Unable to persist Company Form signature attachment.");
      const now = new Date();
      if (input.attachment.bytes) {
        await captureDocumentSignature({
          tx, submissionUuid: submission.submissionUuid, attachmentUuid: input.attachment.uuid,
          bytes: input.attachment.bytes, actorUserId: input.actor.userId, at: now,
        });
      }
      // The schema's signature-type/state unique key includes soft-deleted rows.
      // Revive that slot on an explicit re-sign instead of colliding on insert.
      const prior = await tx.select().from(frmSectionSignatures).where(and(
        eq(frmSectionSignatures.sectionStateUuid, state.sectionStateUuid),
        eq(frmSectionSignatures.signatureType, input.signatureType),
      )).limit(2).for("update");
      if (prior.length > 1) throw new CompanyFormConflictError("Duplicate active signatures prevent a safe update.");
      await freezeSystemFields({
        tx,
        submission,
        subject,
        adapter: input.adapter,
        actorUserId: input.actor.userId,
        event: "signature",
        at: now,
      });
      const signatureValues = {
        subjectProvenance: input.adapter.signatureProvenance?.(subject.context) ?? null,
        signatureAttUuid: input.attachment.uuid,
        signerName,
        signerRank,
        witnessName: input.method === "witnessed" ? userName : null,
        witnessUserId: input.method === "witnessed" ? user.id : null,
        witnessRank: input.method === "witnessed"
          ? (await declaration.resolveWitnessIdentity?.(input.actor, tx))?.rank ?? user.designation?.trim() ?? null : null,
        signerRoleUuid: input.actor.kind !== "seafarer" ? input.actor.roleId : null,
        signedAt: now,
        signedByUuid: user.userUuid ?? String(input.actor.userId),
        signatureMethod: input.method,
        updatedByUuid: String(input.actor.userId),
        updatedAt: now,
        isDeleted: false,
      };
      if (prior[0]) {
        await tx.update(frmSectionSignatures).set(signatureValues)
          .where(eq(frmSectionSignatures.sectionSignatureUuid, prior[0].sectionSignatureUuid));
        await tx.update(frmSignatureAttachments).set({
          isDeleted: true,
          updatedByUuid: String(input.actor.userId),
          updatedAt: now,
        }).where(eq(frmSignatureAttachments.sigAttUuid, prior[0].signatureAttUuid));
      } else {
        await tx.insert(frmSectionSignatures).values({
          sectionSignatureUuid: randomUUID(),
          sectionStateUuid: state.sectionStateUuid,
          signatureType: input.signatureType,
          ...signatureValues,
          createdByUuid: String(input.actor.userId),
          isSync: false,
        });
      }
      return { signatureType: input.signatureType, signerName, signatureMethod: input.method, signedAt: now };
    });
  }

  async removeSignature(input: {
    submissionUuid: string;
    sectionUuid: string;
    signatureUuid: string;
    actor: CompanyFormPrincipal;
    adapter: LifecycleAdapter;
  }) {
    return getDb().transaction(async (tx: Executor) => {
      const { submission, subject } = await loadLockedContext(
        tx, input.submissionUuid, input.adapter, input.actor, "remove_signature",
      );
      if (submission.status !== "in_progress" || !input.adapter.canStart(subject.context)) {
        throw new CompanyFormConflictError("This Company Form no longer accepts signature changes.");
      }
      const { section, part, state } = await sectionAndState(
        tx, submission, input.sectionUuid, input.actor.userId,
      );
      if (state.status === "submitted") throw new CompanyFormConflictError("Submitted Company Form sections are read-only.");
      await assertCompanyFormSectionEditable({ principal: input.actor, section, part, executor: tx });
      const signatures = await tx.select().from(frmSectionSignatures).where(and(
        eq(frmSectionSignatures.sectionSignatureUuid, input.signatureUuid),
        eq(frmSectionSignatures.sectionStateUuid, state.sectionStateUuid),
        eq(frmSectionSignatures.isDeleted, false),
      )).limit(1).for("update");
      if (!signatures[0]) throw new CompanyFormNotFoundError("Company Form signature not found in this section.");
      await input.adapter.authorizeSectionAction?.({ principal: input.actor, subject: subject.context,
        stageKey: submission.stageKey, section, action: "remove_signature", signatureType: signatures[0].signatureType, executor: tx });
      const users = await tx.select({ userUuid: masterUsers.userUuid }).from(masterUsers)
        .where(eq(masterUsers.id, input.actor.userId)).limit(1);
      const signature = signatures[0];
      if (!ownsCompanyFormSignature(signature, input.actor.userId, users[0]?.userUuid)) {
        throw new CompanyFormPermissionError("Fill in permits removing only an unsubmitted signature you signed or recorded as witness.");
      }
      const now = new Date();
      await tx.update(frmSectionSignatures).set({
        isDeleted: true,
        updatedByUuid: String(input.actor.userId),
        updatedAt: now,
      }).where(eq(frmSectionSignatures.sectionSignatureUuid, input.signatureUuid));
      await tx.update(frmSignatureAttachments).set({
        isDeleted: true,
        updatedByUuid: String(input.actor.userId),
        updatedAt: now,
      }).where(eq(frmSignatureAttachments.sigAttUuid, signatures[0].signatureAttUuid));
    });
  }

  async voidSubmission(input: {
    submissionUuid: string;
    reason: string;
    retirementConfirmedAt?: string;
    actor: CompanyFormPrincipal;
    adapter: LifecycleAdapter;
  }) {
    if (input.actor.kind === "seafarer") throw new CompanyFormPermissionError("Company Forms Void permission is required.");
    const reason = input.reason.trim();
    if (!reason || reason.length > 5000) throw new CompanyFormValidationError("A written void reason of 1 to 5,000 characters is required.");
    return getDb().transaction(async (tx: Executor) => {
      // Match start's subject -> form ordering, then lock the submission.
      // Archive takes the same form lock, so acknowledgement cannot race it.
      const parents = await tx.select().from(frmCompanySubmissions).where(and(
        eq(frmCompanySubmissions.submissionUuid, input.submissionUuid),
        eq(frmCompanySubmissions.isDeleted, false),
      )).limit(1);
      if (!parents[0]) throw new CompanyFormNotFoundError("Company Form submission not found.");
      await input.adapter.lockForStart(parents[0].subjectRef, tx);
      const forms = await tx.select({ archivedAt: admFormsV2.archivedAt }).from(admFormsV2)
        .where(eq(admFormsV2.formUuid, parents[0].formUuid)).limit(1).for("update");
      if (!forms[0]) throw new CompanyFormNotFoundError("Company Form not found.");
      const { submission } = await loadLockedContext(
        tx, input.submissionUuid, input.adapter, input.actor, "void_submission",
      );
      if (submission.status === "voided") throw new CompanyFormConflictError("This Company Form submission is already voided.");
      if (submission.stageKey === "on_board" && forms[0].archivedAt &&
        (!input.retirementConfirmedAt ||
          new Date(input.retirementConfirmedAt).getTime() !== new Date(forms[0].archivedAt).getTime())) {
        throw new CompanyFormConflictError("This form has been retired. Voiding will not allow a replacement on this form.");
      }
      const users = await tx.select().from(masterUsers).where(eq(masterUsers.id, input.actor.userId)).limit(1);
      const voidedByName = users[0] ? actorName(users[0]) : null;
      if (!voidedByName) throw new CompanyFormPermissionError("The authenticated voiding user's identity is unavailable.");
      const now = new Date();
      await tx.update(frmCompanySubmissions).set({
        status: "voided",
        voidedAt: now,
        voidedByUuid: String(input.actor.userId),
        voidedByName,
        voidedByDesignation: users[0].designation?.trim() || null,
        voidReason: reason,
        voidedPreviousStatus: submission.status,
        updatedByUuid: String(input.actor.userId),
        updatedAt: now,
      }).where(eq(frmCompanySubmissions.submissionUuid, submission.submissionUuid));
    });
  }
}

export const companyFormSubmissionLifecycleRepository = new CompanyFormSubmissionLifecycleRepository();