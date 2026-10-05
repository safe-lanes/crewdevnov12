import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { admFormVersionsV2, admFormsV2 } from "../../../shared/v2/admin/schema";
import { frmSubjectStages } from "../../../shared/v2/forms-engine/subjectRegistry";
import {
  frmCompanySubmissions,
} from "../../../shared/v2/forms-engine/submissions";
import { getDb } from "../db";
import type {
  CompanyFormSubjectAdapter,
  SubjectLookupResult,
} from "./contracts";
import { CompanyFormConflictError, CompanyFormNotFoundError } from "./errors";
import {
  validatePersistedCompanyFormLifecycle,
  validatePersistedCompanyFormLifecycles,
} from "./lifecyclePolicy";

type Executor = any;

export type CompanyFormSubmissionRow = {
  submissionUuid: string;
  subjectType: string;
  subjectRef: string;
  formUuid: string;
  formVersionUuid: string;
  stageKey: string | null;
  status: "in_progress" | "completed" | "voided";
  completedAt: Date | null;
  replacesSubmissionUuid: string | null;
  replacedBySubmissionUuid: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type EligibleCompanyForm = {
  formUuid: string;
  formName: string;
  description: string | null;
  formVersionUuid: string;
  versionNo: string;
  stageKey: string | null;
  releasedAt: Date | null;
};

function isLaterRelease(candidate: EligibleCompanyForm, current: EligibleCompanyForm): boolean {
  const candidateNo = Number.parseInt(candidate.versionNo, 10);
  const currentNo = Number.parseInt(current.versionNo, 10);
  const candidateValid = Number.isFinite(candidateNo);
  const currentValid = Number.isFinite(currentNo);
  if (candidateValid && currentValid && candidateNo !== currentNo) return candidateNo > currentNo;
  if (candidateValid !== currentValid) return candidateValid;

  const candidateDate = candidate.releasedAt ? new Date(candidate.releasedAt).getTime() : 0;
  const currentDate = current.releasedAt ? new Date(current.releasedAt).getTime() : 0;
  return candidateDate > currentDate;
}

function postgresError(error: unknown): Record<string, unknown> | undefined {
  if (!error || typeof error !== "object") return undefined;
  const current = error as Record<string, unknown>;
  if (current.code || current.constraint) return current;
  return postgresError(current.cause);
}

export class CompanyFormSubmissionsRepository {
  async countsForSubjects(subjectType: string, subjectRefs: string[], stageKey: string) {
    if (!subjectRefs.length) return {};
    const rows = await getDb().select({ subjectRef: frmCompanySubmissions.subjectRef,
      count: sql<number>`count(*)::integer` }).from(frmCompanySubmissions)
      .where(and(eq(frmCompanySubmissions.subjectType, subjectType),
        inArray(frmCompanySubmissions.subjectRef, subjectRefs), eq(frmCompanySubmissions.stageKey, stageKey),
        subjectType === "crew_assignment" && stageKey === "on_board"
          ? sql`${frmCompanySubmissions.status} <> 'voided'` : undefined,
        eq(frmCompanySubmissions.isDeleted, false))).groupBy(frmCompanySubmissions.subjectRef);
    return Object.fromEntries(subjectRefs.map(ref => [ref, rows.find((row: any) => row.subjectRef === ref)?.count ?? 0]));
  }
  async findEligibleForms(
    subjectType: string,
    stageKey: string | null,
    executor: Executor = getDb(),
  ): Promise<EligibleCompanyForm[]> {
    const versions = await executor
      .select({
        formUuid: admFormsV2.formUuid,
        formName: admFormsV2.name,
        description: admFormsV2.description,
        formId: admFormsV2.id,
        formSubjectType: admFormsV2.subjectType,
        formVersionUuid: admFormVersionsV2.fvUuid,
        versionNo: admFormVersionsV2.versionNo,
        stageKey: admFormVersionsV2.stageKey,
        stageSubjectType: admFormVersionsV2.stageSubjectType,
        releasedAt: admFormVersionsV2.releasedAt,
      })
      .from(admFormVersionsV2)
      .innerJoin(admFormsV2, eq(admFormsV2.id, admFormVersionsV2.formId))
      .where(and(
        eq(admFormsV2.category, "dynamic"),
        eq(admFormsV2.subjectType, subjectType),
        eq(admFormsV2.isDeleted, false),
        isNull(admFormsV2.archivedAt),
        eq(admFormVersionsV2.isDeleted, false),
        eq(admFormVersionsV2.status, "released"),
        stageKey === null ? isNull(admFormVersionsV2.stageKey) : eq(admFormVersionsV2.stageKey, stageKey),
        eq(admFormVersionsV2.stageSubjectType, subjectType),
      ))
      .orderBy(asc(admFormsV2.name), asc(admFormVersionsV2.versionNo));

    const lifecycleByVersion = await validatePersistedCompanyFormLifecycles(
      executor,
      versions.map((row: { formVersionUuid: string }) => row.formVersionUuid),
    );

    const latestByFormAndStage = new Map<string, EligibleCompanyForm>();
    for (const row of versions) {
      if ((lifecycleByVersion.get(row.formVersionUuid)?.length ?? 1) > 0) continue;
      const eligible: EligibleCompanyForm = {
        formUuid: row.formUuid,
        formName: row.formName,
        description: row.description,
        formVersionUuid: row.formVersionUuid,
        versionNo: row.versionNo,
        stageKey: row.stageKey,
        releasedAt: row.releasedAt,
      };
      const key = `${row.formUuid}\u0000${row.stageKey ?? "\u0001"}`;
      const current = latestByFormAndStage.get(key);
      if (!current || isLaterRelease(eligible, current)) latestByFormAndStage.set(key, eligible);
    }

    return [...latestByFormAndStage.values()].sort((a, b) =>
      a.formName.localeCompare(b.formName) ||
      (a.stageKey ?? "").localeCompare(b.stageKey ?? "") ||
      a.versionNo.localeCompare(b.versionNo));
  }

  async listForSubjects(
    subjectType: string,
    subjectRefs: readonly string[],
    executor: Executor = getDb(),
  ): Promise<CompanyFormSubmissionRow[]> {
    if (subjectRefs.length === 0) return [];
    return executor
      .select({
        submissionUuid: frmCompanySubmissions.submissionUuid,
        subjectType: frmCompanySubmissions.subjectType,
        subjectRef: frmCompanySubmissions.subjectRef,
        formUuid: frmCompanySubmissions.formUuid,
        formVersionUuid: frmCompanySubmissions.formVersionUuid,
        stageKey: frmCompanySubmissions.stageKey,
        versionNo: admFormVersionsV2.versionNo,
        releasedAt: admFormVersionsV2.releasedAt,
        formName: admFormsV2.name,
        formArchivedAt: admFormsV2.archivedAt,
        voidedAt: frmCompanySubmissions.voidedAt,
        voidedByName: frmCompanySubmissions.voidedByName,
        voidedByUuid: frmCompanySubmissions.voidedByUuid,
        voidedByDesignation: frmCompanySubmissions.voidedByDesignation,
        voidReason: frmCompanySubmissions.voidReason,
        voidedPreviousStatus: frmCompanySubmissions.voidedPreviousStatus,
        systemSnapshotAt: frmCompanySubmissions.systemSnapshotAt,
        systemSnapshotEvent: frmCompanySubmissions.systemSnapshotEvent,
        stageLabel: frmSubjectStages.label,
        status: frmCompanySubmissions.status,
        completedAt: frmCompanySubmissions.completedAt,
        replacesSubmissionUuid: frmCompanySubmissions.replacesSubmissionUuid,
        replacedBySubmissionUuid: frmCompanySubmissions.replacedBySubmissionUuid,
        createdAt: frmCompanySubmissions.createdAt,
        updatedAt: frmCompanySubmissions.updatedAt,
      })
      .from(frmCompanySubmissions)
      .leftJoin(admFormVersionsV2, eq(admFormVersionsV2.fvUuid, frmCompanySubmissions.formVersionUuid))
      .leftJoin(admFormsV2, eq(admFormsV2.formUuid, frmCompanySubmissions.formUuid))
      .leftJoin(frmSubjectStages, and(eq(frmSubjectStages.subjectType, frmCompanySubmissions.subjectType),
        eq(frmSubjectStages.stageKey, frmCompanySubmissions.stageKey)))
      .where(and(
        eq(frmCompanySubmissions.subjectType, subjectType),
        inArray(frmCompanySubmissions.subjectRef, [...subjectRefs]),
        eq(frmCompanySubmissions.isDeleted, false),
      ))
      .orderBy(desc(frmCompanySubmissions.createdAt), asc(frmCompanySubmissions.submissionUuid));
  }

  async createPinnedSubmission(input: {
    adapter: CompanyFormSubjectAdapter<any>;
    subjectType: string;
    subjectRef: string;
    formUuid: string;
    formVersionUuid: string;
    authorizeLockedSubject: (subject: SubjectLookupResult<any>) => Promise<void>;
    authorizeLockedVersion?: (subject: SubjectLookupResult<any>, stageKey: string | null, executor: any) => Promise<void>;
  }): Promise<CompanyFormSubmissionRow> {
    try {
      return await getDb().transaction(async (tx: Executor) => {
        // Subject first: this takes the same row lock as assignment cancellation.
        const subject = await input.adapter.lockForStart(input.subjectRef, tx);
        if (!subject) throw new CompanyFormNotFoundError("Company Form subject not found.");
        await input.authorizeLockedSubject(subject);
        if (!input.adapter.canStart(subject.context)) {
          throw new CompanyFormConflictError("This subject is no longer eligible to start a Company Form.");
        }

        // Match Admin archive/release lock order: form, version, then the
        // subject-stage advisory lock used by the stage and pin triggers.
        const forms = await tx.select({
          id: admFormsV2.id,
          formUuid: admFormsV2.formUuid,
          subjectType: admFormsV2.subjectType,
          category: admFormsV2.category,
          archivedAt: admFormsV2.archivedAt,
          isDeleted: admFormsV2.isDeleted,
        }).from(admFormsV2)
          .where(eq(admFormsV2.formUuid, input.formUuid))
          .limit(1)
          .for("update");
        const form = forms[0];
        if (!form || form.isDeleted || form.category !== "dynamic" ||
            form.subjectType !== input.subjectType) {
          throw new CompanyFormNotFoundError("Selected Company Form is not available for this subject.");
        }
        if (form.archivedAt) {
          throw new CompanyFormConflictError("Archived Company Forms cannot be started.");
        }

        const versions = await tx.select({
          formId: admFormVersionsV2.formId,
          formVersionUuid: admFormVersionsV2.fvUuid,
          status: admFormVersionsV2.status,
          isDeleted: admFormVersionsV2.isDeleted,
          stageKey: admFormVersionsV2.stageKey,
          stageSubjectType: admFormVersionsV2.stageSubjectType,
        }).from(admFormVersionsV2)
          .where(eq(admFormVersionsV2.fvUuid, input.formVersionUuid))
          .limit(1)
          .for("update");
        const version = versions[0];
        if (!version || version.isDeleted || version.formId !== form.id) {
          throw new CompanyFormNotFoundError("Selected Company Form version does not belong to this form.");
        }
        if (version.status !== "released") {
          throw new CompanyFormConflictError("Only a released Company Form version can be started.");
        }
        await input.authorizeLockedVersion?.(subject, version.stageKey, tx);
        const lifecycleErrors = await validatePersistedCompanyFormLifecycle(tx, version.formVersionUuid);
        if (lifecycleErrors.length > 0) {
          throw new CompanyFormConflictError(
            `This Company Form version cannot be completed and cannot be started. ${lifecycleErrors.join(" ")}`,
          );
        }

        await tx.execute(sql`
          SELECT pg_advisory_xact_lock(
            hashtextextended('frm_subject_stage:' || ${input.subjectType}, 0)
          )
        `);
        const stages = await input.adapter.loadStages(tx);
        const selectedStage = version.stageKey ?? null;
        if (
          version.stageSubjectType !== input.subjectType ||
          (stages.length === 0 ? selectedStage !== null : (
            selectedStage === null || !stages.some((stage) => stage.stageKey === selectedStage)
          ))
        ) {
          throw new CompanyFormConflictError("Selected Company Form version is no longer eligible for this subject.");
        }
        const eligibleVersions = await this.findEligibleForms(input.subjectType, selectedStage, tx);
        if (!eligibleVersions.some((candidate) =>
          candidate.formUuid === form.formUuid &&
          candidate.formVersionUuid === version.formVersionUuid)) {
          throw new CompanyFormConflictError(
            "Selected Company Form version is no longer the released eligible version. Refresh the form list and try again.",
          );
        }

        // The subject row is locked for the transaction, serializing starts and
        // voids for this assignment. Link only the newest terminal void so
        // repeated void/re-create cycles form a readable chain, not a fork.
        const activeSubmissions = await tx.select({
          submissionUuid: frmCompanySubmissions.submissionUuid,
        }).from(frmCompanySubmissions)
          .where(and(
            eq(frmCompanySubmissions.formUuid, form.formUuid),
            eq(frmCompanySubmissions.subjectType, input.subjectType),
            eq(frmCompanySubmissions.subjectRef, subject.subjectRef),
            sql`${frmCompanySubmissions.status} <> 'voided'
              AND COALESCE(${frmCompanySubmissions.isDeleted}, false) = false`,
          ))
          .limit(1)
          .for("update");
        if (activeSubmissions.length > 0) {
          throw new CompanyFormConflictError("A non-voided submission for this Company Form and subject already exists.");
        }
        const replacedRows = await tx.select({
          submissionUuid: frmCompanySubmissions.submissionUuid,
        }).from(frmCompanySubmissions)
          .where(and(
            eq(frmCompanySubmissions.formUuid, form.formUuid),
            eq(frmCompanySubmissions.subjectType, input.subjectType),
            eq(frmCompanySubmissions.subjectRef, subject.subjectRef),
            eq(frmCompanySubmissions.status, "voided"),
            eq(frmCompanySubmissions.isDeleted, false),
            isNull(frmCompanySubmissions.replacedBySubmissionUuid),
          ))
          .orderBy(desc(frmCompanySubmissions.voidedAt), desc(frmCompanySubmissions.createdAt),
            desc(frmCompanySubmissions.id))
          .limit(1)
          .for("update");
        const replacedSubmissionUuid = replacedRows[0]?.submissionUuid ?? null;
        const submissionUuid = uuidv4();
        const inserted = await tx.insert(frmCompanySubmissions).values({
          submissionUuid,
          subjectType: input.subjectType,
          subjectRef: subject.subjectRef,
          formUuid: form.formUuid,
          formVersionUuid: version.formVersionUuid,
          stageKey: selectedStage,
          status: "in_progress",
          completedAt: null,
          replacesSubmissionUuid: replacedSubmissionUuid,
          isDeleted: false,
          isSync: false,
        }).returning({
          submissionUuid: frmCompanySubmissions.submissionUuid,
          subjectType: frmCompanySubmissions.subjectType,
          subjectRef: frmCompanySubmissions.subjectRef,
          formUuid: frmCompanySubmissions.formUuid,
          formVersionUuid: frmCompanySubmissions.formVersionUuid,
          stageKey: frmCompanySubmissions.stageKey,
          status: frmCompanySubmissions.status,
          completedAt: frmCompanySubmissions.completedAt,
          replacesSubmissionUuid: frmCompanySubmissions.replacesSubmissionUuid,
          replacedBySubmissionUuid: frmCompanySubmissions.replacedBySubmissionUuid,
          createdAt: frmCompanySubmissions.createdAt,
          updatedAt: frmCompanySubmissions.updatedAt,
        });
        const submission = inserted[0];
        if (replacedSubmissionUuid) {
          const replacedUpdate = await tx.update(frmCompanySubmissions).set({
            replacedBySubmissionUuid: submissionUuid,
          }).where(and(
            eq(frmCompanySubmissions.submissionUuid, replacedSubmissionUuid),
            eq(frmCompanySubmissions.status, "voided"),
            isNull(frmCompanySubmissions.replacedBySubmissionUuid),
          )).returning({ submissionUuid: frmCompanySubmissions.submissionUuid });
          if (replacedUpdate.length !== 1) {
            throw new CompanyFormConflictError(
              "The prior voided Company Form changed during replacement; retry starting the form.",
            );
          }
        }
        await input.adapter.linkSubmission({ executor: tx, submissionUuid, subject });
        return submission;
      });
    } catch (error: unknown) {
      const postgres = postgresError(error);
      if (postgres?.code === "23505" &&
          postgres.constraint === "uq_frm_company_submissions_form_subject_ref") {
        throw new CompanyFormConflictError("A submission for this Company Form and subject already exists.");
      }
      throw error;
    }
  }
}

export const companyFormSubmissionsRepository = new CompanyFormSubmissionsRepository();