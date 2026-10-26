import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type TrainingSuggestion = {
  suggestion_uuid: string;
  course_uuid: string;
  status: "SUGGESTED" | "CONFIRMED" | "DISMISSED" | "CLOSED" | "WITHDRAWN";
  target_date: string | null;
  confirmed_at: string | null;
  closed_certificate_uuid: string | null;
  gap: unknown;
  closingCertificateLabel?: string | null;
  closureReason?: string | null;
};

type TrainingNeedSuggestionProps = {
  suggestion: TrainingSuggestion;
  canCreate: boolean;
  suggestionQueryKey: unknown[];
  onSaved: (suggestion: TrainingSuggestion) => void;
};

const statusLabel: Record<TrainingSuggestion["status"], string> = {
  SUGGESTED: "Suggested",
  CONFIRMED: "Confirmed",
  CLOSED: "Closed",
  DISMISSED: "Dismissed",
  WITHDRAWN: "Withdrawn",
};

function sailDate(value: string | null) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(0);
  date.setUTCFullYear(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(Number(match[3])).padStart(2, "0")}-${months[Number(match[2]) - 1]}-${match[1]}`;
}

export function TrainingNeedSuggestion({ suggestion, canCreate, suggestionQueryKey, onSaved }: TrainingNeedSuggestionProps) {
  const queryClient = useQueryClient();
  const [dismissOpen, setDismissOpen] = useState(false);
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: async (action: "confirm" | "dismiss") => {
      const path = `/api/v2/training-needs/compliance/${encodeURIComponent(suggestion.suggestion_uuid)}/${action}`;
      const response = await apiRequest("POST", path, action === "dismiss" ? { reason: reason.trim() } : {});
      return await response.json() as TrainingSuggestion;
    },
    onSuccess: saved => {
      queryClient.setQueryData<{ suggestions: TrainingSuggestion[]; canCreate: boolean }>(suggestionQueryKey, current => current
        ? { ...current, suggestions: current.suggestions.map(item => item.suggestion_uuid === saved.suggestion_uuid ? saved : item) }
        : current);
      onSaved(saved);
      queryClient.invalidateQueries({ queryKey: suggestionQueryKey });
      queryClient.invalidateQueries({ queryKey: ["/api/v2/training-needs"] });
      setDismissOpen(false);
      setReason("");
    },
  });

  const actionable = canCreate && suggestion.status === "SUGGESTED";
  const date = sailDate(suggestion.target_date);
  const gapText = typeof suggestion.gap === "string" ? suggestion.gap : null;

  return (
    <div className="mt-2 rounded border border-sky-200 bg-sky-50/70 px-2.5 py-2 text-xs" data-testid={`training-need-suggestion-${suggestion.course_uuid}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-sky-900">{statusLabel[suggestion.status]}</span>
        <span className="text-slate-600">Pre-joining compliance</span>
        {date && <span className="text-slate-700">Target {date}</span>}
      </div>
      {(suggestion.status === "CLOSED" && suggestion.closed_certificate_uuid) && (
        <p className="mt-1 text-slate-600">Certificate: {suggestion.closingCertificateLabel || "Qualifying certificate recorded in history"}</p>
      )}
      {suggestion.status === "CLOSED" && suggestion.closureReason && <p className="mt-1 text-slate-600">{suggestion.closureReason}</p>}
      {suggestion.status === "CLOSED" && gapText && <p className="mt-1 text-slate-600">{gapText}</p>}
      {mutation.isError && <p className="mt-1 text-rose-800" role="alert">The training need could not be updated. Please try again.</p>}
      {actionable && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Button type="button" size="sm" className="h-7 px-2.5 text-xs" disabled={mutation.isPending} onClick={() => mutation.mutate("confirm")} data-testid={`training-suggestion-confirm-${suggestion.course_uuid}`}>Confirm</Button>
          <Button type="button" size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={mutation.isPending} onClick={() => setDismissOpen(true)} data-testid={`training-suggestion-dismiss-${suggestion.course_uuid}`}>Dismiss</Button>
        </div>
      )}
      <Dialog open={dismissOpen} onOpenChange={open => { if (!open && !mutation.isPending) setDismissOpen(false); }}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader><DialogTitle>Dismiss training suggestion</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`dismiss-reason-${suggestion.suggestion_uuid}`}>Reason</Label>
            <Textarea id={`dismiss-reason-${suggestion.suggestion_uuid}`} value={reason} onChange={event => setReason(event.target.value)} required maxLength={2000} aria-describedby={`dismiss-help-${suggestion.suggestion_uuid}`} />
            <p id={`dismiss-help-${suggestion.suggestion_uuid}`} className="text-xs text-slate-600">Enter a reason to dismiss this suggestion.</p>
            {mutation.isError && <p className="text-sm text-rose-800" role="alert">The suggestion could not be dismissed. Please try again.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setDismissOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!reason.trim() || mutation.isPending} onClick={() => mutation.mutate("dismiss")}>Dismiss suggestion</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
