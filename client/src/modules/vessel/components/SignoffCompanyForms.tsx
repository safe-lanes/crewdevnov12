import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { sailDate } from "@shared/v2/forms-engine/displayFormatting";
import { apiRequest } from "@/lib/queryClient";
import { companyFormErrorMessage } from "@/lib/companyFormErrors";
import { Button } from "@/components/ui/button";
import { CompanySubmissionRenderer } from "@/components/configured-form/companySubmissionContract";
import type { CompanyFormSubmissionSummary } from "@shared/v2/forms-engine/submissionRenderContract";
import { AssignmentFormRequirements } from "@/modules/crew-pool/components/AssignmentFormRequirements";
import { stageCheckBlocksActions, stageCheckFor, useAssignmentFormRequirements } from "@/modules/crew-pool/components/assignmentFormRequirementsQuery";

type EligibleForm = {
  formUuid: string;
  formName: string;
  formVersionUuid: string;
  versionNo: string;
  stageKey: string;
};

export type SignoffCompanyFormsContext = {
  planUuid: string;
  assignmentUuid: string;
  crewUuid: string;
  vesselUuid: string;
};

async function read<T>(path: string): Promise<T> {
  return (await apiRequest("GET", path)).json();
}

function subjectPath(context: SignoffCompanyFormsContext, suffix = "", stageKey?: string) {
  const params = new URLSearchParams({
    crewUuid: context.crewUuid,
    planUuid: context.planUuid,
    vesselUuid: context.vesselUuid,
  });
  if (stageKey) params.set("stageKey", stageKey);
  return `/api/v2/company-form-submissions/subjects/crew_assignment/${encodeURIComponent(context.assignmentUuid)}${suffix}?${params.toString()}`;
}

/** Verify only the incumbent assignment explicitly persisted on this planning row. */
export async function verifySignoffAssignment(context: SignoffCompanyFormsContext) {
  if (!context.planUuid || !context.assignmentUuid || !context.crewUuid || !context.vesselUuid) {
    throw new Error("No exact onboard assignment is linked to this planning row. An administrator must reconcile the assignment before forms can be opened.");
  }
  const planning = await read<{
    crewAssignUuid?: string | null;
    crewUuid?: string | null;
    vesselUuid?: string | null;
    isDeleted?: boolean;
    isArchived?: boolean;
    signOffDate?: string | null;
  }>(`/api/v2/vessel/planning/${encodeURIComponent(context.planUuid)}`);
  if (
    planning.crewAssignUuid !== context.assignmentUuid ||
    planning.crewUuid !== context.crewUuid ||
    planning.vesselUuid !== context.vesselUuid ||
    planning.isDeleted ||
    planning.isArchived
  ) {
    throw new Error("The onboard assignment is stale, archived, deleted, or already signed off. Close and reopen the popup; no assignment will be inferred.");
  }
  // Planning can carry a proposed date while its exact assignment is aboard.
  // The submission endpoints independently verify the authoritative assignment.
  return planning;
}

export function SignoffCompanyForms(context: SignoffCompanyFormsContext) {
  const identity = `${context.planUuid}:${context.assignmentUuid}:${context.crewUuid}:${context.vesselUuid}`;
  return <SignoffCompanyFormsSession key={identity} context={context} />;
}

