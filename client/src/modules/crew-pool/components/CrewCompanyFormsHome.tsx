import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { sailDate } from "@shared/v2/forms-engine/displayFormatting";
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load saved company forms.";
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
          Saved declarations and retained history across assignments.
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
              Assignment details could not be loaded: {assignmentHistoryError}
            </p>
          )}
          {home.isLoading && (
            <p className="rounded-md bg-slate-50 px-3 py-3 text-sm text-slate-700" role="status">
              Loading saved declarations…
            </p>
          )}
          {home.error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900" role="alert">
              <p>
                {isPermissionError(home.error)
                  ? "You do not have permission to view these company-form records."
                  : `Saved company forms could not be loaded: ${errorMessage(home.error)}`}
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
                ? "No permitted assignment subjects or saved declaration history are available."
                : "No permitted company-form subjects or saved declarations are available for this crew member."}
            </p>
          )}
          {home.isSuccess && groups.length > 0 && (
            <div className="space-y-3">
              {groups.map((group) => {
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
                          "Assignment dates unavailable"
                        )}
                      </span>
                      {display?.status && (
                        <span className="mt-1 block text-xs text-slate-500">
                          {valueOrUnavailable(display.status)}
                        </span>
                      )}
                    </summary>

                    <div className="space-y-4 border-t border-slate-200 px-3 py-3">
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
                          No saved declarations for this assignment.
                        </p>
                      ) : (
                        <ol className="space-y-3">
                          {group.submissions.map((submission) => {
                            const recordedAt = submission.systemSnapshotAt
                              ? `Declaration recorded ${sailDate(submission.systemSnapshotAt)}`
                              : `Declaration date unavailable · Created ${sailDate(submission.createdAt)}`;
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
                                    <p className="mt-1 text-sm text-slate-600">
                                      Version {valueOrUnavailable(submission.versionNo)}{" "}
                                      <span aria-hidden="true">·</span>{" "}
                                      {valueOrUnavailable(submission.stageLabel)}
                                    </p>
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