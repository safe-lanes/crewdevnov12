import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { companyFormErrorMessage } from "@/lib/companyFormErrors";
import { Button } from "@/components/ui/button";
import { CompanySubmissionRenderer } from "@/components/configured-form/companySubmissionContract";
import { sailDate } from "@shared/v2/forms-engine/displayFormatting";
import type { CompanyFormSubmissionSummary } from "@shared/v2/forms-engine/submissionRenderContract";
import { AssignmentFormRequirements } from "@/modules/crew-pool/components/AssignmentFormRequirements";
import { stageCheckBlocksActions, useAssignmentFormRequirements } from "@/modules/crew-pool/components/assignmentFormRequirementsQuery";

export function useOnboardFormCounts(refs: Array<string | null | undefined>) {
  const ids = [...new Set(refs.filter((ref): ref is string => !!ref))].sort();
  return useQuery<Record<string, number>>({
    queryKey: ["onboard-company-form-counts", ids], enabled: ids.length > 0, retry: false,
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (let i = 0; i < ids.length; i += 200) {
        Object.assign(counts, await (await apiRequest("POST",
          "/api/v2/company-form-submissions/subjects/crew_assignment/submission-counts",
          { subjectRefs: ids.slice(i, i + 200), stageKey: "on_board" })).json());
      }
      if (ids.some(id => typeof counts[id] !== "number")) throw new Error("The form count response is incomplete.");
      return counts;
    },
  });
}

