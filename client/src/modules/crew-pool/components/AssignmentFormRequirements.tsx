import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { companyFormErrorMessage, safeCompanyFormReason } from "@/lib/companyFormErrors";
import { stageCheckBlocksActions, stageCheckFor, useAssignmentFormRequirements, type AssignmentFormRequirement as Requirement } from "./assignmentFormRequirementsQuery";

const stageNames: Record<string, string> = {
  before_joining: "Before joining",
  on_board: "On board",
  at_sign_off: "At sign-off",
};

function humanDate(date?: string | null) {
  if (!date) return "Date unavailable";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleDateString();
}

function statusKind(status: string) {
  const value = status.toUpperCase();
  if (value.includes("WITHDRAW")) return "withdrawn";
  if (value.includes("UNRESOLV")) return "unresolved";
  if (value.includes("VOID")) return "voided";
  if (value.includes("COMPLETE")) return "completed";
  if (value.includes("CONFLICT") || value.includes("MANUAL")) return "manual";
  return "required";
}

function historyEventLabel(event: string) {
  const labels: Record<string, string> = {
    created: "Requirement recorded",
    assigned: "Requirement assigned",
    completed: "Requirement completed",
    withdrawn: "Requirement withdrawn",
    resolved: "Requirement resolved",
    updated: "Requirement updated",
  };
  return labels[event.toLowerCase()] ?? "Requirement updated";
}