function SignoffCompanyFormsSession({ context }: { context: SignoffCompanyFormsContext }) {
  const [selectedVersion, setSelectedVersion] = useState("");
  const [activeSubmission, setActiveSubmission] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previouslyVerified, setPreviouslyVerified] = useState(false);
  const mounted = useRef(true);
  const creating = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const hasLink = Boolean(context.planUuid && context.assignmentUuid && context.crewUuid && context.vesselUuid);
  const verification = useQuery({
    queryKey: ["signoff-company-form-context", context],
    queryFn: () => verifySignoffAssignment(context),
    enabled: hasLink,
    retry: false,
    staleTime: 0,
  });
  const assignmentRequirements = useAssignmentFormRequirements(context.assignmentUuid, previouslyVerified);
  const signoffCheck = stageCheckFor(assignmentRequirements.data, "at_sign_off");
  const formStageBlocked = !previouslyVerified || assignmentRequirements.isLoading || assignmentRequirements.isError ||
    stageCheckBlocksActions(assignmentRequirements.data, "at_sign_off");
  const formStageMessage = !previouslyVerified
    ? "Manual form selection is available after the incumbent assignment is verified."
    : assignmentRequirements.isError
      ? "Form stage availability could not be verified. Manual form selection is disabled until the check can be loaded."
      : assignmentRequirements.isLoading
        ? "Checking at-sign-off form stage availability…"
        : !signoffCheck || signoffCheck.deferred || signoffCheck.outcome === "DEFERRED"
          ? "Available once Relief Status is Planned or Confirmed."
          : "Manual form selection is unavailable until the enforced at-sign-off check is completed.";
  useEffect(() => {
    if (verification.isSuccess && verification.isFetchedAfterMount && !verification.isFetching) setPreviouslyVerified(true);
  }, [verification.isSuccess, verification.isFetchedAfterMount, verification.isFetching]);

  const eligible = useQuery({
    queryKey: ["signoff-company-form-eligible", context],
    queryFn: () => read<EligibleForm[]>(subjectPath(context, "/eligible-forms", "at_sign_off")),
    enabled: previouslyVerified && verification.isSuccess && !verification.isFetching,
    retry: false,
    staleTime: 0,
  });
  const history = useQuery({
    queryKey: ["signoff-company-form-history", context],
    queryFn: () => read<{ submissions: CompanyFormSubmissionSummary[] }>(subjectPath(context, "/submissions")),
    enabled: previouslyVerified,
    retry: false,
    staleTime: 0,
  });

  const forms = eligible.data ?? [];
  const submissions = previouslyVerified && history.isSuccess
    ? (history.data?.submissions ?? []).filter(s => s.stageKey === "at_sign_off") : [];
  const chosen = forms.find((form) => form.formVersionUuid === selectedVersion);
  const existing = chosen && submissions.find((submission) =>
    submission.formUuid === chosen.formUuid &&
    submission.stageKey === "at_sign_off" &&
    submission.status !== "voided",
  );
  const ready = previouslyVerified && verification.isSuccess && !verification.isFetching &&
    eligible.isSuccess && !eligible.isFetching && history.isSuccess && !history.isFetching;

  async function startOrResume() {
    if (!chosen || !ready || formStageBlocked || creating.current) return;
    creating.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await verifySignoffAssignment(context);
      const current = await read<{ submissions: CompanyFormSubmissionSummary[] }>(subjectPath(context, "/submissions"));
      const parent = current.submissions.find((submission) =>
        submission.formUuid === chosen.formUuid &&
        submission.stageKey === "at_sign_off" &&
        submission.status !== "voided",
      );
      const result = parent ?? await (await apiRequest("POST", subjectPath(context, "/submissions"), {
        formUuid: chosen.formUuid,
        formVersionUuid: chosen.formVersionUuid,
      })).json() as CompanyFormSubmissionSummary;
      if (!result.submissionUuid) throw new Error("The form service did not return a submission link.");
      if (mounted.current) setActiveSubmission(result.submissionUuid);
    } catch (error) {
      if (mounted.current) setActionError(companyFormErrorMessage(error, "start"));
    } finally {
      creating.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (activeSubmission) {
    return <CompanySubmissionRenderer
      key={activeSubmission}
      submissionUuid={activeSubmission}
      entryStage={{ stageKey: "at_sign_off", submissionUuids: submissions.map(s => s.submissionUuid) }}
      requestContext={{ crewUuid: context.crewUuid, planUuid: context.planUuid, vesselUuid: context.vesselUuid }}
      onBack={() => {
        setActiveSubmission(null);
        void history.refetch();
        void verification.refetch();
      }}
    />;
  }

  return <section className="space-y-4 rounded-md border border-[#d5e0eb] bg-[#f7f9fb] p-4" data-testid="signoff-company-forms">
    <div>
      <h3 className="font-medium text-[#16569e]">Planning at-sign-off forms</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Manual forms for the recorded onboard assignment.
      </p>
    </div>
    {!hasLink && <p role="alert" className="text-sm text-destructive">No exact onboard assignment is linked. Assignment reconciliation is required; no assignment will be inferred.</p>}
    {verification.isFetching && <p role="status" className="text-sm">Verifying the incumbent planning assignment…</p>}
    {verification.error && <p role="alert" className="text-sm text-destructive">{companyFormErrorMessage(verification.error, "verifyAssignment")}</p>}
    {eligible.error && <p role="alert" className="text-sm text-destructive">{companyFormErrorMessage(eligible.error, "loadEligible")}</p>}
    {history.error && <p role="alert" className="text-sm text-destructive">{companyFormErrorMessage(history.error, "loadHistory")}</p>}
    {formStageBlocked && <p role={assignmentRequirements.isError ? "alert" : "status"} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{formStageMessage}</p>}
    {eligible.isFetching && <p role="status" className="text-sm">Loading released at-sign-off forms…</p>}
    {ready && !formStageBlocked && forms.length === 0 && <p className="text-sm text-muted-foreground">No released, lifecycle-valid at-sign-off forms are eligible for this assignment.</p>}
    {ready && (forms.length > 0 || formStageBlocked) && <div className="space-y-2">
      <label htmlFor="signoff-form-version" className="text-sm font-medium">Select a released form and version</label>
      <select id="signoff-form-version" data-testid="select-signoff-form-version"
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={selectedVersion} onChange={(event) => setSelectedVersion(event.target.value)} disabled={busy || formStageBlocked}>
        <option value="">Select a form…</option>
        {forms.map((form) => <option key={form.formVersionUuid} value={form.formVersionUuid}>{form.formName} — version {form.versionNo}</option>)}
      </select>
      <Button type="button" data-testid="button-start-signoff-form" disabled={!chosen || busy || formStageBlocked} onClick={() => void startOrResume()}>
        {busy ? "Opening…" : existing ? "Open existing form" : "Start selected form"}
      </Button>
    </div>}
    {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
    <section className="space-y-2">
      {previouslyVerified && <AssignmentFormRequirements subjectRef={context.assignmentUuid} stageKey="at_sign_off" onOpenSubmission={setActiveSubmission} beforeStart={() => verifySignoffAssignment(context)} />}
      <h4 className="font-medium">Saved forms and retained history</h4>
      {history.isFetching && <p role="status" className="text-sm">Loading saved forms…</p>}
      {history.isSuccess && submissions.length === 0 && <p className="text-sm text-muted-foreground">No forms have been started for this assignment.</p>}
      {submissions.map((submission) => <div key={submission.submissionUuid} className="rounded-md border bg-background p-3 text-sm">
        <div>{submission.formName ?? forms.find((form) => form.formUuid === submission.formUuid)?.formName ?? "Company form"} · {submission.status}</div>
        {submission.origin && <span className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{submission.origin === "REQUIRED" ? "Required" : "Manual"}</span>}
        <div className="text-muted-foreground">Version {submission.versionNo?.padStart(2, "0") ?? "unavailable"} · Released {sailDate(submission.releasedAt)}</div>
        <div className="text-muted-foreground">{submission.stageLabel ?? "Stage unavailable"}</div>
        {submission.replacementHistory?.filter(link => submissions.some(s => s.submissionUuid === link.submissionUuid)).map((link) => <div key={link.submissionUuid}>
          {link.label} <button type="button" className="text-primary underline" onClick={() => setActiveSubmission(link.submissionUuid)}>
            {link.targetLabel || "Open linked form — historical label unavailable"}
          </button>
        </div>)}
        <Button type="button" variant="outline" className="mt-2" onClick={() => setActiveSubmission(submission.submissionUuid)}>
          {submission.status === "in_progress" && submission.canEdit !== false ? "Resume form" : "Read form"}
        </Button>
      </div>)}
    </section>
    <Button type="button" variant="outline" disabled={busy} onClick={() => {
      void verification.refetch();
      void history.refetch();
      void eligible.refetch();
    }}>Refresh at-sign-off forms</Button>
  </section>;
}