type Eligible = { formUuid: string; formVersionUuid: string; formName: string; versionNo: string };
export function OnboardCompanyForms({ assignmentUuid, readOnly = false }: { assignmentUuid: string; readOnly?: boolean }) {
  const client = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assignmentRequirements = useAssignmentFormRequirements(assignmentUuid, !readOnly);
  const formStageBlocked = readOnly || assignmentRequirements.isLoading || assignmentRequirements.isError ||
    stageCheckBlocksActions(assignmentRequirements.data, "on_board");
  const path = `/api/v2/company-form-submissions/subjects/crew_assignment/${encodeURIComponent(assignmentUuid)}`;
  const history = useQuery({
    queryKey: ["onboard-company-form-history", assignmentUuid], retry: false, staleTime: 0,
    queryFn: async () => (await apiRequest("GET", `${path}/submissions`)).json() as Promise<{ submissions: CompanyFormSubmissionSummary[] }>,
  });
  const eligible = useQuery({
    queryKey: ["onboard-company-form-eligible", assignmentUuid], retry: false, staleTime: 0, enabled: !readOnly,
    queryFn: async () => (await apiRequest("GET", `${path}/eligible-forms?stageKey=on_board`)).json() as Promise<Eligible[]>,
  });
  const submissions = (history.data?.submissions ?? []).filter(s => s.stageKey === "on_board");
  const changed = () => {
    void history.refetch();
    void client.invalidateQueries({ queryKey: ["onboard-company-form-counts"] });
  };
  if (active) return <CompanySubmissionRenderer key={active} submissionUuid={active}
    entryStage={{ stageKey: "on_board", submissionUuids: submissions.map(s => s.submissionUuid) }}
    onBack={() => { setActive(null); changed(); }} />;
  const chosen = eligible.data?.find(form => form.formVersionUuid === selected);
  const existing = chosen && submissions.find(s => s.formUuid === chosen.formUuid && s.status !== "voided");
  return <div className="space-y-4" data-testid="onboard-company-forms">
    <p className="text-sm text-muted-foreground">{readOnly ? "Historical assignment · read-only" : "On-board Company Forms"}</p>
    {history.isFetching && <p role="status">Loading saved forms…</p>}
    {history.error && <p role="alert" className="text-destructive">{companyFormErrorMessage(history.error, "loadHistory")}</p>}
    {eligible.error && <p role="alert" className="text-destructive">{companyFormErrorMessage(eligible.error, "loadEligible")}</p>}
    {!readOnly && history.isSuccess && eligible.isSuccess && <div className="space-y-2">
      <label className="block text-sm font-medium" htmlFor="onboard-form-version">Select a released on-board form</label>
      <select id="onboard-form-version" data-testid="select-onboard-form-version" className="h-10 w-full rounded-md border px-3 text-sm"
        value={selected} onChange={e => setSelected(e.target.value)} disabled={busy || formStageBlocked}>
        <option value="">Select a form…</option>
        {eligible.data.map(form => <option key={form.formVersionUuid} value={form.formVersionUuid}>{form.formName} — version {form.versionNo}</option>)}
      </select>
      {!eligible.data.length && !formStageBlocked && <p>No released, lifecycle-valid on-board forms are eligible.</p>}
      {formStageBlocked && <p role={assignmentRequirements.isError ? "alert" : "status"} className="text-sm text-amber-900">
        {assignmentRequirements.isError
          ? "Form stage availability could not be verified. Form selection is disabled until the check can be loaded."
          : assignmentRequirements.isLoading
            ? "Checking on-board form stage availability…"
            : "Form selection is unavailable until the enforced on-board check is completed."}
      </p>}
      <Button data-testid="button-start-onboard-form" disabled={!chosen || busy || formStageBlocked} onClick={async () => {
        if (!chosen || busy || formStageBlocked) return;
        setBusy(true); setError(null);
        try {
          const current = (await (await apiRequest("GET", `${path}/submissions`)).json()).submissions as CompanyFormSubmissionSummary[];
          const saved = current.find(s => s.stageKey === "on_board" && s.formUuid === chosen.formUuid && s.status !== "voided");
          const result = saved ?? await (await apiRequest("POST", `${path}/submissions`,
            { formUuid: chosen.formUuid, formVersionUuid: chosen.formVersionUuid })).json();
          if (!result.submissionUuid) throw new Error("No form submission link was returned.");
          setActive(result.submissionUuid); changed();
        } catch (err) { setError(companyFormErrorMessage(err, "start")); }
        finally { setBusy(false); }
      }}>{busy ? "Opening…" : existing ? "Open existing form" : "Start selected form"}</Button>
    </div>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <AssignmentFormRequirements subjectRef={assignmentUuid} stageKey="on_board" onOpenSubmission={setActive} allowStart={!readOnly} />
    <h3 className="font-medium">Saved forms and retained history (total including voided: {submissions.length})</h3>
    {history.isSuccess && !submissions.length && <p>No on-board forms have been started.</p>}
    {submissions.map(s => <div key={s.submissionUuid} className="rounded-md border p-3 text-sm">
      <p>{s.formName || "Company form"} · {s.status}</p>
      {s.origin && <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{s.origin === "REQUIRED" ? "Required" : "Manual"}</span>}
      <p>Version {s.versionNo?.padStart(2, "0") || "unavailable"} · Released {sailDate(s.releasedAt)}</p>
      <p>{s.systemSnapshotAt ? "Form recorded" : "Created"} {sailDate(s.systemSnapshotAt ?? s.createdAt)}</p>
      {s.status === "voided" && s.formArchivedAt && !s.replacedBySubmissionUuid &&
        <p>No replacement — form retired</p>}
      {s.replacementHistory?.filter(link => submissions.some(s => s.submissionUuid === link.submissionUuid)).map(link => <p key={link.submissionUuid}>{link.label}{" "}
        <button className="text-primary underline" onClick={() => setActive(link.submissionUuid)}>
          {link.targetLabel || "Open linked form — historical label unavailable"}</button></p>)}
      <Button variant="outline" className="mt-2" onClick={() => setActive(s.submissionUuid)}>
        {s.canEdit && !readOnly ? "Resume form" : "Read form"}</Button>
    </div>)}
    <Button variant="outline" onClick={() => { changed(); if (!readOnly) void eligible.refetch(); }}>Refresh forms</Button>
  </div>;
}