export function AssignmentFormRequirements({ subjectRef, stageKey, onOpenSubmission, beforeStart, allowStart = true, requirementUuid }: {
  subjectRef: string;
  stageKey?: string;
  onOpenSubmission?: (submissionUuid: string) => void;
  beforeStart?: () => Promise<unknown>;
  allowStart?: boolean;
  requirementUuid?: string;
}) {
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [retryingEvent, setRetryingEvent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const query = useAssignmentFormRequirements(subjectRef);
  const queryKey = ["assignment-form-requirements", subjectRef];
  const requirements = (query.data?.requirements ?? []).filter((r) =>
    (!stageKey || r.stage_key === stageKey) && (!requirementUuid || r.requirement_uuid === requirementUuid));
  const runs = (query.data?.runs ?? []).filter((r) => !stageKey || r.stage_key === stageKey);
  const stageChecks = query.data?.stageChecks;
  const visibleStageChecks = (stageChecks?.stages ?? []).filter((stage) => !stageKey || stage.stage_key === stageKey);
  const blockedStage = stageKey ? stageCheckFor(query.data, stageKey) : undefined;
  const blocked = Boolean(stageKey && (query.isError || stageCheckBlocksActions(query.data, stageKey)));

  async function start(requirement: Requirement) {
    if (query.isError || stageCheckBlocksActions(query.data, requirement.stage_key)) {
      setError("The enforced form stage is unavailable until its check can be verified.");
      return;
    }
    setBusyId(requirement.requirement_uuid);
    setError("");
    try {
      await beforeStart?.();
      const result = await (await apiRequest(
        "POST",
        `/api/v2/company-form-submissions/subjects/crew_assignment/${encodeURIComponent(subjectRef)}/requirements/${encodeURIComponent(requirement.requirement_uuid)}/start`,
        {},
      )).json() as { submissionUuid?: string };
      if (!result.submissionUuid) throw new Error("The form could not be opened because no submission was returned.");
      await queryClient.invalidateQueries({ queryKey });
      onOpenSubmission?.(result.submissionUuid);
    } catch (cause) {
      setError(companyFormErrorMessage(cause, "start"));
    } finally {
      setBusyId(null);
    }
  }

  async function retryStageCheck(eventUuid: string) {
    setRetryingEvent(eventUuid);
    setError("");
    try {
      await apiRequest(
        "POST",
        `/api/v2/company-form-submissions/subjects/crew_assignment/${encodeURIComponent(subjectRef)}/checks/${encodeURIComponent(eventUuid)}/retry`,
        {},
      );
      await queryClient.invalidateQueries({ queryKey });
    } catch (cause) {
      setError(companyFormErrorMessage(cause, "retryCheck"));
    } finally {
      setRetryingEvent(null);
    }
  }

  return <section className="rounded-md border border-sky-200 bg-sky-50/60 p-3" data-testid={`assignment-form-requirements-${subjectRef}${stageKey ? `-${stageKey}` : ""}`}>
    <div>
      <h4 className="font-semibold text-sky-950">Assignment form requirements</h4>
      <p className="mt-0.5 text-xs text-slate-600">Required forms are linked to this assignment. Saved forms remain listed separately below.</p>
    </div>
    {query.isLoading && <div role="status" className="mt-3 space-y-2"><span className="sr-only">Loading form requirements…</span><div className="h-8 animate-pulse rounded bg-sky-100" /><div className="h-8 animate-pulse rounded bg-sky-100" /></div>}
    {query.error && <div role="alert" className="mt-3 text-sm text-rose-800">
       <p>{companyFormErrorMessage(query.error, "loadRequirements")}</p>
      <button className="mt-1 font-semibold underline" type="button" onClick={() => void query.refetch()}>Retry</button>
    </div>}
    {query.isSuccess && stageChecks && !stageChecks.enforcementEnabled && <p className="mt-2 rounded bg-slate-100 px-2.5 py-2 text-xs text-slate-700">
      Stage-check enforcement is off for this assignment. Existing form controls remain available under the legacy behavior.
    </p>}
    {query.isSuccess && stageChecks?.activationFailure && <p role="alert" className="mt-2 text-sm text-amber-900">{safeCompanyFormReason(stageChecks.activationFailure)}</p>}
    {query.isSuccess && (stageChecks?.failures ?? []).filter(failure =>
      (!stageKey || failure.stage_key === stageKey) && !visibleStageChecks.some(check => check.stage_key === failure.stage_key))
      .map((failure, index) => <p key={`capture-failure-${index}`} role="alert" className="mt-2 text-sm text-amber-900">
        {stageNames[failure.stage_key] ?? "Form stage"} check failed to capture its original facts. The lifecycle operation succeeded; this is not a completed no-forms check.
      </p>)}
    {query.isSuccess && visibleStageChecks.length > 0 && <ul className="mt-3 space-y-2">
      {visibleStageChecks.map((check) => {
        const retryable = stageChecks?.canRetry && ["FAILED", "PENDING"].includes(check.outcome) && Boolean(check.event_uuid);
        const failures = (stageChecks?.failures ?? []).filter((failure) => failure.stage_key === check.stage_key);
        const deferred = check.deferred || check.outcome === "DEFERRED";
        return <li key={`${check.stage_key}-${check.cycle_uuid}`} className={`rounded border px-3 py-2 text-xs ${check.outcome === "COMPLETED" && !deferred ? "border-emerald-200 bg-emerald-50 text-emerald-900" : deferred ? "border-slate-200 bg-slate-50 text-slate-700" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{stageNames[check.stage_key] ?? "Form stage"} check · {deferred ? "Deferred" : check.outcome === "COMPLETED" ? "Completed" : check.outcome === "FAILED" ? "Failed" : "Pending"}</span>
            {retryable && <button type="button" className="rounded border border-current px-2 py-1 font-semibold hover:bg-white/70 disabled:opacity-50" disabled={retryingEvent === check.event_uuid} onClick={() => void retryStageCheck(check.event_uuid)}>
              {retryingEvent === check.event_uuid ? "Retrying…" : "Retry check"}
            </button>}
          </div>
           <p className="mt-1">{check.reason ? safeCompanyFormReason(check.reason) : check.recorded_at ? `Recorded ${humanDate(check.recorded_at)}` : "Recorded time unavailable."}</p>
           {failures.map((failure, index) => <p key={`${failure.stage_key}-${index}`} className="mt-1 break-words">{safeCompanyFormReason(failure.evidence)}</p>)}
          {check.outcome === "COMPLETED" && !deferred && !query.data?.requirements.some((requirement) => requirement.stage_key === check.stage_key) && <p className="mt-1 font-medium">The completed stage check found no forms that apply.</p>}
          {deferred && check.stage_key === "at_sign_off" && <p className="mt-1">Available once Relief Status is Planned or Confirmed.</p>}
        </li>;
      })}
    </ul>}
    {query.isSuccess && stageChecks?.enforcementEnabled && stageKey && !stageCheckFor(query.data, stageKey) && stageKey === "at_sign_off" && <p className="mt-2 text-xs text-amber-900">Available once Relief Status is Planned or Confirmed.</p>}
    {query.isSuccess && stageChecks?.enforcementEnabled && blocked && <p className="mt-2 text-xs text-amber-900">
      {stageKey === "at_sign_off" && (!blockedStage || blockedStage.deferred || blockedStage.outcome === "DEFERRED") ? "Available once Relief Status is Planned or Confirmed." : `Required forms cannot be started until the ${stageNames[stageKey!] ?? "form stage"} check is completed.`}
    </p>}
    {query.isSuccess && !stageChecks?.enforcementEnabled && runs.length > 0 && <ul className="mt-3 space-y-1 text-xs text-slate-600">
      {runs.map((run, index) => <li key={`${run.stage_key}-${index}`}>
        {stageNames[run.stage_key] ?? "Form stage"} check recorded {humanDate(run.recorded_at)} · {run.outcome === "FAILED" ? "Failed" : run.outcome === "PENDING" ? "Pending" : "Completed"}
         {run.failure_reason ? ` · ${safeCompanyFormReason(run.failure_reason)}` : ""}
      </li>)}
    </ul>}
    {query.isSuccess && runs.length === 0 && !stageChecks?.enforcementEnabled && <p className="mt-2 text-xs text-slate-600">No legacy requirement check is recorded for this stage yet. Existing manual form actions remain available.</p>}
    {query.isSuccess && requirements.length === 0 && !stageChecks?.enforcementEnabled && <p className="mt-2 text-sm text-slate-600">No assigned form obligations are listed for this stage.</p>}
    {query.isSuccess && requirements.length > 0 && <ul className="mt-3 space-y-2">
      {requirements.map((requirement) => {
        const kind = statusKind(requirement.status);
        const currentSubmission = requirement.current_submission_uuid ?? requirement.existing_form?.submissionUuid ?? null;
        const origin = requirement.existing_form?.origin?.toUpperCase();
        const manualConflict = origin === "MANUAL" && Boolean(currentSubmission) && kind !== "voided";
        const displayKind = manualConflict ? "manual" : kind;
        const requirementBlocked = query.isError || stageCheckBlocksActions(query.data, requirement.stage_key);
        const startActionEligible = !manualConflict && kind !== "unresolved" && kind !== "withdrawn" && (kind === "voided" || !currentSubmission);
        const canStart = !requirementBlocked && startActionEligible;
        const canOpen = Boolean(currentSubmission && kind !== "voided" && kind !== "withdrawn");
        return <li key={requirement.requirement_uuid} className="rounded border border-sky-100 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">{requirement.form_name || "Required form"}</p>
              <p className="mt-0.5 text-xs text-slate-600">
                {stageNames[requirement.stage_key] ?? "Assignment form"}
                {requirement.version_no != null ? ` · Version ${requirement.version_no}` : ""}
                {requirement.mandatory ? " · Mandatory" : " · Optional"}
              </p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${displayKind === "completed" ? "bg-emerald-100 text-emerald-900" : displayKind === "unresolved" || displayKind === "manual" ? "bg-amber-100 text-amber-950" : "bg-slate-100 text-slate-700"}`}>
              {displayKind === "unresolved" ? "Needs attention" : displayKind === "withdrawn" ? "Withdrawn" : displayKind === "completed" ? "Completed" : displayKind === "voided" ? "Voided" : displayKind === "manual" ? "Manual form conflict" : requirement.status === "STARTED" ? "Started" : "Outstanding"}
            </span>
          </div>
          {kind === "unresolved" && <p className="mt-2 text-xs text-amber-900">{requirement.unresolved_reason ? safeCompanyFormReason(requirement.unresolved_reason) : "The obligation cannot be resolved yet."} This required form cannot be started until resolved.</p>}
          {displayKind === "manual" && <p className="mt-2 text-xs text-amber-900">An existing manual form conflicts with this obligation. Open it below; an authorized user must explicitly void it before starting a required replacement.</p>}
            {requirementBlocked && <p className="mt-2 text-xs text-amber-900">This required form remains visible, but cannot be started until its enforced stage check is completed.</p>}
          {kind === "withdrawn" && <p className="mt-2 text-xs text-slate-600">This obligation is retained for history only.</p>}
          {origin && <p className="mt-1 text-xs text-slate-500">Existing form origin: {origin === "REQUIRED" ? "Required" : "Manual"}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {canOpen && <button type="button" className="rounded border border-sky-700 px-3 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-50 disabled:opacity-50" disabled={!onOpenSubmission} onClick={() => currentSubmission && onOpenSubmission?.(currentSubmission)}>
              {manualConflict ? "Open manual form" : kind === "completed" ? "Open completed form" : "Open linked form"}
            </button>}
            {(canStart || (requirementBlocked && startActionEligible)) && allowStart && <button type="button" className="rounded bg-sky-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canStart || busyId === requirement.requirement_uuid || !onOpenSubmission} onClick={() => void start(requirement)}>
              {busyId === requirement.requirement_uuid ? "Opening…" : kind === "voided" ? "Start replacement form" : currentSubmission ? "Open current form" : "Start required form"}
            </button>}
          </div>
          {!!requirement.history?.length && <details className="mt-2 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">Requirement history</summary>
            <ul className="mt-1 space-y-1">
              {requirement.history.map((event, index) => <li key={`${event.event}-${event.recorded_at}-${index}`}>
                {historyEventLabel(event.event)} · {humanDate(event.recorded_at)}
                 {event.reason ? ` · ${safeCompanyFormReason(event.reason)}` : ""}
              </li>)}
            </ul>
          </details>}
        </li>;
      })}
    </ul>}
    {error && <p className="mt-2 text-sm text-rose-800" role="alert">{error}</p>}
  </section>;
}
