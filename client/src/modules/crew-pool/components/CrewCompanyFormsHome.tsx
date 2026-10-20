import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { companyFormErrorMessage } from "@/lib/companyFormErrors";
import { sailDate } from "@shared/v2/forms-engine/displayFormatting";
import { AssignmentDimensionInspector } from "./AssignmentDimensionInspector";
import { AssignmentFormRequirements } from "./AssignmentFormRequirements";
import { assignmentFormRequirementsQuery, stageCheckBlocksActions, stageCheckFor } from "./assignmentFormRequirementsQuery";
import type {
  CompanyFormSubmissionHome,
  CompanyFormSubmissionSummary,
} from "@shared/v2/forms-engine/submissionRenderContract";

export type CrewCompanyFormsAssignment = {
  assignUuid: string;
  signOnDate?: string | null;
  signOffDate?: string | null;
  assignmentType?: string;
};

type CrewCompanyFormsHomeProps = {
  crewUuid?: string;
  assignments?: readonly CrewCompanyFormsAssignment[];
  assignmentHistoryLoading?: boolean;
  assignmentHistoryError?: string;
  onOpenSubmission?: (submissionUuid: string) => void;
};

const unavailable = "Unavailable";

type EligibleSignoffForm = {
  formUuid: string;
  formVersionUuid: string;
  formName?: string | null;
  versionNo?: string | null;
};

type SignoffHomeGroup = CompanyFormSubmissionHome["groups"][number] & {
  startableStages?: string[];
  unfinishedStageKeys?: string[];
};

function queryString(value: string): string {
  return encodeURIComponent(value);
}

function readForms(payload: unknown): EligibleSignoffForm[] {
  if (Array.isArray(payload)) return payload as EligibleSignoffForm[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.forms)) return record.forms as EligibleSignoffForm[];
    if (Array.isArray(record.eligibleForms)) return record.eligibleForms as EligibleSignoffForm[];
  }
  return [];
}

function readSubmissions(payload: unknown): CompanyFormSubmissionSummary[] {
  if (Array.isArray(payload)) return payload as CompanyFormSubmissionSummary[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.submissions)) return record.submissions as CompanyFormSubmissionSummary[];
    if (Array.isArray(record.groups)) {
      return record.groups.flatMap((group) =>
        group && typeof group === "object" && Array.isArray((group as Record<string, unknown>).submissions)
          ? ((group as Record<string, unknown>).submissions as CompanyFormSubmissionSummary[])
          : [],
      );
    }
  }
  return [];
}

function valueOrUnavailable(value: string | null | undefined): string {
  return value?.trim() || unavailable;
}

export function crewCompanyFormStatusLabel(status: CompanyFormSubmissionSummary["status"]): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "voided":
      return "Voided";
  }
}

function errorMessage(error: unknown, action: "load" | "loadHistory" | "loadEligible" | "start" = "load"): string {
  return companyFormErrorMessage(error, action);
}

function isPermissionError(error: unknown): boolean {
  return error instanceof Error && /(?:^|\b)(?:401|403)(?:\b|:)/.test(error.message);
}

