import React, { useEffect, useRef, useState } from "react";
import { sailDate } from "@shared/v2/forms-engine/displayFormatting";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { CompanySubmissionRenderer } from "@/components/configured-form/companySubmissionContract";
import type { CompanyFormSubmissionSummary } from "@shared/v2/forms-engine/submissionRenderContract";

type EligibleForm = {
  formUuid: string;
  formName: string;
  formVersionUuid: string;
  versionNo: string;
  stageKey: string;
};
type Context = {
  planUuid: string;
  assignmentUuid: string;
  crewUuid: string;
  vesselUuid: string;
};

async function read<T>(path: string): Promise<T> {
  return (await apiRequest("GET", path)).json();
}

/** Never discover a subject by crew, vessel, rank or a current-assignment query. */
export async function verifyJoiningAssignment(context: Context) {
  const planning = await read<{
    relieverAssignUuid: string | null;
    relieverCrewUuid: string | null;
    vesselUuid: string;
    isDeleted?: boolean;
    isArchived?: boolean;
    isRelieverArchived?: boolean;
  }>(`/api/v2/vessel/planning/${encodeURIComponent(context.planUuid)}`);
  if (planning.relieverAssignUuid !== context.assignmentUuid ||
      planning.relieverCrewUuid !== context.crewUuid ||
      planning.vesselUuid !== context.vesselUuid ||
      planning.isDeleted || planning.isArchived || planning.isRelieverArchived) {
    throw new Error("This planning association has changed or is unavailable. Close and reopen the reliever popup; no assignment will be inferred.");
  }
  const assignment = await read<{
    assignUuid: string;
    crewUuid: string;
    vesselUuid: string;
    assignmentType: string;
  }>(`/api/v2/vessel/planning/${encodeURIComponent(context.planUuid)}/reliever-assignment/${encodeURIComponent(context.assignmentUuid)}`);
  if (assignment.assignUuid !== context.assignmentUuid ||
      assignment.crewUuid !== context.crewUuid ||
      assignment.vesselUuid !== context.vesselUuid ||
      !["Planned", "OnBoard"].includes(assignment.assignmentType)) {
    throw new Error("The recorded assignment is not a valid deployed reliever assignment. Starting a declaration is unavailable.");
  }
  return assignment;
}

export function JoiningCompanyForms(context: Context) {
  const identity = `${context.planUuid}:${context.assignmentUuid}:${context.crewUuid}:${context.vesselUuid}`;
  return <JoiningCompanyFormsSession key={identity} context={context} />;
}

