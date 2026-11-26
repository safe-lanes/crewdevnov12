import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ConfiguredFormLiveProps } from "./ConfiguredFormRenderer";
import { companyFormErrorMessage } from "@/lib/companyFormErrors";
import { DraftSaveUnconfirmedError } from "./draftSave";

export function SectionDraftActions({ sectionId, live, readOnly, requiresSubmission, companyForm, canSubmit, submitSection }: {
  sectionId: string; live?: ConfiguredFormLiveProps; readOnly: boolean;
  requiresSubmission: boolean; companyForm: boolean; canSubmit: boolean; submitSection: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: boolean }>({});
  const busy = useRef(false);
  const mounted = useRef(true);
  const allowed = useRef(!readOnly);
  allowed.current = !readOnly;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const state = live?.sectionStates?.[sectionId];
  const optIn = !!live?.draftSaveScope;
  const draft = optIn && state?.lastDraftSavedAt && state.status !== "submitted"
    && state.status !== "not_applicable" && requiresSubmission
    && live?.submissionStatus !== "completed" && live?.submissionStatus !== "voided";
  const submitting = !!live?.sectionSubmitting?.[sectionId];
  const save = async () => {
    if (busy.current || submitting || !allowed.current || !live?.onSaveDraft) return;
    busy.current = true;
    setSaving(true); setFeedback({});
    try {
      await live.onSaveDraft(sectionId);
      if (mounted.current && allowed.current && optIn) setFeedback({ success: true });
    } catch (error) {
      if (mounted.current && allowed.current) setFeedback({ error: error instanceof DraftSaveUnconfirmedError ? error.message : companyFormErrorMessage(error, "save") });
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return <div className="flex flex-wrap items-center gap-2 border-t pt-3">
    <Badge variant="outline">{state?.status === "submitted" ? "Submitted"
      : state?.status === "not_applicable" ? "Not applicable"
      : companyForm && !requiresSubmission ? "Informational" : draft ? "Draft" : "In progress"}</Badge>
    {live?.sectionOwnership?.[sectionId] && <span className="text-xs">Owner: {live.sectionOwnership[sectionId].ownerLabel}</span>}
    {state?.submittedByName && <span className="text-xs">Submitted by {state.submittedByName}</span>}
    {draft && <span className="text-xs">Last Saved by: {state?.lastDraftSavedByName || "User name unavailable"}</span>}
    {!readOnly && requiresSubmission && <>
      <Button type="button" variant="outline" size="sm" disabled={saving || submitting} onClick={() => void save()}>{saving ? "Saving…" : "Save draft"}</Button>
      {canSubmit && <Button type="button" size="sm" disabled={saving || submitting}
        onClick={() => { if (!busy.current) submitSection(); }}>{submitting ? "Submitting…" : "Submit"}</Button>}
    </>}
    {!readOnly && feedback.success && <p className="basis-full text-sm text-emerald-700" role="status">Draft saved successfully</p>}
    {!readOnly && feedback.error && <p className="basis-full text-sm text-destructive" role="alert">{feedback.error}</p>}
    {live?.sectionActionErrors?.[sectionId] && <p className="basis-full text-sm text-destructive" role="alert">{live.sectionActionErrors[sectionId]}</p>}
  </div>;
}