export function CrewCompanyFormsHome({
  crewUuid,
  assignments = [],
  assignmentHistoryLoading = false,
  assignmentHistoryError,
  onOpenSubmission,
}: CrewCompanyFormsHomeProps) {
  const queryClient = useQueryClient();
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [selectedForms, setSelectedForms] = useState<Record<string, string>>({});
  const [startError, setStartError] = useState<{ subjectRef: string; message: string; permission: boolean } | null>(null);
  const home = useQuery<CompanyFormSubmissionHome>({
    queryKey: ["crew-company-forms-home", crewUuid],
    enabled: Boolean(crewUuid),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/v2/company-form-submissions/subjects/crew_assignment/home/${encodeURIComponent(crewUuid!)}/submissions`,
      );
      return (await response.json()) as CompanyFormSubmissionHome;
    },
  });
  const rawGroupsForChecks = home.data?.groups ?? [];
  const stageCheckQueries = useQueries({
    queries: rawGroupsForChecks.map((group) => assignmentFormRequirementsQuery(group.subjectRef)),
  });
  const requirementStateBySubject = new Map(rawGroupsForChecks.map((group, index) => [
    group.subjectRef,
    stageCheckQueries[index],
  ]));

  const eligible = useQuery<EligibleSignoffForm[]>({
    queryKey: ["crew-company-signoff-eligible", crewUuid, activePicker],
    enabled: Boolean(crewUuid && activePicker),
    retry: false,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/v2/company-form-submissions/subjects/crew_assignment/${queryString(activePicker!)}/eligible-forms?stageKey=at_sign_off&crewUuid=${queryString(crewUuid!)}`,
      );
      return readForms(await response.json());
    },
  });

  const startSignoff = useMutation({
    mutationFn: async ({ subjectRef, form }: { subjectRef: string; form: EligibleSignoffForm }) => {
      if (!crewUuid) throw new Error("Select a crew member before starting a sign-off form.");
      const base = `/api/v2/company-form-submissions/subjects/crew_assignment/${queryString(subjectRef)}/submissions?crewUuid=${queryString(crewUuid)}`;
      const historyResponse = await apiRequest("GET", base);
      const existing = readSubmissions(await historyResponse.json()).find((submission) =>
        submission.status !== "voided" &&
        submission.formUuid === form.formUuid,
      );
      if (existing) return existing.submissionUuid;

      const response = await apiRequest("POST", base, {
        formUuid: form.formUuid,
        formVersionUuid: form.formVersionUuid,
      });
      const created = await response.json() as { submissionUuid?: string; submission?: { submissionUuid?: string } };
      const submissionUuid = created.submissionUuid ?? created.submission?.submissionUuid;
      if (!submissionUuid) throw new Error("The sign-off form was created but its submission link was not returned.");
      return submissionUuid;
    },
    onSuccess: (submissionUuid) => {
      void queryClient.invalidateQueries({ queryKey: ["crew-company-forms-home", crewUuid] });
      onOpenSubmission?.(submissionUuid);
      setActivePicker(null);
      setStartError(null);
    },
    onError: (error, variables) => {
      setStartError({
        subjectRef: variables.subjectRef,
        message: errorMessage(error, "start"),
        permission: isPermissionError(error),
      });
    },
  });

  const assignmentOrder = new Map(assignments.map((assignment, index) => [assignment.assignUuid, index]));
  const groups = [...(home.data?.groups ?? [])].sort((a, b) => {
    const aOrder = assignmentOrder.get(a.subjectRef);
    const bOrder = assignmentOrder.get(b.subjectRef);
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
    if (aOrder !== undefined) return -1;
    if (bOrder !== undefined) return 1;
    return 0;
  });

  return (
    <section
      className="rounded-md border border-gray-200 bg-white p-4 shadow-sm"
      data-testid="crew-company-forms-home"
      aria-labelledby="crew-company-forms-heading"
    >
      <div className="mb-4 border-b-2 pb-3" style={{ borderColor: "#16569e" }}>
        <h3 id="crew-company-forms-heading" className="text-lg font-semibold" style={{ color: "#16569e" }}>
          G3. Company Forms
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Saved forms and retained history across assignments.
        </p>
      </div>

      {!crewUuid ? (
        <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700" role="status">
          Select a crew member to view permitted company-form history.
        </p>
      ) : (
        <>
          {assignmentHistoryLoading && (
            <p className="mb-3 text-sm text-slate-600" role="status">
              Loading assignment details…
            </p>
          )}
          {assignmentHistoryError && (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
              Assignment details could not be loaded. Refresh the assignment details and try again.
            </p>
          )}
          {home.isLoading && (
            <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700" role="status">
              Loading saved forms…
            </p>
          )}
          {home.error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900" role="alert">
              <p>
                {isPermissionError(home.error)
                  ? "You do not have permission to view these company-form records."
                  : errorMessage(home.error, "loadHistory")}
              </p>
              <button
                type="button"
                className="mt-2 rounded border border-rose-300 bg-white px-3 py-1.5 font-medium text-rose-900 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                onClick={() => void home.refetch()}
              >
                Retry
              </button>
            </div>
          )}
          {home.isSuccess && groups.length === 0 && (
            <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700" role="status">
              {assignments.length === 0 && !assignmentHistoryLoading
                ? "No permitted assignment subjects or saved form history are available."
                : "No permitted company-form subjects or saved forms are available for this crew member."}
            </p>
          )}
          {home.isSuccess && groups.length > 0 && (
            <div className="space-y-3">
              {groups.map((rawGroup) => {
                const group = rawGroup as SignoffHomeGroup;
                const assignment = assignments.find((item) => item.assignUuid === group.subjectRef);
                const display = group.display;
                const heading = valueOrUnavailable(display?.label)
                  !== unavailable
                  ? valueOrUnavailable(display?.label)
                  : assignment
                    ? valueOrUnavailable(assignment.assignmentType) === unavailable
                      ? "Crew assignment"
                      : valueOrUnavailable(assignment.assignmentType)
                    : "Historical assignment";
                const unfinishedSignoffCount = group.unfinishedStageKeys?.includes("at_sign_off")
                  ? group.submissions.filter((submission) =>
                    submission.stageKey === "at_sign_off" && submission.status === "in_progress",
                  ).length
                  : 0;
                const requirementState = requirementStateBySubject.get(group.subjectRef);
                const signoffCheck = stageCheckFor(requirementState?.data, "at_sign_off");
                const signoffStagePermitted = group.startableStages?.includes("at_sign_off") === true;
                const signoffBlocked = !signoffStagePermitted || !requirementState || requirementState.isLoading || requirementState.isError ||
                  stageCheckBlocksActions(requirementState.data, "at_sign_off");
                const showSignoffPicker = group.startableStages?.includes("at_sign_off") ||
                  requirementState?.data?.stageChecks?.enforcementEnabled === true;

                return (
                  <details
                    key={group.groupId || group.subjectRef}
                    className="overflow-hidden rounded-md border border-slate-200 bg-white"
                    data-testid={`crew-company-forms-group-${group.subjectRef}`}
                  >
                    <summary className="cursor-pointer list-none px-3 py-3 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-700">
                      <span className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                        <span className="font-medium text-slate-900">{heading}</span>
                        <span className="text-sm text-slate-600">
                          {group.totalCount} saved {group.totalCount === 1 ? "form" : "forms"}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {assignment ? (
                          <>
                            Sign-on {sailDate(assignment.signOnDate)} <span aria-hidden="true">·</span>{" "}
                            Sign-off {sailDate(assignment.signOffDate)}
                          </>
                        ) : (
                          "Historical assignment · recorded details below"
                        )}
                      </span>
                      {display?.status && (
                        <span className="mt-1 block text-xs text-slate-500">
                          {valueOrUnavailable(display.status)}
                        </span>
                      )}
                      {unfinishedSignoffCount > 0 && (
                        <span
                          className="mt-2 inline-flex rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-950"
                          data-testid={`crew-company-forms-unfinished-${group.subjectRef}`}
                        >
                          {unfinishedSignoffCount} unfinished sign-off {unfinishedSignoffCount === 1 ? "form" : "forms"}
                        </span>
                      )}
                    </summary>

                    <div className="space-y-4 border-t border-slate-200 px-3 py-3">
                      <AssignmentFormRequirements subjectRef={group.subjectRef} onOpenSubmission={onOpenSubmission} />
                      <AssignmentDimensionInspector subjectRef={group.subjectRef} />

                      {showSignoffPicker && (
                        <div className="rounded-md border border-blue-200 bg-blue-50/70 p-3" data-testid={`crew-company-forms-signoff-picker-${group.subjectRef}`}>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-900">Start a manual sign-off form</p>
                              <p className="mt-0.5 text-sm text-slate-600">Choose an eligible form for this assignment.</p>
                            </div>
                            <button
                              type="button"
                              disabled={signoffBlocked}
                              className="rounded-md border border-blue-700 bg-white px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => {
                                if (signoffBlocked) return;
                                setStartError(null);
                                setActivePicker(activePicker === group.subjectRef ? null : group.subjectRef);
                              }}
                              aria-expanded={activePicker === group.subjectRef}
                            >
                              {signoffBlocked ? "Form selection unavailable" : activePicker === group.subjectRef ? "Hide eligible forms" : "Choose a form"}
                            </button>
                          </div>
                          {signoffBlocked && (
                            <p className="mt-2 text-sm text-amber-900" role={requirementState?.isError ? "alert" : "status"}>
                              {requirementState?.isLoading
                                ? "Checking whether this form stage is available…"
                                : requirementState?.isError
                                  ? "Stage availability could not be verified. Manual form selection is disabled until the check can be loaded."
                                  : !signoffStagePermitted || !signoffCheck || signoffCheck.deferred || signoffCheck.outcome === "DEFERRED"
                                    ? "Available once Relief Status is Planned or Confirmed."
                                    : "Manual form selection is unavailable until the enforced at-sign-off check is completed."
                              }
                            </p>
                          )}
                          {activePicker === group.subjectRef && (
                            <div className="mt-3 border-t border-blue-200 pt-3">
                              {signoffBlocked && <p className="text-sm text-amber-900">Form selection is disabled while this stage check is unresolved.</p>}
                              {!signoffBlocked && <>
                              {eligible.isLoading && <p role="status" className="text-sm text-slate-600">Loading eligible forms…</p>}
                              {eligible.error && (
                                <p role="alert" className="text-sm text-rose-800">
                                  {isPermissionError(eligible.error)
                                    ? "You do not have permission to view eligible sign-off forms."
                                    : errorMessage(eligible.error, "loadEligible")}
                                  {" "}
                                  <button type="button" className="font-semibold underline" onClick={() => void eligible.refetch()}>Retry</button>
                                </p>
                              )}
                              {eligible.isSuccess && eligible.data.length === 0 && (
                                <p role="status" className="text-sm text-slate-600">No sign-off forms are currently eligible for this assignment.</p>
                              )}
                              {eligible.isSuccess && eligible.data.length > 0 && (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <label className="sr-only" htmlFor={`signoff-form-${group.subjectRef}`}>Eligible sign-off form</label>
                                  <select
                                    id={`signoff-form-${group.subjectRef}`}
                                    className="min-h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                                    value={selectedForms[group.subjectRef] ?? ""}
                                    onChange={(event) => setSelectedForms((current) => ({ ...current, [group.subjectRef]: event.target.value }))}
                                  >
                                    <option value="">Select a form</option>
                                    {eligible.data.map((form) => (
                                      <option key={`${form.formUuid}:${form.formVersionUuid}`} value={`${form.formUuid}:${form.formVersionUuid}`}>
                                        {valueOrUnavailable(form.formName)}{form.versionNo ? ` · Version ${form.versionNo}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    disabled={!selectedForms[group.subjectRef] || startSignoff.isPending}
                                    className="rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-slate-400"
                                    onClick={() => {
                                      const [formUuid, formVersionUuid] = (selectedForms[group.subjectRef] ?? "").split(":");
                                      const form = eligible.data.find((item) => item.formUuid === formUuid && item.formVersionUuid === formVersionUuid);
                                      if (form) startSignoff.mutate({ subjectRef: group.subjectRef, form });
                                    }}
                                  >
                                    {startSignoff.isPending && startSignoff.variables?.subjectRef === group.subjectRef ? "Opening…" : "Start or resume"}
                                  </button>
                                </div>
                              )}
                              {startError?.subjectRef === group.subjectRef && (
                                <p role="alert" className="mt-2 text-sm text-rose-800">
                                  {startError.permission ? "You do not have permission to start or open this sign-off form." : startError.message}
                                </p>
                              )}
                              </>}
                            </div>
                          )}
                        </div>
                      )}
                      {display?.fields && display.fields.length > 0 && (
                        <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                          {display.fields.map((field, index) => (
                            <div key={`${field.label}-${index}`} className="text-sm">
                              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                                {valueOrUnavailable(field.label)}
                              </dt>
                              <dd className="mt-0.5 text-slate-800">{valueOrUnavailable(field.value)}</dd>
                            </div>
                          ))}
                        </dl>
                      )}

                      {group.submissions.length === 0 ? (
                        <p className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-600">
                          No saved forms for this assignment.
                        </p>
                      ) : (
                        <ol className="space-y-3">
                          {group.submissions.map((submission) => {
                            const unfinishedSignoff = group.unfinishedStageKeys?.includes("at_sign_off") === true &&
                              submission.stageKey === "at_sign_off" &&
                              submission.status === "in_progress";
                            const recordedAt = submission.systemSnapshotAt
                              ? `Form recorded ${sailDate(submission.systemSnapshotAt)}`
                              : `Form date unavailable · Created ${sailDate(submission.createdAt)}`;
                            const openLabel = `${valueOrUnavailable(submission.formName)} · ${sailDate(
                              submission.systemSnapshotAt ?? submission.createdAt,
                            )}`;

                            return (
                              <li
                                key={submission.submissionUuid}
                                className="rounded-md border border-slate-200 bg-slate-50/70 p-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <p className="font-medium text-slate-900">
                                      {valueOrUnavailable(submission.formName)}
                                    </p>
                                    {unfinishedSignoff && (
                                      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-amber-900" data-testid={`crew-company-forms-unfinished-submission-${submission.submissionUuid}`}>
                                        <span>Unfinished sign-off form</span>
                                        <a
                                          href="#company-form-history"
                                          className="underline decoration-amber-500 underline-offset-2 hover:text-amber-950"
                                          onClick={(event) => { event.preventDefault(); onOpenSubmission?.(submission.submissionUuid); }}
                                          aria-disabled={!onOpenSubmission}
                                          data-testid={`crew-company-forms-unfinished-open-${submission.submissionUuid}`}
                                        >
                                          Open form
                                        </a>
                                      </div>
                                    )}
                                    <p className="mt-1 text-sm text-slate-600">
                                      Version {valueOrUnavailable(submission.versionNo)}{" "}
                                      <span aria-hidden="true">·</span>{" "}
                                      {valueOrUnavailable(submission.stageLabel)}
                                    </p>
                                    {submission.origin && (
                                      <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${submission.origin === "REQUIRED" ? "bg-sky-100 text-sky-900" : "bg-slate-200 text-slate-700"}`}>
                                        {submission.origin === "REQUIRED" ? "Required" : "Manual"}
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      submission.status === "completed"
                                        ? "bg-emerald-100 text-emerald-900"
                                        : submission.status === "voided"
                                          ? "bg-rose-100 text-rose-900"
                                          : "bg-amber-100 text-amber-950"
                                    }`}
                                  >
                                    {crewCompanyFormStatusLabel(submission.status)}
                                  </span>
                                </div>
                                <p className="mt-2 text-sm text-slate-600">{recordedAt}</p>
                                {submission.handovers?.map((handover, index) => (
                                  <p key={`${handover.recordedAt}-${index}`} className="mt-2 break-all text-xs text-slate-600">
                                    Copy handed to seafarer by {handover.actorName} · {sailDate(handover.recordedAt)}
                                    <br />File SHA-256: {handover.fileSha256}
                                  </p>
                                ))}
                                {submission.status === "voided" && (
                                  <p className="mt-1 text-sm text-slate-600">
                                    Voided by {valueOrUnavailable(submission.voidedByName)}
                                    {submission.voidedByDesignation
                                      ? ` · ${submission.voidedByDesignation}`
                                      : ""}
                                    {submission.voidedAt
                                      ? ` · ${sailDate(submission.voidedAt)}`
                                      : " · void date unavailable"}
                                  </p>
                                )}

                                {submission.replacementHistory?.length ? (
                                  <ul className="mt-3 space-y-2 border-t border-slate-200 pt-2">
                                    {submission.replacementHistory.map((link, index) => (
                                      <li
                                        key={`${link.submissionUuid}-${link.direction}-${index}`}
                                        className="text-sm"
                                      >
                                        <span className="text-slate-600">{link.label}: </span>
                                        <a
                                          href="#company-form-history"
                                          className="font-medium text-blue-800 underline decoration-blue-300 underline-offset-2 hover:text-blue-950 disabled:cursor-not-allowed disabled:text-slate-500"
                                          aria-disabled={!onOpenSubmission}
                                          onClick={(event) => { event.preventDefault(); onOpenSubmission?.(link.submissionUuid); }}
                                          data-testid={`crew-company-forms-link-${submission.submissionUuid}-${link.submissionUuid}`}
                                        >
                                          {valueOrUnavailable(link.targetLabel)}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}

                                <a
                                  href="#company-form-history"
                                  className="mt-3 rounded-md border border-blue-700 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-500"
                                  aria-disabled={!onOpenSubmission}
                                  onClick={(event) => { event.preventDefault(); onOpenSubmission?.(submission.submissionUuid); }}
                                  data-testid={`crew-company-forms-open-${submission.submissionUuid}`}
                                  aria-label={`Open ${openLabel}`}
                                >
                                  Open {openLabel}
                                </a>
                              </li>
                            );
                          })}
                        </ol>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default CrewCompanyFormsHome;