function JoiningCompanyFormsSession({ context }: { context: Context }) {
  const [selectedVersion, setSelectedVersion] = useState("");
  const [activeSubmission, setActiveSubmission] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previouslyVerified, setPreviouslyVerified] = useState(false);
  const mounted = useRef(true);
  const creating = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const subjectPath = `/api/v2/company-form-submissions/subjects/crew_assignment/${encodeURIComponent(context.assignmentUuid)}`;
  const hasLink = Boolean(context.planUuid && context.assignmentUuid && context.crewUuid && context.vesselUuid);
  const verification = useQuery({
    queryKey: ["joining-company-form-context", context],
    queryFn: () => verifyJoiningAssignment(context),
    enabled: hasLink,
    retry: false,
    staleTime: 0,
  });
  useEffect(() => {
    if (verification.isSuccess && verification.isFetchedAfterMount && !verification.isFetching) setPreviouslyVerified(true);
  }, [verification.isSuccess, verification.isFetchedAfterMount, verification.isFetching]);
  const eligible = useQuery({
    queryKey: ["joining-company-form-eligible", context.assignmentUuid],
    queryFn: () => read<EligibleForm[]>(`${subjectPath}/eligible-forms?stageKey=before_joining`),
    enabled: previouslyVerified && verification.isSuccess && !verification.isFetching,
    retry: false,
    staleTime: 0,
  });
  // Historical reads remain independent of today's eligible catalogue.
  const history = useQuery({
    queryKey: ["joining-company-form-history", context.assignmentUuid],
    queryFn: () => read<{ submissions: CompanyFormSubmissionSummary[] }>(`${subjectPath}/submissions`),
    enabled: previouslyVerified,
    retry: false,
    staleTime: 0,
  });
  const forms = eligible.data ?? [];
  const submissions = previouslyVerified && history.isSuccess
    ? (history.data?.submissions ?? []).filter(s => s.stageKey === "before_joining") : [];
  const chosen = forms.find((form) => form.formVersionUuid === selectedVersion);
  const existing = chosen && submissions.find((s) => s.formUuid === chosen.formUuid && s.status !== "voided");
  const ready = previouslyVerified && verification.isSuccess && !verification.isFetching &&
    eligible.isSuccess && !eligible.isFetching && history.isSuccess && !history.isFetching;

  async function startOrResume() {
    if (!chosen || !ready || creating.current) return;
    creating.current = true;
    setBusy(true);
    setActionError(null);
    try {
      // Revalidate live association immediately before a write; cached context
      // must never authorize starting on a cleared or switched reliever.
      await verifyJoiningAssignment(context);
      const current = await read<{ submissions: CompanyFormSubmissionSummary[] }>(`${subjectPath}/submissions`);
      const parent = current.submissions.find((s) => s.stageKey === "before_joining" && s.formUuid === chosen.formUuid && s.status !== "voided");
      const result = parent ?? await (await apiRequest("POST", `${subjectPath}/submissions`, {
        formUuid: chosen.formUuid,
        formVersionUuid: chosen.formVersionUuid,
      })).json() as CompanyFormSubmissionSummary;
      if (!result.submissionUuid) throw new Error("The submission service did not return a declaration identity.");
      if (mounted.current) setActiveSubmission(result.submissionUuid);
    } catch (error) {
      if (mounted.current) setActionError(error instanceof Error ? error.message : "Unable to open this declaration.");
    } finally {
      creating.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (activeSubmission) return <CompanySubmissionRenderer
    key={activeSubmission}
    submissionUuid={activeSubmission}
    entryStage={{ stageKey: "before_joining", submissionUuids: submissions.map(s => s.submissionUuid) }}
    onBack={() => { setActiveSubmission(null); void history.refetch(); void verification.refetch(); }}
  />;

  return <div className="space-y-4" data-testid="joining-company-forms">
    <p className="text-sm text-muted-foreground">
      Before-joining Company Forms
    </p>
    {!hasLink && <p role="alert">No recorded reliever assignment is linked. Reconciliation is required; starting a declaration is disabled.</p>}
    {verification.isFetching && <p role="status">Verifying the recorded planning assignment…</p>}
    {verification.error && <p role="alert" className="text-destructive">{verification.error.message}</p>}
    {eligible.error && <p role="alert" className="text-destructive">{eligible.error.message}</p>}
    {history.error && <p role="alert" className="text-destructive">{history.error.message}</p>}
    {eligible.isFetching && <p role="status">Loading released before-joining forms…</p>}
    {ready && forms.length === 0 && <p>No released, lifecycle-valid before-joining forms are eligible for this assignment.</p>}
    {ready && forms.length > 0 && <div className="space-y-2">
      <label htmlFor="joining-form-version" className="text-sm font-medium">Select a released form and version</label>
      <select id="joining-form-version" data-testid="select-joining-form-version"
        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        value={selectedVersion} onChange={(event) => setSelectedVersion(event.target.value)} disabled={busy}>
        <option value="">Select a form…</option>
        {forms.map((form) => <option key={form.formVersionUuid} value={form.formVersionUuid}>{form.formName} — version {form.versionNo}</option>)}
      </select>
      <Button type="button" data-testid="button-start-joining-form" disabled={!chosen || busy}
        onClick={() => void startOrResume()}>
        {busy ? "Opening…" : existing ? "Open existing declaration" : "Start selected declaration"}
      </Button>
    </div>}
    {actionError && <p role="alert" className="text-destructive">{actionError}</p>}
    <section className="space-y-2">
      <h3 className="font-medium">Declarations and retained history</h3>
      {history.isFetching && <p role="status">Loading declarations…</p>}
      {history.isSuccess && submissions.length === 0 && <p className="text-sm text-muted-foreground">No declarations have been started for this assignment.</p>}
      {submissions.map((submission) => <div key={submission.submissionUuid} className="rounded-md border p-3 text-sm">
        <div>{submission.formName ?? forms.find((form) => form.formUuid === submission.formUuid)?.formName ?? "Company declaration"} · {submission.status}</div>
        <div className="text-muted-foreground">Version {submission.versionNo?.padStart(2, "0") ?? "unavailable"} · Released {sailDate(submission.releasedAt)}</div>
        <div className="text-muted-foreground">{submission.stageLabel ?? "Stage unavailable"}</div>
        {submission.replacementHistory?.filter(link => submissions.some(s => s.submissionUuid === link.submissionUuid)).map(link => <div key={link.submissionUuid}>
          {link.label} <button type="button" className="text-primary underline"
            onClick={() => setActiveSubmission(link.submissionUuid)}>
            {link.targetLabel || "Open linked declaration — historical label unavailable"}</button>
        </div>)}
        <Button type="button" variant="outline" className="mt-2"
          onClick={() => setActiveSubmission(submission.submissionUuid)}>
          {submission.status === "in_progress" && submission.canEdit !== false ? "Resume declaration" : "Read declaration"}
        </Button>
      </div>)}
    </section>
    <Button type="button" variant="outline" disabled={busy} onClick={() => {
      void verification.refetch(); void history.refetch(); void eligible.refetch();
    }}>Refresh joining forms</Button>
  </div>;
}